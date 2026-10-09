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
import { MATRIARCH_DATA } from './species/matriarch';
import { homeBrain, type HomeBrain } from './homeBrains';

/** The homes keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const HOMES_STEP = 'sunscar.homes';
/** The declared home count (data/spawns.ts): the keeper's loops are bounded by it. */
const HOME_COUNT = 13;
/** The homes and the Matriarch's body: the keeper's per-body loops are bounded by it. */
const BODY_COUNT = 14;
/** The browser's 'legacy' decision band: 10 Hz decisions, bodies every frame (AnimalManager scheduler). */
const THINK_EVERY = 6, THINK_DT = 0.1;
const RANGES = new Map([DUNE_RAY, SKITTERER_DATA, DUNE_STRIDER, MATRIARCH_DATA].map(row => {
  const variant = row.variants[0]; if (variant === undefined) throw new Error(`Signal species ${row.kind} has no variant`);
  return [row.kind, variant.scale] as const;
}));

interface Body { readonly id: string; readonly kind: string; readonly recipe: SimSpawn; readonly range: readonly [number, number]; actor: AnimalSim | null; brain: HomeBrain | null }
interface Home extends Body { readonly respawn: number; wait: number }
/** A declared boss row (data/spawns.ts `bosses`): no home refill; its encounter spawns and retires the body. */
export interface SignalBossRow { readonly id: string; readonly kind: string; readonly at: readonly [number, number]; readonly yaw: number }
/** The encounter's handle on its body: `draw` spawns it with the creature stream's six draws, `free` retires its id and token. */
export interface SignalBossBody { draw: () => AnimalSim; free: () => void; readonly actor: () => AnimalSim | null }
/** What the headless keeper is lent: the baked native specs, the manifest's attack cap and the quest's "held" gate. */
export interface SignalHomesPorts {
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** `fight.attackers` from the manifest (E297): at most this many creatures hold an attack token at once. */
  readonly attackers: number;
  /** The ray circles its home without striking until the player has met Sefa (R1B-13). */
  readonly held: () => boolean;
  /** The Matriarch's declared row: her body joins the same manager (stream, tokens, cadence) after the homes. */
  readonly boss?: SignalBossRow;
}
const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
/** A saved trusted recipe's placement; the spec is this build's bake, so a changed spec refuses at the host's restore. */
const Placed = v.object({ id: v.string(), seed: finite, scale: finite, at: v.strictObject({ x: finite, y: finite, z: finite }), yaw: finite });
/** Every shipping home policy saves itself as one string (its own strict continuation). */
const Policy = v.string();
const Saved = v.strictObject({ version: v.literal(1), rng: Stream, tokens: v.array(v.string()),
  homes: v.array(v.strictObject({ id: v.string(), wait: finite, live: v.boolean(), policy: v.nullable(v.string()) })),
  boss: v.nullable(v.strictObject({ id: v.string(), live: v.boolean(), policy: v.nullable(v.string()) })) });

/**
 * The 13 declared homes of Signal Dunes in a renderer-free host (SF72): the platform keeper's spawn, death and respawn
 * rules (`bindRuntimeHomes`), the creature manager's own random stream (six draws per spawn: scale, rig seed, actor seed,
 * timer, fleeUntil, callT), its attack tokens, and the shipping policies (ray patrol-diver, skitterer, strider
 * challenge-grazer) on its 10 Hz decision / per-frame body cadence. Bodies are trusted dynamic actors (`host.spawn`);
 * restore reinstalls exactly the saved roster from its recipes before the host restores, with no stream draw. The
 * Matriarch's body (`ports.boss`) is one more animal of the same manager, after the homes: her encounter spawns it at
 * each reset (six draws from the same stream), her unique policy shares the tokens and cadence, and nothing refills it.
 * On restore, `settle` reinstalls the bodies spawned in play once the runtime's other steps are registered.
 */
