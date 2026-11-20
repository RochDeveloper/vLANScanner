'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SCAN_CATEGORIES,
  normalizeScanCategory,
  getScanCategory,
  matchesScanCategory
} = require('./scan-categories');

test('normalizeScanCategory acepta ids, alias y valores vacíos', () => {
  assert.equal(normalizeScanCategory(), 'all');
  assert.equal(normalizeScanCategory('  '), 'all');
  assert.equal(normalizeScanCategory('printer'), 'printer');
  assert.equal(normalizeScanCategory('IMPRESORAS'), 'printer');
  assert.equal(normalizeScanCategory('nvr'), 'recorder');
  assert.equal(normalizeScanCategory('PCS'), 'workstation');
  assert.throws(() => normalizeScanCategory('tostadoras'), /Categoría/);
});

test('matchesScanCategory limita por tipo de dispositivo', () => {
  assert.equal(matchesScanCategory('workstation', 'all'), true);
  assert.equal(matchesScanCategory('printer', 'printer'), true);
  assert.equal(matchesScanCategory('workstation', 'printer'), false);
  assert.equal(matchesScanCategory('windows-server', 'server'), true);
  assert.equal(matchesScanCategory('server', 'server'), true);
  assert.equal(matchesScanCategory('nvr-camera', 'recorder'), true);
  assert.equal(matchesScanCategory('switch', 'network'), true);
  assert.equal(matchesScanCategory('firewall', 'network'), true);
  assert.equal(matchesScanCategory('smartphone', 'mobile'), true);
  assert.equal(matchesScanCategory('vm', 'vm'), true);
});

test('todas las categorías exponen id, etiqueta e icono', () => {
  for (const category of SCAN_CATEGORIES) {
    assert.ok(category.id);
    assert.ok(category.label);
    assert.ok(category.icon);
    assert.equal(getScanCategory(category.id).id, category.id);
  }
});
