'use strict';

const { OUI } = require('../data/oui-data');

class VendorIdentifier {
  constructor(registry = OUI) {
    this.registry = registry;
  }

  identify(mac) {
    if (typeof mac !== 'string' || mac.length < 8) return '';
    return this.registry[mac.slice(0, 8).toUpperCase()] || '';
  }
}

module.exports = { VendorIdentifier };
