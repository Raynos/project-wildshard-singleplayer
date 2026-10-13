import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { castRay, floorBelow, lineOfSight } from '@wildshard/engine/physics/query';
import { MathUtils, Vector3 } from 'three';
import { ZiplineModeSchema, type ZiplineMode, UpdraftModeSchema, type UpdraftMode, GrappleModeSchema, type GrappleMode } from '@wildshard/format/modes';
import { tagOf } from "@wildshard/engine/physics/surface";
import { CharacterMotor, type MotorOptions } from "@wildshard/engine/physics/CharacterMotor";
import type { Physics } from "@wildshard/engine/physics/Physics";
import { ENTRY_ASPHALT, ENTRY_WIDTH } from "@wildshard/engine/core/config";
import * as v from "valibot";
import { SCRIPT_PARAMETER_QUERY, ScriptHost, type ScriptQuery } from "@wildshard/engine/script/host";
import { ScriptWorld } from "@wildshard/engine/script/effects";
import { scriptPhysicsQueries } from "@wildshard/engine/script/queries";
import type { World } from "@wildshard/engine/core/bootstrap";
import type { SimHost } from "@wildshard/engine/sim";
import type { LevelContext } from "@wildshard/engine/level/context";
import { createShardfileComposedLane, type DeclaredScriptBrainPorts } from "../shardfile/scriptComposition";
import type { ShardScriptContent, ShardScriptPorts } from "../shardfile/scripts";
import type { ScriptRole, ScriptSchedule } from "@wildshard/engine/script/composition";
import type { Scope } from "@wildshard/engine/app/scope";
import { KinematicMover, type MoverPose } from "@wildshard/engine/physics/mover";
import { RopeChain } from "@wildshard/engine/physics/ropeChain";
import { MOVER_FIELDS, MOVER_FIELD_RANGES, moverScriptEntities } from "../shardfile/movers";
import { parseMovers, type MoverData } from "@wildshard/format/movers";

/** One declared entryway as the shardfile states it (a midpoint opening on an edge). */
export interface TerrainEntryway { readonly edge: 'north' | 'east' | 'south' | 'west'; readonly kind?: string | undefined }
/** The walk: lanes per opening, metres walked in, where on the axis the feet start, and the step budget per lane. */
export interface TerrainEntryWalk { readonly lanes: number; readonly walk: number; readonly start: number; readonly maxTicks: number }
/** The player's capsule (the engine's edge walk's). */
const CAPSULE = { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] } as const;

/**
 * An entry proof on a shard's native terrain (SF27): a real player capsule walks `walk` m in from each of the four
 * declared ground entryways, `lanes` lanes across the opening, through the host's own collision world. The engine's edge
 * walk holds every step at y = 0, which only a flat shard meets; here the first `ENTRY_ASPHALT` m (the socket) must be
 * flat at y = 0, and past it the feet follow the admitted heights within 0.15 m on ground no steeper than the capsule
 * climbs. A stall, a fall, a drift out of the lane or an unwalkable slope refuses the proof.
 */
export function proveTerrainEntries(physics: Physics, entryways: readonly TerrainEntryway[], heightAt: (x: number, z: number) => number, spec: TerrainEntryWalk): { lanes: number; steps: number } {
  if (entryways.length !== 4 || entryways.some(entry => (entry.kind ?? 'ground') !== 'ground')) throw new Error('The terrain entry proof needs four ground entryways');
  const motor = new CharacterMotor(physics, CAPSULE), half = ENTRY_WIDTH / 2 - CAPSULE.radius, slope = Math.cos(Math.PI / 4);
  let lanes = 0, steps = 0;
  try {
    for (const edge of ['north', 'east', 'south', 'west'] as const) for (let lane = 0; lane < spec.lanes; lane++) {
      if (!entryways.some(entry => entry.edge === edge)) throw new Error(`Missing the ${edge} entryway`);
      const offset = -half + lane * (2 * half) / (spec.lanes - 1), along = edge === 'north' || edge === 'east' ? spec.start : -spec.start, sign = edge === 'north' || edge === 'east' ? -1 : 1;
      const ns = edge === 'north' || edge === 'south';
      const feet = { x: ns ? offset : along, y: 0.03, z: ns ? along : offset };
      const delta = { x: ns ? 0 : sign * 0.1, y: -9.81 / 3600, z: ns ? sign * 0.1 : 0 };
      let travelled = 0, stalled = 0;
      for (let tick = 0; tick < spec.maxTicks; tick++) {
        if (travelled >= spec.walk) break;
        const before = ns ? feet.z : feet.x;
        const result = motor.move(feet, delta); steps++;
        const advance = sign * ((ns ? feet.z : feet.x) - before);
        travelled += advance; stalled = advance < 0.05 ? stalled + 1 : 0;
        const ground = heightAt(feet.x, feet.z), socket = travelled < ENTRY_ASPHALT - (250 - spec.start);
        if (stalled >= 5 || !result.grounded || Math.abs((ns ? feet.x : feet.z) - offset) > CAPSULE.radius
          || Math.abs(feet.y - ground) > 0.15 || result.groundNormalY < slope || (socket && (ground !== 0 || result.groundNormalY < 0.99))) {
          throw new Error(`Blocked entry ${edge} lane ${String(lane)} at ${travelled.toFixed(2)} m`);
        }
      }
      if (travelled < spec.walk) throw new Error(`Blocked entry ${edge} lane ${String(lane)}: ${String(spec.maxTicks)} steps reached ${travelled.toFixed(2)} m`);
      lanes++;
    }
    return { lanes, steps };
  } finally { motor.dispose(); }
}

/** Transitional standalone composition; a full session injects its existing host and merges entities/rules/queries instead. */
export async function createMoverHost(data: MoverData, assets: ReadonlyMap<string, Uint8Array>, physicsQueries: ScriptQuery): Promise<ScriptHost> {
  const checked = parseMovers(data), modules = await verifiedMoverModules(assets, checked);
  const host = new ScriptHost({ world: new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(checked)), query: moverQueries(checked, physicsQueries) });
  for (const [hash, bytes] of modules) host.install(hash, bytes);
  return host;
}

/** Verified extra author modules and trusted roles share the existing 32-entity mover host. */
export interface MoverRoleComposition { modules: ReadonlyMap<string, Uint8Array>; roles: readonly ScriptRole[]; schedules?: readonly ScriptSchedule[]; seed: number }
/** Declared constants are read only and selected by the trusted calling entity; physics queries keep their adapter. */
export function moverQueries(data: MoverData, physicsQueries: ScriptQuery): ScriptQuery {
  const parameters = new Map(parseMovers(data).map((m) => [m.entity, [...m.input]]));
  return (kind, input, entity) => {
    if (kind !== SCRIPT_PARAMETER_QUERY) return physicsQueries(kind, input, entity);
    if (input.length !== 8 || input.some((value) => value !== 0)) throw new Error('Declared parameters take no author-selected entity');
    const values = parameters.get(entity); if (values === undefined) throw new Error('Unknown declared parameter entity');
    return [...values];
  };
}

/** Transitional view recipe only; a shard may project published poses but cannot author physics or tick ownership. */
export interface MoverView { pose: (value: MoverPose, fields: Readonly<Record<number, number>>) => void; chain?: RopeChain }
/** Declared rows plus trusted legacy view callbacks; the platform owns context, world, scripts, scope and fixed systems. */
export interface MoverInstallation {
  data: MoverData; modules: ReadonlyMap<string, string>; views: ReadonlyMap<string, MoverView>; systemId: string;
  shared?: { host: ScriptHost; tick: () => number };
  /** Additional consuming item roles join this installer's single host and tick. Incompatible with an injected shared host. */
  composition?: MoverRoleComposition;
  /** A grid cell's admitted product bytes by module hash (`runtimeProduct(...).assets.retained`): a module present here is
   *  read from them (hash-checked again by {@link createMoverHost}) instead of fetched a second time from `modules`. */
  admitted?: ReadonlyMap<string, Uint8Array>;
  /** Read a declared module through its existing product reader; SHA verification and tick ownership stay here. */
  read?: (hash: string) => Promise<Uint8Array>;
  permissions?: () => ReadonlyMap<string, number>;
  onDispose?: () => void;
  activation?: MoverActivationPorts;
}
/** Trusted activation observes real grounded collider ownership and the admitted host shared state. */
export interface MoverActivationPorts {
  ground?: () => CharacterMotor['result'] | undefined;
  shared?: (field: number) => number | boolean | undefined;
}
/** The shared script host already owns modules, entity handles and one beginTick per fixed step. */
export interface MoverPorts { physics: Physics | (() => Physics); host: ScriptHost; scope: Scope; adopt?: (id: string) => MoverView | undefined; restoring?: boolean; activation?: MoverActivationPorts }
/** Native handle identity is restored before reconnecting to the replacement world. */
export interface MoverBodyState { id: string; handle: number }
const continuation = v.strictObject({ pending: v.pipe(v.array(v.tuple([v.string(), v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3))])), v.maxLength(32)),
  bodies: v.pipe(v.array(v.strictObject({ id: v.string(), handle: v.pipe(v.number(), v.finite(), v.minValue(0)) })), v.maxLength(32)) });
