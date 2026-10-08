import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { ownedSoakPlans, soakRunPolicy, joinSoakSamples, soakAsyncEvaluator, soakLapMemory } from './owned.mjs';
import { soakCatalogue } from './route.ts';

const catalogue = JSON.parse(readFileSync('src/game/grid/singleplayer.json', 'utf8')).grid;

for (const layout of ['dev', 'shipped']) void test(`SF57 ${layout} enters every production instance and returns to one exact home baseline`, () => {
  const cells = soakCatalogue(catalogue, layout), route = ownedSoakPlans({ cells, home: 'driftwood-isle' });
  assert.deepEqual(route.plans.slice(0, 2).map(p => p.to), ['pine-hollow', 'nalati-grasslands']);
  assert.deepEqual(route.plans.map(p => p.to).sort(), cells.map(c => c.instance).sort());
  let previous = route.reference, from = 'driftwood-isle';
  for (const plan of [...route.plans, ...route.coveragePlans]) {
    assert.equal(plan.from, from); assert.equal(plan.start, undefined); assert.equal(plan.movement, 'road-hover');
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
