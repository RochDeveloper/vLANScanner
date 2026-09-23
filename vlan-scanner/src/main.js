const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const net = require('net');
const {
  isIpv4,
  getHostname,
  getNbtstat,
  parseNbtstatHostname,
  clearHostnameCaches
} = require('./hostname');

let mainWindow;
let stopScanFlag = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'VLAN Network Scanner',
    backgroundColor: '#0d1117',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
    frame: false, titleBarStyle: 'hidden'
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── OUI database ─────────────────────────────────────────────────────────────
const OUI = {
  // Virtualization
  '00:50:56':'VMware','00:0C:29':'VMware','00:1C:14':'VMware','00:05:69':'VMware',
  // Servers
  '00:1A:A0':'Dell','14:18:77':'Dell','F8:DB:88':'Dell','B8:CA:3A':'Dell','18:DB:F2':'Dell',
  'B4:2E:99':'HP','3C:D9:2B':'HP','94:57:A5':'HP','FC:15:B4':'HP','9C:8E:99':'HP',
  '00:15:5D':'Microsoft Hyper-V','DC:A6:32':'Raspberry Pi','B8:27:EB':'Raspberry Pi',
  '00:E0:4C':'Realtek','A0:36:9F':'Intel','8C:8D:28':'Intel','00:1B:21':'Intel',
  // Network
  '3C:97:0E':'Cisco','00:1E:F7':'Cisco','E8:BA:70':'Cisco','00:23:04':'Cisco','F8:7B:20':'Cisco',
  'C8:5B:76':'Ubiquiti','04:18:D6':'Ubiquiti','78:8A:20':'Ubiquiti','24:A4:3C':'Ubiquiti','74:83:C2':'Ubiquiti',
  '00:11:32':'Synology','00:26:F2':'Netgear','C0:3F:D5':'Netgear',
  '50:C7:BF':'TP-Link','F4:EC:38':'TP-Link','AC:84:C6':'TP-Link','98:DE:D0':'TP-Link',
  'CC:40:D0':'Mikrotik','4C:5E:0C':'Mikrotik','2C:C8:1B':'Mikrotik','E4:8D:8C':'Mikrotik',
  'D4:20:B0':'Fortinet','00:09:0F':'Fortinet','90:6C:AC':'Fortinet',
  'A8:9C:ED':'Huawei','00:E0:FC':'Huawei','30:D1:7E':'Huawei',
  '00:1D:0F':'ASUS','04:D4:C4':'ASUS','D8:50:E6':'ASUS',
  'B4:FB:E4':'Apple','3C:15:C2':'Apple','A4:C3:F0':'Apple','F0:18:98':'Apple',

  // ── PRINTERS ────────────────────────────────────────────────────────────────
  '00:00:48':'Epson','00:26:AB':'Epson','AC:18:26':'Epson','64:EB:8C':'Epson',
  '78:AC:C0':'HP-Printer','30:8D:99':'HP-Printer','A0:B3:CC':'HP-Printer','10:60:4B':'HP-Printer','98:E7:F4':'HP-Printer',
  '00:00:74':'Ricoh','00:26:73':'Ricoh','00:60:6E':'Ricoh','08:00:46':'Ricoh',
  '00:00:AA':'Xerox','00:00:15':'Xerox','A4:D1:8C':'Xerox','00:00:FC':'Xerox',
  '00:40:1C':'Canon','00:1E:8F':'Canon','10:DD:B1':'Canon','AC:49:DB':'Canon',
  '00:80:92':'Brother','E4:F8:9C':'Brother','00:80:77':'Brother',
  '00:04:00':'Lexmark','00:04:69':'Lexmark',
  '00:00:AD':'Kyocera','00:C0:EE':'Kyocera','A4:1F:72':'Kyocera',
  '08:00:20':'Konica-Minolta','00:00:85':'Konica-Minolta',
  '00:02:2D':'Zebra','00:07:4D':'Zebra','AC:3F:A4':'Zebra',

  // ── CAMERAS / NVR / DVR ─────────────────────────────────────────────────────
  // Hikvision
  'C0:56:E3':'Hikvision','44:19:B6':'Hikvision','BC:AD:28':'Hikvision','28:57:BE':'Hikvision',
  'A4:14:37':'Hikvision','54:C4:15':'Hikvision','D4:08:31':'Hikvision','D0:21:F9':'Hikvision',
  'E8:56:20':'Hikvision','F4:82:70':'Hikvision','34:EA:34':'Hikvision','70:2E:22':'Hikvision',
  '4C:2C:B0':'Hikvision','E4:70:B8':'Hikvision','C4:2F:90':'Hikvision',
  // Dahua
  'A4:43:30':'Dahua','90:02:A9':'Dahua','BC:32:B2':'Dahua','E0:50:8B':'Dahua',
  '3C:EF:8C':'Dahua','EC:D6:8A':'Dahua','48:0B:B2':'Dahua','70:85:C8':'Dahua','4C:11:BF':'Dahua',
  // Axis
  '00:40:8C':'Axis','AC:CC:8E':'Axis','B8:A4:4F':'Axis','AC:CC:8E':'Axis',
  // Hanwha / Samsung Techwin
  '00:09:18':'Hanwha','34:BD:FA':'Hanwha','FC:03:9F':'Hanwha',
  // Reolink
  'EC:71:DB':'Reolink',
  // Vivotek
  '00:02:D1':'Vivotek',
  // Uniview (UNV)
  '00:18:AE':'Uniview',
  // Bosch
  '00:04:63':'Bosch-Security','00:07:5F':'Bosch-Security',
  // Pelco
  '00:07:CB':'Pelco',
  // Amcrest / Foscam
  '9C:8E:CD':'Amcrest','C4:D6:55':'Foscam','00:62:6E':'Foscam',
  // Avigilon
  '00:18:85':'Avigilon',
  // Provision-ISR
  '00:D0:41':'Provision-ISR',
  // Milesight
  '70:B3:D5':'Milesight',

  // ── VOIP PHONES ──────────────────────────────────────────────────────────────
  // Cisco IP Phones (7800, 8800, 8900 series - very common in enterprises)
  '00:0E:08':'Cisco-Phone','00:11:21':'Cisco-Phone','00:14:69':'Cisco-Phone',
  '00:16:C7':'Cisco-Phone','00:17:59':'Cisco-Phone','00:18:19':'Cisco-Phone',
  '00:19:06':'Cisco-Phone','00:1A:2F':'Cisco-Phone','00:1B:53':'Cisco-Phone',
  '00:1C:58':'Cisco-Phone','00:1E:13':'Cisco-Phone','00:1E:49':'Cisco-Phone',
  '00:1F:6C':'Cisco-Phone','00:21:A0':'Cisco-Phone','00:22:BD':'Cisco-Phone',
  '00:23:33':'Cisco-Phone','00:24:97':'Cisco-Phone','00:25:45':'Cisco-Phone',
  '00:26:CB':'Cisco-Phone','34:7E:5C':'Cisco-Phone','7C:69:F6':'Cisco-Phone',
  'DC:EB:94':'Cisco-Phone','F8:72:EA':'Cisco-Phone','00:50:60':'Cisco-Phone',
  // Yealink (most popular IP phone brand worldwide)
  '80:5E:C0':'Yealink','00:15:65':'Yealink','70:30:18':'Yealink',
  'AC:D1:B8':'Yealink','54:BE:F7':'Yealink','98:73:B4':'Yealink',
  '00:15:65':'Yealink','28:6E:D4':'Yealink','24:9A:D8':'Yealink',
  'F4:8E:38':'Yealink','C0:74:AD':'Yealink','68:93:4E':'Yealink',
  // Grandstream
  '00:0B:82':'Grandstream','C0:74:AD':'Grandstream','00:08:9F':'Grandstream',
  // Polycom / Poly
  '00:04:F2':'Polycom','64:16:7F':'Polycom','00:E0:75':'Polycom',
  '0C:CE:60':'Polycom','38:42:0B':'Polycom',
  // Snom
  '00:04:13':'Snom',
  // Fanvil
  '00:A8:59':'Fanvil','C0:3A:9A':'Fanvil',
  // Panasonic IP phones
  '00:80:F0':'Panasonic-Phone','04:2D:B4':'Panasonic-Phone','40:B8:37':'Panasonic-Phone',
  // Avaya
  '00:07:3B':'Avaya','00:04:0D':'Avaya','00:09:6E':'Avaya','00:0C:29':'Avaya',
  '00:1B:4F':'Avaya','84:83:71':'Avaya',
  // Mitel
  '08:00:0E':'Mitel','00:90:7A':'Mitel',
  // Gigaset
  '7C:2F:80':'Gigaset','00:01:E3':'Gigaset',
  // Alcatel-Lucent phones
  '00:80:9F':'Alcatel-Phone','00:60:3E':'Alcatel-Phone',
};

