import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { ownedSoakPlans, soakRunPolicy, joinSoakSamples, soakAsyncEvaluator, soakLapMemory, soakGamePid, releaseSoakPreviews, soakRouteScope, loadingGlSamples, soakBootPoll } from './owned.mjs';
import { soakCatalogue } from './route.ts';

const catalogue = JSON.parse(readFileSync('src/game/grid/singleplayer.json', 'utf8')).grid;

void test('SF57 loading mutation replay covers blocked timers, resizes, labels and document retirement without interpolation', () => {
  const events = [
    { at: 0, op: 'begin' }, { at: 1, op: 'allocation', id: 'buffer:1', kind: 'buffer', bytes: 64, labelled: false },
    { at: 1, op: 'label', id: 'buffer:1', owner: 'engine', asset: 'fixture' },
    { at: 2, op: 'allocation', id: 'buffer:1', kind: 'buffer', bytes: 128 },
    { at: 8, op: 'allocation', id: 'buffer:1', kind: 'buffer', bytes: null }, { at: 9, op: 'end' },
  ].map((row, sequence) => Object.assign(row, { document: 'first', sequence }));
  events.push(...[{ at: 10, op: 'begin' }, { at: 11, op: 'allocation', id: 'buffer:1', kind: 'buffer', bytes: 20, labelled: true },
    { at: 12, op: 'stop' }].map((row, sequence) => Object.assign(row, { document: 'second', sequence })));
  const replay = loadingGlSamples(events, [-1, .5, 5, 8.5, 9.5, 11.5, 13]);
  assert.equal(replay.has(-1), false); assert.equal(replay.has(13), false);
  assert.deepEqual([...replay.values()].map(row => row.totalBytes), [0, 128, 0, 0, 20]);
  assert.equal(replay.get(5).unlabelled, 0); assert.equal(replay.get(5).reconciled, true);
  assert.equal(loadingGlSamples(events.slice(0, -1), [5]).size, 0);
  assert.equal(loadingGlSamples(events.filter(row => row.op !== 'end'), [5]).size, 0, 'Navigation must retire the previous document explicitly');
  assert.equal(loadingGlSamples(events.filter(row => row.at !== 2), [5]).size, 0, 'A lost mutation is missing evidence, never a guessed state');
  assert.equal(loadingGlSamples(events, [5], [{ at: 5, totalBytes: 999, unlabelled: 0, reconciled: true }]).size, 0,
    'Replay must also reconcile with the actual observed census');
  const native = [{ type: 'sample', phase: 'loading', t: new Date(5000).toISOString(), footprint: 500 }];
  assert.equal(joinSoakSamples(native, [], null, events)[0].gl.totalBytes, 128);
  assert.equal(joinSoakSamples([{ ...native[0], phase: 'drive' }], [], null, events)[0].gl, undefined, 'Playing still needs the actual one-second census');
});

void test('SF57 prepared-cell rehearsal records open coverage and refuses qualifying subset runs', () => {
  const cells = soakCatalogue(catalogue, 'dev');
  const route = ownedSoakPlans({ cells, home: 'driftwood-isle' }, 'cells', soakRouteScope('prepared'));
  assert.deepEqual(route.plans.map(plan => plan.to), ['pine-hollow', 'nalati-grasslands', 'template-2', 'driftwood-isle']);
  assert.deepEqual([...route.omitted].sort((a, b) => a.localeCompare(b)), ['far-reach', 'sunscar-dunes']);
  assert.equal(new Set(route.coveragePlans.map(plan => plan.crossroads).filter(Boolean)).size, 16);
  assert.throws(() => soakRouteScope('prepared', true), /rehearsal only/u);
  assert.throws(() => soakRouteScope('typo'), /Unknown soak route/u);
  assert.equal(soakRouteScope('catalogue', true), 'catalogue');
});

void test('SF57 borrowed previews survive cleanup; owned previews all stop even after one refusal', async () => {
  const bases = [{ base: 'http://127.0.0.1:4401/' }, { base: 'http://127.0.0.1:4402/' }];
  const stopped = [];
  const stop = base => { stopped.push(base); return Promise.reject(new Error('already closed')); };
  await releaseSoakPreviews(bases, stop, true);
  assert.deepEqual(stopped, []);
  await releaseSoakPreviews(bases, stop, false);
  assert.deepEqual(stopped, bases.map(row => row.base));
});

for (const layout of ['dev', 'shipped']) void test(`SF57 ${layout} enters every production instance and returns to one exact home baseline`, () => {
  const cells = soakCatalogue(catalogue, layout), route = ownedSoakPlans({ cells, home: 'driftwood-isle' });
  assert.deepEqual(route.plans.slice(0, 2).map(p => p.to), ['pine-hollow', 'nalati-grasslands']);
  assert.deepEqual(route.plans.map(p => p.to).sort(), cells.map(c => c.instance).sort());
  let previous = route.reference, from = 'driftwood-isle';
  for (const plan of [...route.plans, ...route.coveragePlans]) {
    assert.equal(plan.from, from); assert.equal(plan.start, undefined); assert.equal(plan.movement, 'road-hover'); assert.equal(plan.hoverMaxSpeed, 30);
    for (const point of plan.waypoints) {
      assert.ok(point.x === previous.x || point.z === previous.z, 'Each actual leg follows an axis through road midpoint sockets');
      previous = point;
    }
    from = plan.to;
  }
  assert.equal(from, 'driftwood-isle'); assert.deepEqual(previous, route.reference);
  assert.equal(new Set(route.coveragePlans.map(p => p.crossroads).filter(Boolean)).size, 16);
});

