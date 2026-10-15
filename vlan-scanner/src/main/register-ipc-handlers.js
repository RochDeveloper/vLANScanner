'use strict';

const { validateExternalUrl } = require('../security/external-url');

function registerIpcHandlers({ ipcMain, getWindow, interfaceService, scanManager, resultExporter, shell }) {
  const assertTrustedSender = (event) => {
    const window = getWindow();
    if (window && event.sender !== window.webContents) throw new Error('Origen IPC no autorizado');
  };

  ipcMain.handle('get-local-networks', (event) => {
    assertTrustedSender(event);
    return interfaceService.list();
  });

  ipcMain.handle('scan-network', (event, request) => {
    assertTrustedSender(event);
    return scanManager.start(request, event.sender);
  });

  ipcMain.handle('stop-scan', (event, { runId } = {}) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('Falta el identificador del escaneo');
    return scanManager.cancel(runId);
  });

  ipcMain.handle('export-results', async (event, { data, format } = {}) => {
    assertTrustedSender(event);
    return resultExporter.export(data, format);
  });

  ipcMain.handle('window-minimize', (event) => {
    assertTrustedSender(event);
    getWindow()?.minimize();
  });

  ipcMain.handle('window-maximize', (event) => {
    assertTrustedSender(event);
    const window = getWindow();
    if (!window) return false;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return window.isMaximized();
  });

  ipcMain.handle('window-close', (event) => {
    assertTrustedSender(event);
    getWindow()?.close();
  });

  ipcMain.handle('open-external', async (event, url) => {
    assertTrustedSender(event);
    return shell.openExternal(validateExternalUrl(url));
  });
}

module.exports = { registerIpcHandlers };
