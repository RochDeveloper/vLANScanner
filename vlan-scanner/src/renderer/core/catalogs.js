(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createCatalogModule() {
  const DEVICE_ICONS = Object.freeze({
    router: '🌐', switch: '🔀', server: '🖥️', 'windows-server': '🪟',
    workstation: '💻', vm: '☁️', printer: '🖨️', voip: '📞',
    'nvr-camera': '📹', firewall: '🛡️', ap: '📡', smartphone: '📱', tablet: '📱', default: '❓'
  });

  const PORT_NAMES = Object.freeze({
    21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 69: 'TFTP',
    80: 'HTTP', 110: 'POP3', 135: 'RPC', 139: 'NetBIOS', 1883: 'MQTT',
    443: 'HTTPS', 445: 'SMB', 3389: 'RDP', 5000: 'UPnP', 5060: 'SIP',
    5061: 'SIP-TLS', 5080: 'SIP-Alt', 554: 'RTSP', 5900: 'VNC',
    8000: 'Hikvision', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 8888: 'HTTP-Alt',
    9100: 'RAW-Print', 9200: 'Elastic', 34567: 'DVR', 37777: 'Dahua-NVR'
  });

  const VENDOR_COLORS = Object.freeze({
    cisco: '#1ba0d7', 'cisco-phone': '#1ba0d7', hp: '#0096d6', 'hp-printer': '#0096d6',
    dell: '#007db8', apple: '#777777', ubiquiti: '#f5a623', mikrotik: '#cc2936',
    fortinet: '#ee2222', hikvision: '#c00000', dahua: '#e05000', axis: '#002855',
    yealink: '#00a0e9', grandstream: '#e87722', polycom: '#6f2da8', avaya: '#da291c',
    synology: '#b5a642', vmware: '#607d8b', epson: '#003087', brother: '#00539f',
    canon: '#cc0000', xerox: '#e31837', ricoh: '#003087', zebra: '#9b1c20',
    aruba: '#ff6319', meraki: '#00bceb', juniper: '#009639', apc: '#00adef', siemens: '#009999'
  });

  const OS_PRESENTATION_RULES = Object.freeze([
    { tokens: ['windows'], icon: '🪟', color: '#0078d4' },
    { tokens: ['linux', 'ubuntu', 'debian', 'centos', 'fedora', 'alpine', 'proxmox'], icon: '🐧', color: '#f4a522' },
    { tokens: ['cisco', 'routeros', 'mikrotik', 'junos'], icon: '🔀', color: '#1ba0d7' },
    { tokens: ['fortios', 'fortigate'], icon: '🛡️', color: '#ee2222' },
    { tokens: ['macos', 'mac os', 'ipados', 'ios'], icon: '💻', color: '#888888' },
    { tokens: ['esxi', 'vmware'], icon: '☁️', color: '#607d8b' },
    { tokens: ['synology', 'qnap'], icon: '🖧', color: '#3fb950' },
    { tokens: ['android'], icon: '🤖', color: '#3ddc84' },
    { tokens: ['embedded', 'firmware', 'vxworks'], icon: '📦', color: '#d29922' },
    { tokens: ['yealink', 'grandstream', 'polycom', 'cisco phone', 'sip', 'voip'], icon: '📞', color: '#39c5cf' },
    { tokens: ['freebsd', 'openbsd'], icon: '😈', color: '#ab2b28' }
  ]);

  const VOIP_CATALOG = Object.freeze({
    yealink: { ports: [['http', 80], ['https', 443]], credentials: 'admin / admin' },
    'cisco-phone': { ports: [['http', 80], ['https', 443]], credentials: 'Cisco / Cisco ó admin / admin' },
    grandstream: { ports: [['http', 80], ['https', 443]], credentials: 'admin / admin' },
    polycom: { ports: [['http', 80], ['https', 443]], credentials: '456 (solo PIN)' },
    snom: { ports: [['http', 80]], credentials: 'Sin usuario / contraseña (primera vez)' },
    fanvil: { ports: [['http', 80], ['https', 443]], credentials: 'admin / admin' },
    avaya: { ports: [['http', 80], ['https', 443]], credentials: 'admin / 27238 (por defecto)' },
    mitel: { ports: [['http', 80], ['https', 443]], credentials: 'admin / 1234' },
    panasonic: { ports: [['http', 80], ['https', 443]], credentials: 'admin / adminpass' },
    gigaset: { ports: [['http', 80], ['https', 443]], credentials: 'admin / admin' },
    alcatel: { ports: [['http', 80], ['https', 443]], credentials: 'admin / admin' }
  });

  function presentOs(os) {
    if (!os || os === 'Desconocido') return { icon: '❓', color: '#8b949e', label: '—' };
    const normalized = String(os).toLowerCase();
    const rule = OS_PRESENTATION_RULES.find((candidate) => candidate.tokens.some((token) => normalized.includes(token)));
    return rule
      ? { icon: rule.icon, color: rule.color, label: os }
      : { icon: '❓', color: '#8b949e', label: os };
  }

  function vendorColor(vendor) {
    const normalized = String(vendor || '').toLowerCase();
    const key = Object.keys(VENDOR_COLORS).find((candidate) => normalized.includes(candidate));
    return key ? VENDOR_COLORS[key] : '#8b949e';
  }

  function getVoipVendor(vendor) {
    const normalized = String(vendor || '').toLowerCase();
    const key = Object.keys(VOIP_CATALOG).find((candidate) => normalized.includes(candidate));
    return key ? { key, ...VOIP_CATALOG[key] } : null;
  }

  function buildWebUrls(host) {
    const ports = host.openPorts || [];
    const voip = host.deviceType === 'voip' ? getVoipVendor(host.vendor) : null;
    if (voip) {
      const detected = voip.ports.filter(([, port]) => ports.includes(port));
      return (detected.length ? detected : voip.ports).map(([protocol, port]) => `${protocol}://${host.ip}:${port}/`);
    }
    const urls = [];
    if (ports.includes(443)) urls.push(`https://${host.ip}`);
    if (ports.includes(8443)) urls.push(`https://${host.ip}:8443`);
    if (ports.includes(80)) urls.push(`http://${host.ip}`);
    if (ports.includes(8080)) urls.push(`http://${host.ip}:8080`);
    if (ports.includes(8000)) urls.push(`http://${host.ip}:8000`);
    return urls.length ? urls : [`http://${host.ip}`];
  }

  return {
    DEVICE_ICONS,
    PORT_NAMES,
    VENDOR_COLORS,
    OS_PRESENTATION_RULES,
    VOIP_CATALOG,
    presentOs,
    vendorColor,
    getVoipVendor,
    buildWebUrls
  };
});
