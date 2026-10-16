import { ENEMY_SPECIES_METADATA } from '../data/enemySpecies';
import { animateCrab } from './crabPose';
import { driftwoodSpeciesBrains } from '../runtime/speciesBrains';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { creatureBody } from './bodies';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import type * as THREE from 'three';

/**
 * Reef Crab — Wreck Cove's tidepool crab (art/driftwood-isle/round-3-enemies/driftwood-enemy-1-crab.png): a wide domed orange-red carapace with
 * a pale underside and a crust of barnacles, two eyestalks, six jointed legs and two big pincers. Groups of 3–5 —
 * one BIG (scale ~1.8, 70 hp, claws a quarter larger) and the rest small (scale ~0.85, 25 hp). Custom rig
 * (`rig: 'custom'`): body (root) + head (eyestalk root) + per side: claw arm / hand / tip, three legs × hip / knee.
 *
 * Behaviour (`think`, 10 Hz): dozes around its tidepool; inside 9 m it turns to face you and SIDESTEPS — strafes
 * around you at 1.3 m/s, flipping direction every 1–2.5 s, closing to ~2.4 m — and inside 1.9 m raises both claws
 * for a 0.5 s wind-up, then SNAPS: 10 damage if you are still within 1.6 m (strafe out of it). HARD SHELL
 * (`damageMul`): a blow that lands from the front (within 60° of its heading) does 50 %; flank it. When the big one
 * dies the small ones scatter (flee 6 s, then only bite when you come within 3 m or hit them).
 * Skitter (`animate`): the legs walk in two alternating tripods (L0 R1 L2 / R0 L1 R2), the sidestep reaches the
 * leading legs out and folds the trailing ones; claws up while engaged; the snap raises then slams them.
 */

// ── animation ────────────────────────────────────────────────────────────────────────────





// ── AI ───────────────────────────────────────────────────────────────────────────────────


/** the shell: a blow from within 60° of the crab's heading does half damage */
function crabDamageMul(a: Animal, _hit: THREE.Vector3, dir: THREE.Vector3): number {
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
  const dot = fx * dir.x + fz * dir.z;             // the blow travels opposite the heading when it comes from the front
  return dot < -0.5 ? 0.5 : 1;
}

const callbacks = driftwoodSpeciesBrains.bind('crab');

export const CRAB: SpeciesRow = { ...ENEMY_SPECIES_METADATA.crab, ...callbacks };

export const CRAB_LOOK: SpeciesLook = {
  rigContract: { skeleton: 'crab.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.crab', species: CRAB.id, kind: 'crab',
  fur: NO_FUR,
  rig: 'custom',
  // the lofted shell, claws and legs, baked offline (generators/creatureBodies.ts, the big crab's claws a quarter larger)
  build: (v) => creatureBody('crab', v.id),
  animate: animateCrab,
  damageMul: crabDamageMul,
};
