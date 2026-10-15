'use strict';

function createPreloadApi({ contextBridge, ipcRenderer }) {
  let nextSubscriptionId = 1;
  const subscriptions = new Map();

  function subscribe(kind, channel, callback) {
    if (typeof callback !== 'function') throw new TypeError('El suscriptor debe ser una función');
    const id = nextSubscriptionId++;
    const listener = (_event, data) => callback(data);
    subscriptions.set(id, { kind, channel, listener });
    ipcRenderer.on(channel, listener);
    return id;
  }

  function unsubscribe(kind, id) {
    const entry = subscriptions.get(id);
    if (!entry || entry.kind !== kind) return false;
    ipcRenderer.removeListener(entry.channel, entry.listener);
    subscriptions.delete(id);
    return true;
  }

  const api = {
    network: {
      getLocalNetworks: () => ipcRenderer.invoke('get-local-networks'),
      scan: (request) => ipcRenderer.invoke('scan-network', request),
      cancel: (runId) => ipcRenderer.invoke('stop-scan', { runId }),
      onProgress: (callback) => subscribe('progress', 'scan-progress', callback),
      onHost: (callback) => subscribe('host', 'scan-host-found', callback),
      onState: (callback) => subscribe('state', 'scan-state', callback),
      unsubscribe
    },
    export: {
      results: (request) => ipcRenderer.invoke('export-results', request)
    },
    window: {
      minimize: () => ipcRenderer.invoke('window-minimize'),
      maximize: () => ipcRenderer.invoke('window-maximize'),
      close: () => ipcRenderer.invoke('window-close')
    },
    external: {
      open: (url) => ipcRenderer.invoke('open-external', url)
    }
  };

  contextBridge.exposeInMainWorld('api', api);
  return api;
}

module.exports = { createPreloadApi };
