import { expect, it } from 'vitest';
import { placeholderSource } from '@wildshard/format/placeholderSource';
import { PINE_PLACEHOLDER } from '../src/shards/pine-hollow/data/placeholder';
import { DRIFTWOOD_ISLE } from '../src/shards/driftwood-isle/manifest';

it('G348: admits the shards\' declared placeholder rows and refuses a malformed one', () => {
  expect(placeholderSource('any', undefined)).toEqual({});
  expect(placeholderSource('pine-hollow', PINE_PLACEHOLDER).trees?.map((row) => row.species)).toEqual(['fir', 'pine', 'giant', 'birch', 'sapling', 'snag']);
  expect(placeholderSource('driftwood-isle', DRIFTWOOD_ISLE.placeholder).ground).toEqual({ generator: 'generators/groundRows.ts', export: 'driftwoodGroundBytes' });
  expect(() => placeholderSource('x', { ground: { generator: '../escape.ts', export: 'f' } })).toThrow(/x: invalid placeholder source/u);
  expect(() => placeholderSource('x', { trees: [{ species: 'fir', stem: null, rings: [], crown: [300, 0, 0] }] })).toThrow(/invalid placeholder source/u);
  expect(() => placeholderSource('x', { colour: 'red' })).toThrow(/invalid placeholder source/u);
});
