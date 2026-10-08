import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSoakGl, installSoakWasm, installLoadingGlJournal, installSoakDiagnostics } from './gl.mjs';
import { loadingGlSamples } from './owned.mjs';

void test('SF57 preserves bounded console, actual loss target and admitting-cell evidence through navigation without changing handling', () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage, storage = new Map(), listeners = new Map();
  const calls = [], canvas = { tagName: 'CANVAS', id: 'game', isConnected: true };
  try {
    globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } };
    const page = document => ({ __sf57DocumentId: document,
      console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(method => [method, (...args) => { calls.push([method, ...args]); }])),
      addEventListener: (name, listener) => { listeners.set(name, listener); },
      __wildshard: { world: { game: { canvas } }, shard: { grid: { state: () => ({ inside: 'road', live: {
        live: { current: null, pending: ['pine-hollow'] }, runtimeTiming: { current: { instance: 'pine-hollow', hook: 'world', start: 123 } },
      } }) } } } });
    globalThis.window = page('first'); installSoakDiagnostics();
    for (let index = 0; index < 140; index++) window.console.log(index);
    window.console.warn('before loss');
    const loss = { target: canvas, statusMessage: 'fixture', preventDefault: () => { throw new Error('Must not change recovery'); } };
    listeners.get('webglcontextlost')(loss);
    listeners.get('pagehide')({ persisted: false });
    assert.equal(window.__sf57Diagnostics.length, 128); assert.equal(calls.length, 141);
    globalThis.window = page('second'); installSoakDiagnostics();
    const records = window.__sf57Diagnostics;
    assert.equal(records.at(-3).text, 'before loss'); assert.equal(records.at(-3).method, 'warn');
    const actual = records.at(-2); assert.equal(actual.gameCanvas, true); assert.equal(actual.kind, 'contextlost');
    assert.deepEqual(actual.target, { tag: 'CANVAS', id: 'game', connected: true });
    assert.deepEqual(actual.admitting, { instance: 'pine-hollow', hook: 'world', start: 123 });
    assert.deepEqual(actual.pending, ['pine-hollow']); assert.equal(actual.current, null);
    assert.equal(records.at(-1).kind, 'pagehide'); assert.equal(records.at(-1).document, 'first');
    assert.equal(JSON.stringify(records).includes('preventDefault'), false, 'No event/game objects retained');
  } finally { globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; }
});

void test('SF57 journal suppresses repeated assertions but preserves exact resize, relabel, deletion and new lifetime state', () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage;
  try {
    globalThis.sessionStorage = { getItem: () => null, removeItem: () => undefined };
    globalThis.window = { __sf57DocumentId: 'mutations', addEventListener: () => undefined };
    installLoadingGlJournal();
    const emit = row => { window.__sc_gl_change({ at: Date.now() / 1000, id: 'buffer:1', ...row }); };
    const allocation = { op: 'allocation', kind: 'buffer', bytes: 64, labelled: false };
    emit(allocation); emit({ op: 'label', owner: 'first', asset: 'mesh' });
    for (let index = 0; index < 10000; index++) emit({ op: 'label', owner: 'first', asset: 'mesh' });
    const labelled = { ...allocation, labelled: true, owner: 'first', asset: 'mesh' }; emit(labelled);
    for (let index = 0; index < 10000; index++) emit(labelled);
    emit({ ...labelled, bytes: 128 }); emit({ op: 'label', owner: 'second', asset: 'mesh' });
    emit({ ...allocation, bytes: null }); emit({ ...allocation, bytes: null });
    emit(allocation); emit({ op: 'label', owner: 'second', asset: 'mesh' });
    window.__sf57MarkGLCycle(0); window.__sf57StopGLJournal();
    const events = window.__sf57GLEvents;
    assert.equal(events.length, 11, 'Twenty thousand unchanged assertions create no journal entries');
    assert.deepEqual(events.map(row => row.sequence), Array.from({ length: 11 }, (_, index) => index));
    assert.deepEqual(window.__sf57GLPosition(), { document: 'mutations', sequence: 10 });
    const at = events.at(-1).at, replay = loadingGlSamples(events, [at]).get(at);
    assert.equal(replay.totalBytes, 64); assert.equal(replay.unlabelled, 0); assert.equal(replay.cycle, 0);
  } finally { globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; }
});