const PRINTER_VENDORS  = ['epson','hp-printer','ricoh','xerox','canon','brother','lexmark','kyocera','konica-minolta','zebra','pantum','sharp','oki'];
const VOIP_VENDORS     = ['cisco-phone','yealink','grandstream','polycom','snom','fanvil','panasonic-phone','avaya','mitel','gigaset','alcatel-phone'];
const CAMERA_VENDORS   = ['hikvision','dahua','axis','hanwha','reolink','vivotek','uniview','bosch-security','pelco','amcrest','foscam','avigilon','provision-isr','milesight'];

function getVendor(mac) {
  if (!mac || mac.length < 8) return '';
  return OUI[mac.substring(0, 8).toUpperCase()] || '';
}

// ─── Network helpers ──────────────────────────────────────────────────────────

function getLocalNetworks() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        const base = parts.slice(0, 3).join('.');
        results.push({ interface: name, ip: iface.address, mac: iface.mac, netmask: iface.netmask, base, cidr: `${base}.0/24` });
      }
    }
  }
  return results;
}

function pingHost(ip, timeout = 800) {
  return new Promise((resolve) => {
    if (!isIpv4(ip)) return resolve({ ip, alive: false });
    exec(`ping -n 1 -w ${timeout} ${ip}`, { timeout: timeout + 500, windowsHide: true }, (err, stdout) => {
      resolve({ ip, alive: !err && (stdout.includes('TTL=') || stdout.includes('ttl=')) });
    });
  });
}

