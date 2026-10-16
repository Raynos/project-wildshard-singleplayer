import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { DEER } from '../src/game/systems/species/deer';
import { ELK } from '../src/game/systems/species/elk';
import { PINE_LOFTS } from '../src/shards/pine-hollow/generators/creatureLofts';
import { hullBody } from '../src/shards/pine-hollow/species/bodies';
import { PINE_ELK_THRALL } from '../src/shards/pine-hollow/generators/speciesRows';

// Pine's deer and elk are drawn only on their rigged hulls: the page binds them to the baked skeleton and dims of
// species/bodies.ts, never lofting them. Those rows must stay what the offline lofts (generators/creatureLofts.ts) build,
// for every variant: the hulls were skinned to that skeleton.
test('the baked deer and elk bodies match their lofts for every variant', () => {
  for (const [kind, def] of [['deer', DEER], ['elk', ELK]] as const) {
    const baked = hullBody(kind)();
    expect(baked.furParts.length + baked.hardParts.length + baked.eyeParts.length).toBe(0);
    for (const v of [...def.variants, ...(kind === 'elk' ? [PINE_ELK_THRALL] : [])]) {
      const lofted = PINE_LOFTS[kind](v, new Rng(1));
      expect(baked.bones, `${kind}:${v.id}`).toEqual(lofted.bones);
      expect(baked.dims, `${kind}:${v.id}`).toEqual(lofted.dims);
    }
  }
});