/** Data/script bridge to engine physics; imported code installs nothing, and presentation only reads published state. */
export class MoverRuntime {
  readonly data: MoverData;
  readonly chains = new Map<string, RopeChain>();
  private readonly sinks = new Map<string, (pose: MoverPose) => void>();
  /** the presentation-only views (adopted rows), for {@link showRest} */
  private readonly views = new Map<string, (pose: MoverPose) => void>();
  private readonly host: ScriptHost;
  /** Trusted item bindings use this already installed host's actor grants and current tick. */
  get scriptHost(): ScriptHost { return this.host; }
  private readonly physics: () => Physics;
  private readonly bodies = new Map<string, KinematicMover>();
  private bodyHandles = new Map<string, number>();
  private pending = new Map<string, number>();
  private readonly activation: MoverActivationPorts;
  constructor(data: MoverData, ports: MoverPorts) {
    this.data = parseMovers(data); this.host = ports.host; this.activation = ports.activation ?? {};
    for (const row of this.data) {
      if (row.trigger?.kind === 'stand' && this.activation.ground === undefined) throw new Error('Stand mover requires the real player ground result');
      if (row.trigger?.kind === 'shared') {
        const value = this.activation.shared?.(row.trigger.field);
        if (typeof value !== typeof row.trigger.equals || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Shared mover requires its admitted typed host field');
      }
    }
    const physics = ports.physics; this.physics = typeof physics === 'function' ? physics : () => physics;
    if (ports.restoring && (ports.adopt !== undefined || this.data.some(row => row.kind === 'chain'))) throw new Error('Native mover restore requires declared platform/static bodies');
    for (const m of this.data) if (ports.host.world.entity(m.entity) === undefined) throw new Error('Missing mover script entity');
    for (const m of this.data) {
      const adopted = ports.adopt?.(m.id);
      if (adopted !== undefined) {
        const chain = adopted.chain; let enabled = m.enabled;
        this.sinks.set(m.id, (pose) => { if (chain !== undefined && enabled !== pose.enabled) { enabled = pose.enabled; chain.setEnabled(enabled); } adopted.pose(pose, this.host.world.entity(m.entity)?.fields ?? {}); });
        this.views.set(m.id, (pose) => { adopted.pose(pose, this.host.world.entity(m.entity)?.fields ?? {}); });
        if (chain !== undefined) this.chains.set(m.id, chain); continue;
      }
      if (m.kind === 'chain') { if (m.chain === undefined) throw new Error('Missing chain'); const chain = new RopeChain(this.physics(), m.chain); this.chains.set(m.id, chain); let enabled = m.enabled; chain.setEnabled(enabled); this.sinks.set(m.id, (pose) => { if (enabled !== pose.enabled) { enabled = pose.enabled; chain.setEnabled(enabled); } }); ports.scope.onDispose(() => { chain.dispose(); }); }
      else {
        if (!ports.restoring) { const body = new KinematicMover(this.physics(), m.boxes, this.pose(m.id), m.id, m.kind === 'static'); this.bodies.set(m.id, body); this.bodyHandles.set(m.id, body.body.handle); }
        this.sinks.set(m.id, pose => { const body = this.bodies.get(m.id); if (body === undefined) throw new Error('Mover native body is not reconnected'); body.setPose(pose); });
        ports.scope.onDispose(() => { this.bodies.get(m.id)?.dispose(); });
      }
    }
  }
  /** Queue a host-validated interact command; scene dispatch resolves the stable mover id, never an arbitrary function export. */
  command(id: string, action: 1 | 2 | 3): void { if (!this.data.some((m) => m.id === id)) throw new Error('Unknown mover'); this.pending.set(id, action); }
  /** Read this mover role's ABI input without starting a tick or touching any other script role's allowance. */
  scriptInput(id: string, tick: number, permission = 0): readonly number[] {
    const m = this.data.find(row => row.id === id), e = m === undefined ? undefined : this.host.world.entity(m.entity);
    if (m === undefined || e === undefined) throw new Error('Missing mover');
    let gate = permission;
    if (m.trigger?.kind === 'stand') { const ground = this.activation.ground?.(); gate = Number(ground?.grounded === true && ground.groundCollider !== null && tagOf(ground.groundCollider)?.owner === m.id); }
    else if (m.trigger?.kind === 'shared') {
      const value = this.activation.shared?.(m.trigger.field);
      if (typeof value !== typeof m.trigger.equals || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Unavailable shared mover field');
      gate = Number(value === m.trigger.equals);
    } else if (m.trigger?.kind === 'interact') gate = Number(permission === m.trigger.permission);
    return [tick, 1 / 60, this.pending.get(m.id) ?? 0, m.entity, gate, m.input.length, ...Object.values(MOVER_FIELDS).map(field => e.fields[field] ?? 0)];
  }
  /** Apply an admitted call once; a composed scheduler already owns execution and the global host tick. */
  publish(id: string, ok: boolean): void {
    if (!this.data.some(row => row.id === id)) throw new Error('Unknown mover');
    this.pending.delete(id); if (ok) this.sinks.get(id)?.(this.pose(id));
  }
  /** Fixed.pre after beginTick, before physics; parameter data and current state are explicit ABI input. */
  step(tick: number, permissions: ReadonlyMap<string, number> = new Map()): void {
    for (const m of this.data) {
      const call = this.host.call(m.module, m.entity, this.scriptInput(m.id, tick, permissions.get(m.id) ?? 0));
      this.publish(m.id, call.ok);
    }
  }
  /** Capture chain poses after the world step, then let the existing bridge renderer interpolate them. */
  capture(): void { for (const chain of this.chains.values()) chain.capture(); }
  /** Published state; no presentation caller may mutate script memory or authoritative fields. */
  pose(id: string): MoverPose {
    const m = this.data.find((row) => row.id === id), e = m === undefined ? undefined : this.host.world.entity(m.entity); if (e === undefined) throw new Error('Unknown mover');
    return { position: { x: e.position[0], y: e.position[1], z: e.position[2] }, euler: { x: e.fields[1] ?? 0, y: e.fields[2] ?? 0, z: e.fields[3] ?? 0 }, enabled: !e.frozen && e.fields[4] === 1 };
  }
  /**
   * Draw every adopted view at its declared rest pose (the row's `at` and `euler`), presentation only: no script memory, no
   * body, no tick. The next fixed step publishes the live poses again. The map bake (scripts/bake-maps.mjs, SF66 / G252)
   * calls it, through the level's debug exposure, in the same task as its render, so a moving deck is drawn where it rests.
   */
  showRest(): void {
    for (const m of this.data) this.views.get(m.id)?.({ position: { x: m.at.x, y: m.at.y, z: m.at.z }, euler: { x: m.euler.x, y: m.euler.y, z: m.euler.z }, enabled: m.enabled });
  }
  /** After a logical checkpoint load, bring fresh native bodies to the restored published poses without a physics step. */
  resetPublishedPoses(): void { for (const [id, body] of this.bodies) body.resetPose(this.pose(id)); }
  /** Pending interactions are continuation state; the shared host's own adapter owns fields and full Wasm memory/globals. */
  snapshot(resetIds: ReadonlySet<string> = new Set()): readonly (readonly [string, number])[] { return [...this.pending].filter(([id]) => !resetIds.has(id)); }
  /** Restore pending commands only after validating every row, without partial publication. */
  restore(pending: readonly (readonly [string, number])[]): void { if (new Set(pending.map(([id]) => id)).size !== pending.length || pending.some(([id, action]) => !this.data.some((m) => m.id === id) || ![1, 2, 3].includes(action))) throw new Error('Invalid mover commands'); this.pending = new Map(pending); }
  /** Handle-only continuation; native poses and velocities already belong to the host's physics snapshot. */
  snapshotBodies(): MoverBodyState[] { return [...this.bodyHandles].map(([id, handle]) => ({ id, handle })); }
  /** Validate the whole handle table before publishing any new native identity. */
  restoreBodies(rows: readonly MoverBodyState[]): void {
    const ids = this.data.filter(row => row.kind !== 'chain').map(row => row.id);
    if (rows.length !== ids.length || new Set(rows.map(row => row.id)).size !== rows.length || new Set(rows.map(row => row.handle)).size !== rows.length
      || rows.some(row => !ids.includes(row.id) || !Number.isFinite(row.handle) || row.handle < 0)) throw new Error('Invalid mover native continuation');
    this.bodyHandles = new Map(rows.map(row => [row.id, row.handle]));
  }
  /** Commands and native handles share one bounded adapter; transient lift interactions are not replayed after loading. */
  snapshotState(resetIds: ReadonlySet<string> = new Set()): string { return JSON.stringify({ pending: this.snapshot(resetIds), bodies: this.snapshotBodies() }); }
  /** Parse all continuation fields atomically, without a command, native mutation or gameplay step. */
  restoreState(text: string): void {
    const saved = v.parse(continuation, JSON.parse(text)), pending = this.pending, handles = this.bodyHandles;
    try { this.restore(saved.pending); this.restoreBodies(saved.bodies); } catch (error) { this.pending = pending; this.bodyHandles = handles; throw error; }
  }
  /** After native world/tag restore, reconnect existing bodies and reset only durable lift road poses. */
  reconnect(resetIds: ReadonlySet<string> = new Set()): void {
    if (this.data.some(row => row.kind === 'chain') || [...resetIds].some(id => !this.data.some(row => row.id === id))) throw new Error('Unsupported mover native reconnect');
    const bodies = new Map<string, KinematicMover>();
    for (const row of this.data) {
      const handle = this.bodyHandles.get(row.id); if (handle === undefined) throw new Error('Missing mover native continuation');
      bodies.set(row.id, new KinematicMover(this.physics(), row.boxes, this.pose(row.id), row.id, row.kind === 'static', handle));
    }
    this.bodies.clear(); for (const [id, body] of bodies) { this.bodies.set(id, body); if (resetIds.has(id)) body.resetPose(this.pose(id)); }
  }
}

/** A single platform installer reads declared rows and owns their lifecycle; the shard only supplies presentation recipes. */
export async function installDeclaredMovers(ctx: LevelContext, world: World, options: MoverInstallation): Promise<MoverRuntime> {
  if (options.shared !== undefined && options.composition !== undefined) throw new Error('Mover composition cannot replace an injected shared host');
  let tick = 0, host = options.shared?.host, composition: ReturnType<typeof createShardfileComposedLane> | undefined;
  if (host === undefined) {
    const assets = new Map<string, Uint8Array>();
    for (const hash of new Set(options.data.map((row) => row.module))) {
      const present = options.admitted?.get(hash); if (present !== undefined) { assets.set(hash, present); continue; }
      if (options.read !== undefined) { assets.set(hash, await options.read(hash)); continue; }
      const url = options.modules.get(hash); if (url === undefined) throw new Error('Missing mover module URL');
      const response = await fetch(url); if (!response.ok) throw new Error('Missing mover script'); assets.set(hash, new Uint8Array(await response.arrayBuffer()));
    }
    const query = scriptPhysicsQueries({ physics: world.physics, navigation: ctx.app.navmesh ?? { closestWalkable: () => null, findPath: () => null }, handle: () => undefined });
    if (options.composition === undefined) host = await createMoverHost(options.data, assets, query);
    else { composition = await createComposedMoverHost(options.data, assets, query, options.composition); host = composition.host; }
  }
  if (ctx.scope.disposed) throw new Error('Mover scope left during admission');
  const runtime = new MoverRuntime(options.data, { physics: world.physics, scope: ctx.scope, host, adopt: (id) => options.views.get(id), activation: { ground: () => world.player.motor.result, ...options.activation } });
  const installedHost = host;
  ctx.system({ id: options.systemId, phase: 'fixed.pre', before: ['physics.movers'], run: () => {
    const current = options.shared === undefined ? ++tick : options.shared.tick();
    if (options.shared === undefined) { if (composition === undefined) installedHost.beginTick(current); else composition.step(current); }
    runtime.step(current, options.permissions?.());
  } });
  if (options.onDispose !== undefined) ctx.scope.onDispose(options.onDispose);
  ctx.debug.expose(`movers.${options.systemId}`, { showRest: () => { runtime.showRest(); } }); // the map bake poses movers at rest
  return runtime;
}

const driverFinite = v.pipe(v.number(), v.finite());
const driverEntity = v.strictObject({ id: v.pipe(driverFinite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), name: v.pipe(v.string(), v.maxLength(128)),
  position: v.tuple([driverFinite, driverFinite, driverFinite]), fields: v.record(v.string(), driverFinite), frozen: v.boolean(), interactive: v.boolean() });
/** The mover's field/query role shares its level's host, module union, fuel, events and effect allowances. */
export class MoverScriptDriver {
  readonly data: MoverData;
  readonly world: ScriptWorld;
  private readonly contract: string;
  private readonly query: ScriptQuery;
  private readonly resetIds: ReadonlySet<string>;
  private runtime: MoverRuntime | undefined;
  /** Lift-only modules reset on load; sharing their memory with persistent movers is refused. */
  readonly transientModules: readonly string[];
  constructor(input: MoverData, physicsQueries: ScriptQuery | Pick<SimHost, 'physics'>, resetIds: readonly string[] = []) {
    const query: ScriptQuery = typeof physicsQueries === 'function' ? physicsQueries : (kind, values, entity) =>
      scriptPhysicsQueries({ physics: physicsQueries.physics, navigation: { closestWalkable: () => null, findPath: () => null }, handle: () => undefined })(kind, values, entity);
    this.data = parseMovers(input); this.query = moverQueries(this.data, query);
    this.resetIds = new Set(resetIds);
    if (this.resetIds.size !== resetIds.length || resetIds.some(id => !this.data.some(row => row.id === id))) throw new Error('Invalid transient mover identity');
    this.transientModules = [...new Set(this.data.filter(row => this.resetIds.has(row.id)).map(row => row.module))].sort();
    if (this.data.some(row => !this.resetIds.has(row.id) && this.transientModules.includes(row.module))) throw new Error('Lift module cannot own persistent movers');
    this.contract = JSON.stringify(resetIds.length === 0 ? this.data : { data: this.data, resetIds: [...resetIds].sort() });
    this.world = new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(this.data));
  }
  /** No events cross into mover entity fields from the numeric/brain role. */
  role(): ScriptRole { return { id: 'mover', world: this.world, query: this.query, events: 'consume', snapshot: () => this.snapshot(), restore: text => { this.restore(text); } }; }
  /** Every due call runs under the existing one beginTick; the runtime only publishes admitted collision poses. */
  schedule(runtime: () => MoverRuntime, permissions: () => ReadonlyMap<string, number> = () => new Map()): ScriptSchedule {
    const rows = new Map(this.data.map(row => [row.entity, row]));
    return { id: 'mover', role: 'mover', bindings: this.data.map(row => ({ module: row.module, entity: row.entity, divisor: 1 })),
      input: (binding, tick) => {
        const row = rows.get(binding.entity); if (row === undefined) throw new Error('Missing mover binding');
        return runtime().scriptInput(row.id, tick, permissions().get(row.id) ?? 0);
      }, committed: (binding, call) => {
        const row = rows.get(binding.entity); if (row === undefined) throw new Error('Missing mover binding');
        runtime().publish(row.id, call.ok);
      },
    };
  }
  /** Compose numeric, mover and optional trusted roles under one host's aggregate allowances.
   * Extra roles retain their own owner grants and event policy; omitted roles preserve the existing continuation. */
  compose(content: ShardScriptContent, assets: ReadonlyMap<string, Uint8Array>, ports: ShardScriptPorts,
    brains?: DeclaredScriptBrainPorts, permissions: () => ReadonlyMap<string, number> = () => new Map(),
    extra?: { roles: readonly ScriptRole[]; schedules?: readonly ScriptSchedule[] }): ReturnType<typeof createShardfileComposedLane> {
    return createShardfileComposedLane(content, assets, ports, brains, { roles: [this.role(), ...(extra?.roles ?? [])], transientModules: this.transientModules,
      schedules: [this.schedule(() => { if (this.runtime === undefined) throw new Error('Missing mover runtime'); return this.runtime; }, permissions), ...(extra?.schedules ?? [])] });
  }
  /** Attach native handles to the same host; an explicit drive owns one fixed tick, never another script host. */
  install(sim: SimHost, lane: ReturnType<typeof createShardfileComposedLane>, options: { id: string; restoring?: boolean; activation?: MoverActivationPorts; drive?: boolean }): MoverRuntime {
    if (this.runtime !== undefined) throw new Error('Mover driver is already installed');
    const runtime = new MoverRuntime(this.data, { host: lane.host, physics: () => sim.physics, scope: sim.scope,
      ...(options.restoring === undefined ? {} : { restoring: options.restoring }),
      ...(options.activation === undefined ? {} : { activation: options.activation }) });
    this.runtime = runtime;
    sim.onStep(options.id, () => { if (options.drive === true) lane.step(sim.state.tick); runtime.capture(); }, {
      snapshot: () => runtime.snapshotState(this.resetIds), restore: value => {
        if (typeof value !== 'string') throw new Error('Invalid mover continuation'); runtime.restoreState(value);
      }, physicsRestored: () => { runtime.reconnect(this.resetIds); } });
    if (options.drive === true) sim.onStep(`${options.id}.script`, () => undefined, { snapshot: () => lane.snapshot(), restore: value => {
      if (typeof value !== 'string') throw new Error('Invalid script adapter snapshot'); lane.restore(value);
    } });
    return runtime;
  }
  /** Typed role state; the owning composition captures module memories and host quotas once. */
  snapshot(): string {
    const initial = new Map(moverScriptEntities(this.data).map(row => [row.id, row]));
    return JSON.stringify({ contract: this.contract, entities: this.world.state().map(row => this.resetIds.has(row.name) ? initial.get(row.id) : row) });
  }
  /** Restore matching entity identities atomically without commands, body movement or script execution. */
  restore(text: string): void {
    const saved = v.parse(v.strictObject({ contract: v.string(), entities: v.pipe(v.array(driverEntity), v.maxLength(32)) }), JSON.parse(text));
    if (saved.contract !== this.contract || saved.entities.length !== this.data.length
      || saved.entities.some(row => !this.data.some(mover => mover.entity === row.id && mover.id === row.name))) throw new Error('Incompatible mover role continuation');
    const initial = new Map(moverScriptEntities(this.data).map(row => [row.id, row]));
    if (saved.entities.some(row => this.resetIds.has(row.name) && JSON.stringify(row) !== JSON.stringify(initial.get(row.id)))) throw new Error('Lift continuation must reset at the road stop');
    this.world.restore(saved.entities);
  }
}

/** Prepare one page composition; mover calls still run in their original fixed.pre phase. */
export async function createComposedMoverHost(data: MoverData, assets: ReadonlyMap<string, Uint8Array>, physicsQueries: ScriptQuery,
  extra: MoverRoleComposition): Promise<ReturnType<typeof createShardfileComposedLane>> {
  if (!Number.isSafeInteger(extra.seed) || extra.seed < 0) throw new Error('Invalid composed mover seed');
  const driver = new MoverScriptDriver(data, physicsQueries), modules = new Map(await verifiedMoverModules(assets, driver.data));
  for (const [hash, source] of extra.modules) {
    const bytes = Uint8Array.from(source), digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (!/^(?:commons:)?[a-f0-9]{64}$/u.test(hash) || [...digest].map(value => value.toString(16).padStart(2, '0')).join('') !== hash.replace(/^commons:/u, '')) throw new Error('Extra mover module hash mismatch');
    modules.set(hash, bytes);
  }
  return createShardfileComposedLane({ identity: { seed: extra.seed }, sim: { scripts: [...modules.keys()], bindings: [], scriptTickDivisor: 1 },
    state: { shared: [], player: [] } }, modules, { rules: { fields: {}, archetypes: [], events: [], maxEntities: 32 }, entities: [], actors: new Map(), query: () => [] },
  undefined, { roles: [driver.role(), ...extra.roles], schedules: extra.schedules ?? [], transientModules: driver.transientModules });
}

/** Copy and SHA-256-check each declared module before constructing a headless host. */
export async function verifiedMoverModules(assets: ReadonlyMap<string, Uint8Array>, rows: MoverData): Promise<ReadonlyMap<string, Uint8Array>> {
  return new Map(await Promise.all([...new Set(parseMovers(rows).map(row => row.module))].map(async hash => {
    const bytes = assets.get(hash); if (bytes === undefined) throw new Error('Mover module was not admitted');
    const copy = Uint8Array.from(bytes), digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
    if ([...digest].map(b => b.toString(16).padStart(2, '0')).join('') !== hash) throw new Error('Mover module hash mismatch');
    return [hash, copy] as const;
  })));
}

/** The platform's cable/deck law, used by author rows and both native hosts. */

/** Floor endpoint vectors; explicit construction data, never scene or renderer ownership. */
export interface ZiplineSpec { top: Vector3; bottom: Vector3; /** sag in metres at mid-span per 100 m (default 1.6) */ sag?: number }

/** Platform deck offset and cable/landing attachment heights in metres. */
export const DECK_H = 0.5, CABLE_ABOVE = 3.6, LANDING_ABOVE = 3.2;
const V = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** the zipline's layout on its ends: the launch deck, the cable's two ends and its sag (world) */
export class CableLayout {
  /** the cable's two ends (world) */
  readonly a = new Vector3();
  readonly b = new Vector3();
  readonly len: number;
  readonly sag: number;
  readonly dir = new Vector3();
  /** the flat direction down the line */
  readonly flat: Vector3;
  readonly deck = { x: 0, z: 0, yaw: 0, y: 0, hw: 1.2, hd: 1.8 };

