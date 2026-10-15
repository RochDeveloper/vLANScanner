'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createScanPlan } = require('./scan-request');

test('createScanPlan crea un plan inclusivo y seguro', () => {
  const plan = createScanPlan({
    runId: 'scan-test-1234',
    fromIp: '192.168.1.250',
    toIp: '192.168.2.2',
    scanPorts: false,
    resolveHostnames: true
  });
  assert.equal(plan.total, 9);
  assert.equal(plan.scanPorts, false);
  assert.equal(plan.resolveHostnames, true);
  assert.equal(plan.fromNumber + plan.total - 1, plan.toNumber);
});

test('createScanPlan rechaza rangos y payloads inválidos', () => {
  assert.throws(() => createScanPlan({ fromIp: '256.0.0.1', toIp: '256.0.0.2' }), /IPv4/);
  assert.throws(() => createScanPlan({ fromIp: '10.0.0.10', toIp: '10.0.0.1' }), /anterior/);
  assert.throws(() => createScanPlan({ fromIp: '10.0.0.1', toIp: '10.1.0.1' }), /máximo/);
  assert.throws(() => createScanPlan({ runId: 'corto', fromIp: '10.0.0.1', toIp: '10.0.0.1' }), /Identificador/);
});
