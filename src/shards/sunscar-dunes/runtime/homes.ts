import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimSpawn } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { challengeGrazer } from '@wildshard/sdk/grazers';
import { patrolDiver } from '@wildshard/sdk/flyers';
import { RAY_BRAIN, STRIDER_BRAIN } from '../data/brains';
import { SIGNAL_SPAWNS } from '../data/spawns';
import { RAY_HOME, SEED } from '../layout';
import { DUNE_RAY } from './species/duneRay';
import { DUNE_STRIDER } from './species/strider';
import { SKITTERER_DATA } from './species/skitterer';
import { homeBrain, type HomeBrain } from './homeBrains';

/** The homes keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const HOMES_STEP = 'sunscar.homes';
/** The declared home count (data/spawns.ts): the keeper's loops are bounded by it. */
const HOME_COUNT = 13;
/** The browser's 'legacy' decision band: 10 Hz decisions, bodies every frame (AnimalManager scheduler). */
const THINK_EVERY = 6, THINK_DT = 0.1;
const RANGES = new Map([DUNE_RAY, SKITTERER_DATA, DUNE_STRIDER].map(row => {
  const variant = row.variants[0]; if (variant === undefined) throw new Error(`Signal species ${row.kind} has no variant`);
  return [row.kind, variant.scale] as const;
}));

interface Home { readonly id: string; readonly kind: string; readonly respawn: number; readonly recipe: SimSpawn; readonly range: readonly [number, number]; wait: number; actor: AnimalSim | null; brain: HomeBrain | null }
/** What the headless keeper is lent: the baked native specs, the manifest's attack cap and the quest's "held" gate. */
export interface SignalHomesPorts {
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** `fight.attackers` from the manifest (E297): at most this many creatures hold an attack token at once. */
  readonly attackers: number;
  /** The ray circles its home without striking until the player has met Sefa (R1B-13). */
  readonly held: () => boolean;
}
const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
/** A saved trusted recipe's placement; the spec is this build's bake, so a changed spec refuses at the host's restore. */
const Placed = v.object({ id: v.string(), seed: finite, scale: finite, at: v.strictObject({ x: finite, y: finite, z: finite }), yaw: finite });
/** Every shipping home policy saves itself as one string (its own strict continuation). */
const Policy = v.string();
const Saved = v.strictObject({ version: v.literal(1), rng: Stream, tokens: v.array(v.string()),
  homes: v.array(v.strictObject({ id: v.string(), wait: finite, live: v.boolean(), policy: v.nullable(v.string()) })) });

/**
 * The 13 declared homes of Signal Dunes in a renderer-free host (SF72): the platform keeper's spawn, death and respawn
 * rules (`bindRuntimeHomes`), the creature manager's own random stream (six draws per spawn: scale, rig seed, actor seed,
 * timer, fleeUntil, callT), its attack tokens, and the shipping policies (ray patrol-diver, skitterer, strider
 * challenge-grazer) on its 10 Hz decision / per-frame body cadence. Bodies are trusted dynamic actors (`host.spawn`);
 * restore reinstalls exactly the saved roster from its recipes before the host restores, with no stream draw.
 */
