'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InterfaceService } = require('./interface-service');

test('InterfaceService devuelve CIDR y rango útil según la máscara', () => {
  const service = new InterfaceService(() => ({
    Ethernet: [{ family: 'IPv4', internal: false, address: '10.20.30.40', netmask: '255.255.0.0', mac: 'AA' }],
    Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0', mac: '' }]
  }));
  const [network] = service.list();
  assert.equal(network.cidr, '10.20.0.0/16');
  assert.equal(network.suggestedFrom, '10.20.0.1');
  assert.equal(network.suggestedTo, '10.20.255.254');
});
