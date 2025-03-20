const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const apiCounter = require('./api-call-counter');
const admin = require("firebase-admin");

let mainWindow;

// Replace this with the actual path to your service account key JSON file
const serviceAccountPath = path.join(__dirname, "c-o.json");

// Initialize Firebase Admin SDK with the service account
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore(); // Access Firestore

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

  // Reset API call counters when the app is ready
  apiCounter.resetPeriodCounters();

  // Set API call limits
  apiCounter.setLimit('directions', 2500, 'daily');
  apiCounter.setLimit('geocoding', 2000, 'daily');
});

// Listen for API usage warnings
ipcMain.on('api-limit-warning', (data) => {
  console.warn(`API usage warning: ${data.endpoint} at ${data.usage}/${data.limit}`);
});

// Handle request for API key from renderer process
ipcMain.handle("get-api-key", async () => {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
    return config.API_KEY;
  } catch (error) {
    console.error("Error reading API key:", error);
    return null;
  }
});

// Firestore interaction: Add data to Firestore
ipcMain.handle('firebase:addData', async (event, collectionName, data) => {
  try {
    const docRef = await db.collection(collectionName).add(data);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding data to Firestore:", error);
    return { success: false, error: error.message };
  }
});

// Firestore interaction: Fetch data from Firestore
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

// Sample API call (as you had in your example)
function getDirections(origin, destination) {
  apiCounter.recordCall('directions', {
    cost: 1,
    details: `Route from ${origin} to ${destination}`
  });
  // Perform the actual API call (not implemented here)
}
