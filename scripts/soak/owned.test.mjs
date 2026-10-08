import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ownedSoakPlans, soakRunPolicy, joinSoakSamples, soakAsyncEvaluator, soakLapMemory, soakGamePid, releaseSoakPreviews, soakRouteScope, loadingGlSamples, soakBootPoll } from './owned.mjs';
import { soakCatalogue } from './route.ts';

const catalogue = JSON.parse(readFileSync('src/game/grid/singleplayer.json', 'utf8')).grid;

void test('SF57 context lifecycle metadata never invents bytes and invalid lifecycle records refuse replay', () => {
  const events = [{ at: 0, op: 'begin' }, { at: 1, op: 'context', context: 'context:1', state: 'observed' },
    { at: 2, op: 'allocation', id: 'texture:1', kind: 'texture', bytes: 64, labelled: true },
    { at: 3, op: 'context', context: 'context:1', state: 'lost' },
    { at: 4, op: 'allocation', id: 'texture:1', kind: 'texture', bytes: null }, { at: 5, op: 'stop' }]
    .map((row, sequence) => Object.assign(row, { document: 'context-test', sequence }));
  const replay = loadingGlSamples(events, [2.5, 3.5, 4.5]);
  assert.deepEqual([...replay.values()].map(row => row.totalBytes), [64, 64, 0], 'Only exact allocation mutations alter the ruler');
  for (const changed of [{ state: 'unknown' }, { context: 1 }]) {
    const invalid = structuredClone(events);
    for (const row of invalid) if (row.op === 'context') Object.assign(row, changed);
    assert.equal(loadingGlSamples(invalid, [2.5]).size, 0);
  }
});

void test('SF57 first-crossing diagnostics cannot run as a full or qualifying soak', () => {
  for (const flags of [[], ['--qualifying'], ['--dry-run', '--qualifying']]) {
    const child = spawnSync(process.execPath, ['scripts/soak/soak.mjs', '--worker', '--diagnostic-first-crossing', ...flags],
      { encoding: 'utf8', env: { ...process.env, SIM_UDID: 'not-a-real-device' } });
    assert.equal(child.status, 1); assert.match(child.stderr, /First-crossing diagnostics require a nonqualifying dry run/u);
  }
});

void test('SF57 reconciles same-millisecond census cuts by exact sequence, never by a guessed ordering', () => {
  const events = [{ at: 0, op: 'begin' }, { at: 1, op: 'cycle', cycle: 0 },
    { at: 2, op: 'allocation', id: 'texture:1', kind: 'texture', bytes: 4096, labelled: true },
    { at: 2, op: 'allocation', id: 'texture:2', kind: 'texture', bytes: 5460, labelled: true },
    { at: 3, op: 'stop' }].map((row, sequence) => Object.assign(row, { document: 'exact-cut', sequence }));
  const snapshot = { at: 2, totalBytes: 0, unlabelled: 0, reconciled: true, textures: 0, cycle: 0,
    journal: { document: 'exact-cut', sequence: 1 } };
  const replay = loadingGlSamples(events, [2, 2.5], [snapshot]);
  assert.equal(replay.get(2).totalBytes, 9556, 'The native timestamp includes all mutations through that millisecond');
  assert.equal(replay.get(2.5).totalBytes, 9556, 'The earlier census cut does not remove later real allocations');
  assert.equal(loadingGlSamples(events, [2.5], [{ ...snapshot, journal: null }]).size, 0, 'Legacy ambiguity remains refused');
  for (const journal of [{ document: 'unknown', sequence: 1 }, { document: 'exact-cut', sequence: 99 },
    { document: 'exact-cut', sequence: .5 }, { document: 'exact-cut', sequence: 4 }]) {
    assert.equal(loadingGlSamples(events, [2.5], [{ ...snapshot, journal }]).size, 0);
  }
  assert.equal(loadingGlSamples(events, [2.5], [{ ...snapshot, at: 2.1 }]).size, 0, 'A stale sequence cannot mask earlier allocations');
  assert.equal(loadingGlSamples(events, [2.5], [{ ...snapshot, totalBytes: 1 }]).size, 0, 'An exact cut still requires byte equality');
});

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
  assert.equal(joinSoakSamples([{ ...native[0], phase: 'drive' }], [], null, events)[0].gl, undefined, 'Playing without an explicit cycle marker stays uncovered');
});

