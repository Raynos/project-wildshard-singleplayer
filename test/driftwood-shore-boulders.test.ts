import { expect, it } from 'vitest';
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json';
import shore from '../src/shards/driftwood-isle/data/shoreBoulders.generated.json';
import { STATIC_BOAT, WORLD_GULL_PERCHES, SHORE_BOULDERS } from '../src/shards/driftwood-isle/generators/staticWorld';
import { SEED } from '../src/shards/driftwood-isle/generators/landscapeRows';
import WRECK_SITES from '../src/shards/driftwood-isle/data/wreckSites.json' with { type: 'json' };
import { scatterShore } from '../src/shards/driftwood-isle/generators/shoreBoulders';

it('keeps the admitted shoreline clear of the wreck with unchanged placements', () => {
  const rocks = shore.specs;
  expect(SHORE_BOULDERS.placements).toEqual(shore.placements);
  expect(SHORE_BOULDERS.boxes).toEqual(shore.boxes);
  expect(rocks.length).toBeGreaterThan(0);
  for (const b of rocks) expect(Math.hypot(b.x - WRECK_SITES.world.x, b.z - WRECK_SITES.world.z)).toBeGreaterThan(16 + b.r);
});

it('does not scatter the authored rocks over deep water', () => {
  expect(scatterShore(SEED, 8, { heightAt: () => -20 })).toHaveLength(0);
});

it('retains the sailboat rest floor and native hull dimensions', () => {
  expect(STATIC_BOAT.spec).toEqual({ x: -4.2, z: -203, heading: 0, waterY: 0 });
  expect(STATIC_BOAT.colliders).toHaveLength(5);
  expect(STATIC_BOAT.colliders.at(-1)).toEqual({ kind: 'box', x: 0, y: 0.22, z: 0, hx: 1.02, hy: 0.1, hz: 3.12 });
  expect(STATIC_BOAT.cleats).toEqual([-2.9000000000000004, 2.9000000000000004]);
  expect(STATIC_BOAT.floors).toEqual([{ x: -4.2, z: -203, hw: 0.8800000000000001, hd: 2.9000000000000004, y: 0.32, rot: 0 }]);
  expect(WORLD_GULL_PERCHES.slice(-foliage.gullPerches.length)).toEqual(foliage.gullPerches);
});
