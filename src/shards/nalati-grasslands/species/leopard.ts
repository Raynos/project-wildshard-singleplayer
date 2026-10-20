import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { eliteThink, eliteAct, eliteDamageMul } from '@wildshard/game/quest/elitePage';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';

import { nalatiBody, poseNalatiCreature } from './presentation';






/**
 * Snow leopard (Nalati named elite E1 — Aqbars the Pale, Irbis of the Crags; row B12; mockup
 * art/nalati-grasslands/round-2/4-named-elites/elite-1-aqbars-snow-leopard.jpg). Pale smoky fur with dark open rosettes, a
 * cream belly, a huge thick tail, ice-blue eyes, a muzzle scar. 0.6 m at the shoulder at scale 1 (Aqbars is ×1.5).
 *
 * The QUADRUPED rig (Animal.ts poses the gait: the canid's bone names), feline proportions: long low body, short
 * round head, small round ears, heavy forepaws, the tail as long as the body. `postPose` adds, from `animal.mem`:
 *   mem.low     the stalking crouch (belly to the rock)       mem.snarl  lips back, ears flat
 *   mem.leap    0..1 airborne (the POUNCE: forelegs reach, hind legs trail, tail streaming)
 *   attackPhase (Animal.startAttack) a swipe: the right forepaw rakes (0.3–0.6), the left follows (0.6–0.9)
 * The AI is the elite's (src/shards/nalati-grasslands/combat/elites.ts). No think here: the species is not placed by any herd.
 */

export const LEOPARD = 'leopard';

/** the cat's body: the variant's baked lofts (`generators/leopardBody.ts` -> `species/bodies.ts`) */
const buildFelid = (v: VariantDef): AnimalSpecies => nalatiBody('leopard', v);

const felidPostPose = (c: RigAnimCtx): void => { poseNalatiCreature('leopard', c); };

const { id: _id, brain: _brain, ...body } = ecology.species.leopard;
export const LEOPARD_SPECIES: SpeciesDef = {
  ...body,
  kind: LEOPARD,
  rigContract: { skeleton: 'leopard.v1', clips: [], sockets: ['body', 'head'] },
  fur: NO_FUR,
  pose: { grazeNeck: 0.3, gallopTail: 0.2 },
  gait: { trot: 2.2, gallop: 6 },
  build: buildFelid,
  postPose: felidPostPose,
  act: eliteAct,
  think: eliteThink,
  damageMul: eliteDamageMul,
};
