import { expect, it } from 'vitest';
import { placeholderSource } from '@wildshard/format/placeholderSource';
import { PLACEHOLDER as PINE } from '../src/shards/pine-hollow/data/placeholder';
import { PLACEHOLDER as DRIFTWOOD } from '../src/shards/driftwood-isle/data/placeholder';

it('G348: admits the shards\' declared placeholder rows and refuses a malformed one', () => {
  expect(placeholderSource('any', undefined)).toEqual({});
  expect(placeholderSource('pine-hollow', PINE).trees?.map((row) => row.species)).toEqual(['fir', 'pine', 'giant', 'birch', 'sapling', 'snag']);
  expect(placeholderSource('driftwood-isle', DRIFTWOOD).ground).toEqual({ generator: 'generators/groundRows.ts', export: 'driftwoodGroundBytes' });
  expect(placeholderSource('driftwood-isle', DRIFTWOOD).far?.look).toEqual({ module: 'look/far.ts', export: 'farLook' });
  expect(() => placeholderSource('x', { ground: { generator: '../escape.ts', export: 'f' } })).toThrow(/x: invalid placeholder source/u);
  expect(() => placeholderSource('x', { far: { look: { module: '../../scripts/x.ts', export: 'farLook' } } })).toThrow(/invalid placeholder source/u);
  expect(() => placeholderSource('x', { trees: [{ species: 'fir', stem: null, rings: [], crown: [300, 0, 0] }] })).toThrow(/invalid placeholder source/u);
  expect(() => placeholderSource('x', { colour: 'red' })).toThrow(/invalid placeholder source/u);
});

it('G348: every declared row names modules inside its own shard folder', () => {
  const rows = import.meta.glob<{ PLACEHOLDER: unknown }>('../src/shards/*/data/placeholder.ts', { eager: true });
  const modules = new Set(Object.keys(import.meta.glob(['../src/shards/*/look/**/*.ts', '../src/shards/*/generators/**/*.ts'])));
  expect(Object.keys(rows).length).toBeGreaterThanOrEqual(9);
  for (const [path, row] of Object.entries(rows)) {
    const folder = path.slice(0, -'data/placeholder.ts'.length), source = placeholderSource(folder, row.PLACEHOLDER);
    for (const ref of [source.far?.look, source.far?.grid, source.far?.parts]) if (ref !== undefined) expect(modules.has(`${folder}${ref.module}`), `${folder}${ref.module}`).toBe(true);
  }
});
