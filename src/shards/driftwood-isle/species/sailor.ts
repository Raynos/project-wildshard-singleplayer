import { ENEMY_SPECIES_METADATA } from '../data/enemySpecies';
import { driftwoodSpeciesBrains } from '../runtime/speciesBrains';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { animateSailor } from './sailorPose';
import { creatureBody, preloadCreatureBodies } from './bodies';
import { createMemoryActionBrain } from '@wildshard/game/plugin/brain';
import { SAILOR_ACTIONS } from '../data/speciesActions';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { DRIFTWOOD_STRIKES, driftwoodContact, type DriftwoodContactPorts } from '../combat/strikes';

/**
 * Drowned Sailor — the wreck's guardian (art/driftwood-isle/round-3-enemies/driftwood-enemy-3-wreckghost.png): a bone-white faceted skeleton in the
 * rags of a striped shirt and dark breeches, a red bandana, seaweed hanging off its shoulders and belt, glowing cyan
 * eyes (the eye material is emissive — `eyeGlow`; Enemies.ts adds the faint cyan point light) and a cutlass in its
 * right hand. Humanoid custom rig: body (pelvis, root) · spine · chest · head · per side arm sh / el / hand, leg
 * hip / knee / foot. 60 hp.
 *
 * Behaviour (`think`): HIDES under the wreck's broken deck (`EnemyWorld.hold`) until you come within `hold.r` of it,
 * then RISES through the planks over 1.5 s (arms up, water streaming — `world.splash`), and SHAMBLES after you at
 * 1.1 m/s while you stay inside `hold.guardR` of the hold — it guards the iron sword, it does not chase you down the
 * beach. Inside 1.8 m it winds the cutlass up over its head for 0.6 s and SWINGS: 14 damage within 1.9 m. When you
 * leave, it drifts back to its spot and sinks under the deck again. Dies into a splash of droplets (Enemies.ts: the
 * light goes out) and dissolves when harvested, or on its own after a minute (`corpseFade`). With no hold (the dev harness) it stands guard where it was placed.
 */

export type SailorMem = Record<string, number> & {
  init: number; hx: number; hz: number; cd: number; hitT: number; away: number;
  rise: number; rising: number; sinking: number; floor: number; floorS?: number;
  st: number; hit: number;
  /** E297: the side-step round a beam — ±1, and the time left before it tries the other side */
  sd?: number; sdT?: number;
};

// ── animation ────────────────────────────────────────────────────────────────────────────

export const RISE_T = 1.5;

/** The baked bodies (runtime/creatureBodies.ts) before the sailor spawns: the adventure's install waits on it behind the
 *  loading screen, Enemies.ts before placing the island's enemies. */
export function preloadSailorHead(): Promise<void> { return preloadCreatureBodies(); }

/** The one shipping nonvisual rise/sink/deck transition. Visual and trusted native bodies call it once per body phase. */




// ── AI ───────────────────────────────────────────────────────────────────────────────────

const HIT_R = 1.9;

/** What the strike reads: the contact ports and the sound (ThinkCtx in the browser, a headless host's ports in SF72). */
export interface SailorStrikePorts<A extends AnimalSim> extends DriftwoodContactPorts<A> { sound: (name: string) => void }
export function strikeSailor<A extends AnimalSim>(a: A, c: SailorStrikePorts<A>): void {
  if (driftwoodContact(a, c, { ...DRIFTWOOD_STRIKES.sailor, shape: { kind: 'point', radius: HIT_R } })) c.sound('sailor_slash');
}

const callbacks = driftwoodSpeciesBrains.bind('sailor', (actor, decision) => {
  if (decision.archetype !== 'guardian') throw new Error('Driftwood sailor requires its authored guardian row');
  return createMemoryActionBrain<Animal, ThinkCtx>(actor, SAILOR_ACTIONS, { decide: (_actor, ctx) => { decision.policy.think(ctx); }, effects: new Map([['swing', strikeSailor]]) });
});

export const SAILOR: SpeciesRow = { ...ENEMY_SPECIES_METADATA.sailor, ...callbacks };

export const SAILOR_LOOK: SpeciesLook = {
  rigContract: { skeleton: 'sailor.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.sailor', species: SAILOR.id, kind: 'sailor',
  standMem: { init: 1, rise: 1 }, // it waits sunk under the wreck's deck until woken: the Explorer shows it risen
  fur: NO_FUR,
  rig: 'custom',
  eyeGlow: [0.2, 1.0, 1.0], eyeGlowIntensity: 1.0,
  // the lofted skeleton with its Hunyuan head, baked offline (generators/creatureBodies.ts)
  build: (v) => creatureBody('sailor', v.id),
  animate: animateSailor,
};
