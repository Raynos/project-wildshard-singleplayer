import { expect, it } from 'vitest';
import { scatterShoreBoulders } from '../src/shards/driftwood-isle/world/Boulders';
import { SEED } from '../src/shards/driftwood-isle/data/landscapeRows';
import { WRECK_SITES } from '../src/shards/driftwood-isle/data/wreckSites';
import { scatterShore } from '../src/shards/driftwood-isle/generators/shoreBoulders';

it('keeps the authored shoreline clear of the wreck and returns owned placement rows', () => {
  const rocks = scatterShoreBoulders(SEED), original = rocks[0];
  expect(rocks.length).toBeGreaterThan(0);
  for (const b of rocks) expect(Math.hypot(b.x - WRECK_SITES.world.x, b.z - WRECK_SITES.world.z)).toBeGreaterThan(16 + b.r);
  if (original === undefined) throw new Error('No shore boulders');
  original.r = -1;
  expect(scatterShoreBoulders(SEED)[0]?.r).toBeGreaterThan(0);
  expect(() => scatterShoreBoulders(SEED + 1)).toThrow('regenerate');
  expect(() => scatterShoreBoulders(SEED, 1)).toThrow('regenerate');
});

it('does not scatter the authored rocks over deep water', () => {
  expect(scatterShore(SEED, 8, { heightAt: () => -20 })).toHaveLength(0);
});