void test('SF57 fills a blocked drive timer only from complete mutations and explicit cycles, never allocator or settled guesses', () => {
  const events = [{ at: 0, op: 'begin' },
    { at: 1, op: 'allocation', id: 'buffer:1', kind: 'buffer', bytes: 64, labelled: true },
    { at: 2, op: 'cycle', cycle: 0 }, { at: 6, op: 'cycle', cycle: 1 },
    { at: 7, op: 'allocation', id: 'buffer:1', kind: 'buffer', bytes: 128 },
    { at: 12, op: 'stop' }].map((row, sequence) => Object.assign(row, { document: 'drive', sequence }));
  const native = [1, 4, 8, 13].map(seconds => ({ type: 'sample', phase: 'drive', t: new Date(seconds * 1000).toISOString(), footprint: 500 }));
  const observed = [{ at: 2, totalBytes: 64, unlabelled: 0, reconciled: true, cycle: 0, accountedBytes: 99, settled: true }];
  const joined = joinSoakSamples(native, observed, null, events);
  assert.equal(joined[0].gl.accountedBytes, 99, 'Actual contemporaneous observations keep their allocator and settled telemetry');
  assert.equal(joined[1].gl.totalBytes, 64); assert.equal(joined[1].gl.cycle, 0);
  assert.equal(joined[2].gl.totalBytes, 128); assert.equal(joined[2].gl.cycle, 1);
  assert.equal(joined[2].gl.accountedBytes, null); assert.equal(joined[2].gl.settled, undefined);
  assert.equal(joined[3].gl, undefined, 'Nothing outside explicit journal coverage is reconstructed');
  assert.equal(joinSoakSamples(native, [], null, events)[0].gl, undefined, 'Playing before the first cycle marker is not covered');
  for (const incomplete of [events.slice(0, -1), events.filter(row => row.at !== 7),
    events.map(row => row.op === 'cycle' && row.cycle === 1 ? { ...row, cycle: -1 } : row),
    events.map(row => row.op === 'cycle' && row.cycle === 1 ? { ...row, cycle: 3 } : row)]) {
    assert.equal(joinSoakSamples(native, [], null, incomplete).every(row => row.gl === undefined), true);
  }
  const mismatch = structuredClone(observed); for (const row of mismatch) row.totalBytes = 65;
  assert.equal(joinSoakSamples(native, mismatch, null, events)[2].gl, undefined, 'An observed reconciliation failure invalidates all reconstruction');
  const wrongCycle = structuredClone(observed); for (const row of wrongCycle) row.cycle = 1;
  assert.equal(joinSoakSamples(native, wrongCycle, null, events)[2].gl, undefined, 'Real samples must agree with explicit journal cycles');
  const wrongCategory = structuredClone(observed); for (const row of wrongCategory) row.buffers = 0;
  assert.equal(joinSoakSamples(native, wrongCategory, null, events)[2].gl, undefined, 'The category breakdown must also reconcile');
  const unlabelled = structuredClone(events); for (const row of unlabelled) if (row.op === 'allocation') row.labelled = false;
  assert.equal(joinSoakSamples(native, [], null, unlabelled)[2].gl.unlabelled, 1, 'Unlabelled resources remain a sampling failure');
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
  if (layout === 'dev') assert.deepEqual(route.plans.slice(0, 2).map(p => p.to), ['pine-hollow', 'nalati-grasslands']);
  else {
    assert.ok(route.plans.slice(0, -1).every(plan => cells.find(cell => cell.instance === plan.to)?.slug === '_template'));
    assert.throws(() => ownedSoakPlans({ cells, home: 'driftwood-isle' }, 'cells', 'prepared'), /requires Pine and Nalati/u);
  }
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
