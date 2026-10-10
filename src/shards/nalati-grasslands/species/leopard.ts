import { eliteThink, eliteAct, eliteDamageMul } from '@wildshard/engine/entities/eliteBrain';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR, bump, clamp } from '@wildshard/engine/entities/species/rigs';
import { LEOPARD_DATA } from '../data/species/leopard';

import * as THREE from 'three';
import { nalatiBody } from './bodies';






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

const _e = new THREE.Euler();

/** the cat's own motion on top of the quadruped gait: the crouch, the leap, the swipe, the long tail */
function felidPostPose(c: RigAnimCtx): void {
  const b = c.bones;
  const body = b['body'], n1 = b['neck1'], head = b['head'], jaw = b['jaw'], t1 = b['tail'], t2 = b['tail2'];
  if (body === undefined || n1 === undefined || head === undefined || jaw === undefined || t1 === undefined || t2 === undefined) return;
  const m = c.mem;
  if (!c.alive) return;
  const low = clamp(m['low'] ?? 0, 0, 1), snarl = clamp(m['snarl'] ?? 0, 0, 1), leap = clamp(m['leap'] ?? 0, 0, 1);
  const a = c.attack;
  const rake = a >= 0 ? bump(a, 0.25, 0.65) : 0, rake2 = a >= 0 ? bump(a, 0.55, 0.95) : 0;
  body.position.y += -0.14 * low - 0.04 * snarl;
  body.rotation.x += 0.04 * low - 0.18 * leap - 0.08 * Math.max(rake, rake2);
  n1.rotation.x += 0.3 * low - 0.1 * leap;
  head.rotation.x += -0.25 * low + 0.15 * leap;
  for (const s of ['L', 'R'] as const) {
    const sh = b[`F${s}_shoulder`], ca = b[`F${s}_carpus`], hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`];
    const r = s === 'R' ? rake : rake2;
    if (sh !== undefined) { sh.rotation.x -= 1.1 * leap + 1.3 * r; sh.rotation.z += (s === 'L' ? 1 : -1) * 0.35 * r; }
    if (ca !== undefined) ca.rotation.x += 0.4 * low - 0.3 * leap + 0.6 * r;
    if (hp !== undefined) hp.rotation.x += 0.45 * low + 0.7 * leap;
    if (stf !== undefined) stf.rotation.x -= 0.35 * low + 0.3 * leap;
  }
  jaw.rotation.x = Math.max(0.3 * snarl, 0.4 * Math.max(rake, rake2), 0.25 * leap);
  const eL = b['earL'], eR = b['earR'], flat = Math.max(snarl, leap) * 0.9;
  if (eL !== undefined) eL.rotation.x += flat; if (eR !== undefined) eR.rotation.x += flat;
  // the tail: low and twitching at the tip when stalking, streaming straight back in the leap, a slow S-swing otherwise
  const tw = Math.sin(c.t * (low > 0.3 ? 7 : 1.1) + c.seed * 4);
  t1.rotation.x += -0.25 * low + 0.5 * leap;
  _e.set(0.45 * leap - 0.15 + 0.1 * Math.sin(c.t * 0.9 + c.seed), 0, 0.3 * tw * (0.3 + 0.7 * (1 - leap)));
  t2.rotation.copy(_e);
}

const { id: _id, brain: _brain, ...body } = LEOPARD_DATA;
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
