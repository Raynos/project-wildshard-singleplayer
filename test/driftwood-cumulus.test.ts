import { expect, it } from 'vitest';
import puffs from '../src/shards/driftwood-isle/data/cumulusPuffs.json' with { type: 'json' };
import { cumulusPuffs } from '../src/shards/driftwood-isle/generators/cumulus';
import { cumulusGeometry } from '../src/shards/driftwood-isle/runtime/looks/facetedDayBackdrop';

it('keeps the baked cumulus rows in step with their generator', () => {
  expect(puffs).toEqual(cumulusPuffs());
});

it('instances one icosahedron per puff row and refuses malformed rows', () => {
  const geo = cumulusGeometry(puffs);
  expect(geo.instanceCount).toBe(puffs.length);
  expect(geo.getAttribute('aPuff').count).toBe(puffs.length);
  expect(geo.getAttribute('aLump').count).toBe(puffs.length);
  expect(geo.getAttribute('position').count).toBe(240);
  expect(() => cumulusGeometry([[1, 2, 3]])).toThrow('cumulus rows');
});
