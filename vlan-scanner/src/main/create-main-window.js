'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

function createMainWindow(BrowserWindow) {
  const indexPath = path.join(__dirname, '..', 'index.html');
  const preloadPath = path.join(__dirname, '..', 'preload.js');
  const appUrl = pathToFileURL(indexPath).toString();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'VLAN Network Scanner',
    backgroundColor: '#0d1117',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
      preload: preloadPath
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== appUrl) event.preventDefault();
  });
  window.loadFile(indexPath);
  return window;
}

module.exports = { createMainWindow };
