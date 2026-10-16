import { ENEMY_SPECIES_METADATA } from '../data/enemySpecies';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { animateCrab } from './crabPose';
import { driftwoodSpeciesBrains } from '../runtime/speciesBrains';
import { createMemoryActionBrain } from '@wildshard/game/plugin/brain';
import { CRAB_ACTIONS } from '../data/speciesActions';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { creatureBody } from './bodies';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { DRIFTWOOD_STRIKES, driftwoodContact, type DriftwoodContactPorts } from '../combat/strikes';
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

const SNAP_R = 1.6;

/** the shell: a blow from within 60° of the crab's heading does half damage */
function crabDamageMul(a: Animal, _hit: THREE.Vector3, dir: THREE.Vector3): number {
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
  const dot = fx * dir.x + fz * dir.z;             // the blow travels opposite the heading when it comes from the front
  return dot < -0.5 ? 0.5 : 1;
}

/** What the strike reads: the contact ports and the sound (ThinkCtx in the browser, a headless host's ports in SF72). */
export interface CrabStrikePorts<A extends AnimalSim> extends DriftwoodContactPorts<A> { sound: (name: string) => void }
export function strikeCrab<A extends AnimalSim>(a: A, c: CrabStrikePorts<A>): void {
  if (driftwoodContact(a, c, { ...DRIFTWOOD_STRIKES.snap, damage: a.mods.chargeDamage, shape: { kind: 'point', radius: SNAP_R * Math.max(1, a.scale * 0.8) } })) c.sound('crab_snap');
}

const callbacks = driftwoodSpeciesBrains.bind('crab', (actor, decision) => {
  if (decision.archetype !== 'skirmisher') throw new Error('Driftwood crab requires its authored skirmisher row');
  return createMemoryActionBrain<Animal, ThinkCtx>(actor, CRAB_ACTIONS, { decide: (_actor, ctx) => { decision.policy.think(ctx); }, effects: new Map([['snap', strikeCrab]]) });
});

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
