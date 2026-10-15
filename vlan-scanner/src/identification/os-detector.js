'use strict';

function extractServerHeader(banner) {
  const match = String(banner || '').match(/server:\s*([^\r\n]+)/i);
  return match ? match[1].trim() : '';
}

function ttlToOsHint(ttl) {
  if (!Number.isFinite(ttl)) return '';
  if (ttl >= 120 && ttl <= 128) return 'Windows';
  if (ttl >= 60 && ttl <= 70) return 'Linux/Unix';
  if (ttl >= 250) return 'Cisco IOS / Network OS';
  if (ttl >= 30 && ttl <= 35) return 'Windows (distant)';
  return `Unknown (TTL=${ttl})`;
}

const OS_RULES = Object.freeze([
  {
    name: 'ssh-distribution',
    matches: ({ ssh }) => ['ubuntu', 'debian', 'centos', 'fedora', 'alpine'].find((name) => ssh.includes(name)),
    detect: (_context, match) => `Linux — ${match[0].toUpperCase()}${match.slice(1)}`
  },
  { name: 'freebsd', matches: ({ ssh }) => ssh.includes('freebsd'), detect: () => 'FreeBSD' },
  { name: 'openbsd', matches: ({ ssh }) => ssh.includes('openbsd'), detect: () => 'OpenBSD' },
  { name: 'cisco-ssh', matches: ({ ssh }) => ssh.includes('cisco'), detect: () => 'Cisco IOS' },
  { name: 'mikrotik-ssh', matches: ({ ssh }) => ssh.includes('mikrotik') || ssh.includes('routeros'), detect: () => 'RouterOS (Mikrotik)' },
  { name: 'linux-ssh', matches: ({ ssh }) => ssh.includes('linux'), detect: () => 'Linux' },
  {
    name: 'openssh',
    matches: ({ ssh }) => ssh.includes('openssh'),
    detect: (context) => context.osHint.includes('Linux') ? 'Linux' : 'Unix/Linux'
  },
  {
    name: 'iis',
    matches: ({ serverHeader }) => serverHeader.toLowerCase().includes('microsoft-iis'),
    detect: ({ serverHeader }) => {
      const version = serverHeader.match(/(\d+\.\d+)/)?.[1] || '';
      const versions = {
        '10.0': 'Windows Server 2016/2019/2022',
        '8.5': 'Windows Server 2012 R2',
        '8.0': 'Windows Server 2012',
        '7.5': 'Windows Server 2008 R2',
        '7.0': 'Windows Server 2008'
      };
      return `Windows — IIS ${version} (${versions[version] || 'Windows Server'})`;
    }
  },
  {
    name: 'apache',
    matches: ({ serverHeader }) => serverHeader.toLowerCase().includes('apache'),
    detect: ({ serverHeader }) => `Linux — Apache ${serverHeader.match(/apache\/(\S+)/i)?.[1] || ''}`.trim()
  },
  {
    name: 'nginx',
    matches: ({ serverHeader }) => serverHeader.toLowerCase().includes('nginx'),
    detect: ({ serverHeader }) => `Linux — Nginx ${serverHeader.match(/nginx\/(\S+)/i)?.[1] || ''}`.trim()
  },
  { name: 'lighttpd', matches: ({ serverHeader }) => serverHeader.includes('lighttpd'), detect: () => 'Linux — Lighttpd' },
  { name: 'synology-http', matches: ({ serverHeader }) => serverHeader.includes('synology'), detect: () => 'Synology DSM' },
  { name: 'hikvision-http', matches: ({ serverHeader }) => serverHeader.includes('hikvision'), detect: () => 'Hikvision Embedded Linux' },
  { name: 'dahua-http', matches: ({ serverHeader }) => serverHeader.includes('dahua'), detect: () => 'Dahua Embedded Linux' },
  { name: 'vxworks-http', matches: ({ serverHeader }) => serverHeader.includes('vxworks'), detect: () => 'VxWorks (Embedded)' },
  { name: 'camera-http', matches: ({ serverHeader }) => serverHeader.includes('uc-httpd') || serverHeader.includes('mini_httpd'), detect: () => 'Embedded Linux' },
  ...[
    ['windows server 2022', 'Windows Server 2022'],
    ['windows server 2019', 'Windows Server 2019'],
    ['windows server 2016', 'Windows Server 2016'],
    ['windows server 2012', 'Windows Server 2012'],
    ['windows 11', 'Windows 11'],
    ['windows 10', 'Windows 10'],
    ['ubuntu', 'Linux — Ubuntu'],
    ['debian', 'Linux — Debian'],
    ['centos', 'Linux — Centos'],
    ['freebsd', 'FreeBSD'],
    ['fortigate', 'FortiOS'],
    ['fortios', 'FortiOS'],
    ['routeros', 'RouterOS (Mikrotik)'],
    ['cisco ios xe', 'Cisco IOS XE'],
    ['cisco ios', 'Cisco IOS XE'],
    ['junos', 'Junos OS'],
    ['unifi', 'UniFi OS (Ubiquiti)'],
    ['airos', 'AirOS (Ubiquiti)'],
    ['proxmox', 'Proxmox VE (Linux)'],
    ['esxi', 'VMware ESXi'],
    ['vsphere', 'VMware ESXi'],
    ['synology', 'Synology DSM'],
    ['qnap', 'QNAP QTS'],
    ['android', 'Android'],
    ['macos', 'macOS'],
    ['mac os x', 'macOS'],
    ['ipados', 'iOS/iPadOS'],
    ['iphone os', 'iOS/iPadOS']
  ].map(([needle, label]) => ({
    name: `http-${needle}`,
    matches: ({ http }) => http.includes(needle),
    detect: () => label
  })),
  { name: 'rdp-smb', matches: ({ ports }) => ports.includes(3389) && ports.includes(445), detect: () => 'Windows (RDP+SMB)' },
  { name: 'rdp', matches: ({ ports }) => ports.includes(3389), detect: () => 'Windows' },
  { name: 'smb', matches: ({ ports }) => ports.includes(445) && ports.includes(139), detect: () => 'Windows (SMB)' },
  { name: 'apple-vendor', matches: ({ vendor }) => vendor.includes('apple'), detect: () => 'macOS / iOS' },
  { name: 'cisco-vendor', matches: ({ vendor }) => vendor.includes('cisco'), detect: () => 'Cisco IOS' },
  { name: 'mikrotik-vendor', matches: ({ vendor }) => vendor.includes('mikrotik'), detect: () => 'RouterOS (Mikrotik)' },
  { name: 'ubiquiti-vendor', matches: ({ vendor }) => vendor.includes('ubiquiti'), detect: () => 'UniFi OS / AirOS' },
  { name: 'fortinet-vendor', matches: ({ vendor }) => vendor.includes('fortinet'), detect: () => 'FortiOS' },
  { name: 'synology-vendor', matches: ({ vendor }) => vendor.includes('synology'), detect: () => 'Synology DSM' },
  { name: 'vmware-vendor', matches: ({ vendor }) => vendor.includes('vmware'), detect: () => 'VMware ESXi / Guest' },
  { name: 'camera-vendor', matches: ({ vendor }) => vendor.includes('hikvision') || vendor.includes('dahua'), detect: () => 'Embedded Linux (NVR)' },
  { name: 'printer-type', matches: ({ deviceType }) => deviceType === 'printer', detect: () => 'Printer Firmware' },
  { name: 'camera-type', matches: ({ deviceType }) => deviceType === 'nvr-camera', detect: () => 'Embedded Linux (NVR/DVR)' },
  { name: 'voip-type', matches: ({ deviceType }) => deviceType === 'voip', detect: () => 'VoIP Firmware' },
  { name: 'ttl', matches: ({ osHint }) => Boolean(osHint), detect: ({ osHint }) => osHint }
]);

class OsFingerprintService {
  constructor(rules = OS_RULES) {
    this.rules = rules;
  }

  detect(signals = {}) {
    const context = {
      ssh: String(signals.sshBanner || '').toLowerCase(),
      http: String(signals.httpBanner || '').toLowerCase(),
      smb: String(signals.smbInfo || '').toLowerCase(),
      vendor: String(signals.vendor || '').toLowerCase(),
      ports: signals.ports || [],
      deviceType: signals.deviceType || '',
      osHint: signals.osHint || ttlToOsHint(signals.ttl)
    };
    context.serverHeader = extractServerHeader(context.http);

    for (const rule of this.rules) {
      const match = rule.matches(context);
      if (match) return rule.detect(context, match);
    }
    return 'Desconocido';
  }
}

function normalizeMobileOs(os, signals = {}) {
  const { normalizeMobileOs: classifyNormalize } = require('./mobile-phone-classifier');
  return classifyNormalize(os, signals);
}

module.exports = {
  OsFingerprintService,
  extractServerHeader,
  ttlToOsHint,
  OS_RULES,
  normalizeMobileOs
};
