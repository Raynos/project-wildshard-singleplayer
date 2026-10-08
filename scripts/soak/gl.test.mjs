import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSoakGl, installSoakWasm, installLoadingGlJournal } from './gl.mjs';

void test('SF57 loading journal survives ordinary navigation, preserves sequence and disables mutations before playing', () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage, storage = new Map();
  let hide;
  try {
    globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } };
    const page = id => ({ __sf57DocumentId: id, addEventListener: (name, listener) => { assert.equal(name, 'pagehide'); hide = listener; } });
    globalThis.window = page('first'); installLoadingGlJournal();
    window.__sc_gl_change({ op: 'allocation', at: Date.now() / 1000, id: 'buffer:1', bytes: 64 }); hide();
    assert.equal(window.__sc_gl_change, null);
    globalThis.window = page('second'); installLoadingGlJournal();
    assert.deepEqual(window.__sf57GLEvents.map(row => [row.document, row.sequence, row.op]),
      [['first', 0, 'begin'], ['first', 1, 'allocation'], ['first', 2, 'end'], ['second', 0, 'begin']]);
    window.__sf57StopGLJournal(); assert.equal(window.__sc_gl_change, null);
    assert.equal(window.__sf57GLEvents.at(-1).op, 'stop');
    hide(); assert.equal(storage.size, 0, 'Playing navigation does not create a new loading journal');
  } finally { globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; }
});

void test('SF57 preserves labelled GL allocations, reconciliation and allocator telemetry each second', () => {
  const oldWindow = globalThis.window, oldInterval = globalThis.setInterval;
  let tick, lost;
  const contexts = [{ totalBytes: 100, texBytes: 60, rbBytes: 30, bufBytes: 10, unlabelled: 0, reconciled: true,
    resources: [{ owner: 'template-1', asset: 'model:a', bytes: 60 }, { owner: 'template-1', asset: 'model:a', bytes: 10 }] }];
  try {
    globalThis.setInterval = (callback, period) => { assert.equal(period, 1000); tick = callback; return 1; };
    globalThis.window = { __sc_gl: () => contexts, __sf57Errors: [], __sf57: { cycles: 2 },
      __wildshard: { shard: { grid: { state: () => ({ accountedBytes: 400_000_000, rings: { inFlight: 0, queued: 0 }, live: { live: { pending: [], gameplayReady: true } } }) } } },
      addEventListener: (name, listener) => { assert.equal(name, 'webglcontextlost'); lost = listener; } };
    installSoakGl(); tick();
    const row = window.__sf57GL[0];
    assert.equal(row.totalBytes, 100); assert.equal(row.accountedBytes, 400_000_000); assert.equal(row.cycle, 2);
    assert.deepEqual(row.assets, [{ owner: 'template-1', asset: 'model:a', bytes: 70, resources: 2 }]);
    assert.equal(row.reconciled, true); contexts[0].reconciled = false; contexts[0].unlabelled = 1; tick();
    assert.equal(window.__sf57GL[1].reconciled, false); assert.equal(window.__sf57GL[1].unlabelled, 1);
    contexts[0].totalBytes = 0; tick(); assert.equal(window.__sf57GL[2].totalBytes, 0);
    lost(); assert.deepEqual(window.__sf57Errors, ['WebGL context lost']);
  } finally { globalThis.window = oldWindow; globalThis.setInterval = oldInterval; }
});


void test('SF57 WASM telemetry is weak, deduplicated and never added to GL allocations', async () => {
  const oldWindow = globalThis.window;
  class Memory { buffer = new ArrayBuffer(64); }
  const memory = new Memory(), instance = { exports: { memory } };
  const wasm = { Memory, instantiate: () => Promise.resolve({ instance }), instantiateStreaming: () => Promise.resolve(instance),
    Instance: class { exports = { memory }; } };
  try {
    globalThis.window = { WebAssembly: wasm };
    installSoakWasm(); await wasm.instantiate(); await wasm.instantiateStreaming(); new wasm.Instance();
    assert.equal(window.__sf57Wasm.length, 1); assert.ok(window.__sf57Wasm[0].memory instanceof WeakRef);
    assert.equal(window.__sf57Wasm[0].memory.deref().buffer.byteLength, 64);
  } finally { globalThis.window = oldWindow; }
});
