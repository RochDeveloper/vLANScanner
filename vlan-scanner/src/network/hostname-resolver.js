'use strict';

const { getHostname, clearHostnameCaches } = require('../hostname');
const { raceWithAbort } = require('../domain/cancellation');

class HostnameResolver {
  constructor({ resolver = getHostname, clearCache = clearHostnameCaches } = {}) {
    this.resolver = resolver;
    this.clearCache = clearCache;
  }

  clearCacheForScan() {
    this.clearCache();
  }

  resolve(ip, { signal } = {}) {
    return raceWithAbort(Promise.resolve().then(() => this.resolver(ip)), signal);
  }
}

module.exports = { HostnameResolver };
