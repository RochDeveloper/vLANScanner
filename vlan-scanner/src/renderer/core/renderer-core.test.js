'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('./ip-range');
const { createRangePlan } = require('./ip-range');
const { VlanService, validateVlan } = require('./vlan');
const { selectVisibleHosts } = require('./selectors');

const idsForHost = (host) => new VlanService().idsForHost(host);

test('createRangePlan valida límites y tamaño', () => {
  assert.equal(createRangePlan('192.168.1.250', '192.168.2.2').total, 9);
  assert.throws(() => createRangePlan('192.168.1.256', '192.168.1.1'), /IPv4/);
  assert.throws(() => createRangePlan('10.0.0.2', '10.0.0.1'), /anterior/);
});

test('VlanService valida VLAN y respeta CIDR', () => {
  const service = new VlanService();
  service.add({ id: 100, name: 'Producción', subnet: '10.50.0.128/25', color: '#112233' });
  assert.deepEqual(service.idsForHost({ ip: '10.50.0.200' }), [100]);
  assert.deepEqual(service.idsForHost({ ip: '10.50.0.10' }), [1]);
  assert.throws(() => validateVlan({ id: 4095, name: 'X', subnet: '—', color: '#112233' }), /entre 1/);
  assert.throws(() => service.remove(1), /Default/);
});

test('selectVisibleHosts filtra y ordena sin mutar el estado exterior', () => {
  const hosts = [
    { ip: '192.168.1.10', hostname: 'PC-2', deviceType: 'workstation' },
    { ip: '192.168.1.2', hostname: 'Router', deviceType: 'router' }
  ];
  const visible = selectVisibleHosts(hosts, { activeFilter: 'all', search: 'pc', sort: { key: 'ip', ascending: true } }, idsForHost);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].ip, '192.168.1.10');
  assert.equal(hosts[0].ip, '192.168.1.10');
});
