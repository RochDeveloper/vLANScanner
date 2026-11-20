'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { NetworkScanner } = require('./network-scanner');

const plan = {
  runId: 'scan-network-1', fromNumber: 1, toNumber: 3, total: 3,
  scanPorts: false, resolveHostnames: true
};

test('NetworkScanner emite progreso monotónico y hosts enriquecidos', async () => {
  const progress = [];
  const hosts = [];
  const pingProbe = {
    async probe(ip) {
      return { ip, alive: ip.endsWith('.2'), latencyMs: 4, ttl: 128 };
    }
  };
  const hostEnricher = {
    async enrich(ping) {
      return { ip: ping.ip, hostname: 'PC-OFICINA', openPorts: [], deviceType: 'workstation', os: 'Windows', latencyMs: 4 };
    }
  };
  const scanner = new NetworkScanner({ pingProbe, hostEnricher, batchSize: 2 });
  const result = await scanner.scan(plan, {
    onProgress: (event) => progress.push(event),
    onHostFound: (event) => hosts.push(event.host)
  });

  assert.equal(result.length, 1);
  assert.equal(hosts[0].ip, '0.0.0.2');
  assert.deepEqual(progress.filter((event) => event.phase === 'probing').map((event) => event.scanned), [1, 2, 3]);
  assert.ok(progress.every((event) => event.scanned >= 1 && event.scanned <= 3));
  assert.ok(progress.every((event) => event.runId === plan.runId));
  assert.ok(progress.some((event) => event.phase === 'enriching'));
});

test('NetworkScanner descarta los hosts que no pertenecen a la categoría', async () => {
  const categoryPlan = { ...plan, category: 'printer' };
  const pingProbe = {
    async probe(ip) {
      return { ip, alive: true, latencyMs: 1, ttl: 64 };
    }
  };
  const types = { '0.0.0.2': 'printer', '0.0.0.3': 'workstation' };
  const hostEnricher = {
    async enrich(ping) {
      return { ip: ping.ip, deviceType: types[ping.ip] || 'workstation' };
    }
  };
  const scanner = new NetworkScanner({ pingProbe, hostEnricher, batchSize: 3 });
  const found = [];
  const result = await scanner.scan(categoryPlan, {
    onHostFound: (event) => found.push(event.host)
  });

  assert.deepEqual(result.map((host) => host.ip), ['0.0.0.2']);
  assert.deepEqual(found.map((host) => host.ip), ['0.0.0.2']);
});