  readonly spec: ZiplineSpec;

  constructor(spec: ZiplineSpec) {
    this.spec = spec;
    const flat = this.flat = V(spec.bottom.x - spec.top.x, 0, spec.bottom.z - spec.top.z).normalize();
    // the deck: 3.6 m long, its outer edge at `top`, running back up the slope
    this.deck.yaw = Math.atan2(flat.x, flat.z);
    this.deck.x = spec.top.x - flat.x * this.deck.hd; this.deck.z = spec.top.z - flat.z * this.deck.hd; this.deck.y = spec.top.y + DECK_H;
    this.a.set(spec.top.x + flat.x * 0.4, this.deck.y + CABLE_ABOVE, spec.top.z + flat.z * 0.4);
    this.b.set(spec.bottom.x, spec.bottom.y + LANDING_ABOVE, spec.bottom.z);
    this.len = this.a.distanceTo(this.b);
    this.sag = (spec.sag ?? 1.6) * (this.len / 100);
    this.dir.subVectors(this.b, this.a).normalize();
  }

  /** a point on the cable at arc position s (0 … len), sagging as a parabola */
  at(s: number, out: Vector3): Vector3 {
    const t = MathUtils.clamp(s / this.len, 0, 1);
    return out.lerpVectors(this.a, this.b, t).setY(this.a.y + (this.b.y - this.a.y) * t - this.sag * 4 * t * (1 - t));
  }

  /** where the trolley parks at the top, and its turn about +Y */
  park(out: Vector3): number { this.at(0.6, out); return Math.atan2(this.dir.x, this.dir.z) + Math.PI / 2; }
}


const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ riding: v.boolean(), s: v.pipe(finite, v.minValue(0)), v: v.pipe(finite, v.minValue(0), v.maxValue(32)) });

/** The native page's zipline continuation: cable gravity/drag, carry pose and release velocity; no renderer or grants. */
export class ZiplineDriver {
  private readonly layout: CableLayout;
  private readonly point = new Vector3();
  private readonly ahead = new Vector3();
  private readonly onRide: (on: boolean) => void;
  private riding = false;
  private s = 0;
  private v = 0;

  private readonly row: ZiplineMode;
  constructor(row: ZiplineMode, onRide: (on: boolean) => void) {
    this.row = v.parse(ZiplineModeSchema, row);
    this.layout = new CableLayout({ top: new Vector3(row.top.x, row.top.y, row.top.z), bottom: new Vector3(row.bottom.x, row.bottom.y, row.bottom.z), sag: row.sag }); this.onRide = onRide;
  }

  get isRiding(): boolean { return this.riding; }

  /** Current distance along the cable; presentation reads it without copying or mutating continuation. */
  get distance(): number { return this.s; }

  /** The page's prompt starts once, before its next update. Carry ownership belongs to the callback's player owner. */
  start(): void {
    if (this.riding) return;
    this.riding = true; this.s = 0.4; this.v = 2.5;
    this.onRide(true);
  }

  /** Same post-player update law as world/Zipline.ts; all vectors are reused and the finish callback runs once. */
  update(dt: number, player: { position: Vector3; velocity: Vector3 }): void {
    if (!this.riding) return;
    const slope = -(this.layout.at(this.s + 0.5, this.ahead).y - this.layout.at(this.s, this.point).y) / 0.5;
    this.v = Math.min(this.row.maxSpeed, Math.max(1.5, this.v + (this.row.gravity * slope * 0.9 - this.row.drag * this.v * this.v) * dt));
    this.s += this.v * dt;
    this.layout.at(this.s, this.point);
    player.position.copy(this.point); player.position.y -= this.row.hang;
    player.velocity.set(0, 0, 0);
    if (this.s >= this.layout.len - 1.6) {
      this.riding = false;
      const dir = this.layout.dir;
      player.velocity.set(dir.x * Math.min(6, this.v * 0.4), 1.5, dir.z * Math.min(6, this.v * 0.4));
      this.layout.park(this.point);
      this.onRide(false);
    }
  }

  /** Copied native continuation; the host snapshots the actual player pose and carry owner separately. */
  snapshot(): v.InferOutput<typeof Saved> { return { riding: this.riding, s: this.s, v: this.v }; }

  /** Restore does not start a ride, move the player, draw RNG or publish a callback. Refusal is atomic. */
  restore(value: unknown): void {
    const saved = v.parse(Saved, value);
    if (saved.v > this.row.maxSpeed) throw new Error('Zipline continuation exceeds its admitted speed');
    this.riding = saved.riding; this.s = saved.s; this.v = saved.v;
  }
}

/** The directional column keeps the native strict sides and upper ceiling, with no invented lower boundary. */
export function inUpdraft(row: UpdraftMode, x: number, y: number, z: number): boolean {
  const ux = row.to.x - row.from.x, uz = row.to.z - row.from.z, len = Math.hypot(ux, uz);
  const along = ((x - row.from.x) * ux + (z - row.from.z) * uz) / len, across = Math.abs((x - row.from.x) * uz - (z - row.from.z) * ux) / len;
  return across < row.width / 2 + row.margin && along > 0 && along < len && y < row.to.y + row.margin;
}
/** The board wind law reads real feet and hover state; one host owns when the impulse reaches its player phase. */
export class UpdraftDriver {
  private readonly row: UpdraftMode;
  constructor(row: UpdraftMode) { this.row = v.parse(UpdraftModeSchema, row); }
  /** Add the native lift only while the board is actually inside the admitted column. */
  step(dt: number, feet: { x: number; y: number; z: number }, hovering: boolean, impulse: Vector3): void {
    if (hovering && inUpdraft(this.row, feet.x, feet.y, feet.z)) impulse.y += this.row.lift * dt;
  }
}

