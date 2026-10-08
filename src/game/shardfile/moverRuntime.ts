import * as v from 'valibot';
import { SCRIPT_PARAMETER_QUERY, ScriptHost, type ScriptQuery } from '@wildshard/engine/script/host';
import { ScriptWorld } from '@wildshard/engine/script/effects';
import { scriptPhysicsQueries } from '@wildshard/engine/script/queries';
import type { World } from '@wildshard/engine/core/bootstrap';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { KinematicMover, type MoverPose } from '@wildshard/engine/physics/mover';
import { RopeChain } from '@wildshard/engine/physics/ropeChain';
import { MOVER_FIELDS, MOVER_FIELD_RANGES, moverScriptEntities, parseMovers, type MoverData } from './movers';

/** Transitional standalone composition; a full session injects its existing host and merges entities/rules/queries instead. */
export async function createMoverHost(data: MoverData, assets: ReadonlyMap<string, Uint8Array>, physicsQueries: ScriptQuery): Promise<ScriptHost> {
  const checked = parseMovers(data), modules: [string, Uint8Array][] = [];
  for (const hash of new Set(checked.map((m) => m.module))) {
    const bytes = assets.get(hash); if (bytes === undefined) throw new Error('Missing mover module');
    const copy = Uint8Array.from(bytes), digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
    if ([...digest].map((b) => b.toString(16).padStart(2, '0')).join('') !== hash) throw new Error('Mover module hash mismatch');
    modules.push([hash, copy]);
  }
  const host = new ScriptHost({ world: new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(checked)), query: moverQueries(checked, physicsQueries) });
  for (const [hash, bytes] of modules) host.install(hash, bytes);
  return host;
}

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
  permissions?: () => ReadonlyMap<string, number>;
  onDispose?: () => void;
}
/** The shared script host already owns modules, entity handles and one beginTick per fixed step. */
export interface MoverPorts { physics: Physics | (() => Physics); host: ScriptHost; scope: Scope; adopt?: (id: string) => MoverView | undefined; restoring?: boolean }
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
  private readonly physics: () => Physics;
  private readonly bodies = new Map<string, KinematicMover>();
  private bodyHandles = new Map<string, number>();
  private pending = new Map<string, number>();
  constructor(data: MoverData, ports: MoverPorts) {
    this.data = parseMovers(data); this.host = ports.host;
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
    return [tick, 1 / 60, this.pending.get(m.id) ?? 0, m.entity, permission, m.input.length, ...Object.values(MOVER_FIELDS).map(field => e.fields[field] ?? 0)];
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
  let tick = 0, host = options.shared?.host;
  if (host === undefined) {
    const assets = new Map<string, Uint8Array>();
    for (const hash of new Set(options.data.map((row) => row.module))) {
      const url = options.modules.get(hash); if (url === undefined) throw new Error('Missing mover module URL');
      const response = await fetch(url); if (!response.ok) throw new Error('Missing mover script'); assets.set(hash, new Uint8Array(await response.arrayBuffer()));
    }
    host = await createMoverHost(options.data, assets, scriptPhysicsQueries({ physics: world.physics, navigation: ctx.app.navmesh ?? { closestWalkable: () => null, findPath: () => null }, handle: () => undefined }));
  }
  if (ctx.scope.disposed) throw new Error('Mover scope left during admission');
  const runtime = new MoverRuntime(options.data, { physics: world.physics, scope: ctx.scope, host, adopt: (id) => options.views.get(id) });
  const installedHost = host;
  ctx.system({ id: options.systemId, phase: 'fixed.pre', before: ['physics.movers'], run: () => {
    const current = options.shared === undefined ? ++tick : options.shared.tick(); if (options.shared === undefined) installedHost.beginTick(current);
    runtime.step(current, options.permissions?.());
  } });
  if (options.onDispose !== undefined) ctx.scope.onDispose(options.onDispose);
  ctx.debug.expose(`movers.${options.systemId}`, { showRest: () => { runtime.showRest(); } }); // the map bake poses movers at rest
  return runtime;
}
