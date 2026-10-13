import { expect, it } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { SKY_CREATURE_ROWS } from '../src/shards/far-reach/data/brains';
import { SIGNAL_SPECIES } from '../src/shards/sunscar-dunes/data/brains';
import { SKY_LIBRARY } from '../src/shards/far-reach/world/meshes';
import { DUNE_LIBRARY } from '../src/shards/sunscar-dunes/world/meshes';
import { SKY_STAND_INS } from '../src/shards/far-reach/data/standIns';
import { STRIDER_BODY } from '../src/shards/sunscar-dunes/data/striderRig.baked';
import { RAY_BODY, SKITTERER_BODY } from '../src/shards/sunscar-dunes/data/species/bodies';

const SKY_CREATURE_LOOKS = SKY_LIBRARY.looks, DUNE_CREATURE_LOOKS = DUNE_LIBRARY.looks;
it('keeps both shipping catalogue orders, body skeletons and dimensions before preload', () => {
  expect(SKY_CREATURE_LOOKS.map(row => row.kind)).toEqual(['driftRay', 'skyGoat', 'galeWisp', 'stormRoc']);
  expect(DUNE_CREATURE_LOOKS.map(row => row.kind)).toEqual(['duneRay', 'sandSkitterer', 'duneStrider', 'duneMatriarch']);
  const cases = [
    [SKY_CREATURE_LOOKS, [SKY_STAND_INS['drift-ray'], SKY_STAND_INS['sky-goat'], SKY_STAND_INS['gale-wisp'], SKY_STAND_INS['storm-roc']]],
    [DUNE_CREATURE_LOOKS, [RAY_BODY, SKITTERER_BODY, STRIDER_BODY, RAY_BODY]],
  ] as const;
  for (const [looks, bodies] of cases) {
    for (const [index, look] of looks.entries()) {
      const expected = bodies[index]; if (expected === undefined) throw new Error('Missing baseline skeleton');
      const variant = [...SKY_CREATURE_ROWS, ...SIGNAL_SPECIES].find(row => row.kind === look.kind)?.variants[0];
      if (variant === undefined) throw new Error('Missing shipping variant');
      const rng = new Rng(77), before = rng.snapshot();
      const first = look.build(variant, rng), second = look.build(variant, rng);
      expect(rng.snapshot()).toEqual(before);
      try {
        expect(first.bones).toEqual(expected.bones);
        expect(first.dims).toEqual({ ...expected.dims, feet: [] });
        expect(first.hardParts).toHaveLength(1);
        expect(Array.from(first.hardParts[0]?.getAttribute('position').array ?? [])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(second).not.toBe(first); expect(second.bones).not.toBe(first.bones);
        expect(second.hardParts[0]).not.toBe(first.hardParts[0]);
        first.bones[0]?.pos.splice(0, 1, 12345);
        expect(second.bones).toEqual(expected.bones);
      } finally {
        for (const body of [first, second]) for (const geometry of body.hardParts) geometry.dispose();
      }
    }
  }
});
