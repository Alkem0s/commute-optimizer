import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import admin from 'firebase-admin';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

const serviceAccountPath = path.join(__dirname, "c-o.json");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')))
});

const db = admin.firestore();

ipcMain.handle('run-optimizer', async (_, input) => {
  return new Promise((resolve, reject) => {
    const optimizerPath = process.env.NODE_ENV === 'development'
      ? path.join(
          __dirname, 
          'route_optimizer' + (process.platform === 'win32' ? '.exe' : '')
        )
      : path.join(
          process.resourcesPath,
          'executables',
          'route_optimizer' + (process.platform === 'win32' ? '.exe' : '')
        );

    const optimizerProcess = spawn(optimizerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let result = '';
    let errorOutput = '';

    optimizerProcess.stdin.write(JSON.stringify(input), 'utf-8');
    optimizerProcess.stdin.end();

    optimizerProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    optimizerProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    optimizerProcess.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(result));
        } catch (e) {
          console.error("Optimizer output:", result);  // Log raw output
          reject(new Error(`Output parsing failed: ${e.message}`));
        }
      } else {
        // Add detailed error diagnostics:
        const errorMsg = `Optimizer failed (code ${code}): ${errorOutput || 'No error output'}\n`;
        console.error("Optimizer stderr:", errorOutput);
        console.error("Optimizer stdout:", result);
        reject(new Error(errorMsg));
      }
    });

    optimizerProcess.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error('Optimizer executable not found. Check packaging configuration.'));
      } else {
        reject(err);
      }
    });
  });
});

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      enableRemoteModule: false, // Disable remote module for security
      sandbox: true, // Enable sandboxing for additional security
    },
  });

  mainWindow.loadFile("index.html");
});

ipcMain.handle("get-api-key", async () => {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
    return config.API_KEY;
  } catch (error) {
    console.error("Error reading API key:", error);
    return null;
  }
});

ipcMain.handle('firebase:addData', async (event, collectionName, data) => {
  try {
    const docRef = await db.collection(collectionName).add(data);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding data to Firestore:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('firebase:getData', async (event, collectionName) => {
  try {
    const snapshot = await db.collection(collectionName).get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching data from Firestore:", error);
    return { success: false, error: error.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});