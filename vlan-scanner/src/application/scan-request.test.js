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

test('createScanPlan normaliza la categoría y omite sondeos que no aplican', () => {
  const all = createScanPlan({ fromIp: '10.0.0.1', toIp: '10.0.0.1' });
  assert.equal(all.category, 'all');
  assert.equal(all.probePrinters, true);

  const printers = createScanPlan({ fromIp: '10.0.0.1', toIp: '10.0.0.1', category: 'IMPRESORAS' });
  assert.equal(printers.category, 'printer');
  assert.equal(printers.categoryLabel, 'impresoras');
  assert.equal(printers.probePrinters, true);

  // Las workstations comparten impresoras (EB0607 → Godex): la columna
  // «Impresora compartida» necesita el sondeo también en este escaneo.
  const workstations = createScanPlan({ fromIp: '10.0.0.1', toIp: '10.0.0.1', category: 'workstation' });
  assert.equal(workstations.category, 'workstation');
  assert.equal(workstations.probePrinters, true);
  assert.equal(workstations.scanPorts, true);

  // Un false explícito sigue mandando sobre la categoría.
  const sinSondeo = createScanPlan({ fromIp: '10.0.0.1', toIp: '10.0.0.1', category: 'workstation', probePrinters: false });
  assert.equal(sinSondeo.probePrinters, false);

  const servers = createScanPlan({ fromIp: '10.0.0.1', toIp: '10.0.0.1', category: 'server', scanPorts: false });
  assert.equal(servers.category, 'server');
  assert.equal(servers.scanPorts, true);
  assert.equal(servers.probePrinters, false);

  assert.throws(
    () => createScanPlan({ fromIp: '10.0.0.1', toIp: '10.0.0.1', category: 'inexistente' }),
    /Categoría/
  );
});
