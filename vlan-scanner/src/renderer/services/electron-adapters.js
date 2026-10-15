(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createElectronAdapters() {
  class NetworkAdapter {
    constructor(api) {
      this.api = api;
    }

    listInterfaces() {
      return this.api.network.getLocalNetworks();
    }

    scan(request) {
      return this.api.network.scan(request);
    }

    cancel(runId) {
      return this.api.network.cancel(runId);
    }

    onProgress(callback) {
      return this.api.network.onProgress(callback);
    }

    onHost(callback) {
      return this.api.network.onHost(callback);
    }

    onState(callback) {
      return this.api.network.onState(callback);
    }

    unsubscribe(kind, id) {
      return this.api.network.unsubscribe(kind, id);
    }
  }

  class PlatformAdapter {
    constructor(api, clipboard = globalThis.navigator?.clipboard) {
      this.api = api;
      this.clipboard = clipboard;
    }

    exportResults(data, format) {
      return this.api.export.results({ data, format });
    }

    minimize() { return this.api.window.minimize(); }
    maximize() { return this.api.window.maximize(); }
    close() { return this.api.window.close(); }
    openExternal(url) { return this.api.external.open(url); }

    async copy(text) {
      if (!this.clipboard?.writeText) return false;
      await this.clipboard.writeText(text);
      return true;
    }
  }

  return { NetworkAdapter, PlatformAdapter };
});
