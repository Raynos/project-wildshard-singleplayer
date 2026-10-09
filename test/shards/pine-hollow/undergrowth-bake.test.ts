import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { PINE_SEED, bakePineUndergrowth } from '../../../src/shards/pine-hollow/generators/undergrowth';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { UnderShapesSchema } from '../../../src/shards/pine-hollow/world/undergrowthKit';
import committed from '../../../src/shards/pine-hollow/data/undergrowth.json' with { type: 'json' };

describe('Pine Hollow bakes its undergrowth shapes offline (G285)', () => {
  it('the committed shapes are exact against their generator (the stale gate: rerun scripts/bake-pine-undergrowth.mjs)', () => {
    expect(bakePineUndergrowth()).toEqual(committed);
    // the shapes' streams are the level seed's, as the page's engine SEED is while the floor builds
    expect(PINE_SEED).toBe(PINE_HOLLOW.seed);
  });

  it('every shape is whole: f32-exact attributes, unit normals, triangles in range', () => {
    for (const [kind, s] of Object.entries(v.parse(UnderShapesSchema, committed))) {
      const n = s.position.length / 3;
      expect(n, kind).toBeGreaterThanOrEqual(4);
      expect(s.normal.length, kind).toBe(n * 3);
      expect(s.uv.length, kind).toBe(n * 2);
      expect(s.index.length % 3, kind).toBe(0);
      expect(s.index.every((i) => i < n), kind).toBe(true);
      expect([...s.position, ...s.normal, ...s.uv].every((x) => Math.fround(x) === x), kind).toBe(true);
      for (let i = 0; i < n; i++) expect(Math.hypot(s.normal[i * 3] ?? 0, s.normal[i * 3 + 1] ?? 0, s.normal[i * 3 + 2] ?? 0)).toBeCloseTo(1, 5);
    }
  });
});
