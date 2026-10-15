'use strict';

const { VENDOR_GROUPS } = require('../data/oui-data');
const { MOBILE_HOSTNAME_TOKENS, isMobileConflict } = require('./mobile-phone-classifier');

const includesAny = (value, candidates) => candidates.some((candidate) => value.includes(candidate));
const hasAny = (ports, candidates) => candidates.some((port) => ports.includes(port));

const DEFAULT_DEVICE_RULES = Object.freeze([
  { name: 'firewall', when: ({ vendor, banner }) => vendor.includes('fortinet') || banner.includes('fortigate') || banner.includes('palo alto'), type: 'firewall' },
  { name: 'voip-oui', when: ({ vendor }) => includesAny(vendor, VENDOR_GROUPS.voip), type: 'voip' },
  { name: 'sip-confirmed', when: ({ sipConfirmed, ports }) => sipConfirmed && !hasAny(ports, [135, 139, 445, 3389]), type: 'voip' },
  { name: 'cisco-mikrotik', when: ({ vendor, ports }) => vendor.includes('cisco') || vendor.includes('mikrotik'), type: ({ ports }) => ports.includes(23) ? 'router' : 'switch' },
  { name: 'network-switch', when: ({ vendor }) => ['ubiquiti', 'netgear', 'tp-link', 'linksys'].some((name) => vendor.includes(name)), type: 'switch' },
  { name: 'printer-oui', when: ({ vendor }) => includesAny(vendor, VENDOR_GROUPS.printer), type: 'printer' },
  { name: 'printer-port', when: ({ ports }) => ports.includes(9100), type: 'printer' },
  {
    name: 'printer-banner',
    when: ({ banner }) => ['printer', 'web jetadmin', 'epson', 'ricoh', 'kyocera', 'konica', 'xerox', 'brother', 'lexmark', 'bizhub', 'aficio', 'laserjet', 'imagerunner', 'workcentre'].some((token) => banner.includes(token)),
    type: 'printer'
  },
  { name: 'printer-hostname', when: ({ hostname }) => ['print', 'mfp', 'laserjet', 'officejet', 'deskjet', 'bizhub'].some((token) => hostname.includes(token)), type: 'printer' },
  { name: 'camera-oui', when: ({ vendor }) => includesAny(vendor, VENDOR_GROUPS.camera), type: 'nvr-camera' },
  { name: 'camera-dahua', when: ({ ports }) => ports.includes(37777), type: 'nvr-camera' },
  { name: 'camera-dvr', when: ({ ports }) => ports.includes(34567), type: 'nvr-camera' },
  { name: 'camera-hikvision', when: ({ ports }) => ports.includes(8000) && ports.includes(554), type: 'nvr-camera' },
  { name: 'camera-rtsp', when: ({ ports }) => ports.includes(554) && !ports.includes(3389) && !ports.includes(22), type: 'nvr-camera' },
  {
    name: 'camera-banner',
    when: ({ banner }) => ['hikvision', 'dahua', 'dvr', 'nvr', 'ip camera', 'ipcam', 'network camera', 'video server', 'axis', 'reolink', 'foscam', 'amcrest', 'uniview', 'cctv'].some((token) => banner.includes(token)),
    type: 'nvr-camera'
  },
  { name: 'camera-hostname', when: ({ hostname }) => ['cam', 'nvr', 'dvr', 'cctv', 'hikvision', 'dahua'].some((token) => hostname.includes(token)), type: 'nvr-camera' },
  {
    name: 'phone-hostname',
    when: ({ hostname, ports, sipConfirmed }) => {
      if (isMobileConflict({ openPorts: ports, sipConfirmed }).length) return false;
      return MOBILE_HOSTNAME_TOKENS.some((token) => hostname.includes(token));
    },
    type: 'smartphone'
  },
  {
    name: 'phone-os',
    when: ({ os, ports, banner, sipConfirmed }) => {
      if (isMobileConflict({ openPorts: ports, sipConfirmed }).length) return false;
      const text = `${os || ''} ${banner || ''}`.toLowerCase();
      return ['android', 'ios', 'iphone', 'ipados', 'ipad'].some((token) => text.includes(token));
    },
    type: 'smartphone'
  },
  {
    name: 'windows-rdp',
    when: ({ ports, vendor, banner }) => isWindowsWorkstation(ports, vendor, banner) && ports.includes(3389),
    type: 'windows-server'
  },
  {
    name: 'windows-workstation',
    when: ({ ports, vendor, banner }) => isWindowsWorkstation(ports, vendor, banner),
    type: 'workstation'
  },
  { name: 'workstation-oui', when: ({ vendor }) => includesAny(vendor, VENDOR_GROUPS.workstation), type: 'workstation' },
  { name: 'apple', when: ({ vendor }) => vendor.includes('apple'), type: 'workstation' },
  { name: 'virtual-machine', when: ({ vendor }) => vendor.includes('vmware') || vendor.includes('hyper-v'), type: 'vm' },
  { name: 'voip-hostname', when: ({ hostname, ports }) => ['voip', 'phone', 'sip', 'yealink', 'polycom', 'grandstream'].some((token) => hostname.includes(token)) && !hasAny(ports, [135, 139, 445, 3389, 5900]), type: 'voip' },
  { name: 'sip-only', when: ({ ports }) => (ports.includes(5060) || ports.includes(5061) || ports.includes(5080)) && !hasAny(ports, [135, 139, 445, 3389, 5900, 22, 80]), type: 'voip' },
  { name: 'rdp-fallback', when: ({ ports }) => ports.includes(3389), type: 'windows-server' },
  { name: 'server', when: ({ ports }) => [22, 80, 443].some((port) => ports.includes(port)), type: 'server' }
]);

function isWindowsWorkstation(ports, vendor, banner) {
  return hasAny(ports, [135, 139, 445])
    && !ports.includes(9100)
    && !ports.includes(554)
    && !includesAny(vendor, VENDOR_GROUPS.camera)
    && !banner.includes('camera');
}

class DeviceClassifier {
  constructor(rules = DEFAULT_DEVICE_RULES) {
    this.rules = rules;
  }

  classify({ ports = [], hostname = '', vendor = '', banner = '', sipConfirmed = false, os = '' } = {}) {
    const context = {
      ports,
      hostname: String(hostname || '').toLowerCase(),
      vendor: String(vendor || '').toLowerCase(),
      banner: String(banner || '').toLowerCase(),
      sipConfirmed,
      os: String(os || '').toLowerCase()
    };
    const rule = this.rules.find((candidate) => candidate.when(context));
    if (!rule) return 'workstation';
    return typeof rule.type === 'function' ? rule.type(context) : rule.type;
  }
}

module.exports = { DeviceClassifier, DEFAULT_DEVICE_RULES };
