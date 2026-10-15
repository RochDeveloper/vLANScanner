'use strict';

function parseIPv4(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value.trim())) return null;
  const octets = value.trim().split('.').map(Number);
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

function isIpv4(value) {
  return parseIPv4(value) !== null;
}

function ipv4ToNumber(value) {
  const octets = parseIPv4(value);
  if (!octets) throw new TypeError(`IPv4 inválida: ${value}`);
  return ((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3];
}

function numberToIPv4(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`Valor IPv4 fuera de rango: ${value}`);
  }
  return `${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`;
}

function netmaskToPrefix(netmask) {
  const octets = parseIPv4(netmask);
  if (!octets) return null;
  const value = ipv4ToNumber(netmask);
  let prefix = 0;
  let seenZero = false;
  for (let bit = 31; bit >= 0; bit--) {
    const enabled = (value & (2 ** bit)) !== 0;
    if (enabled) {
      if (seenZero) return null;
      prefix += 1;
    } else {
      seenZero = true;
    }
  }
  return prefix;
}

function cidrFromAddressAndMask(address, netmask) {
  const addressNumber = parseIPv4(address) ? ipv4ToNumber(address) : null;
  const prefix = netmaskToPrefix(netmask);
  if (addressNumber === null || prefix === null) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return `${numberToIPv4((addressNumber & mask) >>> 0)}/${prefix}`;
}

function compareIPv4(left, right) {
  return ipv4ToNumber(left) - ipv4ToNumber(right);
}

module.exports = {
  parseIPv4,
  isIpv4,
  ipv4ToNumber,
  numberToIPv4,
  netmaskToPrefix,
  cidrFromAddressAndMask,
  compareIPv4
};
