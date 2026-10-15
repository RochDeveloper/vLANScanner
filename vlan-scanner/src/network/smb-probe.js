'use strict';

const { getNbtstat, parseNbtstatHostname } = require('../hostname');
const { raceWithAbort } = require('../domain/cancellation');

class SmbProbe {
  constructor({ query = getNbtstat, parse = parseNbtstatHostname } = {}) {
    this.query = query;
    this.parse = parse;
  }

  async inspect(ip, { signal } = {}) {
    const output = await raceWithAbort(Promise.resolve().then(() => this.query(ip)), signal);
    return { output, hostname: this.parse(output, ip) };
  }
}

module.exports = { SmbProbe };
