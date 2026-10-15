'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const classifier = require('./mobile-phone-classifier');

test('MobilePhoneClassifier detecta iPhone estable', () => {
  const analysis = classifier.analyzeMobilePhone({
    hostname: 'iPhone de Ana',
    vendor: 'Apple',
    os: 'iOS',
    openPorts: []
  });
  assert.equal(analysis.isPhone, true);
  assert.equal(analysis.deviceType, 'smartphone');
  assert.equal(analysis.phoneOS, 'iOS');
  assert.notEqual(analysis.phoneConfidence, 'low');
  assert.ok(analysis.phoneEvidence.includes('hostname:iphone'));
  assert.ok(analysis.phoneEvidence.includes('os:ios'));
  assert.equal(analysis.phoneFormFactor, 'handset');
});

test('MobilePhoneClassifier detecta Android Galaxy tablet', () => {
  const analysis = classifier.analyzeMobilePhone({
    hostname: 'Galaxy-Tab-A8',
    vendor: 'Samsung',
    os: 'Android',
    openPorts: []
  });
  assert.equal(analysis.isPhone, true);
  assert.equal(analysis.phoneOS, 'Android');
  assert.equal(analysis.phoneFormFactor, 'tablet');
  assert.match(analysis.phoneHint, /Samsung Galaxy Tab/);
});

test('MobilePhoneClassifier rechaza Samsung solo por OUI/TTL', () => {
  const analysis = classifier.analyzeMobilePhone({
    vendor: 'Samsung',
    openPorts: [],
    ttl: 64
  });
  assert.equal(analysis.isPhone, false);
  assert.equal(analysis.phoneOS, null);
  assert.deepEqual(analysis.phoneEvidence, []);
});

test('MobilePhoneClassifier rechaza PC con puertos y conflictos', () => {
  const analysis = classifier.analyzeMobilePhone({
    hostname: 'android-5f3c',
    openPorts: [135, 445]
  });
  assert.equal(analysis.isPhone, false);
  assert.ok(analysis.conflicts.includes('pc-ports'));
});

test('MobilePhoneClassifier soporta iPhone sin vendor claro', () => {
  const analysis = classifier.analyzeMobilePhone({
    hostname: 'iphone',
    vendor: '',
    ttl: 64
  });
  assert.equal(analysis.isPhone, true);
  assert.equal(analysis.phoneOS, 'iOS');
  assert.equal(analysis.phoneHint, null);
});

test('MobilePhoneClassifier rechaza MAC desconocida', () => {
  const analysis = classifier.analyzeMobilePhone({ vendor: '', openPorts: [] });
  assert.equal(analysis.isPhone, false);
});

test('normalizeMobileOs funciona', () => {
  assert.equal(classifier.normalizeMobileOs('Android 14'), 'Android');
  assert.equal(classifier.normalizeMobileOs('iOS 17'), 'iOS');
});

test('normalizeMobileOs infiere SO por hostname', () => {
  assert.equal(classifier.normalizeMobileOs('', { hostname: 'iPhone de Ana' }), 'iOS');
  assert.equal(classifier.normalizeMobileOs('', { hostname: 'android-phone' }), 'Android');
});
test('isMobileConflict detecta conflictos', () => {
  assert.deepEqual(classifier.isMobileConflict({ openPorts: [135], sipConfirmed: true }), ['pc-ports', 'sip']);
});