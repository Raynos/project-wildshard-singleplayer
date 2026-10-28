import { expect, test } from 'vitest';
import { _buildAs, buildTier, TIER } from '../src/engine/core/tier';
import { selectedLevel } from '../src/engine/level/selection';
import { CHUNK_HALF, ROAD_WIDTH } from '../src/engine/core/config';
import * as heightfield from '../src/engine/world/Heightfield';
import { bakeIslandFoliageBatches, bakeIslandFoliagePlacements, islandFoliageGround,
  islandFoliageBatches, islandFoliagePlacements } from '../src/shards/driftwood-isle/generators/islandDressing';
import { hashImmutableBytes } from '../src/sdk/immutable';
import before from './fixtures/driftwood-island-inputs.json' with { type: 'json' };

function original(placements: ReturnType<typeof islandFoliagePlacements>, bank: ReturnType<typeof islandFoliageBatches>): void {
  const bytes = new TextEncoder().encode(JSON.stringify(placements));
  expect(bytes.byteLength).toBe(before.placements.bytes);
  expect(hashImmutableBytes(bytes)).toBe(before.placements.hash);
  expect([...bank.blobs].map(([name, row]) => ({ name, kind: row.kind, bytes: row.bytes.byteLength,
    hash: hashImmutableBytes(row.bytes) }))).toEqual(before.blobs);
  expect(bank.byUrl).toEqual(before.aliases);
}

test('fresh explicit inputs preserve all original placement bytes and sixteen complete foliage blobs/aliases', () => {
  const ground = islandFoliageGround();
  expect(ground.half).toBe(CHUNK_HALF); expect(ground.roadWidth).toBe(ROAD_WIDTH);
  const placements = bakeIslandFoliagePlacements(ground);
  original(placements, bakeIslandFoliageBatches(placements));
  original(islandFoliagePlacements(), islandFoliageBatches());
});

test('both tiers remain byte-identical without changing ambient tier, level or heightfield bindings', () => {
  const previous = buildTier();
  try {
    for (const tier of ['phone', 'desktop'] as const) {
      _buildAs(tier);
      const level = selectedLevel(), sample = heightfield.heightAt, normal = heightfield.normalAt;
      const placements = bakeIslandFoliagePlacements(islandFoliageGround());
      original(placements, bakeIslandFoliageBatches(placements));
      expect(buildTier()).toBe(tier); expect(selectedLevel()).toBe(level);
      expect(heightfield.heightAt).toBe(sample); expect(heightfield.normalAt).toBe(normal);
    }
  } finally { _buildAs(previous === TIER ? null : previous); }
});
