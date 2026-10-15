'use strict';

const MOBILE_HOSTNAME_TOKENS = Object.freeze([
  'iphone', 'ipad', 'android', 'galaxy', 'pixel', 'redmi', 'oneplus',
  'vivo', 'huawei', 'honor', 'moto', 'nokia', 'xiaomi', 'oppo', 'realme',
  'nothing', 'htc', 'sony', 'zte', 'lg', 'asus', 'infinix', 'tecno', 'itel'
]);

const MOBILE_VENDOR_TOKENS = Object.freeze([
  'apple', 'samsung', 'xiaomi', 'huawei', 'google', 'oneplus', 'oppo',
  'vivo', 'motorola', 'nokia', 'htc', 'sony', 'zte', 'honor', 'nothing',
  'realme', 'lg', 'asus'
]);

const PC_PORTS = Object.freeze([135, 139, 445, 3389, 5985, 22, 5900]);
const CAMERA_PORTS = Object.freeze([554, 8000, 37777, 34567]);
const PRINTER_PORT = 9100;

const SIGNATURE_MOBILE_OS = Object.freeze([
  'android', 'ios', 'iphone', 'ipados', 'ipad'
]);

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function portsOf(openPorts) {
  return Array.isArray(openPorts) ? openPorts : [];
}

function hasPort(openPorts, port) {
  return portsOf(openPorts).includes(port);
}

function hasAnyPort(openPorts, candidates) {
  const ports = portsOf(openPorts);
  return candidates.some((candidate) => ports.includes(candidate));
}

function mobileHostnameToken(hostname) {
  const text = normalizeText(hostname);
  return MOBILE_HOSTNAME_TOKENS.find((token) => text.includes(token)) || '';
}

function mobileOsDetected(signals) {
  const combined = normalizeText(`${signals.os || ''} ${signals.banner || ''} ${signals.hostname || ''}`);
  if (combined.includes('android')) return 'android';
  if (combined.includes('ios') || combined.includes('iphone') || combined.includes('ipados') || combined.includes('ipad')) return 'ios';
  return '';
}

function mobileVendorToken(vendor) {
  const text = normalizeText(vendor);
  return MOBILE_VENDOR_TOKENS.find((token) => text.includes(token)) || '';
}

function mobileMdnsServices(services) {
  if (!Array.isArray(services)) return [];
  return services.filter((service) => {
    const text = normalizeText(service);
    return MOBILE_HOSTNAME_TOKENS.some((token) => text.includes(token)) || text.includes('hap') || text.includes('android');
  });
}

function isMobileConflict({ openPorts = [], sipConfirmed = false } = {}) {
  const conflicts = [];
  const ports = portsOf(openPorts);
  if (PC_PORTS.some((port) => ports.includes(port))) conflicts.push('pc-ports');
  if (CAMERA_PORTS.some((port) => ports.includes(port))) conflicts.push('camera-ports');
  if (ports.includes(PRINTER_PORT)) conflicts.push('printer-port');
  if (sipConfirmed) conflicts.push('sip');
  return conflicts;
}

