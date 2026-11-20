'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ScanController } = require('./scan-controller');

class FakeNetworkPort {
  constructor() {
    this.callbacks = {};
    this.scanPromise = null;
    this.resolveScan = null;
    this.cancelled = null;
  }

  onProgress(callback) { this.callbacks.progress = callback; return 1; }
  onHost(callback) { this.callbacks.host = callback; return 2; }
  onState(callback) { this.callbacks.state = callback; return 3; }
  unsubscribe(kind, id) { delete this.callbacks[kind]; return id > 0; }
  cancel(runId) { this.cancelled = runId; return Promise.resolve({ runId, status: 'cancelling' }); }
  scan(request) {
    this.request = request;
    this.scanPromise = new Promise((resolve) => { this.resolveScan = resolve; });
    return this.scanPromise;
  }
}

test('ScanController mantiene stopping hasta evento terminal e ignora eventos tarde', async () => {
  const network = new FakeNetworkPort();
  const statuses = [];
  const progress = [];
  let clock = 0;
  const controller = new ScanController({
    networkPort: network,
    onStatus: (status) => statuses.push(status.status),
    onProgress: (event) => progress.push(event),
    onElapsed: () => {},
    now: () => clock,
    setTimer: () => 1,
    clearTimer: () => {},
    runIdFactory: () => 'scan-controller-1'
  });
  controller.initialize();
  const execution = controller.start({ fromIp: '10.0.0.1', toIp: '10.0.0.1', scanPorts: false, resolveHostnames: true });
  assert.equal(network.request.category, 'all');
  await controller.stop();
  assert.equal(network.cancelled, 'scan-controller-1');
  assert.deepEqual(statuses, ['running', 'stopping']);
  network.callbacks.state({ runId: 'scan-controller-1', status: 'cancelled', progress: { scanned: 1, total: 1 } });
  network.callbacks.progress({ runId: 'scan-controller-1', scanned: 2, total: 1 });
  network.resolveScan({ runId: 'scan-controller-1', status: 'cancelled', found: 0, hosts: [] });
  await execution;
  assert.equal(progress.length, 0);
  assert.equal(statuses.at(-1), 'cancelled');
  assert.equal(controller.isBusy(), false);
});
