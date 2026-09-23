'use strict';

const dgram = require('dgram');
const dns = require('dns');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const nbtstatCache = new Map();
let dnsServersCache = null;

function isIpv4(ip) {
  if (typeof ip !== 'string' || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  return ip.split('.').every((octet) => Number(octet) <= 255);
}

function execText(command, timeout) {
  return new Promise((resolve) => {
    exec(command, { timeout, windowsHide: true, encoding: 'buffer' }, (err, stdout) => {
      resolve(Buffer.isBuffer(stdout) ? stdout.toString('latin1') : (stdout || ''));
    });
  });
}

function cleanHostname(name, ip) {
  if (!name) return '';
  let trimmed = String(name).trim().replace(/\.+$/, '');
  if (trimmed.startsWith('\\\\')) trimmed = trimmed.slice(2);
  const host = trimmed.split('\\')[0].trim();
  if (!host || host === ip || isIpv4(host)) return '';
  if (/^(localhost|nxdomain|unknown)$/i.test(host)) return '';
  if (/in-addr\.arpa$/i.test(host)) return '';
  return host;
}

function parsePingHostname(stdout, ip) {
  const withBrackets = stdout.match(/(?:Pinging|Haciendo ping a)\s+(.+?)\s+\[/i);
  if (withBrackets) return cleanHostname(withBrackets[1], ip);
  const firstToken = stdout.match(/(?:Pinging|Haciendo ping a)\s+([^\s\[]+)/i);
  return cleanHostname(firstToken ? firstToken[1] : '', ip);
}

function parseNslookupHostname(stdout, ip) {
  const m = stdout.match(/(?:Name|Nombre):\s*(.+)/i);
  return cleanHostname(m ? m[1] : '', ip);
}

function parseNbtstatHostname(stdout, ip) {
  const candidates = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/([A-Za-z0-9][A-Za-z0-9 _$-]{0,15})\s*<\s*00\s*>\s*(\S*)/i);
    if (!m) continue;
    const name = m[1].trim();
    const kind = `${m[2] || ''} ${line}`;
    if (/__MSBROWSE__/i.test(name)) continue;
    if (/\b(GROUP|GRUPO)\b/i.test(kind)) continue;
    candidates.push({
      name,
      unique: /UNIQUE|UNICO|NICO/i.test(kind)
    });
  }
  const preferred = candidates.find((c) => c.unique) || candidates[0];
  return cleanHostname(preferred && preferred.name, ip);
}

function parseDnsServers(ipconfigAll) {
  const servers = [];
  const lines = ipconfigAll.split(/\r?\n/);
  let collecting = false;
  for (const line of lines) {
    if (/Servidores DNS|DNS Servers|Default Gateway|Puerta de enlace predeterminada/i.test(line)) {
      collecting = true;
      const ip = line.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
      if (ip && ip[1] !== '0.0.0.0') servers.push(ip[1]);
      continue;
    }
    if (collecting) {
      const onlyIp = line.match(/^\s+(\d{1,3}(?:\.\d{1,3}){3})\s*$/);
      if (onlyIp && onlyIp[1] !== '0.0.0.0') {
        servers.push(onlyIp[1]);
        continue;
      }
      collecting = false;
    }
  }
  return [...new Set(servers)];
}

async function getLanDnsServers() {
  if (dnsServersCache) return dnsServersCache;
  try {
    dnsServersCache = parseDnsServers(await execText('ipconfig /all', 5000));
  } catch (_) {
    dnsServersCache = [];
  }
  return dnsServersCache;
}

function nbtstatCommand(ip) {
  const root = process.env.SystemRoot || 'C:\\Windows';
  const sysnative = path.join(root, 'Sysnative', 'nbtstat.exe');
  const system32 = path.join(root, 'System32', 'nbtstat.exe');
  const bin = fs.existsSync(sysnative) ? sysnative : system32;
  return `"${bin}" -A ${ip}`;
}

function getNbtstat(ip) {
  if (!isIpv4(ip)) return Promise.resolve('');
  if (nbtstatCache.has(ip)) return Promise.resolve(nbtstatCache.get(ip));
  const pending = execText(nbtstatCommand(ip), 3500).then((stdout) => {
    nbtstatCache.set(ip, stdout);
    return stdout;
  });
  nbtstatCache.set(ip, pending);
  return pending;
}

function skipDnsName(buf, offset) {
  let hops = 0;
  while (offset < buf.length && hops++ < 32) {
    const len = buf[offset];
    if (len === 0) return offset + 1;
    if ((len & 0xc0) === 0xc0) return offset + 2;
    offset += 1 + (len & 0x3f);
  }
  return offset;
}

function readDnsName(buf, offset, hops = 0) {
  if (hops > 16 || offset >= buf.length) return { name: '', offset };
  const len = buf[offset];
  if (len === 0) return { name: '', offset: offset + 1 };
  if ((len & 0xc0) === 0xc0) {
    if (offset + 1 >= buf.length) return { name: '', offset: offset + 2 };
    const ptr = ((len & 0x3f) << 8) | buf[offset + 1];
    const jumped = readDnsName(buf, ptr, hops + 1);
    return { name: jumped.name, offset: offset + 2 };
  }
  const label = buf.slice(offset + 1, offset + 1 + len).toString('ascii');
  const rest = readDnsName(buf, offset + 1 + len, hops + 1);
  return { name: rest.name ? `${label}.${rest.name}` : label, offset: rest.offset };
}

function encodeNetbiosName(bytes16) {
  const out = Buffer.alloc(34);
  out[0] = 32;
  for (let i = 0; i < 16; i++) {
    const c = bytes16[i];
    out[1 + i * 2] = 0x41 + ((c >> 4) & 0x0f);
    out[2 + i * 2] = 0x41 + (c & 0x0f);
  }
  out[33] = 0;
  return out;
}

function buildNbstatQuery() {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(Math.floor(Math.random() * 0xffff), 0);
  header.writeUInt16BE(1, 4);
  const name = Buffer.alloc(16, 0);
  name[0] = 0x2a;
  const qtype = Buffer.from([0x00, 0x21, 0x00, 0x01]);
  return Buffer.concat([header, encodeNetbiosName(name), qtype]);
}

function parseNbstatNames(buf) {
  if (!buf || buf.length < 40) return '';
  const qd = buf.readUInt16BE(4);
  const an = buf.readUInt16BE(6);
  let off = 12;
  for (let i = 0; i < qd; i++) {
    off = skipDnsName(buf, off);
    off += 4;
  }
  if (an >= 1 && off + 12 <= buf.length) {
    off = skipDnsName(buf, off);
    const type = buf.readUInt16BE(off); off += 2;
    off += 6;
    const rdlen = buf.readUInt16BE(off); off += 2;
    if (type === 0x21 && off < buf.length) {
      const fromTable = namesFromNbTable(buf, off, rdlen);
      if (fromTable) return fromTable;
    }
  }
  for (let i = 12; i < buf.length - 18; i++) {
    const found = namesFromNbTable(buf, i, buf.length - i);
    if (found) return found;
  }
  return '';
}

function namesFromNbTable(buf, off, maxLen) {
  if (off >= buf.length) return '';
  const count = buf[off];
  if (count < 1 || count > 32) return '';
  let workstation = '';
  let anyUnique = '';
  let pos = off + 1;
  const end = Math.min(buf.length, off + maxLen);
  for (let i = 0; i < count && pos + 18 <= end; i++) {
    const raw = buf.slice(pos, pos + 15).toString('ascii').replace(/\0/g, '').trim();
    const suffix = buf[pos + 15];
    const flags = buf.readUInt16BE(pos + 16);
    pos += 18;
    const isGroup = (flags & 0x8000) !== 0;
    if (!raw || isGroup || /MSBROWSE/i.test(raw)) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(raw.replace(/ /g, ''))) continue;
    if (suffix === 0x00 && !workstation) workstation = raw;
    if (!anyUnique) anyUnique = raw;
  }
  return workstation || anyUnique;
}

