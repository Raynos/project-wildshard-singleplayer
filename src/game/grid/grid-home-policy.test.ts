import { expect, test } from 'vitest';
import { useOwnedGridHome } from './pageShell';

test('a compiled grid home needs its declared product; admitted data keeps its existing path', () => {
  const compiled = { slug: 'pine-hollow' as const, clientPlanRuntime: true as const, gridShardfile: 'fixture/shard.json' };
  expect(useOwnedGridHome('grid', compiled)).toBe(true);
  expect(useOwnedGridHome('grid', { slug: '_template' }, { runtime: null })).toBe(true);
  expect(() => useOwnedGridHome('grid', { slug: 'pine-hollow', clientPlanRuntime: true })).toThrow('cannot be an owned region');
  expect(() => useOwnedGridHome('grid', { slug: 'pine-hollow' })).toThrow('cannot be an owned region');
});

test('trusted source flags grant no grid ownership and standalone legacy selection stays outside the grid', () => {
  const legacy = { slug: 'pine-hollow-legacy' as const, gridShardfile: 'fixture/shard.json',
    trustedRuntime: { slug: 'pine-hollow-legacy', entry: 'runtime/index.ts' } };
  expect(() => useOwnedGridHome('grid', legacy)).toThrow('no admitted data or compiled client page');
  expect(() => useOwnedGridHome('grid', legacy, { runtime: { entry: 'runtime/index.ts' } })).toThrow('cannot be an owned region');
  expect(useOwnedGridHome('shard', legacy)).toBe(false);
});
