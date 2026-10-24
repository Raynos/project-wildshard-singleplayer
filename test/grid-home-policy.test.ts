import { expect, test } from 'vitest';
import { useOwnedGridHome } from '../src/game/grid/pageShell';

test('a compiled grid home needs its declared product; admitted data keeps its existing path', () => {
  const compiled = { slug: 'fixture', clientPlanRuntime: true as const, gridShardfile: 'fixture/shard.json' };
  expect(useOwnedGridHome('grid', compiled)).toBe(true);
  expect(useOwnedGridHome('grid', { slug: 'data' }, { runtime: null })).toBe(true);
  expect(() => useOwnedGridHome('grid', { slug: 'no-product', clientPlanRuntime: true })).toThrow('cannot be an owned region');
  expect(() => useOwnedGridHome('grid', { slug: 'unknown' })).toThrow('cannot be an owned region');
});

test('trusted source flags grant no grid ownership and standalone legacy selection stays outside the grid', () => {
  const legacy = { slug: 'fixture-legacy', gridShardfile: 'fixture/shard.json',
    trustedRuntime: { slug: 'fixture-legacy', entry: 'runtime/index.ts' } };
  expect(() => useOwnedGridHome('grid', legacy)).toThrow('no admitted data or compiled client page');
  expect(() => useOwnedGridHome('grid', legacy, { runtime: { entry: 'runtime/index.ts' } })).toThrow('cannot be an owned region');
  expect(useOwnedGridHome('shard', legacy)).toBe(false);
});