/**
 * The riding feel's pure logic (NALATI-FINISH B1, N13 — docs/design/nalati/riding-research.md "Not built"): the horse keeping
 * to a road when you let go of the stick, and the rhythm spur. No three.js, no DOM: Mount.ts drives them, vitest covers
 * them (test/shards/nalati-grasslands/ride-assist.test.ts).
 *
 *   roadSteer(roads, x, z, heading, ahead)  → { yaw, off } | null   the way along the nearest road (within ROAD_REACH m and
 *        heading within 60° of its line), aimed `ahead` m down it the way the horse faces; null off a road, across one, or
 *        at its end (RDR2 / Witcher / KCD: with no stick on a road the horse follows it)
 *   const spur = new RhythmSpur();  spur.tap(t, phase, period) → 'good' | 'early' | 'off'   a GALLOP press at the horse's
 *        gait phase (0..1, the stride's downbeat at 0); spur.update(dt); spur.latched / spur.streak / spur.boost
 *        RDR2's rhythm spur ("well-timed taps hold a gallop at almost no stamina cost") and Rival Stars' timed sprint tap:
 *        a tap within ±WINDOW of the beat keeps the gallop going for a stride and a bit (no hold needed), each tap in a row
 *        adds speed (up to +12 %); an off-beat or mashed tap breaks the streak.
 */


/** An authored road point in the horizontal plane. */
export type RoadXZ = readonly [number, number];

/** m from a road's centre line the horse still counts as on it (the trails' beds are ~5–7 m wide) */
export const ROAD_REACH = 5.5;
/** the heading must lie within this of the road's line (cos 60°): turned further off it, the rider is leaving the road */
const roadROAD_ALIGN = 0.5;
/** m short of a road's end the follow lets go (the horse coasts down there) */
const roadROAD_END = 3;

/** Nearest aligned road heading and measured lateral distance. */
export interface RoadSteer { yaw: number; off: number }

/**
 * The yaw (animal convention: x = sin, z = cos) toward the point `ahead` m down the nearest road from (x, z) that runs
 * within 60° of `heading` (at a junction the branch across it is skipped), the way `heading` points along it; `off` = the
 * distance to its centre line. Null when no such road is within ROAD_REACH or it ends within `ahead` + roadROAD_END.
 */
export function roadSteer(roads: readonly (readonly RoadXZ[])[], x: number, z: number, heading: number, ahead: number): RoadSteer | null {
  let best = -1, bestSeg = -1, bestT = 0, bestD = ROAD_REACH;
  for (let r = 0; r < roads.length; r++) {
    const pts = roads[r];
    if (pts === undefined) continue;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a === undefined || b === undefined) continue;
      const ux = b[0] - a[0], uz = b[1] - a[1], l2 = ux * ux + uz * uz;
      if (l2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / l2));
      const d = Math.hypot(x - (a[0] + ux * t), z - (a[1] + uz * t));
      // only a road the horse runs along: at a junction the branch across its heading is not the one it is on
      if (d < bestD && Math.abs((ux * Math.sin(heading) + uz * Math.cos(heading)) / Math.sqrt(l2)) >= roadROAD_ALIGN) { bestD = d; best = r; bestSeg = i; bestT = t; }
    }
  }
  const pts = roads[best];
  if (pts === undefined) return null;
  const a = pts[bestSeg], b = pts[bestSeg + 1];
  if (a === undefined || b === undefined) return null;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dot = ((b[0] - a[0]) * Math.sin(heading) + (b[1] - a[1]) * Math.cos(heading)) / len;
  if (Math.abs(dot) < roadROAD_ALIGN) return null;
  const dir = dot > 0 ? 1 : -1;
  // walk `ahead` m down the polyline from the foot of the perpendicular, the way the horse faces
  let px = a[0] + (b[0] - a[0]) * bestT, pz = a[1] + (b[1] - a[1]) * bestT;
  let left = ahead + roadROAD_END, seg = bestSeg, aimX = px, aimZ = pz, aimed = false;
  for (;;) {
    const q = dir > 0 ? pts[seg + 1] : pts[seg];
    if (q === undefined) return null;
    const d = Math.hypot(q[0] - px, q[1] - pz);
    if (!aimed && left - roadROAD_END <= d) {
      const u = (left - roadROAD_END) / Math.max(d, 1e-6);
      aimX = px + (q[0] - px) * u; aimZ = pz + (q[1] - pz) * u; aimed = true;
    }
    if (left <= d) break;
    left -= d; px = q[0]; pz = q[1];
    seg += dir;
    if (seg < 0 || seg + 1 >= pts.length) return null;   // the road ends before the look-ahead (+ the margin)
  }
  return { yaw: Math.atan2(aimX - x, aimZ - z), off: bestD };
}

/** half-width of the beat window, in stride phase (±0.16 of a stride ≈ ±70 ms at a gallop's ~2.3 strides a second) */
export const SPUR_WINDOW = 0.16;
/** a tap sooner than this share of a stride after the last one is mashing, not riding the rhythm */
const roadSPUR_MASH = 0.55;
/** strides a good tap keeps the gallop going for (so the next beat's tap lands before it runs out) */
const roadSPUR_LATCH = 1.35;
/** Maximum scored streak and speed boost per beat. */
export const SPUR_MAX_STREAK = 3, SPUR_BOOST_PER = 0.04;

/** The score of a press against the current stride. */
export type SpurTap = 'good' | 'early' | 'off';
const roadSpurState = v.strictObject({ version: v.literal(1), streak: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(SPUR_MAX_STREAK)),
  latchT: v.pipe(v.number(), v.finite(), v.minValue(0)), good: v.pipe(v.number(), v.integer(), v.minValue(0)), lastTap: v.pipe(v.number(), v.finite()) });
/** Restorable rhythm-spur clocks. */
export type RhythmSpurState = v.InferOutput<typeof roadSpurState>;

/** Bounded stride-scored gallop continuation. */
export class RhythmSpur {
  /** good taps in a row (0..SPUR_MAX_STREAK) */
  streak = 0;
  /** s the last good tap still holds the gallop */
  latchT = 0;
  /** good taps this ride (for the HUD / the checks) */
  good = 0;
  private lastTap = -1e9;

  /** a GALLOP press at time `t` (s), the horse's gait `phase` (0..1) and stride `period` (s) */
  tap(t: number, phase: number, period: number): SpurTap {
    const since = t - this.lastTap;
    this.lastTap = t;
    const p = ((phase % 1) + 1) % 1, off = Math.min(p, 1 - p);
    if (since < period * roadSPUR_MASH) { this.streak = 0; this.latchT = 0; return 'early'; }
    if (off > SPUR_WINDOW) { this.streak = 0; this.latchT = 0; return 'off'; }
    this.streak = Math.min(SPUR_MAX_STREAK, this.streak + 1);
    this.latchT = period * roadSPUR_LATCH;
    this.good++;
    return 'good';
  }

  update(dt: number): void {
    if (this.latchT > 0) { this.latchT = Math.max(0, this.latchT - dt); if (this.latchT === 0) this.streak = 0; }
  }

  reset(): void { this.streak = 0; this.latchT = 0; this.lastTap = -1e9; }

  /** Exact rhythm continuation, including the previous press that makes a rapid repeat count as mashing. */
  snapshot(): RhythmSpurState { return v.parse(roadSpurState, { version: 1, streak: this.streak, latchT: this.latchT, good: this.good, lastTap: this.lastTap }); }
  restore(value: unknown): void { const s = v.parse(roadSpurState, value); this.streak = s.streak; this.latchT = s.latchT; this.good = s.good; this.lastTap = s.lastTap; }

  /** the rhythm is holding the gallop */
  get latched(): boolean { return this.latchT > 0; }
  /** the gallop's speed factor while latched (1 + 4 % a tap in a row, up to +12 %) */
  get boost(): number { return this.latched ? 1 + SPUR_BOOST_PER * this.streak : 1; }
}

/** Resolved input and the admitted world queries; the caller owns a persistent frame port. */
export interface ReinsFrame {
  readonly forward: number; readonly turn: number; readonly touchX: number; readonly touchY: number;
  readonly gallop: boolean; readonly jump: boolean; readonly drawing: boolean; readonly moveScale: number;
  readonly phase: number; readonly feet: { readonly x: number; readonly z: number };
  readonly roads: readonly (readonly RoadXZ[])[] | undefined;
  readonly inBounds: (x: number, z: number, margin: number) => boolean;
  readonly refuses: (x: number, z: number) => boolean;
  readonly wet: boolean;
}
/** Mounted gait speeds in metres per second. */
export interface HorseSpeeds { readonly walk: number; readonly trot: number; readonly canter: number; readonly gallop: number }
const reinsSECTOR = 0.38;                 // the stick's forward / back sectors: |y| > 0.38 × its length (~67° either side of up / down)
const reinsPIVOT_SPEED = 0.6, reinsBACK_SPEED = 1.1;   // m/s: the stick beside you from a stand (a turn on the spot), reining back
/** rad/s turn at full rein per gait (between them it blends by speed) — at a gallop 0.62 rad/s = a ~21 m radius */
const reinsTURN = { stand: 1.5, walk: 1.35, trot: 1.1, canter: 0.85, gallop: 0.62 };
const reinsDRAW_TURN = 0.6;               // the rein's turn while you draw (a steadier line to shoot from)
const reinsSKID_MIN = 7, reinsSKID_TIME = 1.2, reinsSKID_TURN = 1.6;
const reinsPANIC_SPEED = 9.5, reinsPANIC_TURN = 2;
const reinsROAD_TURN = 2.2, reinsSTEED_RESUME = 25;

const reinsClamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
const reinsLerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;
const reinsAngDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const reinsNum = v.pipe(v.number(), v.finite());
const reinsReinsState = v.strictObject({ version: v.literal(1), steed: v.pipe(reinsNum, v.minValue(0), v.maxValue(100)), winded: v.boolean(), breaking: v.boolean(),
  heading: reinsNum, speed: reinsNum, wUp: reinsNum, grounded: v.boolean(), target: reinsNum, rateIn: reinsNum, turnIn: reinsNum, sector: v.picklist([-1, 0, 1, 2]),
  galloping: v.boolean(), drawing: v.boolean(), jumpWas: v.boolean(), jumpQueued: v.boolean(), cruise: reinsNum, gallopWas: v.boolean(), tapQueued: v.boolean(),
  clock: reinsNum, lastPhase: reinsNum, strideHz: reinsNum, sectorWas: v.picklist([-1, 0, 1, 2]), skidT: reinsNum, panicT: reinsNum, panicRear: reinsNum, panicYaw: reinsNum, jolt: reinsNum,
  onRoad: v.boolean(), beat: v.boolean(), spurFlash: v.pipe(reinsNum, v.integer(), v.minValue(0)), turnLead: reinsNum,
  spur: v.strictObject({ version: v.literal(1), streak: v.pipe(reinsNum, v.integer(), v.minValue(0), v.maxValue(3)), latchT: v.pipe(reinsNum, v.minValue(0)),
    good: v.pipe(reinsNum, v.integer(), v.minValue(0)), lastTap: reinsNum }) });
