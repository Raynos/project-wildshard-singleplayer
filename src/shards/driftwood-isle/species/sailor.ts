import { ENEMY_SPECIES_METADATA } from '../data/enemySpecies';
import { driftwoodSpeciesBrains } from '../runtime/speciesBrains';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { animateSailor } from './sailorPose';
import { creatureBody, preloadCreatureBodies } from './bodies';
import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
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

const ST_ATTACK = 2;
const HIT_R = 1.9, WINDUP = 0.6, SWING_DUR = 0.9;

export const SAILOR: SpeciesRow = { ...ENEMY_SPECIES_METADATA.sailor, act: actSailor, think: thinkSailor };

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

/** What the strike reads: the contact ports and the sound (ThinkCtx in the browser, a headless host's ports in SF72). */
export interface SailorStrikePorts<A extends AnimalSim> extends DriftwoodContactPorts<A> { sound: (name: string) => void }
function strikeSailor<A extends AnimalSim>(a: A, c: SailorStrikePorts<A>): void {
  const m = a.mem as SailorMem, p = a.attackPhase;
  if (m.st !== ST_ATTACK || p < 0) return;
  if (p >= WINDUP / SWING_DUR + 0.05 && !m.hit) { m.hit = 1; if (driftwoodContact(a, c, { ...DRIFTWOOD_STRIKES.sailor, shape: { kind: 'point', radius: HIT_R } })) c.sound('sailor_slash'); }
}
const STATES = ['hide', 'rise', 'attack', 'guard', 'sink'] as const;
/** The sailor's brain shell: the selected decision (shipping or data-selected) at 10 Hz, the strike every body step. */
export class SailorBrain<A extends AnimalSim, C extends SailorStrikePorts<A>> extends CreatureBrain<typeof STATES[number], A, C> {
  private readonly decide: (actor: A, ctx: C) => void;
  constructor(actor: A, decide: (actor: A, ctx: C) => void) { super(actor, STATES); this.decide = decide; }
  override think(ctx: C): void {
    this.decide(this.actor, ctx);
    const state = STATES[this.actor.mem['st'] ?? 0];
    if (state !== undefined) this.transition(state);
  }
  override act(ctx: C): void { strikeSailor(this.actor, ctx); }
}
const brains = new WeakMap<Animal, SailorBrain<Animal, ThinkCtx>>();
function brain(a: Animal): SailorBrain<Animal, ThinkCtx> {
  let value = brains.get(a);
  if (value === undefined) {
    const decision = driftwoodSpeciesBrains.decision('sailor', a);
    if (decision.archetype !== 'guardian') throw new Error('Driftwood sailor requires its authored interior guardian row');
    value = new SailorBrain<Animal, ThinkCtx>(a, (_actor, ctx) => { decision.policy.think(ctx); });
    brains.set(a, value);
  }
  return value;
}
function thinkSailor(a: Animal, ctx: ThinkCtx): void { brain(a).think(ctx); }
function actSailor(a: Animal, ctx: ThinkCtx): void { brain(a).act(ctx); }
