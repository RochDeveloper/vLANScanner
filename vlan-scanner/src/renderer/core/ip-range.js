(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createIpRangeModule() {
  const MAX_SCAN_ADDRESSES = 65535;

  function parseIPv4(value) {
    if (typeof value !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value.trim())) return null;
    const octets = value.trim().split('.').map(Number);
    return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
  }

  function toNumber(value) {
    const octets = parseIPv4(value);
    if (!octets) throw new TypeError(`IPv4 inválida: ${value}`);
    return ((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3];
  }

  function fromNumber(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('Valor IPv4 fuera de rango');
    return `${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`;
  }

  function createRangePlan(fromValue, toValue, maxAddresses = MAX_SCAN_ADDRESSES) {
    const fromIp = String(fromValue || '').trim();
    const toIp = String(toValue || '').trim();
    const from = toNumber(fromIp);
    const to = toNumber(toIp);
    if (from > to) throw new Error('El inicio del rango debe ser anterior al final');
    const total = to - from + 1;
    if (total > maxAddresses) throw new Error(`El rango supera el máximo de ${maxAddresses.toLocaleString('es-ES')} direcciones`);
    return { fromIp, toIp, from, to, total };
  }

  // Indica si el rango que muestra el usuario difiere del que se esta
  // escaneando: el nuevo se aplicara en el proximo escaneo.
  function rangeIsPending(current, running) {
    if (!current || !running) return false;
    const from = String(current.from ?? '').trim();
    const to = String(current.to ?? '').trim();
    if (!from && !to) return false;
    return from !== String(running.from ?? '').trim() || to !== String(running.to ?? '').trim();
  }

  return { MAX_SCAN_ADDRESSES, parseIPv4, toNumber, fromNumber, createRangePlan, rangeIsPending };
});
