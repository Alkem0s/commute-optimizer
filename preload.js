const { contextBridge, ipcRenderer } = require("electron");

// Expose existing functionality for global data, API keys, and communication
contextBridge.exposeInMainWorld(
  'electron', {
    requestGlobalData: () => ipcRenderer.send('request-global-data'),
    onReceiveGlobalData: (callback) => ipcRenderer.on('send-global-data', callback),
  }
);

contextBridge.exposeInMainWorld(
  'api', {
    getApiKey: () => ipcRenderer.invoke("get-api-key"),
    send: (channel, data) => {
      // Whitelist channels
      let validChannels = ['navigate', 'newWindow', 'log'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['go-back', 'go-forward', 'reload', 'go-home', 'toggle-dev-tools'];
      if (validChannels.includes(channel)) {
        // Remove the event to avoid memory leaks
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    log: (message) => {
      ipcRenderer.send('log', message);
    }
  }
);

// Expose Firestore functionality to the renderer process (via IPC)
contextBridge.exposeInMainWorld(
  'firebaseAPI', {
    addData: async (collectionName, data) => {
      try {
        const result = await ipcRenderer.invoke('firebase:addData', collectionName, data);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    getData: async (collectionName) => {
      try {
        const result = await ipcRenderer.invoke('firebase:getData', collectionName);
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
);

contextBridge.exposeInMainWorld('pythonOptimizer', {
  runOptimizer: async (input) => {
    try {
      return await ipcRenderer.invoke('run-optimizer', input);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});
