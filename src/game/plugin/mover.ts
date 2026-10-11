import { tagOf } from "@wildshard/engine/physics/surface";
import { CharacterMotor } from "@wildshard/engine/physics/CharacterMotor";
import type { Physics } from "@wildshard/engine/physics/Physics";
import { ENTRY_ASPHALT, ENTRY_WIDTH } from "@wildshard/engine/core/config";
import type { ShardProps } from "../shardfile/props";
import type { SocketLiftEntry } from "../shardfile/socketLift";
import type { EntryVertex } from "../shardfile/entryGeometry";
import { convexEntryHull as hull, entryCoverage as coverage } from "../shardfile/entryCoverage";
import { glbPoint, glbTransform } from "../shardfile/glbTriangles";
import * as v from "valibot";
import { SCRIPT_PARAMETER_QUERY, ScriptHost, type ScriptQuery } from "@wildshard/engine/script/host";
import { ScriptWorld } from "@wildshard/engine/script/effects";
import { scriptPhysicsQueries } from "@wildshard/engine/script/queries";
import type { World } from "@wildshard/engine/core/bootstrap";
import type { SimHost } from "@wildshard/engine/sim";
import type { LevelContext } from "@wildshard/engine/level/context";
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

/** Only admitted, permanently active collision rows may prove the static road-to-lift approach. */
export interface LiftApproachSource {
  props: ShardProps | null;
  targets: { panels: readonly { colliders: readonly string[] }[] };
}
type Point = readonly [number, number, number];
type Box = Extract<ShardProps['colliders'][number]['shapes'][number], { kind: 'box' }>;
const radius = 0.35, epsilon = 1e-9;
function boxTop(box: Box): EntryVertex[][] {
  const q = box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) };
  const matrix = glbTransform({ translation: [box.x, box.y, box.z], rotation: [q.x, q.y, q.z, q.w] });
  const at = (x: number, z: number) => glbPoint(matrix, { x, y: box.hy, z });
  const a = at(-box.hx, -box.hz), b = at(box.hx, -box.hz), c = at(-box.hx, box.hz), d = at(box.hx, box.hz);
  return [[a, b, c], [d, c, b]];
}
function staticTops(rows: readonly ShardProps['colliders'][number][]): EntryVertex[][] {
  return rows.flatMap(row => row.shapes.flatMap(shape => {
    if (shape.kind === 'box') return boxTop(shape);
    const dx = shape.to.x - shape.from.x, dz = shape.to.z - shape.from.z, run = Math.hypot(dx, dz) / shape.count, rise = (shape.to.y - shape.from.y) / shape.count;
    return Array.from({ length: shape.count }, (_unused, i) => {
      const f = (i + 0.5) / shape.count, hy = Math.max(0.01, rise * (i + 1) / 2);
      return boxTop({ kind: 'box', x: shape.from.x + dx * f, y: shape.from.y + hy, z: shape.from.z + dz * f, hx: shape.width / 2, hy, hz: run / 2, yaw: Math.atan2(dx, dz) });
    }).flat();
  })).filter(triangle => triangle.every(vertex => Math.abs(vertex.y) <= epsilon)).map(hull);
}
function ribbon(a: Point, b: Point, half: number): EntryVertex[] {
  const dx = b[0] - a[0], dz = b[2] - a[2], distance = Math.hypot(dx, dz);
  if (distance <= epsilon) return hull([-1, 1].flatMap(x => [-1, 1].map(z => ({ x: a[0] + x * half, y: 0, z: a[2] + z * half }))));
  const x = -dz / distance * half, z = dx / distance * half;
  return hull([{ x: a[0] + x, y: 0, z: a[2] + z }, { x: a[0] - x, y: 0, z: a[2] - z },
    { x: b[0] + x, y: 0, z: b[2] + z }, { x: b[0] - x, y: 0, z: b[2] - z }]);
}
/** Prove a full-width static mouth, continuous capsule corridor and the actual deck seam before allocating physics. */
export function validateLiftApproach(entry: SocketLiftEntry, deck: readonly EntryVertex[][], source: LiftApproachSource): void {
  const approach = entry.lift.approach; if (approach === undefined) return;
  const rows = approach.colliders.map(id => {
    if (id === entry.lift.mover || id === entry.lift.gate) throw new Error('Static approach collider cannot alias its moving deck or road gate');
    const row = source.props?.colliders.find(candidate => candidate.id === id);
    if (row === undefined || !row.initialActive || row.panel !== null || source.targets.panels.some(target => target.colliders.includes(id))) throw new Error('Static approach requires permanent active declared colliders');
    return row;
  });
  const first = approach.route[0], last = approach.route[approach.route.length - 1];
  if (first === undefined || last === undefined) throw new Error('Missing static approach route');
  const mouth: Point = [entry.edge === 'east' ? 235 : entry.edge === 'west' ? -235 : 0, 0, entry.edge === 'north' ? 235 : entry.edge === 'south' ? -235 : 0];
  if (!first.every((value, axis) => value === mouth[axis])) throw new Error('Static approach must start at the socket inner midpoint');
  let length = Math.hypot(last[0] - entry.lift.roadStop[0], last[2] - entry.lift.roadStop[2]);
  for (let i = 1; i < approach.route.length; i++) {
    const a = approach.route[i - 1], b = approach.route[i]; if (a !== undefined && b !== undefined) length += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  if (length > 32) throw new Error('Static approach route exceeds thirty-two metres');
  const surfaces = staticTops(rows), cover = coverage(surfaces);
  // The mouth strip extends inward only; the platform socket cannot prove any part of this landing.
  const inward: Point = [mouth[0] + (entry.edge === 'east' ? -radius : entry.edge === 'west' ? radius : 0), 0,
    mouth[2] + (entry.edge === 'north' ? -radius : entry.edge === 'south' ? radius : 0)];
  cover(ribbon(mouth, inward, 4), 'Static approach must cover the eight metre road-height mouth');
  for (let i = 0; i < approach.route.length; i++) {
    const point = approach.route[i]; if (point === undefined) continue;
    // At the mouth the socket supplies the outside half of the capsule; all subsequent joins are static ground.
    if (i > 0) cover(ribbon(point, point, radius), 'Static approach corridor lacks declared road-height ground');
    const next = approach.route[i + 1]; if (next !== undefined) cover(ribbon(point, next, radius), 'Static approach corridor lacks declared road-height ground');
  }
  const flatDeck = deck.filter(triangle => triangle.every(vertex => Math.abs(vertex.y) <= epsilon)).map(hull);
  coverage(flatDeck)(ribbon(entry.lift.roadStop, entry.lift.roadStop, radius), 'Socket lift deck must support the real capsule at its road stop');
  const dx = last[0] - entry.lift.roadStop[0], dz = last[2] - entry.lift.roadStop[2], distance = Math.hypot(dx, dz);
  // Only the boarding seam may have a gap: extrude the real deck by at most five centimetres toward the static endpoint.
  const seam = flatDeck.map(surface => hull([...surface, ...surface.map(vertex => ({ ...vertex,
    x: vertex.x + (distance <= epsilon ? 0 : dx / distance * 0.05), z: vertex.z + (distance <= epsilon ? 0 : dz / distance * 0.05) }))]));
  coverage([...surfaces, ...seam])(ribbon(last, entry.lift.roadStop, radius), 'Static approach boarding seam exceeds five centimetres');
}

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
  /** A grid cell's admitted product bytes by module hash (`runtimeProduct(...).assets.retained`): a module present here is
   *  read from them (hash-checked again by {@link createMoverHost}) instead of fetched a second time from `modules`. */
  admitted?: ReadonlyMap<string, Uint8Array>;
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
  let tick = 0, host = options.shared?.host;
  if (host === undefined) {
    const assets = new Map<string, Uint8Array>();
    for (const hash of new Set(options.data.map((row) => row.module))) {
      const present = options.admitted?.get(hash); if (present !== undefined) { assets.set(hash, present); continue; }
      const url = options.modules.get(hash); if (url === undefined) throw new Error('Missing mover module URL');
      const response = await fetch(url); if (!response.ok) throw new Error('Missing mover script'); assets.set(hash, new Uint8Array(await response.arrayBuffer()));
    }
    host = await createMoverHost(options.data, assets, scriptPhysicsQueries({ physics: world.physics, navigation: ctx.app.navmesh ?? { closestWalkable: () => null, findPath: () => null }, handle: () => undefined }));
  }
  if (ctx.scope.disposed) throw new Error('Mover scope left during admission');
  const runtime = new MoverRuntime(options.data, { physics: world.physics, scope: ctx.scope, host, adopt: (id) => options.views.get(id), activation: { ground: () => world.player.motor.result, ...options.activation } });
  const installedHost = host;
  ctx.system({ id: options.systemId, phase: 'fixed.pre', before: ['physics.movers'], run: () => {
    const current = options.shared === undefined ? ++tick : options.shared.tick(); if (options.shared === undefined) installedHost.beginTick(current);
    runtime.step(current, options.permissions?.());
  } });
  if (options.onDispose !== undefined) ctx.scope.onDispose(options.onDispose);
  ctx.debug.expose(`movers.${options.systemId}`, { showRest: () => { runtime.showRest(); } }); // the map bake poses movers at rest
  return runtime;
}

