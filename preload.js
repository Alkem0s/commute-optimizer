const { contextBridge, ipcRenderer } = require("electron");


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


// Log when preload script is executed
console.log('Preload script loaded');