/** Complete reins continuation, including held inputs and rhythm. */
export type MountedReinsState = v.InferOutput<typeof reinsReinsState>;
/** The shipping reins decision law, without input devices, renderer, global app or native resource allocation. */
export class MountedReins {
  steed = 100; winded = false; breaking = false;
  heading = 0; speed = 0; wUp = 0; grounded = true;
  target = 0; rateIn = 0; turnIn = 0; sector = 2;
  galloping = false; drawing = false; jumpWas = false; jumpQueued = false;
  cruise = 0; gallopWas = false; tapQueued = false; clock = 0; lastPhase = 0; strideHz = 2;
  sectorWas = 2; skidT = 0; panicT = 0; panicRear = 0; panicYaw = 0; jolt = 0;
  onRoad = false; beat = false; spurFlash = 0; turnLead = 0;
  readonly spur = new RhythmSpur();
  private readonly speeds: HorseSpeeds;
  constructor(speeds: HorseSpeeds) { this.speeds = speeds; }
  /** All decision clocks and queued input edges; physical motor and presentation continuation belong to their drivers. */
  snapshot(): MountedReinsState {
    return v.parse(reinsReinsState, { version: 1, steed: this.steed, winded: this.winded, breaking: this.breaking, heading: this.heading, speed: this.speed,
      wUp: this.wUp, grounded: this.grounded, target: this.target, rateIn: this.rateIn, turnIn: this.turnIn, sector: this.sector,
      galloping: this.galloping, drawing: this.drawing, jumpWas: this.jumpWas, jumpQueued: this.jumpQueued, cruise: this.cruise,
      gallopWas: this.gallopWas, tapQueued: this.tapQueued, clock: this.clock, lastPhase: this.lastPhase, strideHz: this.strideHz,
      sectorWas: this.sectorWas, skidT: this.skidT, panicT: this.panicT, panicRear: this.panicRear, panicYaw: this.panicYaw, jolt: this.jolt,
      onRoad: this.onRoad, beat: this.beat, spurFlash: this.spurFlash, turnLead: this.turnLead, spur: this.spur.snapshot() });
  }
  /** Validate the entire envelope before changing any live clock. */
  restore(value: unknown): void {
    const s = v.parse(reinsReinsState, value);
    if (s.spur.lastTap > s.clock) throw new RangeError('Rhythm press is ahead of the riding clock');
    this.spur.restore(s.spur);
    this.steed = s.steed; this.winded = s.winded; this.breaking = s.breaking; this.heading = s.heading; this.speed = s.speed;
    this.wUp = s.wUp; this.grounded = s.grounded; this.target = s.target; this.rateIn = s.rateIn; this.turnIn = s.turnIn; this.sector = s.sector;
    this.galloping = s.galloping; this.drawing = s.drawing; this.jumpWas = s.jumpWas; this.jumpQueued = s.jumpQueued; this.cruise = s.cruise;
    this.gallopWas = s.gallopWas; this.tapQueued = s.tapQueued; this.clock = s.clock; this.lastPhase = s.lastPhase; this.strideHz = s.strideHz;
    this.sectorWas = s.sectorWas; this.skidT = s.skidT; this.panicT = s.panicT; this.panicRear = s.panicRear; this.panicYaw = s.panicYaw;
    this.jolt = s.jolt; this.onRoad = s.onRoad; this.beat = s.beat; this.spurFlash = s.spurFlash; this.turnLead = s.turnLead;
  }
  read(dt: number, frame: ReinsFrame): void {
    const HORSE_SPEED = this.speeds, drawing = frame.drawing;
    const fwdK = frame.forward, strK = frame.turn;
    const tx = frame.touchX, ty = frame.touchY, stick = Math.hypot(tx, ty);
    const turnIn = reinsClamp(strK + tx, -1, 1);
    const gallopKey = frame.gallop;
    this.wUp = fwdK > 0 ? this.wUp + dt : 0;
    // the stick's sector (8 ways): ahead (within ~67° of up) = go, the gait by how far it is pushed; beside = a collected
    // turn (at most a trot; a pivot on the spot from a stand); behind = rein in, then back up
    const sector = stick > 0.1 ? (ty > reinsSECTOR * stick ? 1 : ty < -reinsSECTOR * stick ? -1 : 0) : fwdK !== 0 ? fwdK : strK !== 0 ? 0 : 2;
    let target = 0;
    if (sector === 1) target = stick > 0.1 ? (stick < 0.45 ? HORSE_SPEED.walk : stick < 0.85 ? HORSE_SPEED.trot : HORSE_SPEED.canter) : this.wUp < 0.9 ? HORSE_SPEED.trot : HORSE_SPEED.canter;
    else if (sector === 0) target = reinsClamp(this.speed, reinsPIVOT_SPEED, HORSE_SPEED.trot);
    else if (sector === -1) target = this.speed > 0.5 ? 0 : -reinsBACK_SPEED * (stick > 0.1 ? Math.min(1, -ty / 0.8) : 1);
    if (sector === 1) this.cruise = target; else if (sector === -1) this.cruise = 0;   // B1: the gait a road keeps
    if (this.steed <= 0) this.winded = true;
    if (this.winded && this.steed >= reinsSTEED_RESUME) this.winded = false;
    // ── B1: the rhythm spur — a GALLOP press scored against the stride (the horse's gait phase; 0 = the downbeat) ──
    this.clock += dt;
    const ph = frame.phase, dph = (ph - this.lastPhase + 1) % 1;
    if (dt > 0 && dph < 0.5) this.strideHz += (dph / dt - this.strideHz) * Math.min(1, dt * 6);
    this.lastPhase = ph;
    const canSpur = this.speed > 6 && sector !== -1 && !this.winded && !this.breaking && this.panicT <= 0;
    const press = this.tapQueued || (gallopKey && !this.gallopWas);
    this.tapQueued = false;
    this.gallopWas = gallopKey;
    this.spur.update(dt);
    if (!canSpur && this.speed < 5) this.spur.reset();
    if (press && canSpur && this.spur.tap(this.clock, ph, 1 / Math.max(0.5, this.strideHz)) === 'good') this.spurFlash++;
    this.beat = canSpur && Math.min(ph, 1 - ph) < SPUR_WINDOW;
    const galloping = (gallopKey || this.spur.latched) && sector !== -1 && !this.winded && !this.breaking;
    if (galloping) target = HORSE_SPEED.gallop * this.spur.boost;
    // ── B1: the skid stop — the reins pulled back at a canter or faster ──
    if (sector === -1 && this.sectorWas !== -1 && this.speed > reinsSKID_MIN && this.grounded && !this.breaking) {
      this.skidT = reinsSKID_TIME; this.jolt = Math.max(this.jolt, 0.35);
    }
    if (sector !== -1) this.skidT = 0;
    this.sectorWas = sector;
    // ── B1: keep to the road — the stick let go on a road: the gait held (GALLOP gallops it), the reins along the road ──
    let turnSteer = turnIn;
    this.onRoad = false;
    const roads = frame.roads;
    if (roads !== undefined && sector === 2 && !this.breaking && frame.moveScale !== 0 && (this.speed > HORSE_SPEED.walk * 0.8 || galloping)) {
      const r = roadSteer(roads, frame.feet.x, frame.feet.z, this.heading, 5 + Math.abs(this.speed) * 0.9);
      if (r !== null) {
        this.onRoad = true;
        if (!galloping) target = Math.max(this.cruise, HORSE_SPEED.walk);
        turnSteer = reinsClamp(-reinsAngDiff(r.yaw, this.heading) * reinsROAD_TURN, -1, 1);
      }
    }
    // ── B1: the panic — rear (from a stand), then bolt away from the scare, deaf to the reins ──
    if (this.panicT > 0) {
      this.panicT = Math.max(0, this.panicT - dt); this.panicRear = Math.max(0, this.panicRear - dt);
      target = this.panicRear > 0 ? 0 : reinsPANIC_SPEED;
      turnSteer = reinsClamp(-reinsAngDiff(this.panicYaw, this.heading) * 2.5, -1, 1);
    }
    if (this.breaking || frame.moveScale === 0) target = 0;                       // the bucking rounds; a boss intro locks the reins
    // (steep ground is the motor's: the horse's climb limit by gait, in step)
    const ahead = 2 + this.speed * 0.4;
    const ax = frame.feet.x + Math.sin(this.heading) * ahead, az = frame.feet.z + Math.cos(this.heading) * ahead;
    if (!frame.inBounds(ax, az, 6)) target = Math.min(target, 0);
    // a line the horse will not cross (the Storm Titan's grass fire): it stops dead and shies
    if (target > 0 && frame.refuses(ax, az)) target = 0;
    // fording: in the river / the brook the horse wades at a walk-trot, swimming (held at FORD_DEPTH) where it is deeper
    const wet = frame.wet;
    if (wet) target = Math.sign(target) * Math.min(Math.abs(target), HORSE_SPEED.walk * 1.6);
    // the jump is an edge: queued until a fixed step takes it
    const jumpDown = frame.jump;
    if (jumpDown && !this.jumpWas && !this.breaking) this.jumpQueued = true;
    this.jumpWas = jumpDown;
    this.target = target; this.turnIn = turnSteer; this.sector = sector; this.galloping = galloping; this.drawing = drawing;
    // the rein's turn (rad/s at full rein by speed, in step): stick right = heading down (animal yaw)
    this.rateIn = this.breaking ? 0 : -turnSteer * (drawing && this.panicT <= 0 ? reinsDRAW_TURN : 1) * (this.skidT > 0 ? reinsSKID_TURN : this.panicT > 0 ? reinsPANIC_TURN : 1);
    // the head leads the turn: the neck swings to the rein first (eased in horse.ts), the body's turn follows it
    this.turnLead = reinsClamp(this.rateIn * this.maxRate() / reinsTURN.stand, -1, 1);
  }
  maxRate(): number {
    const HORSE_SPEED = this.speeds;
    const sp = Math.abs(this.speed);
    return sp < HORSE_SPEED.walk ? reinsLerp(reinsTURN.stand, reinsTURN.walk, sp / HORSE_SPEED.walk)
      : sp < HORSE_SPEED.trot ? reinsLerp(reinsTURN.walk, reinsTURN.trot, (sp - HORSE_SPEED.walk) / (HORSE_SPEED.trot - HORSE_SPEED.walk))
      : sp < HORSE_SPEED.canter ? reinsLerp(reinsTURN.trot, reinsTURN.canter, (sp - HORSE_SPEED.trot) / (HORSE_SPEED.canter - HORSE_SPEED.trot))
      : reinsLerp(reinsTURN.canter, reinsTURN.gallop, Math.min(1, (sp - HORSE_SPEED.canter) / (HORSE_SPEED.gallop - HORSE_SPEED.canter)));
  }

}


/** Explicit world queries and contact classification, shared by the page and trusted native host. */
export interface MountedWorld {
  readonly physics: Physics | null;
  readonly heightAt: (x: number, z: number) => number;
  readonly waterLevel: () => number;
  readonly wetAt: ((x: number, z: number) => boolean) | undefined;
  readonly stampede: (owner: unknown, horse: AnimalSim) => AnimalSim | null;
  readonly thrown: () => void;
}
/** Physical rider outputs; camera, HUD and equipment stay with presentation. */
export interface MountedRider {
  readonly position: Vector3; readonly velocity: Vector3;
  onGround: boolean; sprinting: boolean; crouching: boolean; speedFactor: number;
}
const mountSTEED_MAX = 100, mountSTEED_GALLOP = 12, mountSTEED_WALK = 15, mountSTEED_CANTER = 5;
const mountBODY = { length: 2.4, radius: 0.42, step: 0.45, snap: 0.5, kg: 450 };
const mountCLIMB = { walk: 47, gallop: 35 };   // degrees: the steepest ground climbed at a walk → at a full gallop (between: by speed)
const mountGRAVITY = 19.7, mountJUMP_V = 7.7;       // m/s², m/s: a 1.5 m arc over 0.78 s (clears the corral's 1.3 m rail)
const mountJUMP_APEX_T = mountJUMP_V / mountGRAVITY;     // s to the top of the arc (the auto jump takes off this far out, in time)
const mountJOSTLE_CD = 0.45, mountUNSEAT_CLOSING = 9;
const mountTURN_EASE = 4.5;               // 1/s: the turn's rate eases toward the rein (~0.22 s) — no snap, and the head leads it
const mountACCEL = 3.6, mountACCEL_HI = 2.2, mountCOAST = 3.2, mountREIN = 8;   // m/s²: speeding up (the gallop's last gear slower), letting go, reining back
const mountSKID = 16, mountSKID_REAR = 0.28;   // m/s it starts from, m/s² it stops at, s at most, the pivot's rein ×
const mountSTEED_RHYTHM = 2;              // STEED/s a gallop held by the rhythm costs (a held GALLOP: mountSTEED_GALLOP)
const mountFORD_DEPTH = 0.95;             // m of water a horse wades before it swims (its back stays dry)               // rad the saddle view looks down past the player's pitch
const mountAngDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const mountPANIC_REAR_POSE = 0.45;
const mountWORLD = ['WORLD'] as const, mountCREATURE = ['CREATURE'] as const;
const mount_from = { x: 0, y: 0, z: 0 }, mount_dir = { x: 0, y: 0, z: 0 }, mount_want = { x: 0, y: 0, z: 0 };

