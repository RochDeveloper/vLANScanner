(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createSelectorModule() {
  const { toNumber } = globalThis.VLANScanner;

  function compareValues(left, right) {
    if (left === right) return 0;
    if (left === null || left === undefined || left === '') return 1;
    if (right === null || right === undefined || right === '') return -1;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  }

  function selectVisibleHosts(hosts, { activeFilter, search, sort }, idsForHost) {
    const query = String(search || '').trim().toLowerCase();
    const filtered = hosts.filter((host) => {
      if (activeFilter?.startsWith('type:') && host.deviceType !== activeFilter.slice(5)) return false;
      if (activeFilter?.startsWith('vlan:') && !idsForHost(host).includes(Number(activeFilter.slice(5)))) return false;
      if (!query) return true;
      const printerText = (host.printers || []).map((p) => `${p.name} ${p.model} ${p.port}`).join(' ');
      const phoneText = host.deviceType === 'smartphone'
        ? [host.phoneOS, host.phoneHint, host.phoneConfidence, (host.phoneEvidence || []).join(' ')].join(' ')
        : '';
      return [host.ip, host.hostname, host.mac, host.vendor, host.deviceType, host.os, printerText,
        host.usbPrinterCount ? 'usb impresora' : '', phoneText].join(' ').toLowerCase().includes(query);
    });

    const direction = sort?.ascending === false ? -1 : 1;
    const key = sort?.key || 'ip';
    return filtered.sort((left, right) => {
      let compared;
      if (key === 'ip') compared = toNumber(left.ip) - toNumber(right.ip);
      else if (key === 'latencyMs') compared = compareValues(left.latencyMs, right.latencyMs);
      else compared = compareValues(left[key], right[key]);
      return compared * direction;
    });
  }

  function countBy(hosts, key) {
    return hosts.reduce((counts, host) => {
      const value = host[key] || 'unknown';
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
  }

  return { selectVisibleHosts, countBy, compareValues };
});
