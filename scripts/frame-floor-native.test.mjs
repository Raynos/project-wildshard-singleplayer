import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeFloorNative } from './frame-floor-native.mjs';

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
