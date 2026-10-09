import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimSpawn, SimValue } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';

/** A declared home the keeper refills (`runtime.spawns.homes`): `respawn` seconds after its body falls, a fresh one. */
export interface KeptHomeRow { readonly id: string; readonly kind: string; readonly at: readonly [number, number]; readonly yaw: number; readonly respawn: number }
/** A declared boss row (`runtime.spawns.bosses`): one more body of the same keeper, never refilled; its encounter draws and frees it. */
export interface KeptBossRow { readonly id: string; readonly kind: string; readonly at: readonly [number, number]; readonly yaw: number }
/** One live body's policy, built at its spawn: decisions on the keeper's cadence, movement every tick, its own continuation. */
export interface KeptPolicy { decide: (dt: number) => void; move: (dt: number) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }
/** A home as the keeper lends it to `beforeStep` and `homes()`: its declared id and kind, its live body and refill clock. */
export interface KeptHome { readonly id: string; readonly kind: string; readonly actor: AnimalSim | null; readonly wait: number }
/** The encounter's handle on the boss body: `draw` spawns it with the stream's six draws, `free` retires its id and token. */
export interface KeptBossBody { draw: () => AnimalSim; free: () => void; readonly actor: () => AnimalSim | null }
/** What a home keeper is given: its rows, its native recipes, its stream seed, its cadence and its policies. */
export interface HomeKeeperSpec {
  /** The keeper's fixed-step id; its continuation also names the live roster to reinstall before the host restores. */
  readonly step: string;
  /** The level seed: the creature stream is `Rng(seed + 31)`, the creature manager's own (six draws per spawn). */
  readonly seed: number;
  readonly homes: readonly KeptHomeRow[];
  /** At most one boss body joins the same manager (stream, tokens, cadence) after the homes. */
  readonly boss?: KeptBossRow;
  /** Each kind's baked native spec: every body of a kind shares one recipe. */
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** Each kind's scale range (its species' first variant): the stream's first draw picks the body's scale in it. */
  readonly scales: ReadonlyMap<string, readonly [number, number]>;
  /** `fight.attackers` from the manifest (E297): at most this many bodies hold an attack token at once. */
  readonly attackers: number;
  /** Decisions run on ticks where `tick % every === 1`, each with `dt` seconds (the browser's 'legacy' band: 6, 0.1). */
  readonly think: { readonly every: number; readonly dt: number };
  /** The shipping policy for one fresh body; `claim` asks for one of the keeper's attack tokens. */
  readonly policy: (kind: string, actor: AnimalSim, claim: (actor: AnimalSim) => boolean) => KeptPolicy;
  /** Runs first on every tick, before the token sweep: a gate the homes read (a held flag in a body's memory). */
  readonly beforeStep?: (homes: readonly KeptHome[]) => void;
}

const finite = v.pipe(v.number(), v.finite());
const Value: v.GenericSchema<SimValue> = v.lazy(() => v.union([v.null(), v.boolean(), finite, v.string(), v.array(Value), v.record(v.string(), Value)]));
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
/** A saved trusted recipe's placement; the spec is this build's bake, so a changed spec refuses at the host's restore. */
const Placed = v.object({ id: v.string(), seed: finite, scale: finite, at: v.strictObject({ x: finite, y: finite, z: finite }), yaw: finite });
const Saved = v.strictObject({ version: v.literal(1), rng: Stream, tokens: v.array(v.string()),
  homes: v.array(v.strictObject({ id: v.string(), wait: finite, live: v.boolean(), policy: v.nullable(v.string()) })),
  boss: v.nullable(v.strictObject({ id: v.string(), live: v.boolean(), policy: v.nullable(v.string()) })) });

interface Body { readonly id: string; readonly kind: string; readonly recipe: SimSpawn; readonly range: readonly [number, number]; actor: AnimalSim | null; brain: KeptPolicy | null }
interface Home extends Body { readonly respawn: number; wait: number }

/**
 * Declared creature homes in a renderer-free host (SHARD-PLATFORM SF72): the platform's spawn, death and respawn rules
 * (as `bindRuntimeHomes` keeps them in the browser), the creature manager's own random stream `Rng(seed + 31)` (six
 * draws per spawn: scale, rig seed, actor seed, timer, fleeUntil, callT), its attack tokens (swept once a holder is dead
 * or its attack is over), and each body's shipping policy on a fixed decision cadence with movement every tick. Bodies
 * are trusted dynamic actors (`host.spawn`) standing on the host's ground (a flyer at its flight altitude). An optional
 * boss body is one more animal of the same manager after the homes: its encounter spawns it (six draws from the same
 * stream) and frees it, its policy shares the tokens and cadence, and nothing refills it.
 *
 * Restore reinstalls exactly the saved roster from its recipes before the host restores, with no stream draw: a body
 * spawned while the keeper installed comes back at once, one spawned in play after the runtime's later steps, when the
 * runtime calls `settle` once those are registered (the host snapshots its adapters in registration order).
 */
