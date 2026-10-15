'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseIPv4,
  isIpv4,
  ipv4ToNumber,
  numberToIPv4,
  netmaskToPrefix,
  cidrFromAddressAndMask,
  compareIPv4
} = require('./ip-address');

test('parseIPv4 valida octetos y formato', () => {
  assert.deepEqual(parseIPv4('192.168.1.10'), [192, 168, 1, 10]);
  assert.equal(parseIPv4('256.1.1.1'), null);
  assert.equal(parseIPv4('-1.1.1.1'), null);
  assert.equal(parseIPv4('1.1.1'), null);
  assert.equal(parseIPv4('1.1.1.1e2'), null);
  assert.equal(isIpv4('0.0.0.0'), true);
});

test('convierte IPv4 a número y viceversa', () => {
  assert.equal(ipv4ToNumber('0.0.0.1'), 1);
  assert.equal(ipv4ToNumber('255.255.255.255'), 4294967295);
  assert.equal(numberToIPv4(1), '0.0.0.1');
  assert.equal(numberToIPv4(4294967295), '255.255.255.255');
  assert.ok(compareIPv4('10.0.0.1', '10.0.0.2') < 0);
});

test('calcula CIDR desde la máscara real', () => {
  assert.equal(netmaskToPrefix('255.255.255.0'), 24);
  assert.equal(netmaskToPrefix('255.255.254.0'), 23);
  assert.equal(netmaskToPrefix('255.255.0.255'), null);
  assert.equal(cidrFromAddressAndMask('192.168.1.20', '255.255.255.0'), '192.168.1.0/24');
  assert.equal(cidrFromAddressAndMask('10.20.30.40', '255.255.0.0'), '10.20.0.0/16');
});
