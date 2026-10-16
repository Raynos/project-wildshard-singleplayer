import * as v from 'valibot';
import { Rng, type RngState } from '@wildshard/engine/core/rng';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { killBelowWorld } from '@wildshard/engine/entities/killHeight';
import type { SimBodyBands, SimHost, SimSpawn, SimValue } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { castRay } from '@wildshard/engine/physics/query';

/**
 * A creature's floor in a renderer-free host (the creature manager's `creatureFloor`; Pine Hollow, Sky Reach): the first
 * WORLD hit under `fromY` at (x, z), else `terrainAt` (also when the hit is the ground's heightfield), and whether it
 * stands on a structure.
 */
export function creatureFloor(host: Pick<SimHost, 'physics'>, terrainAt: (x: number, z: number) => number, heightfield: 'ground' | 'any' = 'ground'): (x: number, z: number, fromY: number) => { y: number; structure: boolean } {
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const;
  return (x, z, fromY) => {
    const terrain = terrainAt(x, z);
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - terrain + 1), sees);
    if (hit === null || ((heightfield === 'any' || hit.material === 'ground') && hit.collider.shape.type === host.physics.R.ShapeType.HeightField)) return { y: terrain, structure: false };
    return { y: hit.point.y, structure: true };
  };
}

/** Reinstall trusted actors at their original adapter boundaries, then settle deferred play-time spawns. */
export function orderedNativeReinstall<B extends { readonly id: string }>(saved: Pick<SimSnapshot, 'adapters'>, step: string, live: readonly B[],
  reinstall: (body: B) => void, installStep?: () => void): () => void {
  const ids = saved.adapters.map(adapter => adapter.id), boundary = ids.indexOf(step);
  if (boundary === -1 || live.length > 1024) throw new Error('Incompatible native roster boundary');
  const at = (body: B): number => ids.indexOf(`runtime.actor.${body.id}`);
  if (live.some(body => at(body) === -1)) throw new Error('Missing native roster actor');
  const ordered = [...live].sort((a, b) => at(a) - at(b));
  const first = ids.findIndex((id, i) => i > boundary && !id.startsWith('runtime.actor.'));
  const deferred: B[] = [];
  if (installStep !== undefined) { ordered.forEach(body => { if (at(body) < boundary) reinstall(body); }); installStep(); }
  ordered.forEach(body => { if (installStep !== undefined && at(body) < boundary) return; if (first === -1 || at(body) < first) reinstall(body); else deferred.push(body); });
  return () => { deferred.forEach(reinstall); deferred.length = 0; };
}

/** A declared home the keeper refills (`runtime.spawns.homes`): `respawn` seconds after its body falls, a fresh one (0: never
 *  refilled, the fallen body stays). A `late` home spawns on the keeper's first step instead of at install, after every
 *  install-time registration (a body that lands once the world it stands on is in place). */
