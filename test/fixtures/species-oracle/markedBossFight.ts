import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { Vector3 } from 'three';

/**
 * A marked boss fight's row (SHARD-PLATFORM SF27): a circular arena, the body's health share at each checkpoint, the
 * intro's rise, the phases that raise its storm (a 0..1 weather strength the views read) and how fast the storm eases,
 * and the memory fields it marks on the body for the body's brain (a `phased-flyer` reads the same three).
 */
export interface MarkedBossFightRow {
  /** Its arena: the player inside `r` m of (x, z) wakes an armed boss. */
  readonly arena: { readonly x: number; readonly z: number; readonly r: number };
  /** The body's health share at each checkpoint (a checkpoint past the end takes the last). */
  readonly hpShares: readonly number[];
  /** Seconds the body takes to rise through the intro (`rise` 0 → 1). */
  readonly riseSeconds: number;
  /** The phases whose storm goal is 1 (every other phase's is 0). */
  readonly stormPhases: readonly number[];
  /** Seconds the storm takes to ease fully in or out. */
  readonly stormFade: number;
  /** The memory fields it marks: `fight` (1 once the fight is on), `rise` (0..1) and `phase`. */
  readonly fields: { readonly fight: string; readonly rise: string; readonly phase: string };
}

/** A marked boss fight's body: the declared boss row, spawned fresh at every reset (the previous body retired first). */
export interface MarkedBossBody<A extends AnimalSim> { spawn: (previous: A | undefined) => A | null; retire: (actor: A) => void }
/** What a marked boss fight is lent: the body, the reward point, where a dead player comes back, and the victory's own effects. */
export interface MarkedBossFightPorts<A extends AnimalSim> {
  readonly body: MarkedBossBody<A>;
  readonly rewardPoint: Vector3;
  readonly respawnPoint: () => { pos: Vector3; yaw: number };
  /** The boss fell (after the storm goal drops): the toast and the quest's flag / fact. */
  readonly victory: () => void;
  /** The fight's views, after the storm eased this tick (fog, sand shells, coin burst). */
  readonly update?: (dt: number, storm: number) => void;
}
/** A marked boss fight's own continuation beside `BossBrain`'s: the storm's goal and strength, and its invulnerability. */
export interface MarkedBossFightState { stormGoal: number; storm: number; invulnerable: boolean }
/** A marked boss fight: the view-free `BossScript`, its storm, its body and its continuation. */
export interface MarkedBossFight<A extends AnimalSim> {
  readonly script: BossScript;
  /** The storm's strength 0..1 (captures and tests read it). */
  readonly weather: { storm: number };
  readonly body: () => A | null;
  /** The body after a restore: the host already reinstalled it (no new spawn, no draw). */
  readonly adopt: (actor: A | null) => void;
  readonly invulnerable: () => boolean;
  readonly snapshot: () => MarkedBossFightState;
  readonly restore: (state: MarkedBossFightState) => void;
}

/**
 * A boss's `BossScript` from its row, free of any view (SF27, the Dune Matriarch's shape): a fresh body per checkpoint
 * at the checkpoint's health share, the intro's rise, the phase marks on the body's memory, the storm's goal per phase
 * and its easing, invulnerability through the beats, and the victory. One fight, two hosts: the browser runs it under
 * its views (`update`), the renderer-free host on the simulation host (`installBossRow`).
 */
export function markedBossFight<A extends AnimalSim>(row: MarkedBossFightRow, ports: MarkedBossFightPorts<A>): MarkedBossFight<A> {
  const focus = new Vector3(), { spawn, retire } = ports.body, weather = { storm: 0 }, f = row.fields;
  let animal: A | null = null, invulnerable = false, stormGoal = 0;
  const goal = (phase: number): number => row.stormPhases.includes(phase) ? 1 : 0;
  const fresh = (): A | null => {
    const previous = animal; if (previous) retire(previous);
    animal = spawn(previous ?? undefined);
    if (animal) { animal.mem[f.fight] = 0; animal.mem[f.rise] = 0; animal.mem[f.phase] = 0; }
    return animal;
  };
  const script: BossScript = {
    inArena: (p) => Math.hypot(p.x - row.arena.x, p.z - row.arena.z) < row.arena.r,
    reset: (checkpoint) => {
      stormGoal = 0; const a = fresh();
      if (a) { a.hp = a.maxHp * (row.hpShares[checkpoint] ?? row.hpShares[row.hpShares.length - 1] ?? 1); a.mem[f.phase] = checkpoint; }
    },
    seal: () => undefined,
    intro: (t) => { if (animal) { animal.mem[f.rise] = Math.min(1, t / row.riseSeconds); focus.copy(animal.position); return focus; } return ports.rewardPoint; },
    begin: (next) => { if (animal) { animal.mem[f.rise] = 1; animal.mem[f.fight] = 1; animal.mem[f.phase] = next; } stormGoal = goal(next); },
    enterPhase: (next) => { if (animal) animal.mem[f.phase] = next; stormGoal = goal(next); },
    update: (dt) => {
      weather.storm += Math.sign(stormGoal - weather.storm) * Math.min(Math.abs(stormGoal - weather.storm), dt / row.stormFade);
      ports.update?.(dt, weather.storm);
    },
    get hpFrac() { return animal ? Math.max(0, animal.hp / animal.maxHp) : 0; },
    get shielded() { return invulnerable; },
    get dead() { return animal !== null && !animal.alive; },
    clampHp: (frac) => { if (animal) animal.hp = frac * animal.maxHp; },
    setInvulnerable: (on) => { invulnerable = on; },
    victory: () => { stormGoal = 0; ports.victory(); },
    rewardPoint: () => ports.rewardPoint,
    respawnPoint: ports.respawnPoint,
  };
  return { script, weather, body: () => animal, adopt: (actor) => { animal = actor; }, invulnerable: () => invulnerable,
    snapshot: () => ({ stormGoal, storm: weather.storm, invulnerable }),
    restore: (state) => { stormGoal = state.stormGoal; weather.storm = state.storm; invulnerable = state.invulnerable; } };
}
