'use strict';

const os = require('os');
const {
  cidrFromAddressAndMask,
  ipv4ToNumber,
  netmaskToPrefix,
  numberToIPv4
} = require('../domain/ip-address');

function isIpv4Family(family) {
  return family === 'IPv4' || family === 4;
}

class InterfaceService {
  constructor(networkInterfaces = os.networkInterfaces) {
    this.networkInterfaces = networkInterfaces;
  }

  list() {
    const groups = this.networkInterfaces() || {};
    const results = [];
    for (const [name, addresses] of Object.entries(groups)) {
      for (const address of addresses || []) {
        if (!isIpv4Family(address.family) || address.internal) continue;
        const cidr = cidrFromAddressAndMask(address.address, address.netmask);
        const prefix = netmaskToPrefix(address.netmask);
        const addressNumber = ipv4ToNumber(address.address);
        const mask = prefix === null ? 0xffffffff : prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
        const networkNumber = (addressNumber & mask) >>> 0;
        const broadcastNumber = (networkNumber + (Math.pow(2, 32 - prefix) - 1)) >>> 0;
        const firstHost = prefix >= 31 ? networkNumber : networkNumber + 1;
        const lastHost = prefix >= 31 ? broadcastNumber : Math.max(firstHost, broadcastNumber - 1);
        const base = numberToIPv4(networkNumber);
        results.push({
          interface: name,
          ip: address.address,
          mac: address.mac || '',
          netmask: address.netmask || '',
          base,
          cidr: cidr || `${base}.0/24`,
          suggestedFrom: numberToIPv4(firstHost),
          suggestedTo: numberToIPv4(lastHost)
        });
      }
    }
    return results;
  }
}

module.exports = { InterfaceService, isIpv4Family };
