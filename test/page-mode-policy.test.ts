import { expect, test } from 'vitest';
import { currentPageMode, setPageMode } from '../src/game/grid/pageMode';
import { pageModeValue, pageModeCap } from '../src/game/shard/pagePolicy';
import policy from '../src/shards/pine-hollow/data/pagePolicy.json' with { type: 'json' };

test('declared policy follows the chosen page without mutating its rows', () => {
  const before = currentPageMode(), original = structuredClone(policy);
  try {
    for (const mode of ['shard', 'grid'] as const) {
      setPageMode(mode);
      expect(pageModeValue(policy.memoryTrim)).toBe(mode === 'grid');
      expect([256, 512, 1024, 2048].map(cap => pageModeCap(policy.setCap, cap)))
        .toEqual(mode === 'grid' ? [256, 512, 512, 2048] : [256, 512, 1024, 2048]);
      expect(pageModeValue({ shard: 'day', grid: 'night' })).toBe(mode === 'grid' ? 'night' : 'day');
    }
    expect(policy).toEqual(original);
  } finally { setPageMode(before); }
});

test('page policies refuse executable, accessor and unbounded cap rows', () => {
  const before = currentPageMode();
  let reads = 0;
  try {
    setPageMode('grid');
    expect(() => pageModeValue({ shard: () => false, grid: () => true })).toThrow('JSON rows');
    expect(() => pageModeValue({ shard: false, get grid() { reads++; return true; } })).toThrow('JSON rows');
    expect(reads).toBe(0);
    const extra = { shard: false, grid: true, other: false };
    expect(() => pageModeValue(extra)).toThrow('JSON rows');
    for (const value of [-1, Number.NaN, Infinity]) {
      expect(() => pageModeCap(policy.setCap, value)).toThrow();
      expect(() => pageModeCap({ shard: null, grid: { through: value, max: 512 } }, 1024)).toThrow();
      expect(() => pageModeCap({ shard: null, grid: { through: 1024, max: value } }, 1024)).toThrow();
    }
  } finally { setPageMode(before); }
});
