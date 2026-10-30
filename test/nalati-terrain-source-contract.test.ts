import { expect, expectTypeOf, test } from 'vitest';
import { TERRAIN } from '../src/shards/nalati-grasslands/generators/terrainRecipe';
import type { ChunkTerrain } from '../src/game/shard/manifest';
import { CHUNK_HALF } from '../src/engine/core/config';
import bounds from '../src/shards/nalati-grasslands/data/terrainBounds.json' with { type: 'json' };

test('the author field retains the complete mutable native terrain port and bounds', () => {
  expectTypeOf<typeof TERRAIN>().toEqualTypeOf<ChunkTerrain>();
  expect(bounds.half).toBe(CHUNK_HALF);
  expect(TERRAIN.datum).toBeUndefined();
});

