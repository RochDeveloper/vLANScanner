'use strict';

const { throwIfAborted } = require('../domain/cancellation');
const { numberToIPv4 } = require('../domain/ip-address');
const { matchesScanCategory } = require('../shared/scan-categories');

class NetworkScanner {
  constructor({ pingProbe, hostEnricher, batchSize = 24 } = {}) {
    this.pingProbe = pingProbe;
    this.hostEnricher = hostEnricher;
    this.batchSize = batchSize;
  }

  async scan(plan, { signal, onProgress = () => {}, onHostFound = () => {} } = {}) {
    const results = [];
    let scanned = 0;

    for (let offset = 0; offset < plan.total; offset += this.batchSize) {
      throwIfAborted(signal);
      const batchEnd = Math.min(offset + this.batchSize, plan.total);
      const probes = [];

      for (let index = offset; index < batchEnd; index++) {
        const ip = numberToIPv4(plan.fromNumber + index);
        probes.push(this.pingProbe.probe(ip, { signal }).then((result) => {
          scanned += 1;
          onProgress({
            runId: plan.runId,
            phase: 'probing',
            scanned,
            total: plan.total,
            ip: result.ip,
            status: 'comprobando'
          });
          return result;
        }));
      }

      const pingResults = await Promise.all(probes);
      throwIfAborted(signal);
      const alive = pingResults.filter((result) => result.alive);

      for (const pingResult of alive) {
        throwIfAborted(signal);
        onProgress({
          runId: plan.runId,
          phase: 'enriching',
          scanned,
          total: plan.total,
          ip: pingResult.ip,
          status: 'resolviendo'
        });

        const host = await this.hostEnricher.enrich(pingResult, {
          resolveHostnames: plan.resolveHostnames,
          scanPorts: plan.scanPorts,
          probePrinters: plan.probePrinters !== false,
          signal,
          onPhase: (status) => onProgress({
            runId: plan.runId,
            phase: 'enriching',
            scanned,
            total: plan.total,
            ip: pingResult.ip,
            status
          })
        });

        throwIfAborted(signal);
        if (!matchesScanCategory(host.deviceType, plan.category)) continue;
        results.push(host);
        onHostFound({ runId: plan.runId, host });
      }
    }

    return results;
  }
}

module.exports = { NetworkScanner };
