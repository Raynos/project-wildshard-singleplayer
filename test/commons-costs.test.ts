import { expect, it } from 'vitest';
import { assertCommonsCosts } from '../src/game/shardfile/commonsCosts';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/game/shardfile/admissionLimits';

const hash = 'a'.repeat(64), extra = 'b'.repeat(64), cost = { decoded: 1, gpu: 2, triangles: 3, draws: 4 };
it('accepts an empty legacy table and exact pinned metadata without unknown fields', () => {
  expect(assertCommonsCosts([], undefined)).toEqual({});
  expect(assertCommonsCosts([hash], { [hash]: cost })).toEqual({ [hash]: cost });
  expect(() => assertCommonsCosts([hash], { [hash]: { ...cost, compressed: 1 } })).toThrow();
});
it('requires the exact unique commons hash set', () => {
  for (const rows of [undefined, {}, { [extra]: cost }, { [hash]: cost, [extra]: cost }]) expect(() => assertCommonsCosts([hash], rows)).toThrow();
  expect(() => assertCommonsCosts([hash, hash], { [hash]: cost })).toThrow('exact cost key set');
});
it('refuses every unsafe cost before consuming any asset', () => {
  for (const field of ['decoded', 'gpu', 'triangles', 'draws']) for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => assertCommonsCosts([hash], { [hash]: { ...cost, [field]: value } })).toThrow();
  }
  expect(() => assertCommonsCosts(['invalid'], { invalid: cost })).toThrow();
});
it('accepts the exact table cap and refuses one extra row', () => {
  const keys = Array.from({ length: limits.commons }, (_, index) => index.toString(16).padStart(64, '0'));
  const rows = Object.fromEntries(keys.map(key => [key, cost]));
  expect(Object.keys(assertCommonsCosts(keys, rows))).toHaveLength(limits.commons);
  expect(() => assertCommonsCosts([...keys, hash], { ...rows, [hash]: cost })).toThrow('bounded commons cost table');
});
