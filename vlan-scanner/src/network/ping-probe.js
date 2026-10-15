'use strict';

const { isIpv4 } = require('../domain/ip-address');
const { createAbortError, throwIfAborted } = require('../domain/cancellation');

class PingProbe {
  constructor(commandRunner, { executable = 'ping.exe', timeoutMs = 800 } = {}) {
    this.commandRunner = commandRunner;
    this.executable = executable;
    this.timeoutMs = timeoutMs;
  }

  async probe(ip, { signal, timeoutMs = this.timeoutMs } = {}) {
    if (!isIpv4(ip)) return { ip, alive: false, latencyMs: null, ttl: null };
    try {
      const { stdout } = await this.commandRunner.run(
        this.executable,
        ['-n', '1', '-w', String(timeoutMs), ip],
        { timeout: timeoutMs + 500, signal }
      );
      const ttlMatch = stdout.match(/TTL[=:](\d+)/i);
      const latencyMatch = stdout.match(/(?:time|tiempo)[=<]\s*(\d+)\s*ms/i);
      return {
        ip,
        alive: Boolean(ttlMatch),
        latencyMs: latencyMatch ? Number(latencyMatch[1]) : null,
        ttl: ttlMatch ? Number(ttlMatch[1]) : null
      };
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw createAbortError();
      return { ip, alive: false, latencyMs: null, ttl: null };
    }
  }
}

module.exports = { PingProbe };