function buildPtrQuery(ip) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(Math.floor(Math.random() * 0xffff), 0);
  header.writeUInt16BE(1, 4);
  const qname = `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
  const labels = qname.split('.').filter(Boolean).map((label) => {
    const body = Buffer.from(label);
    return Buffer.concat([Buffer.from([body.length]), body]);
  });
  const question = Buffer.concat([...labels, Buffer.from([0, 0x00, 0x0c, 0x00, 0x01])]);
  return Buffer.concat([header, question]);
}

function parsePtrAnswers(buf, ip) {
  if (!buf || buf.length < 12) return '';
  const qd = buf.readUInt16BE(4);
  const an = buf.readUInt16BE(6);
  let off = 12;
  for (let i = 0; i < qd; i++) {
    off = skipDnsName(buf, off);
    off += 4;
  }
  for (let i = 0; i < an && off + 10 <= buf.length; i++) {
    const name = readDnsName(buf, off);
    off = name.offset;
    if (off + 10 > buf.length) break;
    const type = buf.readUInt16BE(off); off += 2;
    off += 2;
    off += 4;
    const rdlen = buf.readUInt16BE(off); off += 2;
    if (type === 12 && off + rdlen <= buf.length) {
      const ptr = readDnsName(buf, off);
      const host = cleanHostname(ptr.name, ip);
      if (host) return host;
    }
    off += rdlen;
  }
  return '';
}

function udpQuery(ip, port, packet, timeout = 1400) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    let finished = false;
    const finish = (err, msg) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { sock.close(); } catch (_) { /* already closed */ }
      if (err) reject(err);
      else resolve(msg);
    };
    const timer = setTimeout(() => finish(new Error('timeout')), timeout);
    sock.once('error', (err) => finish(err));
    sock.on('message', (msg, rinfo) => {
      if (rinfo.address === ip) finish(null, msg);
    });
    sock.bind(0, () => {
      sock.send(packet, port, ip, (err) => {
        if (err) finish(err);
      });
    });
  });
}

function reverseWithServers(ip, servers) {
  if (!servers.length) return Promise.reject(new Error('no dns'));
  const resolver = new dns.Resolver();
  resolver.setServers(servers.slice(0, 4));
  return new Promise((resolve, reject) => {
    resolver.reverse(ip, (err, hostnames) => {
      if (err) return reject(err);
      resolve(hostnames && hostnames[0] ? cleanHostname(hostnames[0], ip) : '');
    });
  });
}

function localHostnameIfSelf(ip) {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const iface of addrs || []) {
      const family = iface.family;
      if ((family === 'IPv4' || family === 4) && iface.address === ip) return os.hostname();
    }
  }
  return '';
}

async function firstHostname(factories) {
  return new Promise((resolve) => {
    let pending = factories.length;
    let settled = false;
    if (!pending) return resolve('');
    for (const factory of factories) {
      Promise.resolve()
        .then(factory)
        .then((name) => {
          const host = typeof name === 'string' ? name : '';
          if (!settled && host) {
            settled = true;
            resolve(host);
          }
        })
        .catch(() => {})
        .finally(() => {
          pending -= 1;
          if (!pending && !settled) resolve('');
        });
    }
  });
}

async function getHostname(ip) {
  if (!isIpv4(ip)) return '';
  const selfName = localHostnameIfSelf(ip);
  if (selfName) return selfName;

  const lanDns = getLanDnsServers();

  return firstHostname([
    async () => {
      const servers = await lanDns;
      return reverseWithServers(ip, servers);
    },
    () => new Promise((resolve, reject) => {
      dns.reverse(ip, (err, hostnames) => {
        if (err) return reject(err);
        resolve(hostnames && hostnames[0] ? cleanHostname(hostnames[0], ip) : '');
      });
    }),
    async () => parsePingHostname(await execText(`ping -a -n 1 -w 600 ${ip}`, 2500), ip),
    async () => parseNslookupHostname(await execText(`nslookup ${ip}`, 2500), ip),
    async () => parseNbtstatHostname(await getNbtstat(ip), ip),
    async () => cleanHostname(parseNbstatNames(await udpQuery(ip, 137, buildNbstatQuery())), ip),
    async () => parsePtrAnswers(await udpQuery(ip, 5353, buildPtrQuery(ip)), ip),
    async () => parsePtrAnswers(await udpQuery(ip, 5355, buildPtrQuery(ip)), ip)
  ]);
}

function clearHostnameCaches() {
  nbtstatCache.clear();
  dnsServersCache = null;
}

module.exports = {
  isIpv4,
  cleanHostname,
  parsePingHostname,
  parseNslookupHostname,
  parseNbtstatHostname,
  parseDnsServers,
  parseNbstatNames,
  getNbtstat,
  getHostname,
  clearHostnameCaches
};
