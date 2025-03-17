const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const apiCounter = require('./api-call-counter');
//const {} = require('./classes');
//const {} = require('./global');

let mainWindow;

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

app.on("ready", () => {
  ipcMain.handle("get-api-key", async () => {
    try {
      const configPath = path.join(__dirname, "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return config.API_KEY;
    } catch (error) {
      console.error("Error reading API key:", error);
      return null;
    }
  });
  apiCounter.resetPeriodCounters();
});

apiCounter.setLimit('directions', 2500, 'daily');
apiCounter.setLimit('geocoding', 2000, 'daily');

ipcMain.on('api-limit-warning', (data) => {
    console.warn(`API usage warning: ${data.endpoint} at ${data.usage}/${data.limit}`);
  });
  
  // In your code that makes API calls
  function getDirections(origin, destination) {
    // Record the API call
    apiCounter.recordCall('directions', { 
      cost: 1, 
      details: `Route from ${origin} to ${destination}` 
    });
    
    // Make the actual API call
    // ...
  }