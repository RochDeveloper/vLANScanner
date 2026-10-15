'use strict';

const net = require('net');
const { createAbortError, throwIfAborted } = require('../domain/cancellation');

const ALL_PORTS = Object.freeze([
  21, 22, 23, 25, 53, 69, 80, 110, 135, 139, 443, 445, 554, 1883, 3389,
  5000, 5060, 5061, 5080, 5900, 8000, 8080, 8443, 8888, 9100, 9200, 34567, 37777
]);

function closeSocket(socket) {
  try { socket.destroy(); } catch (_) { /* socket ya cerrado */ }
}

async function probeTcpPort(ip, port, { timeoutMs = 500, signal } = {}) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (error, open = false) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      closeSocket(socket);
      if (error) reject(error);
      else resolve(open);
    };
    const onAbort = () => finish(createAbortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(null, true));
    socket.once('timeout', () => finish(null, false));
    socket.once('error', (error) => finish(signal?.aborted ? createAbortError() : null, false));
    socket.connect(port, ip);
  });
}

class PortScanner {
  async scan(ip, ports = ALL_PORTS, { timeoutMs = 500, signal } = {}) {
    const uniquePorts = [...new Set(ports)];
    const open = await Promise.all(uniquePorts.map((port) => probeTcpPort(ip, port, { timeoutMs, signal })));
    return uniquePorts.filter((_, index) => open[index]).sort((a, b) => a - b);
  }
}

function readTcpBanner(ip, port, { timeoutMs = 1800, signal, request, maxBytes = 5000 } = {}) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';
    let settled = false;
    const finish = (error, value = '') => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      closeSocket(socket);
      if (error) reject(error);
      else resolve(value);
    };
    const onAbort = () => finish(createAbortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      if (request) socket.write(request(ip));
    });
    socket.on('data', (chunk) => {
      data += chunk.toString('latin1');
      if (data.length >= maxBytes) finish(null, data);
    });
    socket.once('close', () => finish(null, data));
    socket.once('timeout', () => finish(null, data));
    socket.once('error', (error) => finish(signal?.aborted ? createAbortError() : null, data));
    socket.connect(port, ip);
  });
}

class HttpBannerProbe {
  grab(ip, port = 80, { signal } = {}) {
    const request = (host) => `GET / HTTP/1.0\r\nHost: ${host}\r\nUser-Agent: NetworkScanner/1.0\r\n\r\n`;
    return readTcpBanner(ip, port, { signal, request }).then((banner) => banner.toLowerCase());
  }
}

class ServiceBannerProbe {
  grabSsh(ip, { signal } = {}) {
    return readTcpBanner(ip, 22, { timeoutMs: 2000, signal, maxBytes: 300 }).then((value) => value.trim());
  }

  async probeSip(ip, port = 5060, { signal } = {}) {
    const branch = `z9hG4bK-${Date.now()}`;
    const request = (host) => [
      `OPTIONS sip:${host} SIP/2.0`,
      `Via: SIP/2.0/TCP ${host}:${port};branch=${branch}`,
      `From: <sip:scanner@${host}>;tag=scanner`,
      `To: <sip:${host}>`,
      `Call-ID: scanner-${branch}@${host}`,
      'CSeq: 1 OPTIONS',
      'Max-Forwards: 1',
      'Content-Length: 0',
      '',
      ''
    ].join('\r\n');
    const banner = await readTcpBanner(ip, port, { timeoutMs: 1500, signal, request, maxBytes: 1000 });
    const normalized = banner.toLowerCase();
    return { isSip: normalized.includes('sip/2.0'), banner: normalized };
  }
}

module.exports = {
  ALL_PORTS,
  PortScanner,
  HttpBannerProbe,
  ServiceBannerProbe,
  probeTcpPort,
  readTcpBanner
};