export function installHomeKeeper(host: SimHost, spec: HomeKeeperSpec, saved?: Readonly<SimSnapshot>): {
  settle: () => void; homes: () => readonly KeptHome[]; boss: KeptBossBody | null;
} {
  const rng = new Rng(spec.seed + 31), holders = new Set<AnimalSim>(), { step } = spec;
  const claim = (a: AnimalSim): boolean => { if (holders.has(a)) return true; if (holders.size >= spec.attackers) return false; holders.add(a); return true; };
  const recipe = (id: string, kind: string, at: readonly [number, number], yaw: number): { recipe: SimSpawn; range: readonly [number, number] } => {
    const native = spec.specs.get(kind), range = spec.scales.get(kind);
    if (native === undefined || range === undefined) throw new Error(`Missing native recipe ${kind} (${step})`);
    const ground = host.groundHeightAt(at[0], at[1]), y = native.flight === undefined ? ground : native.flight.altitude + (native.flight.above === 'world' ? 0 : ground);
    return { range, recipe: { id, spec: native, seed: 0, scale: 1, at: { x: at[0], y, z: at[1] }, yaw } };
  };
  const homes: Home[] = spec.homes.map(row => { const made = recipe(row.id, row.kind, row.at, row.yaw);
    return { id: row.id, kind: row.kind, respawn: row.respawn, wait: 0, actor: null, brain: null, recipe: made.recipe, range: made.range }; });
  const row = spec.boss, made = row === undefined ? null : recipe(row.id, row.kind, row.at, row.yaw);
  const boss: Body | null = row === undefined || made === null ? null : { id: row.id, kind: row.kind, actor: null, brain: null, recipe: made.recipe, range: made.range };
  const bodies: readonly Body[] = boss === null ? homes : [...homes, boss];
  const homeCount = homes.length, bodyCount = bodies.length, every = spec.think.every, thinkDt = spec.think.dt;
  const materialize = (body: Body, next: SimSpawn): AnimalSim => { const a = host.spawn(next); body.actor = a; body.brain = spec.policy(body.kind, a, claim); return a; };
  /** The creature manager's six draws, into the body's own recipe (the host copies it at spawn). */
  const drawBody = (body: Body): AnimalSim => {
    body.recipe.scale = rng.range(body.range[0], body.range[1]); rng.next(); body.recipe.seed = rng.next(); rng.next(); rng.next(); rng.next();
    return materialize(body, body.recipe);
  };
  const freeBody = (body: Body): void => { if (body.actor) { holders.delete(body.actor); host.retire(body.id); body.actor = null; body.brain = null; } };
  const respawn = (home: Home): void => { home.wait = 0; drawBody(home); };
  host.events.on('actor.died', ({ actor }) => { const home = homes.find(h => h.actor?.combatActor() === actor); if (home) home.wait = home.respawn; }, host.scope);
  host.onStep(step, dt => {
    spec.beforeStep?.(homes);
    for (let i = 0; i < bodyCount; i++) { const a = bodies[i]?.actor; if (a && holders.has(a) && (!a.alive || a.attackPhase < 0)) holders.delete(a); }
    if (host.state.tick % every === 1) for (let i = 0; i < bodyCount; i++) { const body = bodies[i]; if (body?.actor?.alive === true) body.brain?.decide(thinkDt); }
    for (let i = 0; i < bodyCount; i++) { const body = bodies[i]; if (body === undefined) continue; const a = body.actor; if (a && a.alive && !a.stunned) body.brain?.move(dt); }
    for (let i = 0; i < homeCount; i++) {
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
        || (state.boss === null) !== (boss === null) || (state.boss !== null && (state.boss.id !== boss?.id || state.boss.live !== (boss.actor !== null)))) throw new Error(`Incompatible ${step} continuation`);
      const tokens = state.tokens.map(id => { const a = bodies.find(b => b.id === id)?.actor ?? null; if (a === null) throw new Error(`Unknown ${step} token holder`); return a; });
      rng.restore(state.rng); holders.clear(); tokens.forEach(a => { holders.add(a); });
      state.homes.forEach((h, i) => { const home = homes[i]; if (home === undefined) return; home.wait = h.wait; if (h.policy !== null) home.brain?.restore(v.parse(Value, JSON.parse(h.policy))); });
      const policy = state.boss?.policy; if (policy !== undefined && policy !== null) boss?.brain?.restore(v.parse(Value, JSON.parse(policy)));
    },
  });
  const deferred: Body[] = [];
  let settle = (): void => undefined;
  if (saved === undefined) homes.forEach(respawn);
  else {
    const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === step)?.state);
    const reinstall = (body: Body): void => {
      const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${body.id}`)?.state;
      if (typeof contract !== 'string') throw new Error(`Missing saved actor ${body.id} (${step})`);
      const placed = v.parse(Placed, JSON.parse(contract));
      if (placed.id !== body.id) throw new Error(`Incompatible saved actor ${body.id} (${step})`);
      materialize(body, { id: placed.id, spec: body.recipe.spec, seed: placed.seed, scale: placed.scale, at: placed.at, yaw: placed.yaw });
    };
    // The host snapshots its adapters in registration order: a body spawned while the keeper installed sits before the
    // runtime's later steps, one spawned in play after them. Reinstall each at its own point, in the saved order.
    const ids = saved.adapters.map(adapter => adapter.id), at = (id: string): number => ids.indexOf(`runtime.actor.${id}`);
    const first = ids.findIndex((id, i) => i > ids.indexOf(step) && id !== step && !id.startsWith('runtime.actor.'));
    const live = bodies.filter((_, i) => (i < homeCount ? keeper.homes[i]?.live : keeper.boss?.live) === true).sort((a, b) => at(a.id) - at(b.id));
    live.forEach(body => { if (first === -1 || at(body.id) < first) reinstall(body); else deferred.push(body); });
    settle = () => { deferred.forEach(reinstall); deferred.length = 0; };
  }
  return { settle, homes: () => homes,
    boss: boss === null ? null : { draw: () => drawBody(boss), free: () => { freeBody(boss); }, actor: () => boss.actor } };
}
