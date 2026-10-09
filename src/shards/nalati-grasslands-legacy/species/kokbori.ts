import { eliteThink, eliteAct, eliteDamageMul } from '@wildshard/engine/entities/eliteBrain';
import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';




import { buildCanid, canidPostPose } from './wolf';


/**
 * Kokbori, Mother of the Pack (Nalati named elite E2; row B12; mockup
 * art/nalati-grasslands/round-2/4-named-elites/elite-2-kokbori-sky-wolf.jpg) — the sky-grey she-wolf of Turkic myth. The
 * creature row's canid (src/shards/nalati-grasslands/species/wolf.ts `buildCanid` + `canidPostPose`, so she stalks, snarls, lunges and
 * HOWLS exactly like her pack) at ×2.6, in a blue-grey coat with a silver ruff and pale eyes. Her own kind so the pack AI
 * (Pack.ts, which drives every `wolf`) leaves her to the elite's brain (src/shards/nalati-grasslands/combat/elites.ts). 650 hp.
 */

export const KOKBORI = 'kokbori';

const SKY: Record<string, RGB> = {
  back: [0.4, 0.44, 0.5], side: [0.64, 0.68, 0.73], cream: [0.93, 0.94, 0.96], leg: [0.6, 0.64, 0.69], dark: [0.2, 0.22, 0.26],
  eye: [0.78, 0.9, 0.96], earIn: [0.7, 0.7, 0.74],
};

export const KOKBORI_SPECIES: SpeciesDef = {
  lockable: true,
  rigContract: { skeleton: 'kokbori.v1', clips: [], sockets: ['body', 'head'] },
  kind: KOKBORI,
  label: engineString('s_1dcfb937c1e2'),
  fur: NO_FUR,
  aggressive: true,
  walkSpeed: 1.8,
  chargeSpeed: 11,
  chargeDamage: 22,
  sounds: { call: 'wolf_howl', hurt: 'wolf_yelp', callEvery: [50, 120] },
  pose: { grazeNeck: 0.5, gallopTail: 0.3 },
  gait: { trot: 1.8, gallop: 5.6 },
  variants: [
    { id: 'kokbori', label: engineString('s_646884575438'), weight: 1, rarity: 'legendary', scale: [2.6, 2.6], hp: 650, tint: SKY, traits: { ruff: 1.45 } },
  ],
  build: buildCanid,
  postPose: canidPostPose,
  tick: 'ai',
  act: eliteAct,
  think: eliteThink,
  damageMul: eliteDamageMul,
};
