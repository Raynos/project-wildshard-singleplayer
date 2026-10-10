import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs on the platform the bake was recorded on.
import { platform } from 'node:process';
import { POOL_ROWS } from '../../../src/shards/pine-hollow/world/beaverPool';
import committed from '../../../src/shards/pine-hollow/data/beaverPool.json' with { type: 'json' };
import { bakePoolRows } from '../../../scripts/bake-pine-beaver-pool.mjs';
import { installPineGround } from '../../../scripts/bake-pine-crags.mjs';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';

describe('Pine Hollow bakes its beaver pool meshes offline (G285)', () => {
  // Exact against a bake recorded on the Mac; Linux's libm differs in the last ulp (CI 38008817381, the crag bake's gate),
  // so the stale gate runs where bakes are made (the local push gate), not on the Linux runners.
  it.runIf(platform === 'darwin')('the committed blocks are exact against their generator (the stale gate: rerun scripts/bake-pine-beaver-pool.mjs)', () => {
    expect(installPineGround()).toBe(PINE_HOLLOW.seed);
    expect(bakePoolRows()).toEqual(committed);
  });

  it('both meshes are whole: f32-exact blocks, a ground height per still vertex, triangles in range', () => {
    for (const [name, m] of Object.entries(POOL_ROWS)) {
      const n = m.position.length / 3;
      expect(n, name).toBeGreaterThan(50);
      expect(m.uv.length, name).toBe(n * 2);
      expect(m.aWater.length, name).toBe(n * 4);
      expect(m.index.length % 3, name).toBe(0);
      expect(m.index.every((i) => i < n), name).toBe(true);
      expect([...m.position, ...m.uv, ...m.aWater].every((x) => Math.fround(x) === x), name).toBe(true);
    }
    expect(POOL_ROWS.still.ground).toHaveLength(POOL_ROWS.still.position.length / 3);
  });
});