function titleCase(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function derivePhoneHint(input = {}) {
  const signals = input && typeof input === 'object' ? input : {};
  const vendor = normalizeText(signals.vendor);
  const hostname = normalizeText(signals.hostname);
  const formFactor = signals.formFactor || signals.phoneFormFactor || null;
  const vendorToken = mobileVendorToken(vendor);

  if (vendorToken === 'apple') {
    return (formFactor === 'tablet' || hostname.includes('ipad')) ? 'Apple iPad (estimado)' : 'Apple iPhone (estimado)';
  }
  if (vendorToken === 'samsung') {
    return (formFactor === 'tablet' || hostname.includes('tab')) ? 'Samsung Galaxy Tab (estimado)' : 'Samsung Galaxy (estimado)';
  }
  if (vendorToken === 'google') return 'Google Pixel (estimado)';
  if (vendorToken === 'xiaomi' || vendorToken === 'redmi' || hostname.includes('redmi')) return 'Xiaomi Redmi/MI (estimado)';
  if (vendorToken === 'huawei' || vendorToken === 'honor') return 'Huawei/Honor (estimado)';
  if (vendorToken) return `${titleCase(vendorToken)} (modelo desconocido)`;

  const mobileHost = mobileHostnameToken(hostname);
  if (mobileHost && !MOBILE_HOSTNAME_TOKENS.includes(hostname.trim())) {
    // Si el hostname es genérico y no es un token móvil aislado, úsalo como pista.
    return String(signals.hostname || '').trim().slice(0, 80) || null;
  }
  return null;
}

function normalizeMobileOs(os, signals = {}) {
  const signalObject = signals && typeof signals === 'object' ? signals : {};
  const combined = normalizeText(`${os || ''} ${signalObject.banner || ''} ${signalObject.hostname || ''}`);
  if (combined.includes('android')) return 'Android';
  if (combined.includes('ios') || combined.includes('iphone') || combined.includes('ipados') || combined.includes('ipad')) return 'iOS';
  if (signalObject.isPhone === true) return 'Mobile OS (unknown)';
  return null;
}

function analyzeMobilePhone(signals = {}) {
  const input = signals && typeof signals === 'object' ? signals : {};
  const hostname = normalizeText(input.hostname);
  const vendor = normalizeText(input.vendor);
  const os = input.os || '';
  const banner = normalizeText(input.banner);
  const openPorts = portsOf(input.openPorts);
  const ttl = input.ttl;
  const sipConfirmed = input.sipConfirmed === true;
  const mdnsServices = Array.isArray(input.mdnsServices) ? input.mdnsServices : [];
  const conflicts = isMobileConflict({ openPorts, sipConfirmed });

  const hostToken = mobileHostnameToken(hostname);
  const osMobile = mobileOsDetected({ os, banner, hostname });
  const vendorToken = mobileVendorToken(vendor);
  const mdnsMobile = mobileMdnsServices(mdnsServices);

  const strongSignal = Boolean(hostToken || osMobile || mdnsMobile.length);

  let score = 0;
  const evidence = [];

  if (hostToken) {
    score += 2;
    evidence.push(`hostname:${hostToken}`);
  }
  if (osMobile) {
    score += 2;
    evidence.push(`os:${osMobile}`);
  }

  const vendorCanCount = Boolean(vendorToken) && (vendorToken !== 'apple' || strongSignal);
  if (vendorCanCount) {
    score += 1;
    evidence.push(`vendor:${vendorToken}`);
  }

  if (mdnsMobile.length) {
    score += 2;
    evidence.push(`mdns:${mdnsMobile[0]}`);
  }

  if (!PC_PORTS.some((port) => openPorts.includes(port))) {
    score += 1;
    evidence.push('ports:no-pc-services');
  }

  if (Number.isFinite(ttl) && ttl >= 60 && ttl <= 70) {
    score += 1;
    evidence.push(`ttl:${ttl}`);
  }

  const isPhone = score >= 3 && conflicts.length === 0 && strongSignal;
  if (!isPhone) {
    return {
      isPhone: false,
      deviceType: null,
      phoneOS: null,
      phoneHint: null,
      phoneConfidence: null,
      phoneEvidence: [],
      phoneFormFactor: null,
      conflicts
    };
  }

  const formFactor = (() => {
    const text = `${hostname} ${banner}`;
    if (text.includes('ipad') || text.includes('tablet') || text.includes('mediapad') || text.includes('galaxy tab') || text.includes('tab')) {
      return 'tablet';
    }
    return 'handset';
  })();

  const phoneOS = normalizeMobileOs(os, { hostname, banner, isPhone: true }) || 'Mobile OS (unknown)';
  const phoneHint = derivePhoneHint({
    vendor: input.vendor,
    hostname: input.hostname,
    formFactor,
    isPhone: true
  });

  const confidence = (score >= 5 || (hostToken && osMobile && conflicts.length === 0)) ? 'high' : 'medium';

  return {
    isPhone: true,
    deviceType: 'smartphone',
    phoneOS,
    phoneHint,
    phoneConfidence: confidence,
    phoneEvidence: evidence,
    phoneFormFactor: formFactor,
    conflicts: []
  };
}

module.exports = {
  analyzeMobilePhone,
  normalizeMobileOs,
  derivePhoneHint,
  isMobileConflict,
  MOBILE_HOSTNAME_TOKENS,
  MOBILE_VENDOR_TOKENS,
  PC_PORTS,
  CAMERA_PORTS,
  PRINTER_PORT,
  SIGNATURE_MOBILE_OS
};