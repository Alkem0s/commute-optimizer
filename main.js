import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

const serviceAccountPath = path.join(__dirname, "c-o.json");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')))
});

const db = admin.firestore();

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");

  apiCounter.resetPeriodCounters();
  apiCounter.setLimit('directions', 2500, 'daily');
  apiCounter.setLimit('geocoding', 2000, 'daily');
});

ipcMain.on('api-limit-warning', (event, data) => {
  console.warn(`API usage warning: ${data.endpoint} at ${data.usage}/${data.limit}`);
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

function getDirections(origin, destination) {
  apiCounter.recordCall('directions', {
    cost: 1,
    details: `Route from ${origin} to ${destination}`
  });
  // Perform the actual API call (not implemented here)
}