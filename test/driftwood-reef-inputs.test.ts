import { expect, test } from 'vitest';
import { driftwoodReefBank } from '../src/shards/driftwood-isle/generators/reefBank';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { scatterLagoon, type LagoonField } from '../src/shards/driftwood-isle/generators/reefScatter';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { SEED, WORLD_DROP } from '../src/shards/driftwood-isle/generators/landscapeRows';
import { WRECK, OCEAN } from '../src/shards/driftwood-isle/generators/worldSites';
import { CHUNK_HALF, ROAD_WIDTH } from '../src/engine/core/config';
import foliagePolicy from '../src/shards/driftwood-isle/data/foliagePolicy.json' with { type: 'json' };

// Captured on e13178f602 before removing the live-field and global-policy fallback.
test('explicit reef inputs retain every predecessor placement, school and fish seed', () => {
  const native = readNativeTerrain(driftwoodGroundBytes());
  const field: LagoonField = { half: native.grid.size / 2, level: OCEAN.level, roadWidth: foliagePolicy.roadWidth,
    heightAt: (x, z) => native.heightAt(x, z) - WORLD_DROP, normalAt: native.normalAt };
  const layout = scatterLagoon(SEED, 360, [{ x: WRECK.x, z: WRECK.z, r: 18 }], field);
  const bytes = new TextEncoder().encode(JSON.stringify(layout));
  expect(bytes.byteLength).toBe(50693);
  expect(hashImmutableBytes(bytes)).toBe('febf548b192714b289c216e0341b97c1139f59f17a7f91515b658b92c54a6426');
  expect(layout.items).toHaveLength(360);
  expect(driftwoodReefBank().layout).toEqual(layout);
  expect(field.half).toBe(CHUNK_HALF); expect(field.roadWidth).toBe(ROAD_WIDTH);
});

test('reef scatter uses only the supplied bounds, water, road mask and numeric samplers', () => {
  const field: LagoonField = { half: 100, level: 10, roadWidth: 4,
    heightAt: () => 7, normalAt: () => [0, 1, 0] };
  const layout = scatterLagoon(23, 90, [], field);
  expect(layout.items).toHaveLength(90);
  for (const row of layout.items) {
    expect(Math.abs(row.x)).toBeLessThanOrEqual(86); expect(Math.abs(row.z)).toBeLessThanOrEqual(86);
    expect(Math.abs(row.x) < 7 && Math.abs(row.z) > 25).toBe(false);
    expect(Math.abs(row.z) < 7 && Math.abs(row.x) > -20).toBe(false);
  }
  expect(scatterLagoon(23, 90, [], { ...field, level: 0 })).toEqual({ items: [] });
  expect(scatterLagoon(23, 90, [], { ...field, roadWidth: 300 })).toEqual({ items: [] });
  expect(scatterLagoon(23, 90, [], { ...field, normalAt: () => [0, 0.85, 0] })).toEqual({ items: [] });
  const failure = new Error('supplied reef sampler refused');
  expect(() => scatterLagoon(23, 1, [], { ...field, heightAt: () => { throw failure; } })).toThrow(failure);
});
