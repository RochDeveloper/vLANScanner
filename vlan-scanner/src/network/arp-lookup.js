'use strict';

const { isIpv4 } = require('../domain/ip-address');
const { createAbortError, throwIfAborted } = require('../domain/cancellation');

class ArpLookup {
  constructor(commandRunner, { executable = 'arp.exe' } = {}) {
    this.commandRunner = commandRunner;
    this.executable = executable;
  }

  async lookup(ip, { signal } = {}) {
    if (!isIpv4(ip)) return '';
    try {
      const { stdout } = await this.commandRunner.run(this.executable, ['-a', ip], { timeout: 2000, signal });
      const escapedIp = ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ipPattern = new RegExp(`(?:^|\\s)${escapedIp}(?:\\s|$)`);
      for (const line of stdout.split(/\r?\n/)) {
        if (!ipPattern.test(line)) continue;
        const match = line.match(/([0-9a-f]{2}(?:[:-][0-9a-f]{2}){5})/i);
        if (match) return match[1].replace(/-/g, ':').toUpperCase();
      }
      return '';
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw createAbortError();
      return '';
    }
  }
}

module.exports = { ArpLookup };