function getMac(ip) {
  return new Promise((resolve) => {
    if (!isIpv4(ip)) return resolve('');
    exec(`arp -a ${ip}`, { timeout: 2000, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve('');
      for (const line of stdout.split('\n')) {
        if (line.includes(ip)) {
          const m = line.match(/([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/);
          if (m) return resolve(m[1].replace(/-/g, ':').toUpperCase());
        }
      }
      resolve('');
    });
  });
}

// Ports: standard + printer-specific (9100) + camera-specific (554 RTSP, 37777 Dahua, 34567 XMEye DVR, 8000 Hikvision)
// 5060=SIP, 5061=SIP-TLS, 5080=SIP-alt, 69=TFTP (phones download config via TFTP)
const ALL_PORTS = [21,22,23,25,53,69,80,110,135,139,443,445,554,1883,3389,5000,5060,5061,5080,5900,8000,8080,8443,8888,9100,9200,34567,37777];

function scanPorts(ip, ports = ALL_PORTS) {
  return new Promise((resolve) => {
    const open = [];
    let pending = ports.length;
    if (!pending) return resolve([]);
    ports.forEach(port => {
      const sock = new net.Socket();
      let done = false;
      const finish = (isOpen) => {
        if (done) return; done = true;
        if (isOpen) open.push(port);
        if (--pending === 0) resolve(open.sort((a, b) => a - b));
      };
      sock.setTimeout(500);
      sock.connect(port, ip, () => { sock.destroy(); finish(true); });
      sock.on('error', () => finish(false));
      sock.on('timeout', () => { sock.destroy(); finish(false); });
    });
  });
}

// Grab HTTP banner from port 80 or 8080 to identify device from its web interface
function grabHttpBanner(ip, port = 80) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let data = '';
    sock.setTimeout(1800);
    sock.connect(port, ip, () => {
      sock.write(`GET / HTTP/1.0\r\nHost: ${ip}\r\nUser-Agent: NetworkScanner/1.0\r\n\r\n`);
    });
    sock.on('data', chunk => { data += chunk.toString('latin1'); if (data.length > 5000) sock.destroy(); });
    sock.on('close', () => resolve(data.toLowerCase()));
    sock.on('error', () => resolve(''));
    sock.on('timeout', () => { sock.destroy(); resolve(data.toLowerCase()); });
  });
}