void test('SF57 dry run retains the ordinary deadline and all leases/samplers cover setup and teardown', () => {
  assert.deepEqual(soakRunPolicy(true), { seconds: 300, samplerSeconds: 1000, leaseMinutes: 20, dryRun: true });
  assert.equal(soakRunPolicy(false).seconds, 1800); assert.equal(soakRunPolicy(false, { receipt: 'docs/test.md', sourceRevision: 'a'.repeat(40), approvedBy: 'Jake' }).seconds, 3600);
  for (const dry of [true, false]) {
    const p = soakRunPolicy(dry); assert.ok(p.leaseMinutes * 60 > p.samplerSeconds);
  }
});

void test('SF57 joins only contemporaneous GL and preserves raw allocator and separate GPU bytes', () => {
  const native = [0, 1, 4].map(seconds => ({ type: 'sample', t: new Date(seconds * 1000).toISOString(), footprint: 500, gpu: 100 }));
  const rows = joinSoakSamples(native, [{ at: .2, totalBytes: 200, accountedBytes: 123 }, { at: 1.2, totalBytes: 250, accountedBytes: 456 }]);
  assert.equal(rows[0].gl.accountedBytes, 123); assert.equal(rows[1].gl.totalBytes, 250);
  assert.equal(rows[1].footprint, 500); assert.equal(rows[1].gpu, 100); assert.equal(rows[2].gl, undefined);
  assert.equal(joinSoakSamples(native, []).every(row => row.gl === undefined), true);
});


void test('SF57 Safari awaits async route results while sampling, and refuses navigation rather than reconnecting', async () => {
  const window = { __sf57DocumentId: 'original' }, context = { window, Promise };
  let observations = 0;
  const raw = expression => Promise.resolve(runInNewContext(expression, context));
  const evaluate = soakAsyncEvaluator(raw, () => { observations++; return Promise.resolve(); });
  assert.equal(await evaluate('Promise.resolve(42)'), 42); assert.ok(observations > 0);
  assert.deepEqual(Object.keys(window), ['__sf57DocumentId']);
  await assert.rejects(evaluate('Promise.reject(Error("failed runtime"))'), /failed runtime/u);
  const changed = soakAsyncEvaluator(raw, () => { window.__sf57DocumentId = 'reloaded'; return Promise.resolve(); });
  await assert.rejects(changed('new Promise(()=>{})'), /document changed/u);
});


void test('SF57 per-lap peaks sum WC+GL only and mark unfinished laps', () => {
  const perLap = soakLapMemory([{ phase: 'drive', footprint: 800, interval: 900, gpu: 9999,
    gl: { cycle: 0, totalBytes: 200, accountedBytes: 300, wasm: [{ bytes: 50 }] } },
    { phase: 'drive', footprint: 700, gpu: 10000, gl: { cycle: 1, totalBytes: 100, accountedBytes: 250 } }], 1);
  assert.equal(perLap[0].peakBytes, 1100); assert.equal(perLap[0].gpuProcessPeakBytes, 9999);
  assert.equal(perLap[0].accountedPeakBytes, 300); assert.equal(perLap[0].wasmPeakBytes, 50);
  assert.equal(perLap[0].complete, true); assert.equal(perLap[1].complete, false);
});


void test('SF57 binds playing WC to the admitted game PID, not the prewarm, and fails missing game readings', () => {
  const native = [{ type: 'sample', phase: 'loading', t: new Date(0).toISOString(), footprint: 545,
    pids: { 7: [500, 510], 9: [45, 45] } }, { type: 'sample', phase: 'drive', t: new Date(1000).toISOString(), footprint: 550,
    pids: { 7: [505, 515], 9: [45, 45] } }];
  assert.equal(soakGamePid(native), 7);
  const gl = [0, 1, 2].map(at => ({ at, totalBytes: 200 }));
  const rows = joinSoakSamples([...native, { type: 'sample', phase: 'drive', t: new Date(2000).toISOString(), footprint: 45, pids: { 9: [45, 45] } }], gl, 7);
  assert.equal(rows[0].footprint, 545); assert.equal(rows[1].footprint, 505); assert.equal(rows[1].interval, 515);
  assert.equal(rows[1].allWebContentBytes, 550); assert.equal(rows[2].footprint, 0);
  assert.throws(() => soakGamePid([]), /Missing native game/u);
});

void test('SF57 permits only the exact premeasurement WebKit target transition', async () => {
  const transition = () => Promise.reject(new Error("'Runtime' domain was not found"));
  assert.equal(await soakBootPoll(transition, true), false);
  await assert.rejects(soakBootPoll(transition, false), /Runtime/u);
  await assert.rejects(soakBootPoll(() => Promise.reject(new Error('Owned-shell load failed: broken')), true), /load failed/u);
  assert.equal(await soakBootPoll(() => Promise.resolve('ready'), true), 'ready');
});
