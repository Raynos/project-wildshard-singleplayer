import * as v from 'valibot';
import { Vector3 } from 'three';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/**
 * A held boss fight's row (SHARD-PLATFORM SF27): a boss whose one body stays through every checkpoint (a retry resets it
 * in place, it is never respawned). Its arena is a circle over a floor; `hpShares` is its health share at each checkpoint
 * (and so its phases' thresholds); the intro looks at, and the victory pays out at, `rewardPoint`; a player who dies in
 * the fight comes back at `respawn`.
 */
export interface HeldBossFightRow {
  /** The player inside `r` m of (x, z) and above `floor` wakes an armed boss. */
  readonly arena: { readonly x: number; readonly z: number; readonly r: number; readonly floor: number };
  readonly hpShares: readonly number[];
  readonly rewardPoint: { readonly x: number; readonly y: number; readonly z: number };
  readonly respawn: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number };
}
/** The body's brain a held boss fight drives: its phase, whether the fight is on, and its reset to its rest pose. */
export interface HeldBossBrain { phase: number; fighting: boolean; restart: () => void }
/** A held boss fight: its view-free `BossScript`, its shield, and its own continuation (`{ hp, invulnerable }`). */
export interface HeldBossFight {
  readonly script: BossScript;
  readonly shielded: () => boolean;
  readonly snapshot: () => { hp: number; invulnerable: boolean };
  readonly restore: (value: unknown) => void;
}
const finite = v.pipe(v.number(), v.finite());
const Continuation = v.strictObject({ hp: finite, invulnerable: v.boolean() });

/**
 * A held boss's view-free fight from its row (SF27, the Storm Roc's shape): the engine's BossBrain owns the intro, the
 * health-threshold phases, checkpoint and retry, and victory; this script binds them to the one body and its brain. A
 * reset puts the body back at the checkpoint's health share with its brain at that phase (clamped to the last), out of
 * the fight and restarted; the fight's start and each phase set the brain's phase; the body's health is the bar.
 * `onVictory` gets the reward point. One script, two hosts: the browser under its views, the headless host on its boss row.
 */
export function heldBossFight(row: HeldBossFightRow, body: AnimalSim | null, brain: HeldBossBrain | null, onVictory: (at: Vector3) => void): HeldBossFight {
  let hp = 1, invulnerable = false;
  const at = new Vector3(row.rewardPoint.x, row.rewardPoint.y, row.rewardPoint.z), last = row.hpShares.length - 1;
  const clamp = (n: number): number => n <= 0 ? 0 : Math.min(last, n);
  const script: BossScript = {
    inArena: (p) => Math.hypot(p.x - row.arena.x, p.z - row.arena.z) < row.arena.r && p.y > row.arena.floor,
    reset: (checkpoint) => { hp = row.hpShares[clamp(checkpoint)] ?? 1; if (brain) { brain.phase = clamp(checkpoint); brain.fighting = false; brain.restart(); }
      if (body) { body.hp = hp * body.maxHp; body.alive = true; } },
    seal: () => undefined, intro: () => at,
    begin: (next) => { if (brain) { brain.phase = clamp(next); brain.fighting = true; } },
    enterPhase: (next) => { if (brain) brain.phase = clamp(next); },
    update: (_dt, _t, fighting) => { if (body) hp = body.hp / body.maxHp; if (brain) brain.fighting = fighting; },
    get hpFrac() { return hp; }, get shielded() { return invulnerable; }, get dead() { return body ? !body.alive : hp === 0; },
    clampHp: (frac) => { hp = frac; if (body) body.hp = frac * body.maxHp; }, setInvulnerable: (on) => { invulnerable = on; },
    victory: () => { onVictory(at); }, rewardPoint: () => at,
    respawnPoint: () => ({ pos: new Vector3(row.respawn.x, row.respawn.y, row.respawn.z), yaw: row.respawn.yaw }),
  };
  return { script, shielded: () => invulnerable, snapshot: () => ({ hp, invulnerable }),
    restore: saved => { const value = v.parse(Continuation, saved); hp = value.hp; invulnerable = value.invulnerable; } };
}