const mountNum = v.pipe(v.number(), v.finite()), mountPoint = v.tuple([mountNum, mountNum, mountNum]);
const mountBodyState = v.strictObject({ version: v.literal(1), reins: v.unknown(), feet: mountPoint, prevFeet: mountPoint,
  prevHeading: mountNum, yawRate: mountNum, vy: mountNum, onDeck: v.boolean(), swimming: v.boolean(), airT: mountNum,
  blockedT: v.pipe(mountNum, v.minValue(0)), shoveX: mountNum, shoveZ: mountNum, jostleCd: v.pipe(mountNum, v.minValue(0)),
  eyeY: mountNum, bobY: mountNum, gait: v.picklist(['stand', 'walk', 'trot', 'canter', 'gallop']),
  jostles: v.pipe(mountNum, v.integer(), v.minValue(0)), thrownBy: v.nullable(v.literal('stampede')) });

/** The shipping lying PLAYER capsule, including its native deck weight and gait-dependent slope rule. */
export function mountedMotorOptions(scale: number, owner: AnimalSim): MotorOptions {
  return { radius: mountBODY.radius * scale, height: mountBODY.radius * 2 * scale, length: mountBODY.length * scale,
    step: mountBODY.step * scale, maxClimbDeg: mountCLIMB.walk, snap: mountBODY.snap, group: 'PLAYER',
    blockedBy: ['WORLD', 'CREATURE', 'ITEM'], owner, weight: mountBODY.kg };
}

/** All scalar history needed by the physical motor and rider projection; the capsule belongs to native continuation. */
export interface MountedBodyState {
  readonly version: 1; readonly reins: ReturnType<MountedReins['snapshot']>;
  readonly feet: number[]; readonly prevFeet: number[];
  readonly prevHeading: number; readonly yawRate: number; readonly vy: number;
  readonly onDeck: boolean; readonly swimming: boolean; readonly airT: number; readonly blockedT: number;
  readonly shoveX: number; readonly shoveZ: number; readonly jostleCd: number;
  readonly eyeY: number; readonly bobY: number; readonly gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop';
  readonly jostles: number; readonly thrownBy: string | null;
}
/** The actual shipping mounted motor law, renderer-free; its native resources are explicitly installed by the caller. */
export class MountedBody extends MountedReins {

  gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop' = 'stand';
  jostles = 0; thrownBy: string | null = null;
  motor: CharacterMotor | null = null;
  readonly feet = new Vector3(); readonly prevFeet = new Vector3();
  prevHeading = 0; yawRate = 0; vy = 0; onDeck = false; swimming = false;
  airT = -1; blockedT = 0; shoveX = 0; shoveZ = 0; jostleCd = 0;
  eyeY = 0; bobY = 0;
  private readonly vel = new Vector3();
  private contactHorse: AnimalSim | null = null; private contactWorld: MountedWorld | null = null;
  private contactHit: AnimalSim | null = null;
  private contactResult(): AnimalSim | null { return this.contactHit; }
  private readonly contact: Parameters<CharacterMotor['touching']>[2] = c => {
    const world = this.contactWorld, a = this.contactHorse;
    if (world === null || a === null) return true;
    const o = world.stampede(tagOf(c)?.owner, a);
    if (o === null) return true;
    this.contactHit = o; return false;
  };
  private readonly bodySpeeds: HorseSpeeds;
  constructor(bodySpeeds: HorseSpeeds) { super(bodySpeeds); this.bodySpeeds = bodySpeeds; }

  /** Scalar continuation; the native capsule is captured separately and reconnected after world replacement. */
  snapshotBody(): MountedBodyState {
    return { version: 1 as const, reins: this.snapshot(), feet: this.feet.toArray(), prevFeet: this.prevFeet.toArray(),
      prevHeading: this.prevHeading, yawRate: this.yawRate, vy: this.vy, onDeck: this.onDeck, swimming: this.swimming,
      airT: this.airT, blockedT: this.blockedT, shoveX: this.shoveX, shoveZ: this.shoveZ, jostleCd: this.jostleCd,
      eyeY: this.eyeY, bobY: this.bobY, gait: this.gait, jostles: this.jostles, thrownBy: this.thrownBy };
  }
  /** Refuse malformed history atomically, before changing any live reins or feet. */
  restoreBody(value: unknown): void {
    const s = v.parse(mountBodyState, value), checked = new MountedReins(this.bodySpeeds);
    checked.restore(s.reins);
    this.restore(s.reins); this.feet.fromArray(s.feet); this.prevFeet.fromArray(s.prevFeet);
    this.prevHeading = s.prevHeading; this.yawRate = s.yawRate; this.vy = s.vy; this.onDeck = s.onDeck; this.swimming = s.swimming;
    this.airT = s.airT; this.blockedT = s.blockedT; this.shoveX = s.shoveX; this.shoveZ = s.shoveZ; this.jostleCd = s.jostleCd;
    this.eyeY = s.eyeY; this.bobY = s.bobY; this.gait = s.gait; this.jostles = s.jostles; this.thrownBy = s.thrownBy;
  }

  settleBody(): void {
    const m = this.motor;
    if (m !== null) {
      m.release();
      // a capsule lying level on a slope digs its uphill end in: lift it clear (gravity sets it down on the next steps)
      const y0 = this.feet.y;
      let free = false;
      let up = 0;
      for (let i = 0; i < 9; i++) {
        if (free) break;
        this.feet.y = y0 + up; free = m.setYaw(this.feet, this.heading); up += 0.1;
      }
      // standing in something (the hitching rail at the camp horse's nose): back out along the heading, up to 2 m
      const bx = -Math.sin(this.heading), bz = -Math.cos(this.heading);
      for (let i = 0; i < 14; i++) {
        if (free) break;
        this.feet.x += bx * 0.15; this.feet.z += bz * 0.15; this.feet.y = y0;
        free = m.setYaw(this.feet, this.heading);
      }
    }
    this.vy = 0; this.grounded = true; this.airT = -1;
    this.prevFeet.copy(this.feet); this.prevHeading = this.heading;
  }
  landBody(world: MountedWorld): void {
    const f = this.feet, physics = world.physics, heightAt = world.heightAt;
    if (physics === null) return;
    const top = floorBelow(physics, f.x, f.z, f.y + 2.5, 2.6, this.motor?.collider);
    if (top !== undefined && top > f.y) { f.y = top; this.onDeck = top - heightAt(f.x, f.z) > 0.3; }
  }
  private obstacleAhead(world: MountedWorld, scale: number): boolean {
    const physics = world.physics, m = this.motor;
    if (physics === null || m === null) return false;
    const f = this.feet, s = scale;
    const sx = Math.sin(this.heading), sz = Math.cos(this.heading);
    const reach = this.speed * mountJUMP_APEX_T;               // the centre is over the obstacle at the top of the arc
    mount_dir.x = sx; mount_dir.y = 0; mount_dir.z = sz;
    mount_from.x = f.x; mount_from.y = f.y + 0.7 * s; mount_from.z = f.z;
    const low = castRay(physics, mount_from, mount_dir, reach + 0.6, mountWORLD, m.collider);
    if (low !== null && low.material !== 'ground' && Math.abs(low.normal.y) < 0.5 && low.distance > reach - 0.9) {
      mount_from.y = f.y + 1.75 * s;
      const high = castRay(physics, mount_from, mount_dir, low.distance + 1.2, mountWORLD, m.collider);
      const land = floorBelow(physics, f.x + sx * (low.distance + 2.2), f.z + sz * (low.distance + 2.2), f.y + 2.5, 5, m.collider);
      return high === null && land !== undefined;
    }
    // a ditch / the brook: the ground drops a metre 2.4–3.4 m ahead and rises again 2 m past it
    for (let i = 0; i < 2; i++) {
      const d = i === 0 ? 2.4 : 3.4;
      const x = f.x + sx * d, z = f.z + sz * d;
      const g = floorBelow(physics, x, z, f.y + 1, 6, m.collider);
      if (g === undefined || g > f.y - 1.0) continue;
      const far = floorBelow(physics, x + sx * 2, z + sz * 2, f.y + 2, 8, m.collider);
      if (far !== undefined && far > g + 0.6) return true;
    }
    return false;
  }
  stepBody(dt: number, a: AnimalSim, p: MountedRider, world: MountedWorld): void {
    const HORSE_SPEED = this.bodySpeeds, heightAt = world.heightAt, waterLevel = world.waterLevel;
    const f = this.feet;
    this.prevFeet.copy(f); this.prevHeading = this.heading;
    // ── turning: the rate eases toward the rein; the body turns only where its nose and rump have room ──
    this.yawRate += (this.rateIn * this.maxRate() - this.yawRate) * Math.min(1, dt * mountTURN_EASE);
    let heading = this.breaking ? a.yaw : this.heading + this.yawRate * dt;   // the bucking spins the horse itself (Taming)
    heading = Math.atan2(Math.sin(heading), Math.cos(heading));
    if (heading !== this.heading) {
      if (this.motor === null || this.motor.setYaw(f, heading)) this.heading = heading;
      else this.yawRate = 0;                                                    // boxed in: the turn is refused
    }
    // inertia: speeding up takes its time (a canter in ~2.5 s, the gallop's last gear slower); letting go coasts down,
    // the reins (back) stop it in a couple of lengths
    const accel = this.target > this.speed ? (this.speed > HORSE_SPEED.canter - 0.5 ? mountACCEL_HI : mountACCEL) : this.skidT > 0 ? mountSKID : this.sector === -1 || this.target < 0 ? mountREIN : mountCOAST;
    // B1: the skid — the haunches down (the rear knob), until the horse stands
    if (this.skidT > 0) this.skidT = this.speed < 0.6 ? 0 : Math.max(0, this.skidT - dt);
    this.speed += MathUtils.clamp(this.target - this.speed, -accel * dt, accel * dt);
    // ── the jump: Space, or by itself at a canter+ over a rail / log / the brook a jump's reach ahead ──
    const wantJump = this.jumpQueued || (this.speed > 6 && this.grounded && this.obstacleAhead(world, a.scale));
    this.jumpQueued = false;
    if (wantJump && this.grounded && !this.breaking && !this.swimming) { this.vy = mountJUMP_V; this.grounded = false; this.airT = 0; }
    // on the ground no push down into it (the capsule's long flat underside snags on the ground's own contact if it
    // is pressed into it every step — the snap to ground takes it down slopes); in the air, gravity
    if (!this.grounded || this.vy > 0) this.vy -= mountGRAVITY * dt;
    // ── R3: the herd's shove fades ──
    const fade = Math.exp(-dt * 5);
    this.shoveX *= fade; this.shoveZ *= fade; this.jostleCd = Math.max(0, this.jostleCd - dt);
    // ── the move: the horse's climb limit by gait (47° at a walk → 35° at a gallop), then the motor ──
    const sx = Math.sin(this.heading), sz = Math.cos(this.heading);
    mount_want.x = (sx * this.speed + this.shoveX) * dt; mount_want.y = this.vy * dt; mount_want.z = (sz * this.speed + this.shoveZ) * dt;
    const m = this.motor;
    let grounded: boolean, freedom = 1;
    if (m !== null) {
      // by the gait the reins ask for (or the speed still carried): held at a gallop, a 40° bank stays refused — rein in
      // to a walk and the horse picks its way up
      const climbV = Math.max(Math.abs(this.speed), Math.abs(this.target));
      m.setClimb(MathUtils.lerp(mountCLIMB.walk, mountCLIMB.gallop, MathUtils.clamp((climbV - HORSE_SPEED.walk) / (HORSE_SPEED.gallop - HORSE_SPEED.walk), 0, 1)));
      const carried = this.grounded && m.carry(f);   // a deck that moves (none on Nalati yet): ride it first
      if (carried && this.vy <= 0) mount_want.y = 0;
      const r = m.move(f, mount_want, false);
      grounded = r.grounded; freedom = r.horizontalFreedom;
    } else {
      // no physics world (a node harness): the old ground follow, nothing stops it
      f.x += mount_want.x; f.z += mount_want.z; f.y = heightAt(f.x, f.z); grounded = true;
    }
    // on a deck: standing on a registered collider over the terrain (the Kunes bridge, a yurt's floor) — every Nalati
    // floor is real geometry since NALATI-MERGE P1, so the motor carries the horse on it (no floor functions left)
    this.onDeck = grounded && f.y - heightAt(f.x, f.z) > 0.3;
    // swimming: deeper than mountFORD_DEPTH the horse floats with its back dry (fording stays game code)
    const wl = waterLevel();
    this.swimming = f.y < wl - mountFORD_DEPTH && (world.wetAt?.(f.x, f.z) === true || heightAt(f.x, f.z) < wl);
    if (this.swimming) { f.y = wl - mountFORD_DEPTH; grounded = true; }
    // on a structure (a bridge deck, floor function or collider): the terrain under it is not what the hooves stand on, so
    // the body must not tilt to it — the Kunes bridge spans a gully and the horse pitched ~20° to the bank below, which
    // swung the seat (and the eye) forward over the neck: no head or ears in the frame on the bridge (NALATI-MERGE H4)
    a.levelGround = this.onDeck || f.y - heightAt(f.x, f.z) > 0.3;
    if (grounded && this.vy <= 0) {
      if (this.airT >= 0) this.bobY -= 0.12;                                     // the landing
      this.vy = 0; this.airT = -1;
    } else if (this.airT >= 0) this.airT += dt;
    this.grounded = grounded;
    // run into a wall: the gait drops to what the body actually made (no galloping in place against a fence) — once it
    // has held for a few steps, so one snag on a stone doesn't rein the horse in
    this.blockedT = freedom < 0.5 && Math.abs(this.speed) > 0.5 ? this.blockedT + dt : 0;
    if (this.blockedT > 0.06) {
      const made = Math.hypot(f.x - this.prevFeet.x, f.z - this.prevFeet.z) / dt;
      this.speed = Math.sign(this.speed) * Math.min(Math.abs(this.speed), made);
    }
    // ── R3: a stampeding horse against the rider: jostled; at a gallop, a hard hit throws you ──
    if (m !== null && this.jostleCd <= 0) {
      this.contactHorse = a; this.contactWorld = world; this.contactHit = null;
      try { m.touching(0.3, mountCREATURE, this.contact); }
      finally { this.contactHorse = null; this.contactWorld = null; }
      const hit = this.contactResult();
      if (hit !== null && this.jostleBody(hit)) { world.thrown(); return; }
    }
    // ── the horse follows exactly (Animal skips its own steering while driven; pose() places it) ──
    a.setMotion(this.heading, this.speed, 50);
    a.speed = this.speed;
    a.state = this.speed > 6 ? 'flee' : Math.abs(this.speed) > 0.2 ? 'wander' : 'idle';
    // the rear knob is a LEVEL (horse.ts eases toward it) and Mount owns it while you ride: the jump's take-off, the skid
    // sitting the horse back, the panic's first half-second — else 0. E320: the skid and the panic only ever raised it, so
    // after one the neck stood up in front of the rider's eye for good (the "cursed", face-on horse on the horse track)
    if (this.airT >= 0) {
      const u = this.airT / (2 * mountJUMP_APEX_T);
      a.mem['rear'] = u < 0.35 ? 0.35 : 0;
      if (u > 0.6 && u < 0.65) a.mem['kick'] = 1;
    } else if (!this.breaking) a.mem['rear'] = this.panicRear > 0 ? mountPANIC_REAR_POSE : this.skidT > 0 ? mountSKID_REAR : 0;
    // ── STEED ──
    this.gait = this.speed < 0.3 ? 'stand' : this.speed < 3 ? 'walk' : this.speed < 6.5 ? 'trot' : this.speed < 11 ? 'canter' : 'gallop';
    const rhythm = this.spur.latched;   // B1: a gallop the rhythm holds is almost free
    this.steed = MathUtils.clamp(this.steed + dt * (this.galloping && this.speed > 9 ? -(rhythm ? mountSTEED_RHYTHM : mountSTEED_GALLOP) : this.gait === 'canter' ? mountSTEED_CANTER : mountSTEED_WALK), 0, mountSTEED_MAX);
    // ── the rider rides along: the carrier velocity for the bow, no walk of his own ──
    this.vel.set(sx * this.speed, this.vy, sz * this.speed);
    p.velocity.copy(this.vel);
    p.onGround = true; p.sprinting = this.speed > 10; p.crouching = false; p.speedFactor = 0;
  }
  jostleBody(o: AnimalSim): boolean {
    this.jostleCd = mountJOSTLE_CD; this.jostles++;
    const ox = Math.sin(o.yaw) * o.speed, oz = Math.cos(o.yaw) * o.speed;
    const mx = Math.sin(this.heading) * this.speed, mz = Math.cos(this.heading) * this.speed;
    const closing = Math.hypot(ox - mx, oz - mz);
    let nx = this.feet.x - o.position.x, nz = this.feet.z - o.position.z;
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const k = Math.min(3.5, 0.8 + closing * 0.25);
    this.shoveX = nx * k + (ox - mx) * 0.15; this.shoveZ = nz * k + (oz - mz) * 0.15;
    this.jolt = Math.max(this.jolt, Math.min(1, 0.3 + closing / 14));
    this.speed *= 0.92;
    if (this.gait === 'gallop' && closing >= mountUNSEAT_CLOSING) {
      this.thrownBy = 'stampede';
      return true;
    }
    return false;
  }
  /** The shipping feet/eye-height projection, called once after fixed motion; it owns no camera or renderer. */
  placeRider(dt: number, alpha: number, a: AnimalSim, p: Pick<MountedRider, 'position'>, world: MountedWorld): number {
    const t = MathUtils.clamp(alpha, 0, 1);
    const pf = this.prevFeet, f = this.feet;
    const glide = pf.distanceToSquared(f) < 25;   // a teleport is not a glide
    const px = glide ? pf.x + (f.x - pf.x) * t : f.x, pz = glide ? pf.z + (f.z - pf.z) * t : f.z;
    let py = glide ? pf.y + (f.y - pf.y) * t : f.y;
    const heading = glide ? this.prevHeading + mountAngDiff(this.heading, this.prevHeading) * t : this.heading;
    // the hooves on the ground: the capsule rides on its lowest mountPoint, so on a slope its middle floats a little — draw the
    // horse on the floor under its middle (a physics query; decks and the jump keep the body's own height)
    const physics = world.physics;
    if (this.grounded && !this.onDeck && !this.swimming && this.airT < 0 && physics !== null && this.motor !== null) {
      const fl = floorBelow(physics, px, pz, py + 0.3, 0.9, this.motor.collider);
      if (fl !== undefined && fl < py) py = fl;
    }
    if (this.airT >= 0) this.eyeY = py; else this.eyeY += (py - this.eyeY) * Math.min(1, dt * 12);
    a.position.set(px, this.eyeY, pz);
    a.yaw = heading;
    p.position.set(px, this.eyeY, pz);
    return heading;
  }
}

