'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createPreloadApi } = require('./preload-api');

test('createPreloadApi expone facadas segregated y suscripciones limpiables', () => {
  const ipcRenderer = new EventEmitter();
  const calls = [];
  ipcRenderer.invoke = (channel, payload) => {
    calls.push({ channel, payload });
    return Promise.resolve(channel);
  };
  let exposed;
  const contextBridge = { exposeInMainWorld: (_name, api) => { exposed = api; } };
  createPreloadApi({ contextBridge, ipcRenderer });

  assert.ok(exposed.network);
  assert.ok(exposed.export);
  assert.ok(exposed.window);
  assert.ok(exposed.external);
  assert.equal(exposed.detectVlans, undefined);

  const received = [];
  const id = exposed.network.onProgress((event) => received.push(event));
  ipcRenderer.emit('scan-progress', {}, { runId: 'one' });
  assert.deepEqual(received, [{ runId: 'one' }]);
  assert.equal(exposed.network.unsubscribe('progress', id), true);
  ipcRenderer.emit('scan-progress', {}, { runId: 'two' });
  assert.equal(received.length, 1);

  exposed.network.cancel('run-123');
  assert.deepEqual(calls.at(-1), { channel: 'stop-scan', payload: { runId: 'run-123' } });
  assert.throws(() => exposed.network.onProgress(null), TypeError);
});
