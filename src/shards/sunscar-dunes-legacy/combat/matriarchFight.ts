import type { BossDefinition, BossScript } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { Vector3 } from 'three';
import { BASIN } from '../data/layout';
import { STRINGS } from '../data/strings';
import { MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG } from '../quests/signal';

/** Her declared boss row's id (data/spawns.ts `bosses`), her encounter's id and her saved actor's identity. */
export const MATRIARCH_ID = 'sunscar.matriarch';
/** The reward: coins once, on the first fall (her paid flag). */
export const MATRIARCH_REWARD = 20;
/** Her rise out of the basin (the intro's pose), seconds. */
export const MATRIARCH_RISE = 3.2;
/** The phase II storm closes in and lifts over this many seconds. */
export const STORM_FADE = 2.5;

/** Her encounter: the intro, three phases at 100 / 66 / 33 % and their captions (the engine's `BossBrain` runs them). */
export function matriarchDefinition(): BossDefinition {
  return { id: MATRIARCH_ID, name: STRINGS.matriarch, title: STRINGS.matriarchTitle, retryTitle: STRINGS.retry, intro: MATRIARCH_RISE + 0.6, introShort: 1.2,
    phases: [{ at: 1, caption: STRINGS.phaseDives, name: STRINGS.phaseDives }, { at: 0.66, caption: STRINGS.phaseStorm, name: STRINGS.phaseStorm },
      { at: 0.33, caption: STRINGS.phaseGrounded, name: STRINGS.phaseGrounded }], reward: {} };
}

/** Her record's flags (SF50-p: no save of her own; `bossFlagRecord` keeps beaten and paid on the shard's flags). */
export const MATRIARCH_RECORD = { defeated: MATRIARCH_DEFEATED_FLAG, paid: MATRIARCH_PAID_FLAG } as const;

/** Her body: the declared boss row, spawned fresh at every reset (the previous body retired first). */
export interface MatriarchBody<A extends AnimalSim> { spawn: (previous: A | undefined) => A | null; retire: (actor: A) => void }
/** What her fight is lent: the body, the reward point, where a dead player comes back, and the victory's own effects. */
export interface MatriarchFightPorts<A extends AnimalSim> {
  readonly body: MatriarchBody<A>;
  readonly rewardPoint: Vector3;
  readonly respawnPoint: () => { pos: Vector3; yaw: number };
  /** She fell (after the storm goal drops): the toast and the quest's flag / fact. */
  readonly victory: () => void;
  /** The fight's views, after the storm eased this tick (fog, sand shells, coin burst). */
  readonly update?: (dt: number, storm: number) => void;
}
/** Her fight's own continuation beside `BossBrain`'s: the storm's goal and strength, and her invulnerability. */
export interface MatriarchFightState { stormGoal: number; storm: number; invulnerable: boolean }
export interface MatriarchFight<A extends AnimalSim> {
  readonly script: BossScript;
  /** The storm's strength 0..1 (captures and tests read it). */
  readonly weather: { storm: number };
  readonly body: () => A | null;
  /** Her body after a restore: the host already reinstalled it (no new spawn, no draw). */
  readonly adopt: (actor: A | null) => void;
  readonly invulnerable: () => boolean;
  readonly snapshot: () => MatriarchFightState;
  readonly restore: (state: MatriarchFightState) => void;
}

/**
 * The Dune Matriarch's `BossScript`, free of any view (SF72): her body's reset per checkpoint (fresh body, health at the
 * checkpoint's share), the rise, the phase marks on her memory (`mem.fight` / `mem.rise` / `mem.phase`, read by
 * `MatriarchBrain`), the storm's goal and easing, her invulnerability through the beats, and the victory. One fight,
 * two hosts: the browser's `DuneMatriarch` (combat/matriarch.ts) runs it under the fog, sand shells, boss bar and coin
 * burst; the headless runtime (runtime/matriarch.ts) runs it on the simulation host.
 */
export function matriarchFight<A extends AnimalSim>(ports: MatriarchFightPorts<A>): MatriarchFight<A> {
  const focus = new Vector3(), { spawn, retire } = ports.body, weather = { storm: 0 };
  let animal: A | null = null, invulnerable = false, stormGoal = 0;
  const fresh = (): A | null => {
    const previous = animal; if (previous) retire(previous);
    animal = spawn(previous ?? undefined);
    if (animal) { animal.mem['fight'] = 0; animal.mem['rise'] = 0; animal.mem['phase'] = 0; }
    return animal;
  };
  const script: BossScript = {
    // The fire's light is the summons (review R7): she rises while the player is anywhere from the bowl to the tower
    // deck (78 m from its centre), so the lighting player sees it.
    inArena: (p) => Math.hypot(p.x - BASIN.x, p.z - BASIN.z) < BASIN.r + 34,
    reset: (checkpoint) => {
      stormGoal = 0; const a = fresh();
      if (a) { a.hp = a.maxHp * (checkpoint === 0 ? 1 : checkpoint === 1 ? 0.66 : 0.33); a.mem['phase'] = checkpoint; }
    },
    seal: () => undefined,
    intro: (t) => { if (animal) { animal.mem['rise'] = Math.min(1, t / MATRIARCH_RISE); focus.copy(animal.position); return focus; } return ports.rewardPoint; },
    begin: (next) => { if (animal) { animal.mem['rise'] = 1; animal.mem['fight'] = 1; animal.mem['phase'] = next; } stormGoal = next === 1 ? 1 : 0; },
    enterPhase: (next) => { if (animal) animal.mem['phase'] = next; stormGoal = next === 1 ? 1 : 0; },
    update: (dt) => {
      weather.storm += Math.sign(stormGoal - weather.storm) * Math.min(Math.abs(stormGoal - weather.storm), dt / STORM_FADE);
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
