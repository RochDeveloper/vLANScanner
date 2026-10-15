'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { HostEnricher } = require('./host-enricher');

function createEnricher(ports = []) {
  const calls = { hostname: 0, smb: 0 };
  const enricher = new HostEnricher({
    hostnameResolver: { resolve: async () => { calls.hostname += 1; return 'NO-DEBE-APARECER'; } },
    arpLookup: { lookup: async () => '' },
    portScanner: { scan: async () => ports },
    httpBannerProbe: { grab: async () => '' },
    serviceBannerProbe: { grabSsh: async () => '', probeSip: async () => ({ isSip: false, banner: '' }) },
    smbProbe: { inspect: async () => { calls.smb += 1; return { output: '', hostname: 'SMB' }; } },
    vendorIdentifier: { identify: () => '' },
    deviceClassifier: { classify: () => 'workstation' },
    osFingerprintService: { detect: () => 'Windows' }
  });
  return { enricher, calls };
}

test('HostEnricher respeta la opción deshabilitar hostnames', async () => {
  const { enricher, calls } = createEnricher();
  const host = await enricher.enrich({ ip: '10.0.0.1', latencyMs: 1, ttl: 128 }, {
    resolveHostnames: false,
    scanPorts: false
  });
  assert.equal(host.hostname, '');
  assert.equal(calls.hostname, 0);
  assert.equal(calls.smb, 0);
});

test('HostEnricher usa NetBIOS como respaldo cuando hostname está habilitado', async () => {
  const { enricher, calls } = createEnricher([445]);
  enricher.hostnameResolver.resolve = async () => '';
  const host = await enricher.enrich({ ip: '10.0.0.1', latencyMs: 1, ttl: 128 }, {
    resolveHostnames: true,
    scanPorts: true
  });
  assert.equal(host.hostname, 'SMB');
  assert.equal(calls.smb, 1);
});

test('HostEnricher añade campos smartphone cuando el clasificador lo indica', async () => {
  const enricher = new (require('./host-enricher').HostEnricher)({
    hostnameResolver: { resolve: async () => 'iphone' },
    arpLookup: { lookup: async () => '' },
    portScanner: { scan: async () => [] },
    httpBannerProbe: { grab: async () => '' },
    serviceBannerProbe: { grabSsh: async () => '', probeSip: async () => ({ isSip: false, banner: '' }) },
    smbProbe: { inspect: async () => ({ output: '', hostname: '' }) },
    vendorIdentifier: { identify: () => 'Apple' },
    deviceClassifier: { classify: () => 'workstation' },
    osFingerprintService: { detect: () => 'iOS/iPadOS' },
    mobilePhoneClassifier: { analyze: () => ({ isPhone: true, deviceType: 'smartphone', phoneOS: 'iOS', phoneHint: 'Apple iPhone (estimado)', phoneConfidence: 'high', phoneEvidence: ['hostname:iphone'], phoneFormFactor: 'handset' }) }
  });
  const host = await enricher.enrich({ ip: '10.0.0.1', latencyMs: 1, ttl: 64 }, { resolveHostnames: true, scanPorts: false });
  assert.equal(host.deviceType, 'smartphone');
  assert.equal(host.phoneOS, 'iOS');
  assert.equal(host.phoneEvidence.length, 1);
});

test('HostEnricher no rompe si el clasificador móvil falla', async () => {
  const enricher = new (require('./host-enricher').HostEnricher)({
    hostnameResolver: { resolve: async () => '' },
    arpLookup: { lookup: async () => '' },
    portScanner: { scan: async () => [] },
    httpBannerProbe: { grab: async () => '' },
    serviceBannerProbe: { grabSsh: async () => '', probeSip: async () => ({ isSip: false, banner: '' }) },
    smbProbe: { inspect: async () => ({ output: '', hostname: '' }) },
    vendorIdentifier: { identify: () => '' },
    deviceClassifier: { classify: () => 'workstation' },
    osFingerprintService: { detect: () => 'Windows' },
    mobilePhoneClassifier: { analyze: () => { throw new Error('boom'); } }
  });
  const host = await enricher.enrich({ ip: '10.0.0.1', latencyMs: 1, ttl: 128 }, { resolveHostnames: false, scanPorts: false });
  assert.equal(host.status, 'online');
  assert.deepEqual(host.phoneEvidence, ['classifier-error']);
});
