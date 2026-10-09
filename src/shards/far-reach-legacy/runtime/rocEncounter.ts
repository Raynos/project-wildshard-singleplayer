import * as v from 'valibot';
import { Vector3 } from 'three';
import type { BossDefinition, BossScript } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { CROWN, DAIS, FALLEN_BRIDGE } from '../data/layout';
import { STRINGS } from '../data/strings';
import type { RocPhase, StormRocBrain } from './stormRocBrain';

export const ROC_ID = 'far.roc';
/** The HP fractions where phases 2 and 3 begin. */
export const PHASES = [1, 0.66, 0.33] as const;
/** The Roc's purse: coins paid on its first fall (the quest's reward is separate). */
export const BOSS_REWARD = 25;
const clampPhase = (n: number): RocPhase => n <= 0 ? 0 : n === 1 ? 1 : 2;

/** The encounter's card, phases and retry title; the browser's StormRocBoss and the headless runtime build the same one. */
export function rocBossDefinition(): BossDefinition {
  return { id: ROC_ID, name: STRINGS.roc, title: STRINGS.rocTitle, retryTitle: STRINGS.rocRetry, intro: 1.5, introShort: 0.3,
    phases: [{ at: PHASES[0], caption: STRINGS.rocP1, name: STRINGS.rocP1 }, { at: PHASES[1], caption: STRINGS.rocP2, name: STRINGS.rocP2 }, { at: PHASES[2], caption: STRINGS.rocP3, name: STRINGS.rocP3 }],
    reward: {} };
}
const finite = v.pipe(v.number(), v.finite());
const Continuation = v.strictObject({ hp: finite, invulnerable: v.boolean() });

/**
 * The Storm Roc's fight, view-free (SF72): the engine's BossBrain owns the intro, the HP-threshold phases, checkpoint and
 * retry, and victory; this script binds them to the Roc's body (phase 1 stoops from the storm, phase 2 sweeps gale walls
 * across the crown, phase 3 lands on the dais) and to the crown arena. The browser (combat/stormRoc.ts) and the headless
 * runtime (runtime/roc.ts) run this one script; presentation, input, respawn and persistence stay their own ports.
 */
export function rocEncounter<A extends AnimalSim>(roc: A | null, body: StormRocBrain<A> | null, onVictory: (at: Vector3) => void): {
  script: BossScript; shielded: () => boolean; snapshot: () => { hp: number; invulnerable: boolean }; restore: (value: unknown) => void;
} {
  let hp = 1, invulnerable = false;
  const at = new Vector3(DAIS.x, CROWN.y + DAIS.h, DAIS.z);
  const script: BossScript = {
    inArena: (p) => Math.hypot(p.x - CROWN.x, p.z - CROWN.z) < CROWN.r * 0.9 && p.y > CROWN.y - 2,
    reset: (checkpoint) => { hp = PHASES[clampPhase(checkpoint)]; if (body) { body.phase = clampPhase(checkpoint); body.fighting = false; body.restart(); }
      if (roc) { roc.hp = hp * roc.maxHp; roc.alive = true; } },
    seal: () => undefined, intro: () => at,
    begin: (next) => { if (body) { body.phase = clampPhase(next); body.fighting = true; } },
    enterPhase: (next) => { if (body) body.phase = clampPhase(next); },
    update: (_dt, _t, fighting) => { if (roc) hp = roc.hp / roc.maxHp; if (body) body.fighting = fighting; },
    get hpFrac() { return hp; }, get shielded() { return invulnerable; }, get dead() { return roc ? !roc.alive : hp === 0; },
    clampHp: (frac) => { hp = frac; if (roc) roc.hp = frac * roc.maxHp; }, setInvulnerable: (on) => { invulnerable = on; },
    victory: () => { onVictory(at); }, rewardPoint: () => at,
    respawnPoint: () => ({ pos: new Vector3(FALLEN_BRIDGE.x1, CROWN.y + 0.2, FALLEN_BRIDGE.z1 - 2), yaw: 0 }),
  };
  return { script, shielded: () => invulnerable, snapshot: () => ({ hp, invulnerable }),
    restore: saved => { const value = v.parse(Continuation, saved); hp = value.hp; invulnerable = value.invulnerable; } };
}
