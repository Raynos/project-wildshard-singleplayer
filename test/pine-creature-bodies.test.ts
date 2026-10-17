import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { DEER } from '../src/shards/pine-hollow/generators/deerRows';
import { ELK } from '../src/shards/pine-hollow/generators/elkRows';
import { PINE_LOFTS } from '../src/shards/pine-hollow/generators/creatureLofts';
import grazers from '../src/shards/pine-hollow/data/grazers.generated.json' with { type: 'json' };
import { preparePineGrazers, pineGrazer } from '../src/shards/pine-hollow/species/looks';
import { PINE_ELK_THRALL } from '../src/shards/pine-hollow/generators/speciesRows';

// Pine's deer and elk are drawn only on their rigged hulls: the page binds them to the baked skeleton and dims of
// species/bodies.ts, never lofting them. Those rows must stay what the offline lofts (generators/creatureLofts.ts) build,
// for every variant: the hulls were skinned to that skeleton.
test('the baked deer and elk bodies match their lofts for every variant', async () => {
  await preparePineGrazers({ file: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(grazers))) });
  for (const [kind, def] of [['deer', DEER], ['elk', ELK]] as const) {
    const first = def.variants[0];
    if (first === undefined) throw new Error('Missing grazer variant');
    const { build, ...fields } = pineGrazer(kind);
    expect(fields).toEqual(def);
    const baked = build(first, new Rng(1));
    expect(baked.furParts.length + baked.hardParts.length + baked.eyeParts.length).toBe(0);
    for (const v of [...def.variants, ...(kind === 'elk' ? [PINE_ELK_THRALL] : [])]) {
      const lofted = PINE_LOFTS[kind](v, new Rng(1));
      expect(baked.bones, `${kind}:${v.id}`).toEqual(lofted.bones);
      expect(baked.dims, `${kind}:${v.id}`).toEqual(lofted.dims);
    }
    const copy = build(first, new Rng(1));
    expect(copy).toEqual(baked);
    expect(copy.bones).not.toBe(baked.bones);
    expect(copy.bones[0]?.pos).not.toBe(baked.bones[0]?.pos);
    expect(copy.dims.feet[0]).not.toBe(baked.dims.feet[0]);
  }
});