export interface KeptHomeRow { readonly id: string; readonly kind: string; readonly at: readonly [number, number]; readonly yaw: number; readonly respawn: number; readonly late?: boolean }
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
  /** Decisions run on ticks where `tick % every === 1`, each with `dt` seconds (the browser's 'legacy' band: 6, 0.1). With
   *  `bands`, the keeper opts the host into the page's body bands (`SimHost.useBodyBands`) at install instead: every body
   *  with an actor takes its decision step from its band clock (`brainDt`, taken alive or not; a live body decides when it
   *  is due) and moves on its body clock (`bodyDt`, when non-zero). */
  readonly think: { readonly every: number; readonly dt: number } | { readonly bands: SimBodyBands };
  /** The shipping policy for one fresh body; `claim` asks for one of the keeper's attack tokens, `stream` is the creature
   *  stream itself (a policy whose own draws share it, after the spawns'). */
  readonly policy: (kind: string, actor: AnimalSim, claim: (actor: AnimalSim) => boolean, stream: Rng) => KeptPolicy;
  /** A declared death plane: first on every tick, a live body under it dies by the fall pipeline (`killBelowWorld`). */
  readonly killY?: number;
  /** Where a drawn body stands, asked after its six draws instead of the host's ground at install: the floor under its
   *  home and whether that floor is a structure (the body's `levelGround`); a flyer still flies its altitude over it. */
  readonly place?: (id: string) => { readonly y: number; readonly structure: boolean };
  /** Runs on every body the keeper materializes, fresh or restored, before its policy is built (a body's own ground law). */
  readonly adopt?: (actor: AnimalSim) => void;
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
interface Home extends Body { readonly respawn: number; readonly late: boolean; wait: number }

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
    const ground = spec.place === undefined ? host.groundHeightAt(at[0], at[1]) : 0, y = native.flight === undefined ? ground : native.flight.altitude + (native.flight.above === 'world' ? 0 : ground);
    return { range, recipe: { id, spec: native, seed: 0, scale: 1, at: { x: at[0], y, z: at[1] }, yaw } };
  };
  const homes: Home[] = spec.homes.map(row => { const made = recipe(row.id, row.kind, row.at, row.yaw);
    return { id: row.id, kind: row.kind, respawn: row.respawn, late: row.late === true, wait: 0, actor: null, brain: null, recipe: made.recipe, range: made.range }; });
  const row = spec.boss, made = row === undefined ? null : recipe(row.id, row.kind, row.at, row.yaw);
  const boss: Body | null = row === undefined || made === null ? null : { id: row.id, kind: row.kind, actor: null, brain: null, recipe: made.recipe, range: made.range };
  const bodies: readonly Body[] = boss === null ? homes : [...homes, boss];
  const homeCount = homes.length, bodyCount = bodies.length, think = spec.think, banded = 'bands' in think;
  const every = 'bands' in think ? 0 : think.every, thinkDt = 'bands' in think ? 0 : think.dt, world = spec.killY === undefined ? undefined : { killY: spec.killY };
  if ('bands' in think) host.useBodyBands(think.bands);
  const materialize = (body: Body, next: SimSpawn): AnimalSim => {
    const a = host.spawn(next); spec.adopt?.(a); body.actor = a; body.brain = spec.policy(body.kind, a, claim, rng); return a;
  };
  /** The creature manager's six draws, into the body's own recipe (the host copies it at spawn), then its placement. */
  const drawBody = (body: Body): AnimalSim => {
    body.recipe.scale = rng.range(body.range[0], body.range[1]); rng.next(); body.recipe.seed = rng.next(); rng.next(); rng.next(); rng.next();
    const floor = spec.place?.(body.id), flight = body.recipe.spec.flight;
    if (floor !== undefined) body.recipe.at.y = flight === undefined ? floor.y : flight.altitude + (flight.above === 'world' ? 0 : floor.y);
    const a = materialize(body, body.recipe); if (floor !== undefined) a.levelGround = floor.structure; return a;
  };
  let lateDue = homes.some(home => home.late);
  const freeBody = (body: Body): void => { if (body.actor) { holders.delete(body.actor); host.retire(body.id); body.actor = null; body.brain = null; } };
  const respawn = (home: Home): void => { home.wait = 0; drawBody(home); };
  host.events.on('actor.died', ({ actor }) => { const home = homes.find(h => h.actor?.combatActor() === actor); if (home) home.wait = home.respawn; }, host.scope);
  host.onStep(step, dt => {
    if (world !== undefined) for (let i = 0; i < bodyCount; i++) { const a = bodies[i]?.actor; if (a?.alive === true) killBelowWorld(a, world, host.combat); }
    spec.beforeStep?.(homes);
    if (lateDue) { lateDue = false; for (let i = 0; i < homeCount; i++) { const home = homes[i]; if (home?.late === true) respawn(home); } }
    for (let i = 0; i < bodyCount; i++) { const a = bodies[i]?.actor; if (a && holders.has(a) && (!a.alive || a.attackPhase < 0)) holders.delete(a); }
    if (banded) for (let i = 0; i < bodyCount; i++) {
      const body = bodies[i], a = body?.actor; if (body === undefined || a === null || a === undefined) continue;
      const due = host.brainDt(body.id); if (due > 0 && a.alive) body.brain?.decide(due);
    }
    else if (host.state.tick % every === 1) for (let i = 0; i < bodyCount; i++) { const body = bodies[i]; if (body?.actor?.alive === true) body.brain?.decide(thinkDt); }
    for (let i = 0; i < bodyCount; i++) {
      const body = bodies[i], a = body?.actor; if (body === undefined || a === null || a === undefined) continue;
      const moved = banded ? host.bodyDt(body.id) : dt; if (moved > 0 && a.alive && !a.stunned) body.brain?.move(moved);
    }
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
  let settle = (): void => undefined;
  if (saved === undefined) homes.forEach(home => { if (!home.late) respawn(home); });
  else {
    const keeper = v.parse(Saved, saved.adapters.find(adapter => adapter.id === step)?.state);
    // the late homes are due until they have landed (a landed body is held, alive or fallen, until a refill replaces it)
    lateDue = homes.some((home, i) => home.late && keeper.homes[i]?.live !== true);
    const reinstall = (body: Body): void => {
      const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${body.id}`)?.state;
      if (typeof contract !== 'string') throw new Error(`Missing saved actor ${body.id} (${step})`);
      const placed = v.parse(Placed, JSON.parse(contract));
      if (placed.id !== body.id) throw new Error(`Incompatible saved actor ${body.id} (${step})`);
      materialize(body, { id: placed.id, spec: body.recipe.spec, seed: placed.seed, scale: placed.scale, at: placed.at, yaw: placed.yaw });
    };
    // The host snapshots its adapters in registration order: a body spawned while the keeper installed sits before the
    // runtime's later steps, one spawned in play after them. Reinstall each at its own point, in the saved order.
    const live = bodies.filter((_, i) => (i < homeCount ? keeper.homes[i]?.live : keeper.boss?.live) === true);
    settle = orderedNativeReinstall(saved, step, live, reinstall);
  }
  return { settle, homes: () => homes,
    boss: boss === null ? null : { draw: () => drawBody(boss), free: () => { freeBody(boss); }, actor: () => boss.actor } };
}

/** Mutable identity/recipe slot owned by a native roster; a retired slot keeps its recipe with no live actor. */
export interface NativeCreatureSlot<A extends AnimalSim = AnimalSim> {
  id: string; kind: string; variant: string; herd: number; readonly recipe: SimSpawn;
  range: readonly [number, number]; actor: A | null;
}

/** Baked native creature intake. Callers retain pose/policy, herd ownership, ecology and their save envelope.
 * Spawn draws use the supplied stream in scale/rig-seed/body-seed/memory order; reinstall never draws.
 * The registry owns kind/variant admission and structure-aware placement, not a shard's decision schedule. */
export function createNativeCreatureRoster<B extends NativeCreatureSlot>(host: SimHost, ports: {
  readonly specs: Iterable<AnimalSimSpec>;
  readonly variants: ReadonlyMap<string, readonly { readonly id: string; readonly scale: readonly [number, number] }[]>;
  readonly rng: Rng; readonly spawnY: number; readonly attackTurnCap: number;
  readonly heightfield?: 'ground' | 'any';
  /** Optional existing herd owner; joining/retiring updates the same member arrays. */
  readonly herds?: { readonly herds: readonly { readonly members: NonNullable<B['actor']>[] }[]; addHerd: (kind: string, x: number, z: number) => number };
  readonly retired?: (body: B) => void;
  readonly preflight?: (body: B) => void;
  readonly attach: (native: AnimalSim, body: B) => NonNullable<B['actor']>;
  readonly joined: (body: B, actor: NonNullable<B['actor']>) => void;
  readonly ground?: (body: B, x: number, z: number, fromY: number) => number | undefined;
}): {
  body: (id: string, kind: string, variant: string, herd: number, at: { x: number; z: number }, yaw: number,
    range?: readonly [number, number], authored?: { seed: number; scale: number }) => {
      id: string; kind: string; variant: string; herd: number; range: readonly [number, number]; actor: null; recipe: SimSpawn };
  spec: (kind: string, variant: string) => AnimalSimSpec;
  byId: Map<string, B>;
  floor: (x: number, z: number, fromY: number) => number;
  materialize: (body: B, recipe: SimSpawn, structure: boolean) => void;
  arrive: (body: B) => void;
  draw: (body: B, consumeMemory?: boolean) => void;
  /** Retire an owned live identity and detach its herd membership before caller cleanup. Never draws. */
  retire: (body: B) => void;
  /** Retire a pending predecessor only when its owned actor is still present and dead. */
  retireDead: (id: string | undefined) => void;
  /** Refill the same recipe slot: retire, allocate, replace its herd, draw, then arrive. */
  refill: (body: B, allocate: () => string, home: { readonly x: number; readonly z: number }) => void;
  /** Replay authored memory-adoption checkpoints, then continue at the declared stream. Preflight is effect-free. */
  adopt: (rows: readonly { readonly id: string; readonly x: number; readonly z: number; readonly seed?: number; readonly stream: Readonly<RngState> }[],
    stream: Readonly<RngState>, adopt: (actor: NonNullable<B['actor']>, x: number, z: number) => void) => void;
  retarget: (body: (B & { herd: number }) | undefined, kind: string, variant: string | undefined, herd: number,
    x: number, z: number, allocate: () => { id: string; yaw: number }) => B & { herd: number };
  bindBodyStep: (callbacks: { before: (body: B, actor: NonNullable<B['actor']>, dt: number) => void;
    after: (body: B, actor: NonNullable<B['actor']>, dt: number) => void }) => void;
  reinstall: (body: B, saved: Readonly<SimSnapshot>) => void;
} {
  const recipes = new Map<string, Map<string, AnimalSimSpec>>(), byId = new Map<string, B>();
  for (const known of ports.specs) {
    let group = recipes.get(known.kind);
    if (group === undefined) { group = new Map(); recipes.set(known.kind, group); }
    group.set(known.variant, known);
  }
  const sample = creatureFloor(host, (x, z) => host.groundHeightAt(x, z), ports.heightfield);
  const floor = (x: number, z: number, fromY: number): number => sample(x, z, fromY).y;
  const spec = (kind: string, variant: string): AnimalSimSpec => {
    const known = recipes.get(kind)?.get(variant);
    if (known === undefined) throw new Error(`Missing native creature recipe: ${kind}.${variant}`);
    return known;
  };
  const body = (id: string, kind: string, variant: string, herd: number, at: { x: number; z: number }, yaw: number,
    range?: readonly [number, number], authored?: { seed: number; scale: number }) => {
    const scale = range ?? ports.variants.get(kind)?.find(row => row.id === variant)?.scale;
    if (scale === undefined) throw new Error(`Missing native creature scale: ${kind}.${variant}`);
    return { id, kind, variant, herd, range: scale, actor: null,
      recipe: { id, spec: spec(kind, variant), seed: authored?.seed ?? 0, scale: authored?.scale ?? 1, at: { x: at.x, y: 0, z: at.z }, yaw } };
  };
  const materialize = (item: B, recipe: SimSpawn, structure: boolean): void => {
    ports.preflight?.(item);
    const actor = ports.attach(host.spawn(recipe), item);
    actor.levelGround = structure;
    if (structure) actor.groundHeight = (x, z, fromY) => ports.ground?.(item, x, z, fromY) ?? floor(x, z, fromY);
    actor.attackTurnCap = ports.attackTurnCap;
    item.actor = actor; byId.set(item.id, item); ports.herds?.herds[item.herd]?.members.push(actor); ports.joined(item, actor);
  };
  const arrive = (item: B): void => {
    const at = item.recipe.at, found = sample(at.x, at.z, Math.max(ports.spawnY, host.groundHeightAt(at.x, at.z)) + 1);
    at.y = found.y; materialize(item, item.recipe, found.structure);
  };
  const draw = (item: B, consumeMemory = true): void => {
    item.recipe.scale = ports.rng.range(item.range[0], item.range[1]); ports.rng.next(); item.recipe.seed = ports.rng.next();
    if (consumeMemory) { ports.rng.next(); ports.rng.next(); ports.rng.next(); }
  };
  const release = (item: B, detach: boolean): void => {
    const actor = item.actor, members = ports.herds?.herds[item.herd]?.members;
    if (actor === null || byId.get(item.id) !== item || (members !== undefined && members.length > 1024)) throw new Error('Foreign native roster retirement');
    const at = detach ? members?.indexOf(actor) ?? -1 : -1; if (at >= 0) members?.splice(at, 1);
    byId.delete(item.id); host.retire(item.id); ports.retired?.(item); item.actor = null;
  };
  const retire = (item: B): void => { release(item, true); };
  const retireDead = (id: string | undefined): void => {
    const item = id === undefined ? undefined : byId.get(id);
    if (item?.actor !== null && item?.actor !== undefined && !item.actor.alive) retire(item);
  };
  const refill = (item: B, allocate: () => string, home: { readonly x: number; readonly z: number }): void => {
    const herds = ports.herds;
    if (herds === undefined || !Number.isFinite(home.x) || !Number.isFinite(home.z) || (herds.herds[item.herd]?.members.length ?? 0) > 1) throw new Error('Invalid native roster replacement');
    ports.preflight?.(item); release(item, false);
    const id = allocate();
    if (id.length === 0 || id.length > 128 || byId.has(id)) throw new Error('Invalid native replacement identity');
    item.id = id; item.recipe.id = id;
    const old = herds.herds[item.herd]; if (old !== undefined) old.members.length = 0;
    item.herd = herds.addHerd(item.kind, home.x, home.z);
    draw(item); arrive(item);
  };
  const adopt = (rows: readonly { readonly id: string; readonly x: number; readonly z: number; readonly seed?: number; readonly stream: Readonly<RngState> }[],
    stream: Readonly<RngState>, remember: (actor: NonNullable<B['actor']>, x: number, z: number) => void): void => {
    const check = new Rng(0), initial = ports.rng.snapshot(), ids = new Set<string>();
    const validate = (state: Readonly<RngState>): void => {
      check.restore(state);
      if (state.initial !== initial.initial || state.scrambledFork !== initial.scrambledFork) throw new Error('Foreign native adoption stream');
    };
    if (rows.length > 1024) throw new Error('Native adoption roster exceeds its bound');
    validate(stream);
    const ready = rows.map(row => {
      const item = byId.get(row.id), actor = item?.actor;
      if (row.id.length === 0 || row.id.length > 128 || ids.has(row.id) || actor === null || actor === undefined
        || !Number.isFinite(row.x) || !Number.isFinite(row.z) || (row.seed !== undefined && row.seed !== item?.recipe.seed)) throw new Error('Invalid native adoption row');
      ids.add(row.id); validate(row.stream); return { row, actor };
    });
    for (const { row, actor } of ready) { ports.rng.restore(row.stream); remember(actor, row.x, row.z); }
    ports.rng.restore(stream);
  };
  const retarget = (item: (B & { herd: number }) | undefined, kind: string, variant: string | undefined, herd: number,
    x: number, z: number, allocate: () => { id: string; yaw: number }): B & { herd: number } => {
    if (variant === undefined) throw new Error('Missing native creature variant');
    if (item === undefined) throw new Error('Missing native creature recipe slot');
    const range = ports.variants.get(kind)?.find(row => row.id === variant)?.scale, native = spec(kind, variant);
    if (range === undefined) throw new Error(`Missing native creature scale: ${kind}.${variant}`);
    const { id, yaw } = allocate();
    item.id = id; item.kind = kind; item.variant = variant; item.herd = herd; item.range = range;
    item.recipe.id = id; item.recipe.spec = native; item.recipe.at.x = x; item.recipe.at.z = z; item.recipe.yaw = yaw;
    return item;
  };
  const bindBodyStep = (callbacks: {
    before: (body: B, actor: NonNullable<B['actor']>, dt: number) => void;
    after: (body: B, actor: NonNullable<B['actor']>, dt: number) => void;
  }): void => { host.useBodyStep({
    before: (id, actor, dt) => { const item = byId.get(id); if (item?.actor === actor) callbacks.before(item, item.actor, dt); },
    after: (id, actor, dt) => { const item = byId.get(id); if (item?.actor === actor) callbacks.after(item, item.actor, dt); },
  }); };
  const reinstall = (item: B, saved: Readonly<SimSnapshot>): void => {
    const contract = saved.adapters.find(adapter => adapter.id === `runtime.actor.${item.id}`)?.state;
    if (typeof contract !== 'string') throw new Error(`Missing saved native creature ${item.id}`);
    const recipe = v.parse(Placed, JSON.parse(contract));
    if (recipe.id !== item.id) throw new Error(`Incompatible saved native creature ${item.id}`);
    item.recipe.yaw = recipe.yaw; item.recipe.seed = recipe.seed; item.recipe.scale = recipe.scale;
    Object.assign(item.recipe.at, recipe.at);
    const found = sample(recipe.at.x, recipe.at.z, recipe.at.y + 1);
    const level = saved.entities.find(entity => entity.id === item.id)?.state.flags.levelGround;
    materialize(item, item.recipe, level ?? found.structure);
  };
  return { body, spec, byId, floor, materialize, arrive, draw, retire, retireDead, refill, adopt, retarget, bindBodyStep, reinstall };
}