export function installSignalHomes(host: SimHost, ports: SignalHomesPorts, saved?: Readonly<SimSnapshot>): { homes: () => readonly { id: string; actor: AnimalSim | null; wait: number }[] } {
  if (SIGNAL_SPAWNS.homes.length !== HOME_COUNT) throw new Error('Signal declares 13 homes');
  const rng = new Rng(SEED + 31), holders = new Set<AnimalSim>();
  const shared = { host, ray: patrolDiver({ ...RAY_BRAIN, home: { x: RAY_HOME.x, z: RAY_HOME.z } }), strider: challengeGrazer(STRIDER_BRAIN),
    claim: (a: AnimalSim): boolean => { if (holders.has(a)) return true; if (holders.size >= ports.attackers) return false; holders.add(a); return true; } };
  const homes: Home[] = SIGNAL_SPAWNS.homes.map(row => {
    const spec = ports.specs.get(row.kind), range = RANGES.get(row.kind);
    if (spec === undefined || range === undefined) throw new Error(`Missing native Signal recipe ${row.kind}`);
    const ground = host.groundHeightAt(row.at[0], row.at[1]), y = spec.flight === undefined ? ground : spec.flight.altitude + (spec.flight.above === 'world' ? 0 : ground);
    return { id: row.id, kind: row.kind, respawn: row.respawn, range, wait: 0, actor: null, brain: null,
      recipe: { id: row.id, spec, seed: 0, scale: 1, at: { x: row.at[0], y, z: row.at[1] }, yaw: row.yaw } };
  });
  const materialize = (home: Home, recipe: SimSpawn): void => { const a = host.spawn(recipe); home.actor = a; home.brain = homeBrain(home.kind, a, shared); };
  /** The creature manager's six draws, into the home's own recipe (the host copies it at spawn). */
  const respawn = (home: Home): void => {
    home.recipe.scale = rng.range(home.range[0], home.range[1]); rng.next(); home.recipe.seed = rng.next(); rng.next(); rng.next(); rng.next();
    home.wait = 0; materialize(home, home.recipe);
  };
  host.events.on('actor.died', ({ actor }) => { const home = homes.find(h => h.actor?.combatActor() === actor); if (home) home.wait = home.respawn; }, host.scope);
  host.onStep(HOMES_STEP, dt => {
    const think = host.state.tick % THINK_EVERY === 1, ray = homes[0]?.actor;
    if (ray) ray.mem['held'] = ports.held() ? 1 : 0;
    for (let i = 0; i < HOME_COUNT; i++) { const a = homes[i]?.actor; if (a && holders.has(a) && (!a.alive || a.attackPhase < 0)) holders.delete(a); }
    if (think) for (let i = 0; i < HOME_COUNT; i++) { const home = homes[i]; if (home?.actor?.alive === true) home.brain?.decide(THINK_DT); }
    for (let i = 0; i < HOME_COUNT; i++) { const home = homes[i]; if (home === undefined) continue; const a = home.actor; if (a && a.alive && !a.stunned) home.brain?.move(dt); }
    for (let i = 0; i < HOME_COUNT; i++) {
      const home = homes[i];
      if (home === undefined || home.wait <= 0) continue;
      home.wait -= dt;
      if (home.wait > 0) continue;
      if (home.actor) { holders.delete(home.actor); host.retire(home.id); home.actor = null; home.brain = null; }
      respawn(home);
    }
  }, {
    snapshot: () => ({ version: 1, rng: { ...rng.snapshot() }, tokens: homes.flatMap(h => h.actor !== null && holders.has(h.actor) ? [h.id] : []),
      homes: homes.map(h => ({ id: h.id, wait: h.wait, live: h.actor !== null, policy: h.brain === null ? null : JSON.stringify(h.brain.snapshot()) })) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.homes.length !== homes.length || state.homes.some((h, i) => { const home = homes.at(i); return home === undefined || h.id !== home.id || h.live !== (home.actor !== null); })) throw new Error('Incompatible Signal homes continuation');
      const tokens = state.tokens.map(id => { const a = homes.find(h => h.id === id)?.actor ?? null; if (a === null) throw new Error('Unknown Signal token holder'); return a; });
      rng.restore(state.rng); holders.clear(); tokens.forEach(a => { holders.add(a); });
      state.homes.forEach((h, i) => { const home = homes[i]; if (home === undefined) return; home.wait = h.wait; if (h.policy !== null) home.brain?.restore(v.parse(Policy, JSON.parse(h.policy))); });
    },
  });
  if (saved === undefined) homes.forEach(respawn);
  else {
    const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === HOMES_STEP)?.state);
    keeper.homes.forEach((h, i) => {
      const home = homes[i]; if (home === undefined || !h.live) return;
      const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${home.id}`)?.state;
      if (typeof contract !== 'string') throw new Error(`Missing saved Signal actor ${home.id}`);
      const placed = v.parse(Placed, JSON.parse(contract));
      if (placed.id !== home.id) throw new Error(`Incompatible saved Signal actor ${home.id}`);
      materialize(home, { id: placed.id, spec: home.recipe.spec, seed: placed.seed, scale: placed.scale, at: placed.at, yaw: placed.yaw });
    });
  }
  return { homes: () => homes.map(h => ({ id: h.id, actor: h.actor, wait: h.wait })) };
}