const moverFinite = v.pipe(v.number(), v.finite());
const moverNatural = v.pipe(moverFinite, v.integer(), v.minValue(0));
const headlessMoverSaved = v.strictObject({
  host: v.strictObject({ tick: v.pipe(moverFinite, v.integer(), v.minValue(-1)),
    used: v.strictObject({ effects: moverNatural, spawns: moverNatural, events: moverNatural, queries: moverNatural, fuel: moverNatural }),
    pending: v.array(v.strictObject({ type: moverNatural, target: moverNatural, value: moverFinite })),
    modules: v.array(v.strictObject({ name: v.string(), memory: v.array(moverNatural), globals: v.array(v.strictObject({ name: v.string(), type: v.picklist(['number', 'bigint']), value: v.string() })), failures: moverNatural, disabled: v.boolean() })) }),
  world: v.array(v.strictObject({ id: moverNatural, name: v.string(), position: v.tuple([moverFinite, moverFinite, moverFinite]), fields: v.record(v.string(), moverFinite), frozen: v.boolean(), interactive: v.boolean() })),
  movers: v.string(),
});

/** A headless platform installation exposes published poses and refused script calls. */
export interface HeadlessMovers { readonly runtime: MoverRuntime; failures: () => number }
/** Explicit native ownership; the getter follows replacement worlds after a restore. */
export interface HeadlessMoverPorts { physics: () => SimHost['physics']; scope: SimHost['scope']; restoring: boolean; activation?: MoverActivationPorts }
/** A caller-driven set owns its script host, entities and trusted permission table. */
export interface HeadlessMoverSet extends HeadlessMovers { host: ScriptHost; world: ScriptWorld; permissions: Map<string, number> }
/** Stable continuation identity and trusted permissions for a SimHost installation. */
export interface HeadlessMoverInstallation {
  systemId: string; restoring: boolean;
  initialPermissions?: ReadonlyMap<string, number>;
  permissions?: () => ReadonlyMap<string, number>;
  sharedState?: (field: number) => number | boolean | undefined;
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

/** Construct native movers without stepping; the caller explicitly owns the fixed clock. */
export function createHeadlessMovers(rows: MoverData, modules: ReadonlyMap<string, Uint8Array>, ports: HeadlessMoverPorts, initialPermissions: ReadonlyMap<string, number> = new Map()): HeadlessMoverSet {
  const data = parseMovers(rows);
  const world = new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(data));
  const physicsQuery: ScriptQuery = (kind, input, entity) => scriptPhysicsQueries({ physics: ports.physics(), navigation: { closestWalkable: () => null, findPath: () => null }, handle: () => undefined })(kind, input, entity);
  const host = new ScriptHost({ world, query: moverQueries(data, physicsQuery) });
  for (const hash of new Set(data.map(row => row.module))) {
    const bytes = modules.get(hash); if (bytes === undefined) throw new Error('Unverified mover module');
    host.install(hash, bytes);
  }
  const runtime = new MoverRuntime(data, { host, physics: ports.physics, scope: ports.scope, restoring: ports.restoring, ...(ports.activation === undefined ? {} : { activation: ports.activation }) });
  return { runtime, host, world, permissions: new Map(initialPermissions), failures: () => host.failureCount };
}