/** Default platform grapple parameters; courses may supply an admitted authored profile. */
export const DEFAULT_GRAPPLE_MODE = v.parse(GrappleModeSchema, { id: 'grapple' });
/** Real hook roster and native visibility/guard ports; a mode profile grants no anchor or floor. */
export interface GrappleCourse {
  readonly mode?: GrappleMode;
  readonly name: string;
  /** the rings' centres, world space: what the claw bites */
  readonly hooks: readonly Vector3[];
  /** a hook the claw sees past something only this course knows (the Well's rail); a clear line of sight always counts */
  seePast?: (ports: GrapplePorts, eye: Vector3, hook: Vector3) => boolean;
  /** a zip from the feet at `from` to `landing` must lift before it pulls (the Well's crossing) */
  lifts?: (from: Vector3, landing: Vector3) => boolean;
  /** the height a lifting zip rises to, from the feet now toward the approach point */
  liftTo?: (from: Vector3, approach: Vector3) => number;
  /** a lifting zip starts (true) and every grapple ends (false): the Well's safety cap */
  guard?: (open: boolean) => void;
}

/** The body the claw pulls: the player's feet, velocity, ground flag and capsule (the client Player, or the host's). */
export interface GrappleBody {
  readonly position: Vector3;
  readonly velocity: Vector3;
  onGround: boolean;
  readonly motor: Pick<CharacterMotor, 'collider' | 'move'>;
}
/** What the claw asks of the world: the physics queries and the body it pulls. */
export interface GrapplePorts { readonly physics: Physics; readonly body: GrappleBody }

/**
 * The Fei Zhua's law, renderer-free (SF72): which hook the claw may bite (in reach, in sight, with a floor to land on),
 * where the zip lands and flies to, and the grapple's phases (fire → bite → lift → zip → vault → settle, or a miss
 * reeled back), stepped on the player's own capsule through the engine's physics queries. One implementation: the
 * browser's Tool (FeiZhua.ts) drives it from the LOCK / JUMP presses and its traversal answer and draws the rope, markers
 * and FX from its state; the headless runtime (runtime/grapple.ts) drives it from tick commands. Nothing here draws.
 *
 * The aim is a port (`GrappleView`): the browser's camera, or the headless player's eye and heading.
 */

/** Minimum native hook reach in metres. */
export const MIN_RANGE = 2.5;
/** Maximum native hook reach in metres. */
export const MAX_RANGE = 38;

/** Native claw flight wait in seconds. */
export const FIRE_TIME = 0.27;

/** Native reel wait in seconds. */
export const REEL_TIME = 0.48;
/** the centred window a hook must sit in to be the candidate (|ndc x|, |ndc y|) */
export const WIN_X = 0.52, WIN_Y = 0.68;
/** the player's capsule, feet to crown (Player.ts BODY_HEIGHT) plus a margin: the room a zip's approach point needs */
const grappleBODY = 1.95;

/** The aim: an eye, a screen projection (normalized device coordinates) and the look direction. */
export interface GrappleView {
  readonly eye: Vector3;
  /** refresh the view's matrices before a full test of every hook */
  update?: () => void;
  project: (point: Vector3, out: Vector3) => Vector3;
  forward: (out: Vector3) => Vector3;
}
/** A validated hook, real landing and native approach. */
export interface GrappleTarget { hook: Vector3; landing: Vector3; approach: Vector3; lifts: boolean }
/** Native traversal phase name. */
export type GrapplePhase = 'idle' | 'fire' | 'bite' | 'lift' | 'zip' | 'vault' | 'settle' | 'miss' | 'reel' | 'dock';
/** The phase changes the presentation follows (cues, arms, flashes, toasts); the law never waits on them. */
export interface GrappleEvents {
  fire?: () => void;
  miss?: () => void;
  bite?: () => void;
  zip?: () => void;
  reel?: () => void;
  dock?: () => void;
  /** every grapple ends here; `active` is whether it ended mid-flight (anything but idle or the dock) */
  release?: (active: boolean) => void;
}

const grappleUP = { x: 0, y: 1, z: 0 };
const grappleVToward = new Vector3(), grappleVSide = new Vector3(), grappleVProbe = new Vector3();

/** The claw sees a hook: a clear line of sight, or past what only the course knows (the fragment's Well rail). */
export function hookVisible(ports: GrapplePorts, course: GrappleCourse, eye: Vector3, hook: Vector3): boolean {
  if (lineOfSight(ports.physics, eye, hook, 1.1, ports.body.motor.collider)) return true;
  return course.seePast?.(ports, eye, hook) === true;
}

/** the capsule's footprint (Player.ts RADIUS 0.38 and a hair): four probes round the landing */
const grappleFOOT = [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]] as const;
/** a floor the capsule can stand on at (x, z): within a tread's rise across its whole width (a stair is; a rail's top, a
 *  balustrade's or the square's edge by the balustrade is not) */
function grappleStandable(ports: GrapplePorts, x: number, y: number, z: number): boolean {
  const body = ports.body.motor.collider;
  for (const [dx, dz] of grappleFOOT) {
    const f = floorBelow(ports.physics, x + dx, z + dz, y + 0.6, 1.2, body);
    if (f === undefined || Math.abs(f - y) > 0.4) return false;
  }
  return true;
}

