import { describe, expect, it } from 'vitest';
import { layoutFauna, layoutFaunaCells, type FaunaLayoutOpts } from '../../src/engine/world/faunaLayout';
import { PINE_HOLLOW } from '../../src/shards/pine-hollow/manifest';
import { DRIFTWOOD_ISLE } from '../../src/shards/driftwood-isle/manifest';
import { NINE_DRAGON_STACK } from '../../src/shards/nine-dragon-stack/manifest';
import { speciesDef } from '../../src/engine/entities/species/registry';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';

const opts: FaunaLayoutOpts = { seed: 1337, half: 100, margin: 25, spacing: 56, jitter: 15, ring: 20, emptyWeight: 10,
  trailDistance: (x, z) => Math.hypot(x, z) * 0.2,
  groups: [
    { kind: 'deer', weight: 36, count: [3, 4], canopy: false, trailBand: [10, 25] },
    { kind: 'boar', weight: 32, count: [2, 3], canopy: true, trailBand: [12, 40] },
    { kind: 'elk', weight: 18, count: [2, 4], canopy: false, trailBand: [15, 40], prefer: (d) => d >= 15 && d <= 40 ? 1.8 : 1 },
  ],
};
describe('seeded spawn baselines', () => {
  it('the real shard manifests retain species, counts, variants, spots and rings', () => {
    expect(DRIFTWOOD_ISLE.spawns).toMatchSnapshot('driftwood anchored herds');
    expect(PINE_HOLLOW.spawns).toMatchSnapshot('pine seeded layout and dens');
    expect(NINE_DRAGON_STACK.spawns).toEqual([]);
  });
  it('layoutFauna stays deterministic and keeps its ring/trail rules', () => {
    const a = layoutFauna(opts); expect(a).toEqual(layoutFauna(opts)); expect(a).toMatchSnapshot('seed1337 flat trail grid');
    for (const row of a) { expect(row.anchor?.rMax).toBe(20); expect(row.count).toBeGreaterThanOrEqual(2); }
    expect(layoutFauna({ ...opts, seed: 1338 })).not.toEqual(a);
  });
  it('an avoid disc removes only that cell without reshuffling the other populated rolls', () => {
    const cells = layoutFaunaCells({ ...opts, emptyWeight: 0 }), first = cells[0];
    if (first === undefined) throw new Error('empty layout');
    const avoided = layoutFaunaCells({ ...opts, emptyWeight: 0, avoid: [{ x: first.x, z: first.z, r: 1 }] });
    expect(avoided).toEqual(cells.slice(1));
  });
  it('species variant roll weights retain the actual registered baseline', () => {
    expect(AnimalFactory).toBeDefined();
    const table = Object.fromEntries(['boar', 'bear', 'crab', 'monkey', 'sailor', 'captain', 'wolf', 'horse', 'deer', 'elk', 'balbal'].map((kind) =>
      [kind, speciesDef(kind).variants.map((v) => ({ id: v.id, weight: v.weight, hp: v.hp, scale: v.scale, mods: v.mods }))]));
    expect(table).toMatchSnapshot('variant roll tables');
  });
});
