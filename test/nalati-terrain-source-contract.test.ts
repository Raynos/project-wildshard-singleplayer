import { expect, expectTypeOf, test } from 'vitest';
import { TERRAIN, groundColor, surfaceAt, edgeBermAt } from '../src/shards/nalati-grasslands/generators/terrainRecipe';
import type { ChunkTerrain } from '../src/game/shard/manifest';
import { CHUNK_HALF } from '../src/engine/core/config';
import { hashImmutableBytes } from '../src/sdk/immutable';
import bounds from '../src/shards/nalati-grasslands/data/terrainBounds.json' with { type: 'json' };
import original from './fixtures/nalati-terrain-source-original.json' with { type: 'json' };

test('the author field retains the complete mutable native terrain port and bounds', () => {
  expectTypeOf<typeof TERRAIN>().toEqualTypeOf<ChunkTerrain>();
  expect(bounds.half).toBe(CHUNK_HALF);
  expect(TERRAIN.trails).toEqual(original.trails);
  expect(TERRAIN.cabinSites).toEqual(original.cabinSites);
  expect(TERRAIN.pond).toEqual(original.pond);
  expect(TERRAIN.datum).toBeUndefined();
});

test('all terrain samples retain predecessor Float64 bits across the entire cell', () => {
  const values: number[] = [], out: [number, number, number] = [0, 0, 0];
  for (let z = -250; z <= 250; z += 500 / 64) for (let x = -250; x <= 250; x += 500 / 64) {
    const h = TERRAIN.heightAt(x, z), n = TERRAIN.normalAt(x, z), slope = 1 - n[1];
    values.push(h, ...n, ...TERRAIN.normalAt(x, z, 1), ...TERRAIN.splatAt(x, z),
      TERRAIN.trailDistance(x, z), TERRAIN.cabinMask(x, z), TERRAIN.pondMask(x, z), TERRAIN.waterLevel(),
      ...groundColor(x, z, h, slope, TERRAIN, out), ...surfaceAt(x, z, h, slope), edgeBermAt(x, z));
  }
  const bytes = new Uint8Array(Float64Array.from(values).buffer);
  expect(values.length).toBe(original.values);
  expect(bytes.length).toBe(original.bytes);
  expect(hashImmutableBytes(bytes)).toBe(original.sha256);
});
