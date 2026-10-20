import { expect, test } from 'vitest';
import { floorAtRects } from '@wildshard/engine/physics/box';
import * as v from 'valibot';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../src/shards/driftwood-isle/generators/clientSections';
import { decodeEntryDecks } from '../src/shards/driftwood-isle/generators/entryDecks';
import decks from '../src/shards/driftwood-isle/data/entryDecks.generated.json' with { type: 'json' };
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json' with { type: 'json' };
import islandFacts from '../src/shards/driftwood-isle/data/islandFacts.generated.json' with { type: 'json' };

function rows() {
  const value = DRIFTWOOD_CLIENT_SECTIONS.find(row => row.name === 'custom/fixedLayouts')?.value;
  return v.parse(SECTIONS['custom/fixedLayouts'], value);
}
test('published world-build data preserves every original deck and both tiers of foliage in authored order', () => {
  const data = rows();
  expect(data.entryDecks).toEqual(decks.rows);
  expect(data.foliage).toEqual({ seed: foliage.seed, tiers: foliage.tiers, islandPalms: islandFacts.extraPalms });
  expect(data.entryDecks.map(row => row.edge)).toEqual(['north', 'east', 'south', 'west']);
  expect(data.foliage.tiers.phone.palms.placements).toHaveLength(204);
  expect(data.foliage.tiers.desktop.bushes.placements).toHaveLength(260);
});
test('the moved build decoder retains cached-row and positive-footprint refusals', () => {
  expect(decodeEntryDecks(decks)).toEqual(decks.rows);
  const first = decks.rows[0]; if (first === undefined) throw new Error('Missing deck');
  expect(() => decodeEntryDecks({ ...decks, notice: 'hand edited' })).toThrow();
  expect(() => decodeEntryDecks({ ...decks, rows: [{ ...first, rect: { ...first.rect, maxX: first.rect.minX } }, ...decks.rows.slice(1)] })).toThrow('positive footprint');
});
test('canonical section admission refuses wrong entry order, altered slab height and unbounded foliage', () => {
  const data = rows(), [first, second, third, fourth] = data.entryDecks;
  expect(() => v.parse(SECTIONS['custom/fixedLayouts'], { ...data, entryDecks: [second, first, third, fourth] })).toThrow();
  expect(() => v.parse(SECTIONS['custom/fixedLayouts'], { ...data, entryDecks: [{ ...first, rect: { ...first.rect, minX: Infinity } }, second, third, fourth] })).toThrow();
  expect(() => v.parse(SECTIONS['custom/fixedLayouts'], { ...data, entryDecks: [{ ...first, slab: { ...first.slab, yTop: 1 } }, second, third, fourth] })).toThrow();
  expect(() => v.parse(SECTIONS['custom/fixedLayouts'], { ...data, foliage: { ...data.foliage, tiers: { ...data.foliage.tiers,
    phone: { ...data.foliage.tiers.phone, palms: { ...data.foliage.tiers.phone.palms, specs: Array.from({ length: 1025 }, () => data.foliage.tiers.phone.palms.specs[0]) } } } } })).toThrow();
});

test('compiled deck floors preserve inclusive corners and adjacent floating-point edges', () => {
  const data = rows(), epsilon = Number.EPSILON * 256;
  for (const { rect } of decks.rows) {
    const xs = [rect.minX - epsilon, rect.minX, (rect.minX + rect.maxX) / 2, rect.maxX, rect.maxX + epsilon];
    const zs = [rect.minZ - epsilon, rect.minZ, (rect.minZ + rect.maxZ) / 2, rect.maxZ, rect.maxZ + epsilon];
    for (const x of xs) for (const z of zs) {
      const expected = decks.rows.some(({ rect: r }) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) ? 0 : undefined;
      expect(floorAtRects(data.entryFloors, x, z, 'first'), `${x},${z}`).toBe(expected);
    }
  }
});
