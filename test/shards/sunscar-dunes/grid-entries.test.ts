import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the committed terrain collider the game installs.
import { readFileSync } from 'node:fs';
import { decodeTerrainTile, encodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { validateEntrywayTerrain } from '@wildshard/format/entrywayAssets';
import { entrywayRules } from '@wildshard/format/entryways';
import { contentHash } from '../../../src/sdk/project';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { farLook } from '../../../src/shards/sunscar-dunes/generators/farLook';

// SF50-g (G93 / G99 / G103 / G131): Signal Dunes' declared boundary rows are its terrain collider's (the ground the game
// installs), and the engine's entry roads make every 8 m opening and 8 × 15 m socket footprint exactly road height.
const collider = source.terrain?.collider;
if (collider === undefined) throw new Error('Missing Signal terrain collider');
const ground = decodeTerrainTile(Uint8Array.from(readFileSync(`src/shards/sunscar-dunes/assets/${collider}`)));
const res = ground.resolution, heights = ground.heights;
const at = (i: number, j: number): number => heights[j * res + i] ?? Number.NaN;

it('declares the collider\'s four native boundary rows, the midpoints at road height', () => {
  const native = { north: (k: number) => at(k, res - 1), south: (k: number) => at(k, 0), east: (k: number) => at(res - 1, k), west: (k: number) => at(0, k) };
  // M3 / G227: the rows are the compiled terrain tiles' own (257 samples, the collider's edge exactly)
  expect(res).toBe(257);
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    const row = source.edge[side];
    expect(row.heights).toHaveLength(257);
    expect(row.colours).toHaveLength(257);
    expect(row.heights.map((h, k) => Math.fround(h) - native[side](k)).every(d => d === 0)).toBe(true);
    expect(Math.max(...row.heights)).toBeGreaterThan(5); // the dune field, not a flat substitute
  }
  expect(entrywayRules(source)).toEqual([]);
  expect(source.entryways.map((row) => [row.edge, row.width, row.kind ?? 'ground'])).toEqual([['north', 8, 'ground'], ['east', 8, 'ground'], ['south', 8, 'ground'], ['west', 8, 'ground']]);
  expect(source.accent).toBe('orchid');
});

it('refuses a forged opening: one raised sample inside the 8 m gap', () => {
  const forged = structuredClone(source), north = forged.edge.north.heights, mid = Math.floor(north.length / 2);
  north[mid] = 0.01;
  expect(entrywayRules(forged)).toEqual(['illegal shard: entryway opening must meet road height y=0 across its width']);
});

it('admits the baked heightfield across all four 8 x 15 m socket footprints and refuses a trench in one', () => {
  const tile = (field: Float32Array) => {
    const encoded = encodeTerrainTile({ resolution: res, x: -250, z: -250, size: 500, heights: field }), hash = contentHash(encoded);
    return { source: { entryways: source.entryways, terrain: { collider: hash } }, assets: new Map([[hash, encoded]]) };
  };
  const real = tile(heights);
  expect(() => { validateEntrywayTerrain(real.source, real.assets); }).not.toThrow();
  const trench = Float32Array.from(heights); trench[3 * res + Math.floor(res / 2)] = -0.2; // 6 m in from the south midpoint
  const forged = tile(trench);
  expect(() => { validateEntrywayTerrain(forged.source, forged.assets); }).toThrow('footprint must be flat');
});

it('carries the approved warm dust-haze band and dusk grade in the actual far product', () => {
  const baked: unknown = JSON.parse(readFileSync('public/assets/baked/sunscar-dunes/far.json', 'utf8'));
  expect(baked).toMatchObject({ look: { band: farLook.band, grade: farLook.grade } });
});
