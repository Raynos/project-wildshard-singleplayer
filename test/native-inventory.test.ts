import { expect, test } from 'vitest';
import { DriftwoodPack } from '../src/shards/driftwood-isle/runtime/pack';
import { createPinePack } from '../src/shards/pine-hollow/runtime/pack';

test('both native quest packs load old inventories and continue stacking/trading', () => {
  const drift = new DriftwoodPack(); drift.restore({ counts: { doubloon: 4, coconut: 2 }, order: ['coconut', 'doubloon'] });
  expect(drift.count('doubloon')).toBe(4); expect(drift.add('doubloon', 2)).toBe(true);
  expect(drift.snapshot()).toEqual({ counts: { coconut: 2, doubloon: 6 }, order: ['coconut', 'doubloon'] });
  const pine = createPinePack(); pine.restore({ counts: { venison: 2.5, 'deer-hide': -1 }, order: ['deer-hide', 'venison'] });
  expect(pine.count('deer-hide')).toBe(-1); expect(pine.take('venison', 1)).toBe(true); expect(pine.add('venison', 2)).toBe(true);
  expect(pine.snapshot()).toEqual({ counts: { venison: 3.5, 'deer-hide': -1 }, order: ['deer-hide', 'venison'] });
  const missing = createPinePack(); missing.restore({ counts: {}, order: ['venison'] }); expect(missing.count('venison')).toBe(0);
});
test('native inventory refuses corrupt rosters, duplicate order and original bounds', () => {
  const drift = new DriftwoodPack();
  for (const state of [{ counts: { doubloon: 0 }, order: ['doubloon'] }, { counts: {}, order: ['doubloon'] },
    { counts: { unknown: 1 }, order: ['unknown'] }, { counts: { doubloon: 1 }, order: ['doubloon', 'doubloon'] }]) expect(() => drift.restore(state)).toThrow();
  expect(() => drift.add('doubloon', 0.5)).toThrow();
  drift.restore({ counts: { doubloon: Number.MAX_SAFE_INTEGER }, order: ['doubloon'] }); expect(() => drift.add('doubloon', 1)).toThrow();
  const pine = createPinePack(); expect(() => pine.restore({ counts: { venison: 1_000_001 }, order: ['venison'] })).toThrow();
  expect(() => pine.restore({ counts: { venison: 1 }, order: [] })).toThrow();
  expect(() => pine.restore({ counts: { unknown: 1 }, order: ['unknown'] })).toThrow();
});