/** Advance the script clock, publish platform poses, then capture any native chains. */
export function stepHeadlessMovers(movers: Pick<HeadlessMoverSet, 'runtime' | 'host' | 'permissions'>, tick: number, permissions: ReadonlyMap<string, number> = movers.permissions): void {
  movers.host.beginTick(tick); movers.runtime.step(tick, permissions); movers.runtime.capture();
}

/** Install one fixed-step owner and preserve exact guest/native continuation without an installation tick. */
export function installHeadlessMovers(host: SimHost, rows: MoverData, modules: ReadonlyMap<string, Uint8Array>, options: HeadlessMoverInstallation): HeadlessMovers {
  const movers = createHeadlessMovers(rows, modules, { physics: () => host.physics, scope: host.scope, restoring: options.restoring, activation: { ground: () => host.hasPlayerMotor ? host.player.motor.result : undefined, ...(options.sharedState === undefined ? {} : { shared: options.sharedState }) } }, options.initialPermissions);
  host.onStep(options.systemId, () => { stepHeadlessMovers(movers, host.state.tick, options.permissions?.() ?? movers.permissions); }, {
    snapshot: () => JSON.stringify({ host: movers.host.checkpoint(), world: movers.world.state(), movers: movers.runtime.snapshotState() }),
    restore: value => {
      if (typeof value !== 'string') throw new Error('Invalid mover continuation');
      const saved = v.parse(headlessMoverSaved, JSON.parse(value));
      movers.host.restoreState(saved.host);
      movers.world.restore(saved.world.map(row => ({ ...row, fields: Object.fromEntries(Object.entries(row.fields).map(([key, field]) => [Number(key), field])) })));
      movers.runtime.restoreState(saved.movers);
    },
    physicsRestored: () => { movers.runtime.reconnect(); },
  });
  return { runtime: movers.runtime, failures: movers.failures };
}