// Send SIP OPTIONS probe to check if device responds as a SIP endpoint
function probeSip(ip, port = 5060) {
  return new Promise((resolve) => {
    const udpMsg = Buffer.from(
      `OPTIONS sip:${ip} SIP/2.0
` +
      `Via: SIP/2.0/UDP ${ip}:5060;branch=z9hG4bK-scanner
` +
      `From: <sip:scanner@${ip}>;tag=scanner
` +
      `To: <sip:${ip}>
` +
      `Call-ID: scanner-${Date.now()}@${ip}
` +
      `CSeq: 1 OPTIONS
` +
      `Max-Forwards: 1
` +
      `Content-Length: 0

`
    );
    // Try TCP SIP first (port 5060/5061)
    const sock = new net.Socket();
    let responded = false;
    sock.setTimeout(1500);
    sock.connect(port, ip, () => {
      sock.write(
        `OPTIONS sip:${ip} SIP/2.0
` +
        `Via: SIP/2.0/TCP ${ip}:5060;branch=z9hG4bK-scanner
` +
        `From: <sip:scanner@${ip}>;tag=scanner
` +
        `To: <sip:${ip}>
` +
        `Call-ID: scanner-${Date.now()}@${ip}
` +
        `CSeq: 1 OPTIONS
` +
        `Max-Forwards: 1
` +
        `Content-Length: 0

`
      );
    });
    let data = '';
    sock.on('data', chunk => {
      data += chunk.toString();
      responded = true;
      sock.destroy();
    });
    sock.on('close', () => resolve({ isSip: responded || data.includes('SIP/2.0'), banner: data.toLowerCase() }));
    sock.on('error', () => resolve({ isSip: false, banner: '' }));
    sock.on('timeout', () => { sock.destroy(); resolve({ isSip: false, banner: '' }); });
  });
}

// ─── OS Detection ────────────────────────────────────────────────────────────

// Method 1: TTL fingerprinting from ping output
function detectOsFromTtl(ip) {
  return new Promise((resolve) => {
    exec(`ping -n 1 -w 1000 ${ip}`, { timeout: 2000 }, (err, stdout) => {
      if (err || !stdout) return resolve({ ttl: null, osHint: '' });
      const m = stdout.match(/TTL[=:](\d+)/i);
      if (!m) return resolve({ ttl: null, osHint: '' });
      const ttl = parseInt(m[1]);
      // TTL ranges (accounting for hops):
      // 128 = Windows (exact or close)
      // 64  = Linux / macOS / Android / iOS
      // 255 = Cisco IOS / network gear
      // 254 = Juniper / some Linux
      let osHint = '';
      if (ttl >= 120 && ttl <= 128) osHint = 'Windows';
      else if (ttl >= 60 && ttl <= 70) osHint = 'Linux/Unix';
      else if (ttl >= 250) osHint = 'Cisco IOS / Network OS';
      else if (ttl >= 30 && ttl <= 35) osHint = 'Windows (distant)';
      else if (ttl > 0) osHint = `Unknown (TTL=${ttl})`;
      resolve({ ttl, osHint });
    });
  });
}