void test('SF57 journal survives boot navigation and records explicit playing cycles until teardown', () => {
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
    window.__sf57MarkGLCycle(0); window.__sf57MarkGLCycle(1);
    assert.equal(window.__sf57.cycles, 1);
    assert.deepEqual(window.__sf57GLEvents.slice(-2).map(row => [row.sequence, row.op, row.cycle]), [[1, 'cycle', 0], [2, 'cycle', 1]]);
    assert.throws(() => window.__sf57MarkGLCycle(-1), /Invalid GL journal cycle/u);
    window.__sf57StopGLJournal(); assert.equal(window.__sc_gl_change, null);
    assert.equal(window.__sf57GLEvents.at(-1).op, 'stop');
    assert.throws(() => window.__sf57MarkGLCycle(2), /Invalid GL journal cycle/u);
    hide(); assert.equal(storage.size, 0, 'Stopped journal is not persisted again');
  } finally { globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; }
});

void test('SF57 optional upload trace counts same-sized calls, bounds blocked queues and records navigation truncation', () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage, storage = new Map();
  let hide;
  try {
    globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } };
    const page = (id, trace) => ({ __sf57DocumentId: id, __sf57TraceUploads: trace, addEventListener: (_name, listener) => { hide = listener; } });
    globalThis.window = page('first', true); installLoadingGlJournal();
    const row = { op: 'allocation', operation: 'bufferData', kind: 'buffer', id: 'buffer:1', bytes: 64, at: 1 };
    for (let index = 0; index < 10001; index++) window.__sc_gl_change(row);
    assert.equal(window.__sf57GLEvents.length, 2, 'Exact state journal still coalesces unchanged storage');
    assert.equal(window.__sf57GLUploads.length, 10000); assert.equal(window.__sf57UploadOverflow, 1);
    hide(); globalThis.window = page('second', true); installLoadingGlJournal();
    assert.equal(window.__sf57GLUploads.length, 1000); assert.equal(window.__sf57UploadOverflow, 9001);
    assert.equal(window.__sf57GLUploads[0].document, 'first');
    assert.equal(window.__sf57GLUploads[0].uploadSequence, 9000);
    window.__sf57GLUploads.splice(0); window.__sf57TraceUploads = false;
    window.__sc_gl_change(row); assert.equal(window.__sf57GLUploads.length, 0, 'Ordinary soak does not collect storage-call traces');
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
      __sf57GLPosition: () => ({ document: 'census', sequence: 42 }),
      __wildshard: { shard: { grid: { state: () => ({ accountedBytes: 400_000_000, rings: { inFlight: 0, queued: 0 }, live: { live: { pending: [], gameplayReady: true } } }) } } },
      addEventListener: (name, listener) => { assert.equal(name, 'webglcontextlost'); lost = listener; } };
    installSoakGl(); tick();
    const row = window.__sf57GL[0];
    assert.equal(row.totalBytes, 100); assert.equal(row.accountedBytes, 400_000_000); assert.equal(row.cycle, 2);
    assert.deepEqual(row.journal, { document: 'census', sequence: 42 });
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

void test('optional travel storage call sites are sampled once per operation per second with a hard scalar cap', () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage;
  try {
    globalThis.sessionStorage = { getItem: () => null, removeItem: () => undefined };
    globalThis.window = { __sf57DocumentId: 'sites', __sf57TraceUploads: true, addEventListener: () => undefined };
    installLoadingGlJournal();
    const row = { op: 'allocation', operation: 'bufferData', kind: 'buffer', id: 'buffer:1', context: 'game', stage: 'travel', bytes: 64, at: 1 };
    for (let index = 0; index < 1000; index++) window.__sc_gl_change(row);
    for (let second = 2; second < 140; second++) window.__sc_gl_change({ ...row, at: second });
    const sites = window.__sf57GLUploads.filter(value => typeof value.callSite === 'string');
    assert.equal(sites.length, 128);
    assert.equal(sites.filter(value => value.at === 1).length, 1);
    assert.ok(sites.every(value => value.callSite.length <= 6000 && value.callSite.includes('SF57 storage call site')));
    window.__sf57TraceUploads = false;
    window.__sc_gl_change({ ...row, at: 200 });
    assert.equal(window.__sf57GLUploads.length, 1138);
  } finally { globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage; }
});
