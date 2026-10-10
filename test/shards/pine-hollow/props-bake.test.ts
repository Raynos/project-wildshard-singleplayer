import { describe, expect, it } from 'vitest';
import { PINE_SEED } from '../../../src/shards/pine-hollow/generators/undergrowth';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { PROP_ROWS } from '../../../src/shards/pine-hollow/world/props';
import committed from '../../../src/shards/pine-hollow/data/props.json' with { type: 'json' };
import { bakePropRows, pineTrunkCircles } from '../../../scripts/bake-pine-props.mjs';
import { installPineGround } from '../../../scripts/bake-pine-crags.mjs';

describe('Pine Hollow bakes its forest props offline (G285)', () => {
  it('the committed poses are exact against their generator (the stale gate: rerun scripts/bake-pine-props.mjs)', async () => {
    // the ground the props stand on is the level's (its grid carries the seed); their streams are the level seed's
    expect(installPineGround()).toBe(PINE_HOLLOW.seed);
    expect(PINE_SEED).toBe(PINE_HOLLOW.seed);
    expect(await bakePropRows()).toEqual(committed);
  }, 30_000);

  it('every copy stands clear of the trunks on a unit rotation, the scatter at full strength', () => {
    expect(PROP_ROWS.rocks.length).toBeGreaterThan(300);
    expect(PROP_ROWS.stumps.length).toBeGreaterThan(50);
    expect(PROP_ROWS.logs).toHaveLength(55);
    const trunks = pineTrunkCircles();
    for (const [x, , z, qx, qy, qz, qw, s] of [...PROP_ROWS.rocks.map((r) => r.slice(2)), ...PROP_ROWS.stumps, ...PROP_ROWS.logs]) {
      expect(Math.hypot(qx ?? 0, qy ?? 0, qz ?? 0, qw ?? 0)).toBeCloseTo(1, 9);
      expect(s).toBeGreaterThan(0.25);
      expect(trunks.some((t) => Math.hypot(t.x - (x ?? 0), t.z - (z ?? 0)) < t.r)).toBe(false);
    }
    // the draw order: rocks grouped by shape
    const shapes = PROP_ROWS.rocks.map(([k]) => k);
    expect(shapes).toEqual([...shapes].sort((a, b) => a - b));
  });
});