export function installSignalHomes(host: SimHost, ports: SignalHomesPorts, saved?: Readonly<SimSnapshot>): { settle: () => void; homes: () => readonly { id: string; actor: AnimalSim | null; wait: number }[]; boss: SignalBossBody | null } {
  if (SIGNAL_SPAWNS.homes.length !== HOME_COUNT) throw new Error('Signal declares 13 homes');
  const rng = new Rng(SEED + 31), holders = new Set<AnimalSim>();
  const shared = { host, ray: patrolDiver({ ...RAY_BRAIN, home: { x: RAY_HOME.x, z: RAY_HOME.z } }), strider: challengeGrazer(STRIDER_BRAIN),
    claim: (a: AnimalSim): boolean => { if (holders.has(a)) return true; if (holders.size >= ports.attackers) return false; holders.add(a); return true; } };
  const recipe = (id: string, kind: string, at: readonly [number, number], yaw: number): { recipe: SimSpawn; range: readonly [number, number] } => {
    const spec = ports.specs.get(kind), range = RANGES.get(kind);
    if (spec === undefined || range === undefined) throw new Error(`Missing native Signal recipe ${kind}`);
    const ground = host.groundHeightAt(at[0], at[1]), y = spec.flight === undefined ? ground : spec.flight.altitude + (spec.flight.above === 'world' ? 0 : ground);
    return { range, recipe: { id, spec, seed: 0, scale: 1, at: { x: at[0], y, z: at[1] }, yaw } };
  };
  const homes: Home[] = SIGNAL_SPAWNS.homes.map(row => { const made = recipe(row.id, row.kind, row.at, row.yaw);
    return { id: row.id, kind: row.kind, respawn: row.respawn, wait: 0, actor: null, brain: null, recipe: made.recipe, range: made.range }; });
  const row = ports.boss, made = row === undefined ? null : recipe(row.id, row.kind, row.at, row.yaw);
  const boss: Body | null = row === undefined || made === null ? null : { id: row.id, kind: row.kind, actor: null, brain: null, recipe: made.recipe, range: made.range };
  const bodies: readonly Body[] = boss === null ? homes : [...homes, boss];
  const materialize = (body: Body, next: SimSpawn): AnimalSim => { const a = host.spawn(next); body.actor = a; body.brain = homeBrain(body.kind, a, shared); return a; };
  /** The creature manager's six draws, into the body's own recipe (the host copies it at spawn). */
  const drawBody = (body: Body): AnimalSim => {
    body.recipe.scale = rng.range(body.range[0], body.range[1]); rng.next(); body.recipe.seed = rng.next(); rng.next(); rng.next(); rng.next();
    return materialize(body, body.recipe);
  };
  const freeBody = (body: Body): void => { if (body.actor) { holders.delete(body.actor); host.retire(body.id); body.actor = null; body.brain = null; } };
  const respawn = (home: Home): void => { home.wait = 0; drawBody(home); };
  host.events.on('actor.died', ({ actor }) => { const home = homes.find(h => h.actor?.combatActor() === actor); if (home) home.wait = home.respawn; }, host.scope);
  host.onStep(HOMES_STEP, dt => {
    const think = host.state.tick % THINK_EVERY === 1, ray = homes[0]?.actor;
    if (ray) ray.mem['held'] = ports.held() ? 1 : 0;
    for (let i = 0; i < BODY_COUNT; i++) { const a = bodies[i]?.actor; if (a && holders.has(a) && (!a.alive || a.attackPhase < 0)) holders.delete(a); }
    if (think) for (let i = 0; i < BODY_COUNT; i++) { const body = bodies[i]; if (body?.actor?.alive === true) body.brain?.decide(THINK_DT); }
    for (let i = 0; i < BODY_COUNT; i++) { const body = bodies[i]; if (body === undefined) continue; const a = body.actor; if (a && a.alive && !a.stunned) body.brain?.move(dt); }
    for (let i = 0; i < HOME_COUNT; i++) {
      const home = homes[i];
      if (home === undefined || home.wait <= 0) continue;
      home.wait -= dt;
      if (home.wait > 0) continue;
      freeBody(home);
      respawn(home);
    }
  }, {
    snapshot: () => ({ version: 1, rng: { ...rng.snapshot() }, tokens: bodies.flatMap(b => b.actor !== null && holders.has(b.actor) ? [b.id] : []),
      homes: homes.map(h => ({ id: h.id, wait: h.wait, live: h.actor !== null, policy: h.brain === null ? null : JSON.stringify(h.brain.snapshot()) })),
      boss: boss === null ? null : { id: boss.id, live: boss.actor !== null, policy: boss.brain === null ? null : JSON.stringify(boss.brain.snapshot()) } }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.homes.length !== homes.length || state.homes.some((h, i) => { const home = homes.at(i); return home === undefined || h.id !== home.id || h.live !== (home.actor !== null); })
        || (state.boss === null) !== (boss === null) || (state.boss !== null && (state.boss.id !== boss?.id || state.boss.live !== (boss.actor !== null)))) throw new Error('Incompatible Signal homes continuation');
      const tokens = state.tokens.map(id => { const a = bodies.find(b => b.id === id)?.actor ?? null; if (a === null) throw new Error('Unknown Signal token holder'); return a; });
      rng.restore(state.rng); holders.clear(); tokens.forEach(a => { holders.add(a); });
      state.homes.forEach((h, i) => { const home = homes[i]; if (home === undefined) return; home.wait = h.wait; if (h.policy !== null) home.brain?.restore(v.parse(Policy, JSON.parse(h.policy))); });
      const policy = state.boss?.policy; if (policy !== undefined && policy !== null) boss?.brain?.restore(v.parse(Policy, JSON.parse(policy)));
    },
  });
  const deferred: Body[] = [];
  let settle = (): void => undefined;
  if (saved === undefined) homes.forEach(respawn);
  else {
    const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === HOMES_STEP)?.state);
    const reinstall = (body: Body): void => {
      const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${body.id}`)?.state;
      if (typeof contract !== 'string') throw new Error(`Missing saved Signal actor ${body.id}`);
      const placed = v.parse(Placed, JSON.parse(contract));
      if (placed.id !== body.id) throw new Error(`Incompatible saved Signal actor ${body.id}`);
      materialize(body, { id: placed.id, spec: body.recipe.spec, seed: placed.seed, scale: placed.scale, at: placed.at, yaw: placed.yaw });
    };
    // The host snapshots its adapters in registration order: a body spawned while the keeper installed sits before the
    // runtime's later steps, one spawned in play after them. Reinstall each at its own point, in the saved order.
    const ids = saved.adapters.map(adapter => adapter.id), at = (id: string): number => ids.indexOf(`runtime.actor.${id}`);
    const first = ids.findIndex((id, i) => i > ids.indexOf(HOMES_STEP) && id !== HOMES_STEP && !id.startsWith('runtime.actor.'));
    const live = bodies.filter((_, i) => (i < HOME_COUNT ? keeper.homes[i]?.live : keeper.boss?.live) === true).sort((a, b) => at(a.id) - at(b.id));
    live.forEach(body => { if (first === -1 || at(body.id) < first) reinstall(body); else deferred.push(body); });
    settle = () => { deferred.forEach(reinstall); deferred.length = 0; };
  }
  return { settle, homes: () => homes.map(h => ({ id: h.id, actor: h.actor, wait: h.wait })),
    boss: boss === null ? null : { draw: () => drawBody(boss), free: () => { freeBody(boss); }, actor: () => boss.actor } };
}
