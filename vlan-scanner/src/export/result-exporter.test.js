'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeResults, csvCell } = require('./result-exporter');

test('serializeResults genera JSON estable', () => {
  const hosts = [{ ip: '10.0.0.1', hostname: 'PC-01' }];
  assert.deepEqual(JSON.parse(serializeResults(hosts, 'json')), hosts);
});

test('CSV escapa comillas, saltos y fórmulas', () => {
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('say "hi"\nnext'), '"say ""hi""\nnext"');
  const csv = serializeResults([{
    ip: '10.0.0.1', hostname: 'PC, "001"', mac: '', vendor: '', deviceType: 'workstation', os: 'Windows', openPorts: [22, 80], latencyMs: 3
  }], 'csv');
  assert.match(csv, /"PC, ""001"""/);
  assert.match(csv, /"22,80"/);
  assert.throws(() => serializeResults([], 'xml'), /no soportado/);
});

test('el CSV expone las impresoras compartidas y su recurso', () => {
  const csv = serializeResults([{
    ip: '172.16.11.177',
    hostname: 'EB0607',
    sharedPrinterCount: 1,
    printers: [
      { name: 'Godex RT700i', connectionType: 'USB', port: 'USB002', shared: true, shareName: 'Godex Almacen2' },
      { name: 'Fax', connectionType: 'Local', port: 'SHRFAX:', shared: false, shareName: null }
    ]
  }], 'csv');
  assert.ok(csv.includes('Shared Printers'));
  assert.ok(csv.includes('COMPARTIDA (Godex Almacen2)'));
  assert.ok(!csv.includes('Fax [Local / SHRFAX:] COMPARTIDA'));
});
