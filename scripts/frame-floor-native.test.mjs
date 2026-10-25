import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeFloorNative, floorNativeExpression } from './frame-floor-native.mjs';
import { runInNewContext } from 'node:vm';

await test('native memory witnesses copy the actual runtime residents without inventing two worlds', () => {
  const residents=['road','cell'],pending=[];
  const live={current:'cell',residents,pending,gameplayReady:true};
  const context={window:{__wildshard:{memory:()=>({totals:{gpu:12},unattributed:{gpu:0},allocations:[]}),
    shard:{grid:{state:()=>({live:{live,crossing:{phase:'settled'}}})}}}},performance:{timeOrigin:1}};
  const row=runInNewContext(floorNativeExpression,context);
  assert.deepEqual(Array.from(row.residents),['road','cell']);
  assert.equal(row.phase,'playing');assert.equal(row.current,'cell');
  residents.pop();pending.push('other');
  assert.equal(row.residents.length,2);assert.equal(row.pending.length,0);
  const next=runInNewContext(floorNativeExpression,context);
  assert.deepEqual(Array.from(next.residents),['road']);
  assert.deepEqual(Array.from(next.pending),['other']);assert.equal(next.phase,'loading');
});

const native = Array.from({ length: 6 }, (_, index) => ({ type: 'sample', phase: 'measure',
  t: new Date(index * 100).toISOString(), interval: index < 3 ? 900 : 700,
  pids: { 7: [500, 600], 8: [10, 20] } }));
const gpu = [
  { at: 0, phase: 'loading', memory: { totals: { gpu: 100 }, unattributed: { gpu: 0 }, allocations: [{ domain: 'gpu', owner: 'engine', asset: 'target', bytes: 100 }] } },
  { at: 300, phase: 'playing', memory: { totals: { gpu: 50 }, unattributed: { gpu: 0 }, allocations: [] } },
];

await test('charges loading overlap, playing kernel interval highs and conservative GPU peak', () => {
  const row = gradeFloorNative(native, gpu);
  assert.equal(row.gamePid, 7);
  assert.equal(row.loadingPeakBytes, 1000);
  assert.equal(row.playingPeakBytes, 700);
  assert.deepEqual(row.phaseSamples, { loading: 3, playing: 3 });
  assert.equal(row.gpuPeakAllocations[0].asset, 'target');
});

await test('refuses missing native/GPU/playing phases and lost game process', () => {
  assert.throws(() => gradeFloorNative([], gpu), /Missing native/u);
  assert.throws(() => gradeFloorNative(native, []), /Missing native/u);
  assert.throws(() => gradeFloorNative(native, gpu.slice(0, 1)), /No playing/u);
  assert.throws(() => gradeFloorNative(native, gpu, [], 1), /Missing native/u);
  const lost = structuredClone(native); lost[3].pids = {};
  assert.throws(() => gradeFloorNative(lost, gpu), /disappeared/u);
});

await test('keeps preparation and Inspector gaps under the playing cap after readiness', () => {
  const samples = structuredClone(native);
  samples.push({ type: 'sample', phase: 'measure', t: new Date(5000).toISOString(), interval: 2500,
    pids: { 7: [2000, 2200], 8: [10, 20] } });
  const preparing = [...gpu, { ...gpu[0], at: 400, phase: 'loading' }];
  const row = gradeFloorNative(samples, preparing);
  assert.equal(row.playingPeakBytes, 2300);
  assert.equal(row.loadingPeakBytes, 1000);
});
