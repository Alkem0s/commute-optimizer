// main.cjs
const { app } = require('electron');

app.whenReady().then(() => {
  import('./main.js'); // Adjust the path to your main ES Module file
});