// Method 2: SSH banner grab — reveals exact OS/distro
function grabSshBanner(ip) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let data = '';
    sock.setTimeout(2000);
    sock.connect(22, ip, () => {});
    sock.on('data', chunk => {
      data += chunk.toString();
      if (data.length > 200) sock.destroy();
    });
    sock.on('close', () => resolve(data.trim()));
    sock.on('error', () => resolve(''));
    sock.on('timeout', () => { sock.destroy(); resolve(data.trim()); });
  });
}

// Method 3: SMB fingerprint via NetBIOS (port 445)
function grabSmbInfo(ip) {
  return getNbtstat(ip);
}

// Method 4: HTTP Server header
function extractServerHeader(banner) {
  const m = banner.match(/server:\s*([^\r\n]+)/i);

  return m ? m[1].trim() : '';
}

// Combine all signals into a final OS string
function detectOs({ ttl, osHint, sshBanner, httpBanner, smbInfo, ports, vendor, deviceType }) {
  const ssh = (sshBanner || '').toLowerCase();
  const http = (httpBanner || '').toLowerCase();
  const smb = (smbInfo || '').toLowerCase();
  const v = (vendor || '').toLowerCase();
  const serverHeader = extractServerHeader(http);

  // ── SSH banner — most reliable for Linux servers ──
  if (ssh.includes('ubuntu'))   return 'Linux — Ubuntu';
  if (ssh.includes('debian'))   return 'Linux — Debian';
  if (ssh.includes('centos'))   return 'Linux — CentOS';
  if (ssh.includes('fedora'))   return 'Linux — Fedora';
  if (ssh.includes('alpine'))   return 'Linux — Alpine';
  if (ssh.includes('freebsd'))  return 'FreeBSD';
  if (ssh.includes('openbsd'))  return 'OpenBSD';
  if (ssh.includes('cisco'))    return 'Cisco IOS';
  if (ssh.includes('mikrotik') || ssh.includes('routeros')) return 'RouterOS (Mikrotik)';
  if (ssh.includes('linux'))    return 'Linux';
  if (ssh.includes('openssh'))  {
    // OpenSSH but OS unknown — use TTL
    if (osHint.includes('Linux')) return 'Linux';
    return 'Unix/Linux';
  }

  // ── HTTP Server header ──
  if (serverHeader) {
    if (serverHeader.toLowerCase().includes('microsoft-iis')) {
      const verM = serverHeader.match(/(\d+\.\d+)/);
      const ver = verM ? verM[1] : '';
      // IIS version -> Windows Server version mapping
      const iisMap = { '10.0':'Windows Server 2016/2019/2022', '8.5':'Windows Server 2012 R2', '8.0':'Windows Server 2012', '7.5':'Windows Server 2008 R2', '7.0':'Windows Server 2008' };
      return `Windows — IIS ${ver} (${iisMap[ver] || 'Windows Server'})`;
    }
    if (serverHeader.toLowerCase().includes('apache')) {
      const verM = serverHeader.match(/apache\/(\S+)/i);
      return `Linux — Apache ${verM ? verM[1] : ''}`.trim();
    }
    if (serverHeader.toLowerCase().includes('nginx')) {
      const verM = serverHeader.match(/nginx\/(\S+)/i);
      return `Linux — Nginx ${verM ? verM[1] : ''}`.trim();
    }
    if (serverHeader.toLowerCase().includes('lighttpd')) return 'Linux — Lighttpd';
    if (serverHeader.toLowerCase().includes('synology')) return 'Synology DSM';
    if (serverHeader.toLowerCase().includes('hikvision')) return 'Hikvision Embedded Linux';
    if (serverHeader.toLowerCase().includes('dahua')) return 'Dahua Embedded Linux';
    if (serverHeader.toLowerCase().includes('vxworks')) return 'VxWorks (Embedded)';
    if (serverHeader.toLowerCase().includes('uc-httpd')) return 'Embedded Linux (IP Camera)';
    if (serverHeader.toLowerCase().includes('mini_httpd')) return 'Embedded Linux';
  }

  // ── HTTP body keywords ──
  if (http.includes('windows server 2022')) return 'Windows Server 2022';
  if (http.includes('windows server 2019')) return 'Windows Server 2019';
  if (http.includes('windows server 2016')) return 'Windows Server 2016';
  if (http.includes('windows server 2012')) return 'Windows Server 2012';
  if (http.includes('windows 11'))          return 'Windows 11';
  if (http.includes('windows 10'))          return 'Windows 10';
  if (http.includes('ubuntu'))              return 'Linux — Ubuntu';
  if (http.includes('debian'))              return 'Linux — Debian';
  if (http.includes('centos'))              return 'Linux — CentOS';
  if (http.includes('freebsd'))             return 'FreeBSD';
  if (http.includes('fortigate') || http.includes('fortios')) return 'FortiOS';
  if (http.includes('routeros'))            return 'RouterOS (Mikrotik)';
  if (http.includes('ios xe') || http.includes('cisco ios')) return 'Cisco IOS XE';
  if (http.includes('junos'))               return 'Junos OS';
  if (http.includes('unifi'))               return 'UniFi OS (Ubiquiti)';
  if (http.includes('airos'))               return 'AirOS (Ubiquiti)';
  if (http.includes('proxmox'))             return 'Proxmox VE (Linux)';
  if (http.includes('esxi') || http.includes('vsphere')) return 'VMware ESXi';
  if (http.includes('synology'))            return 'Synology DSM';
  if (http.includes('qnap'))                return 'QNAP QTS';
  if (http.includes('android'))             return 'Android';
  if (http.includes('macos') || http.includes('mac os x')) return 'macOS';
  if (http.includes('ipados') || http.includes('iphone os')) return 'iOS/iPadOS';

  // ── Ports-based inference ──
  if (ports.includes(3389) && ports.includes(445)) return 'Windows (RDP+SMB)';
  if (ports.includes(3389)) return 'Windows';
  if (ports.includes(445) && ports.includes(139)) return 'Windows (SMB)';

  // ── Vendor-based inference ──
  if (v.includes('apple'))   return 'macOS / iOS';
  if (v.includes('cisco'))   return 'Cisco IOS';
  if (v.includes('mikrotik')) return 'RouterOS (Mikrotik)';
  if (v.includes('ubiquiti')) return 'UniFi OS / AirOS';
  if (v.includes('fortinet')) return 'FortiOS';
  if (v.includes('synology')) return 'Synology DSM';
  if (v.includes('vmware'))   return 'VMware ESXi / Guest';
  if (v.includes('hikvision') || v.includes('dahua')) return 'Embedded Linux (NVR)';

  // ── Device type inference ──
  if (deviceType === 'printer') return 'Printer Firmware';
  if (deviceType === 'nvr-camera') return 'Embedded Linux (NVR/DVR)';
  if (deviceType === 'voip') return 'VoIP Firmware';

  // ── TTL as last resort ──
  if (osHint) return osHint;

  return 'Desconocido';
}