// back steps from the ring toward the player first; then past it (a ring on a lip: the pull carries you over onto the
// floor behind it, E286's rim → square crossing)
const grappleBACKS = [1.2, 2, 2.8, 4, 6, -1.6, -2.4, -3.2, -4.2] as const;
const grappleSIDES = [0, -2, 2, -4, 4] as const;

/** where a landing was found: none (no safe zip target), between the player and the ring, or past the ring */
export const NONE = 0, NEAR = 1, PAST = 2;
/** Which side of the anchor holds the verified floor. */
export type Side = typeof NONE | typeof NEAR | typeof PAST;

/** The actual floor near a ring, approached from `from` (the player's feet), written to `out`. */
export function landingFor(ports: GrapplePorts, from: Vector3, hook: Vector3, out: Vector3): Side {
  grappleVToward.subVectors(from, hook).setY(0);
  if (grappleVToward.lengthSq() < 0.01) return NONE;
  grappleVToward.normalize();
  grappleVSide.set(-grappleVToward.z, 0, grappleVToward.x);
  const fromY = hook.y + 2;
  const body = ports.body.motor.collider;
  for (const back of grappleBACKS) {
    for (const sideStep of grappleSIDES) {
      grappleVProbe.copy(hook).addScaledVector(grappleVToward, back).addScaledVector(grappleVSide, sideStep);
      const floor = floorBelow(ports.physics, grappleVProbe.x, grappleVProbe.z, fromY, 12, body);
      if (floor === undefined || floor < hook.y - 9 || floor > hook.y + 1.8) continue;
      if (!grappleStandable(ports, grappleVProbe.x, floor, grappleVProbe.z)) continue;
      out.set(grappleVProbe.x, floor + 0.12, grappleVProbe.z);
      return back > 0 ? NEAR : PAST;
    }
  }
  return NONE;
}

/**
 * Where the zip flies to for a landing past the ring: over it at up to the ring's height (so it comes in over the lip the
 * ring hangs from, a rail or a balustrade, instead of through it) with room for the capsule under anything overhead,
 * then the player drops on. A landing on the player's side is flown to straight, as it always was.
 */
function grappleApproachFor(ports: GrapplePorts, hook: Vector3, landing: Vector3, out: Vector3): void {
  let clear = Math.min(1.6, Math.max(0, hook.y - landing.y - 0.2));
  if (clear > 0) {
    const hit = castRay(ports.physics, landing, grappleUP, clear + grappleBODY, ['WORLD'], ports.body.motor.collider);
    if (hit !== null) clear = Math.max(0, Math.min(clear, hit.distance - grappleBODY));
  }
  out.copy(landing);
  out.y += clear;
}

/** Build the native approach only from a verified landing. */
export function targetFor(ports: GrapplePorts, course: GrappleCourse, hook: Vector3, landing: Vector3, side: Side): GrappleTarget {
  const approach = landing.clone();
  if (side === PAST) grappleApproachFor(ports, hook, landing, approach);
  return { hook, landing: landing.clone(), approach, lifts: course.lifts?.(ports.body.position, landing) === true };
}

/** the full test of every hook, for the LOCK press when no candidate is cached (a one-off, not per frame) */
export function nearestHook(ports: GrapplePorts, course: GrappleCourse, view: GrappleView): GrappleTarget | null {
  view.update?.();
  const eye = view.eye;
  const landing = new Vector3(), p = new Vector3();
  let chosen: GrappleTarget | null = null, score = Infinity;
  for (const hook of course.hooks) {
    const mode = course.mode ?? DEFAULT_GRAPPLE_MODE;
    const d = eye.distanceTo(hook);
    if (d < mode.minRange || d > mode.maxRange) continue;
    view.project(hook, p);
    if (p.z < -1 || p.z > 1 || Math.abs(p.x) > mode.windowX || Math.abs(p.y) > mode.windowY) continue;
    const s = p.x * p.x + p.y * p.y * 0.55 + d * 0.0008;
    if (s >= score || !hookVisible(ports, course, eye, hook)) continue;
    const side = landingFor(ports, ports.body.position, hook, landing);
    if (side === NONE) continue;
    chosen = targetFor(ports, course, hook, landing, side);
    score = s;
  }
  return chosen;
}

/** The outcome of a LOCK press: nothing to do (fall through to the plain lock-on), held (a crossing in flight), let go, armed for a miss shot, or locked on a hook. */
export type LockResult = 'pass' | 'busy' | 'released' | 'armed' | 'locked';

interface Xyz { x: number; y: number; z: number }
/** The grapple's exact continuation (the phase clock, the target, the miss point). */
export interface GrappleSaved {
  phase: GrapplePhase; armedMiss: boolean; clock: number; blocked: number; liftY: number; missEnd: Xyz;
  target: { hook: Xyz; landing: Xyz; approach: Xyz; lifts: boolean } | null;
}
const grappleXyz = (point: Vector3): Xyz => ({ x: point.x, y: point.y, z: point.z });
const grappleVec = (p: Xyz): Vector3 => new Vector3(p.x, p.y, p.z);

/** The grapple's state machine: LOCK, JUMP (fire), the traversal step and the release. */
export class GrappleSim {
  phase: GrapplePhase = 'idle';
  target: GrappleTarget | null = null;
  armedMiss = false;
  clock = 0;
  readonly missEnd = new Vector3();
  course: GrappleCourse;
  private blocked = 0;
  private liftY = 0;
  private readonly ports: GrapplePorts;
  private readonly events: GrappleEvents;
  private readonly end = new Vector3();
  private readonly want = new Vector3();
  private readonly before = new Vector3();

  constructor(ports: GrapplePorts, course: GrappleCourse, events: GrappleEvents = {}) {
    this.ports = ports; this.course = course; this.events = events;
  }

  /** a crossing has started: the safety guard stays open until a safe landing or bailout, LOCK cannot let go */
  busy(): boolean { return this.phase !== 'idle' && this.phase !== 'miss' && this.phase !== 'reel' && this.phase !== 'dock'; }
  /** a hook is locked or the miss shot is armed */
  holding(): boolean { return this.target !== null || this.armedMiss; }

  release(): void {
    const active = this.phase !== 'idle' && this.phase !== 'dock';
    this.phase = 'idle'; this.target = null; this.armedMiss = false; this.clock = this.blocked = 0;
    this.course.guard?.(false);
    this.events.release?.(active);
  }

  /** the LOCK press: `candidate` is the cached pick (else the full test), `lockedOn` whether an enemy lock-on owns an empty LOCK */
  lock(view: GrappleView, candidate: () => GrappleTarget | null, lockedOn: () => boolean): LockResult {
    if (this.busy()) return 'busy';
    if (this.holding()) { this.release(); return 'released'; }
    const pick = candidate() ?? nearestHook(this.ports, this.course, view);
    if (pick === null) {
      if (lockedOn()) return 'pass';
      this.armedMiss = true;
      return 'armed';
    }
    this.target = pick;
    return 'locked';
  }

  /** the JUMP press: fire at the locked hook (or the armed miss shot along the view); false when nothing is held */
  fire(view: GrappleView): boolean {
    if (this.target === null && !this.armedMiss) return false;
    if (this.phase !== 'idle') return true;
    this.phase = 'fire'; this.clock = 0;
    const p = this.ports.body.position;
    if (this.target === null) {
      view.forward(this.want);
      this.missEnd.copy(view.eye).addScaledVector(this.want, 19);
      this.missEnd.y -= 1.2;
    } else if (this.target.lifts) {
      this.course.guard?.(true);
      this.liftY = this.course.liftTo?.(p, this.target.approach) ?? p.y + 3.5;
    }
    this.events.fire?.();
    return true;
  }

  /** one fixed step of a grapple in flight; true while it owns the body's move (the player's own walk waits) */
  traverse(dt: number): boolean {
    if (this.phase === 'idle') return false;
    this.clock += dt;
    const p = this.ports.body, target = this.target, want = this.want, before = this.before;
    if (this.phase === 'fire') {
      p.velocity.set(0, 0, 0);
      if (this.clock >= (this.course.mode ?? DEFAULT_GRAPPLE_MODE).fireTime) {
        this.clock = 0;
        if (target === null) { this.phase = 'miss'; this.events.miss?.(); }
        else { this.phase = 'bite'; this.events.bite?.(); }
      }
      return true;
    }
    if (this.phase === 'miss') { if (this.clock >= 0.16) { this.phase = 'reel'; this.clock = 0; this.events.reel?.(); } return false; }
    if (this.phase === 'reel') { if (this.clock >= (this.course.mode ?? DEFAULT_GRAPPLE_MODE).reelTime) { this.phase = 'dock'; this.clock = 0; this.events.dock?.(); } return false; }
    if (this.phase === 'dock') { if (this.clock >= 0.12) this.release(); return false; }
    if (target === null) { this.release(); return false; }
    if (this.phase === 'bite') {
      p.velocity.set(0, 0, 0);
      if (this.clock >= (this.course.mode ?? DEFAULT_GRAPPLE_MODE).biteTime) { this.phase = target.lifts ? 'lift' : 'zip'; this.clock = 0; p.onGround = false; this.events.zip?.(); }
      return true;
    }
    if (this.phase === 'lift') {
      const rise = Math.min(18 * dt, Math.max(0, this.liftY - p.position.y));
      before.copy(p.position);
      p.motor.move(p.position, want.set(0, rise, 0), true);
      p.velocity.subVectors(p.position, before).divideScalar(dt);
      p.onGround = false;
      if (p.position.y >= this.liftY - 0.2) { this.phase = 'zip'; this.clock = 0; }
      else if (this.clock > 0.6) { this.release(); }
      return true;
    }
    if (this.phase === 'vault') {
      // A short motor-driven pop clears the hook's lip; Rapier still owns collision.
      before.copy(p.position);
      p.motor.move(p.position, want.set(0, 0.7 * dt, 0), true);
      p.velocity.subVectors(p.position, before).divideScalar(dt);
      if (this.clock >= 0.14) { this.phase = 'settle'; this.clock = 0; }
      return true;
    }
    if (this.phase === 'settle') {
      p.velocity.set(0, -0.5, 0);
      if (this.clock >= 0.10) { this.release(); return false; }
      return true;
    }
    // the pull flies to the approach point over the landing; from there the player drops onto it
    this.end.copy(target.approach);
    want.subVectors(this.end, p.position);
    const remaining = want.length();
    if (remaining < 0.25) { this.phase = 'vault'; this.clock = 0; p.velocity.set(0, 0, 0); return true; }
    want.multiplyScalar(Math.min((this.course.mode ?? DEFAULT_GRAPPLE_MODE).zipSpeed * dt, remaining) / remaining);
    before.copy(p.position);
    p.motor.move(p.position, want, true);
    const moved = p.position.distanceTo(before);
    p.velocity.subVectors(p.position, before).divideScalar(dt);
    p.onGround = false;
    this.blocked = moved < want.length() * 0.15 ? this.blocked + dt : 0;
    if (this.blocked > 0.22 || this.clock > 2.5) { p.velocity.set(0, -0.5, 0); this.release(); }
    return true;
  }

  snapshot(): GrappleSaved {
    const t = this.target;
    return { phase: this.phase, armedMiss: this.armedMiss, clock: this.clock, blocked: this.blocked, liftY: this.liftY, missEnd: grappleXyz(this.missEnd),
      target: t === null ? null : { hook: grappleXyz(t.hook), landing: grappleXyz(t.landing), approach: grappleXyz(t.approach), lifts: t.lifts } };
  }
  /** restore a saved grapple; the course's guard is the caller's (open exactly while a lifting crossing is in flight: `guardOpen`) */
  /** the Well safety cap's state the grapple implies: open from a lifting crossing's fire to its release */
  guardOpen(): boolean { return this.phase !== 'idle' && this.target?.lifts === true; }
  restore(saved: GrappleSaved): void {
    this.phase = saved.phase; this.armedMiss = saved.armedMiss; this.clock = saved.clock; this.blocked = saved.blocked; this.liftY = saved.liftY;
    this.missEnd.set(saved.missEnd.x, saved.missEnd.y, saved.missEnd.z);
    const t = saved.target;
    this.target = t === null ? null : { hook: grappleVec(t.hook), landing: grappleVec(t.landing), approach: grappleVec(t.approach), lifts: t.lifts };
  }
}
