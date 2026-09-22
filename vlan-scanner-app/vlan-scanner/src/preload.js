const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getLocalNetworks: () => ipcRenderer.invoke('get-local-networks'),
  detectVlans: () => ipcRenderer.invoke('detect-vlans'),
  scanNetwork: (opts) => ipcRenderer.invoke('scan-network', opts),
  exportResults: (opts) => ipcRenderer.invoke('export-results', opts),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onScanProgress: (cb) => ipcRenderer.on('scan-progress', (_, data) => cb(data)),
  onHostFound: (cb) => ipcRenderer.on('scan-host-found', (_, data) => cb(data)),
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch),
});
