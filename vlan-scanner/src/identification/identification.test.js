'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DeviceClassifier } = require('./device-classifier');
const { OsFingerprintService } = require('./os-detector');

const classifier = new DeviceClassifier();
const detector = new OsFingerprintService();

test('DeviceClassifier usa reglas de fabricante y puertos', () => {
  assert.equal(classifier.classify({ vendor: 'Fortinet' }), 'firewall');
  assert.equal(classifier.classify({ vendor: 'Yealink' }), 'voip');
  assert.equal(classifier.classify({ ports: [9100] }), 'printer');
  assert.equal(classifier.classify({ ports: [554] }), 'nvr-camera');
  assert.equal(classifier.classify({ ports: [445, 3389] }), 'windows-server');
  assert.equal(classifier.classify({ ports: [22] }), 'server');
});

test('OsFingerprintService detecta banners e inferencias', () => {
  assert.equal(detector.detect({ sshBanner: 'SSH-2.0-OpenSSH Ubuntu' }), 'Linux — Ubuntu');
  assert.equal(detector.detect({ httpBanner: 'Server: nginx/1.26.0' }), 'Linux — Nginx 1.26.0');
  assert.equal(detector.detect({ ports: [445, 3389], vendor: 'Dell' }), 'Windows (RDP+SMB)');
  assert.equal(detector.detect({ ttl: 128 }), 'Windows');
  assert.equal(detector.detect({}), 'Desconocido');
});

test('DeviceClassifier clasifica smartphones con prioridad', () => {
  const c = new (require('./device-classifier').DeviceClassifier)();
  assert.equal(c.classify({ hostname: 'iphone', vendor: 'Apple', os: 'iOS', ports: [] }), 'smartphone');
  assert.equal(c.classify({ vendor: 'Samsung', os: 'Android', ports: [80] }), 'smartphone');
  assert.notEqual(c.classify({ ports: [554, 8000] }), 'smartphone');
  assert.notEqual(c.classify({ ports: [5060] }), 'smartphone');
  assert.notEqual(c.classify({ vendor: 'Apple', ports: [22, 80, 443] }), 'smartphone');
});

test('normalizeMobileOs delega en classifier', () => {
  const { normalizeMobileOs } = require('./os-detector');
  assert.equal(normalizeMobileOs('Android 14'), 'Android');
});
