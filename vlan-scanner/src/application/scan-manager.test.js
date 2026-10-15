'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ScanManager } = require('./scan-manager');

function createSender() {
  const events = [];
  return { events, isDestroyed: () => false, send: (channel, payload) => events.push({ channel, payload }) };
}

test('ScanManager aísla ejecuciones y cancela la correcta', async () => {
  let clearCalls = 0;
  const plan = { runId: 'scan-cancel-1', total: 10 };
  const scanner = {
    scan(_plan, { signal, onProgress }) {
      onProgress({ runId: plan.runId, phase: 'probing', scanned: 2, total: 10, ip: '10.0.0.2' });
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('cancelled');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  };
  const manager = new ScanManager({
    scanner,
    hostnameResolver: { clearCacheForScan: () => { clearCalls += 1; } },
    createPlan: () => plan
  });
  const sender = createSender();
  const execution = manager.start({}, sender);
  assert.equal(clearCalls, 1);
  assert.throws(() => manager.start({ runId: 'scan-other-1' }, sender), /activo/);
  assert.deepEqual(manager.cancel('otro-run-id'), { runId: 'otro-run-id', status: 'not-found' });
  assert.deepEqual(manager.cancel(plan.runId), { runId: plan.runId, status: 'cancelling' });
  const summary = await execution;
  assert.equal(summary.status, 'cancelled');
  assert.equal(manager.activeRunId, null);
  const states = sender.events.filter((event) => event.channel === 'scan-state').map((event) => event.payload.status);
  assert.deepEqual(states, ['running', 'cancelled']);
  assert.equal(sender.events.filter((event) => event.channel === 'scan-host-found').length, 0);
});