function guessDeviceType(ports, hostname, vendor, banner, sipConfirmed = false) {
  const h = (hostname || '').toLowerCase();
  const v = (vendor || '').toLowerCase();
  const b = (banner || '').toLowerCase();

  // Firewall
  if (v.includes('fortinet') || b.includes('fortigate') || b.includes('palo alto')) return 'firewall';

  // ── VoIP phones — OUI check first (most reliable) ──
  if (VOIP_VENDORS.some(vv => v.includes(vv))) return 'voip';
  // SIP probe confirmed this device speaks SIP and has no Windows ports
  const hasWinPorts = ports.some(p => [135,139,445,3389].includes(p));
  if (sipConfirmed && !hasWinPorts) return 'voip';

  // Network gear
  if (v.includes('cisco') || v.includes('mikrotik')) return ports.includes(23) ? 'router' : 'switch';
  if (v.includes('ubiquiti') || v.includes('netgear') || v.includes('tp-link') || v.includes('linksys')) return 'switch';

  // ── PRINTERS ──
  if (PRINTER_VENDORS.some(pv => v.includes(pv))) return 'printer';
  if (ports.includes(9100)) return 'printer';  // JetDirect / RAW print = definitive
  if (b.includes('printer') || b.includes('web jetadmin') || b.includes('epson')
    || b.includes('ricoh') || b.includes('kyocera') || b.includes('konica')
    || b.includes('xerox') || b.includes('brother') || b.includes('lexmark')
    || b.includes('bizhub') || b.includes('aficio') || b.includes('laserjet')
    || b.includes('imagerunner') || b.includes('workcentre')) return 'printer';
  if (h.includes('print') || h.includes('mfp') || h.includes('laserjet')
    || h.includes('officejet') || h.includes('deskjet') || h.includes('bizhub')) return 'printer';

  // ── NVR / DVR / IP CAMERAS ──
  if (CAMERA_VENDORS.some(cv => v.includes(cv))) return 'nvr-camera';
  if (ports.includes(37777)) return 'nvr-camera';   // Dahua signature port
  if (ports.includes(34567)) return 'nvr-camera';   // XMEye/generic DVR signature port
  if (ports.includes(8000) && ports.includes(554))  return 'nvr-camera'; // Hikvision NVR (8000+RTSP)
  if (ports.includes(554) && !ports.includes(3389) && !ports.includes(22)) return 'nvr-camera'; // RTSP only
  if (b.includes('hikvision') || b.includes('dahua') || b.includes('dvr')
    || b.includes('nvr') || b.includes('ip camera') || b.includes('ipcam')
    || b.includes('network camera') || b.includes('video server')
    || b.includes('axis') || b.includes('reolink') || b.includes('foscam')
    || b.includes('amcrest') || b.includes('uniview') || b.includes('cctv')) return 'nvr-camera';
  if (h.includes('cam') || h.includes('nvr') || h.includes('dvr')
    || h.includes('cctv') || h.includes('hikvision') || h.includes('dahua')) return 'nvr-camera';

  // ── WORKSTATIONS / PCs — detectar ANTES que VoIP para evitar clasificación errónea ──
  // Una PC con Teams/Zoom puede tener el puerto 5060 abierto — no es un teléfono VoIP
  const isWindowsPC = (ports.includes(135) || ports.includes(139) || ports.includes(445))
                   && !ports.includes(9100) && !ports.includes(554)
                   && !CAMERA_VENDORS.some(cv => v.includes(cv));
  if (isWindowsPC && ports.includes(3389)) return 'windows-server';
  if (isWindowsPC) return 'workstation';

  // OUIs comunes en tarjetas de red de PCs y laptops
  const PC_VENDORS = ['intel','realtek','dell','hp','lenovo','acer','msi','gigabyte','toshiba'];
  if (PC_VENDORS.some(pv => v.includes(pv))) return 'workstation';

  if (v.includes('apple')) return 'workstation';
  if (v.includes('vmware') || v.includes('hyper-v')) return 'vm';

  // ── VoIP phones — OUI is the most reliable signal ──
  if (VOIP_VENDORS.some(vv => v.includes(vv))) return 'voip';

  // ── VoIP — hostname/banner + no Windows ports ──
  const hasWindowsPorts = ports.some(p => [135, 139, 445, 3389, 5900].includes(p));
  const isVoip = (h.includes('voip') || h.includes('phone') || h.includes('sip') || h.includes('yealink') || h.includes('polycom') || h.includes('grandstream'))
              && !hasWindowsPorts;
  if (isVoip) return 'voip';
  // SIP ports open but NO Windows ports = likely a phone or PBX
  const hasSipOnly = (ports.includes(5060) || ports.includes(5061)) && !hasWindowsPorts && !ports.includes(22) && !ports.includes(80);
  if (hasSipOnly) return 'voip';

  if (ports.includes(3389)) return 'windows-server';
  if (ports.includes(22) || ports.includes(80) || ports.includes(443)) return 'server';
  return 'workstation';
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle('get-local-networks', () => getLocalNetworks());
ipcMain.handle('stop-scan', () => { stopScanFlag = true; });

ipcMain.handle('scan-network', async (event, { base, startHost = 1, endHost = 254, scanPorts: doPorts = true }) => {
  stopScanFlag = false;
  clearHostnameCaches();
  const total = endHost - startHost + 1;
  let scanned = 0;
  const results = [];
  const BATCH = 24;

  for (let i = startHost; i <= endHost && !stopScanFlag; i += BATCH) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH, endHost + 1); j++) batch.push(pingHost(`${base}.${j}`));
    const pings = await Promise.all(batch);
    const alive = pings.filter(r => r.alive);

    for (const { ip } of alive) {
      if (stopScanFlag) break;
      event.sender.send('scan-progress', { scanned: ++scanned, total, ip, status: 'resolviendo' });

      let [hostname, mac] = await Promise.all([getHostname(ip), getMac(ip)]);
      const vendor = getVendor(mac);

      let openPorts = [];
      let banner = '';

      if (doPorts) {
        event.sender.send('scan-progress', { scanned, total, ip, status: 'puertos' });
        openPorts = await scanPorts(ip);

        // Grab HTTP banner from port 80 or 8080 for better identification
        const webPort = openPorts.includes(80) ? 80 : openPorts.includes(8080) ? 8080 : openPorts.includes(8000) ? 8000 : null;
        if (webPort) {
          event.sender.send('scan-progress', { scanned, total, ip, status: 'identificando' });
          banner = await grabHttpBanner(ip, webPort);
        }
      }

      // OS Detection + SIP probe (must run BEFORE guessDeviceType)
      event.sender.send('scan-progress', { scanned, total, ip, status: 'detectando SO' });
      const hasSip = openPorts.includes(5060) || openPorts.includes(5061) || openPorts.includes(5080);
      const [ttlInfo, sshBanner, smbInfo, sipResult] = await Promise.all([
        detectOsFromTtl(ip),
        openPorts.includes(22) ? grabSshBanner(ip) : Promise.resolve(''),
        openPorts.includes(445) ? grabSmbInfo(ip) : Promise.resolve(''),
        hasSip ? probeSip(ip, openPorts.includes(5060) ? 5060 : 5061) : Promise.resolve({ isSip: false, banner: '' })
      ]);
      if (sipResult.isSip) banner += ' sip-confirmed';
      const sipConfirmed = sipResult.isSip;
      if (!hostname && smbInfo) hostname = parseNbtstatHostname(smbInfo, ip);
      const deviceType = guessDeviceType(openPorts, hostname, vendor, banner, sipConfirmed);
      const os = detectOs({
        ttl: ttlInfo.ttl, osHint: ttlInfo.osHint,
        sshBanner, httpBanner: banner, smbInfo,
        ports: openPorts, vendor, deviceType
      });

      const host = { ip, hostname, mac, vendor, openPorts, deviceType, os, status: 'online' };
      results.push(host);
      event.sender.send('scan-host-found', host);
    }

    scanned = Math.max(scanned, Math.min(i + BATCH - 1, endHost) - startHost + 1);
    event.sender.send('scan-progress', { scanned, total, ip: `${base}.${Math.min(i + BATCH - 1, endHost)}`, status: 'pinging' });
  }
  return results;
});

ipcMain.handle('export-results', async (event, { data, format }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar resultados',
    defaultPath: `network-scan-${Date.now()}`,
    filters: format === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!filePath) return false;
  const content = format === 'csv'
    ? 'IP,Hostname,MAC,Vendor,Device Type,OS,Open Ports\n' +
      data.map(d => `${d.ip},"${d.hostname}","${d.mac}","${d.vendor}","${d.deviceType}","${d.os||''}","${(d.openPorts||[]).join(',')}"`).join('\n')
    : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf8');
  shell.showItemInFileManager(filePath);
  return true;
});

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle('window-close', () => mainWindow.close());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
