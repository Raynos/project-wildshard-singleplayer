// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads Pine's native bakes and the native physics module.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import source from '../../../src/shards/pine-hollow/shard.config';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { parseNavmesh, type Navmesh } from '../../../src/engine/physics/navmesh';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, prepareHeadlessRuntime } from '../../../src/shards/pine-hollow/runtime/headless';
import { PINE_ACT, PINE_INTERACT, pineSpots, type PineSpots } from '../../../src/shards/pine-hollow/runtime/quest';
import { LOOKOUT_TRAIL } from '../../../src/shards/pine-hollow/layout';
import { canonicalSimDigest } from '../../fake/simState';

/**
 * Pine Hollow's whole-shard witness (E435 §C / SF72), on its trusted renderer-free entry `runtime/headless.ts`, composed as
 * the platform's trusted adapter composes it (the plan's level and ports, one install, the tick's commands lent to the
 * runtime, its effects buffered per tick). The player's tape is tick commands only (`player` moves and `script` prompt
 * presses, `pine.interact`), chosen each tick from where the player stands: from the spawn on the south road to Hale on
 * the cabin's porch, the beaver dam's two logs and its glass, the pond's lantern, up the lookout's five flights to the
 * fire finder's flint, down to the ridge lantern, up again to the launch, the zipline to the Hollow and on to the den's
 * lantern. Nothing writes health, flags or positions: every outcome is gameplay. The night (the stag's walk, the Antler
 * King, the dawn) is the next lane's (progress/shard-platform/handoffs/sf72-pine.md).
 */
export const ENTRY = 'runtime/headless.ts';
const ROOT = new URL('../../../', import.meta.url);
const assets = new Map([PINE_TERRAIN_ASSET, PINE_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(new URL(path, ROOT)))] as const));
const EYE = 1.68;

/** One authoritative session: the host, the tick's lent commands and its committed effects. */
interface Session { host: SimHost; tape: readonly HeadlessCommand[]; effects: HeadlessEffect[]; tick: HeadlessEffect[] }
const requireValue = <T>(value: T | undefined | null, message: string): T => { if (value === undefined || value === null) throw new Error(message); return value; };
/** A continuation's hash: the snapshot in canonical form (test/fake/simState.ts). */
const digest = (host: SimHost): string => canonicalSimDigest(snapshotSimHost(host));

export function pineRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
export function pinePlan(rapier: Rapier): Promise<HeadlessRuntimePlan> { return Promise.resolve(prepareHeadlessRuntime({ shard: source, assets, rapier })); }

function context(session: Omit<Session, 'host'>, saved?: string): HeadlessRuntimeInstallation {
  return { restoring: saved !== undefined, ...(saved === undefined ? {} : { snapshot: decodeSimSnapshot(saved) }), commands: () => session.tape, emit: effect => { session.tick.push(effect); } };
}
function boot(plan: HeadlessRuntimePlan, rapier: Rapier): Session {
  const session = { tape: [] as readonly HeadlessCommand[], effects: [] as HeadlessEffect[], tick: [] as HeadlessEffect[] };
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  plan.install(host, context(session));
  if (session.tick.length > 0) throw new Error('Installation emitted gameplay effects');
  return Object.assign(session, { host });
}
/** A session restored from a snapshot wire (the replay leg). */
export function restore(plan: HeadlessRuntimePlan, rapier: Rapier, saved: string): Session {
  const session = { tape: [] as readonly HeadlessCommand[], effects: [] as HeadlessEffect[], tick: [] as HeadlessEffect[] }, ports = { ...plan.ports, rapier };
  const host = restoreSimHost(plan.level, ports, decodeSimSnapshot(saved), fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context(session, saved)); });
  if (session.tick.length > 0) throw new Error('Restore emitted gameplay effects');
  return Object.assign(session, { host });
}
/** One tick as the trusted adapter runs it (its last `player` command steps the host); only a completed tick commits its effects. */
function step(session: Session, commands: readonly HeadlessCommand[]): HeadlessEffect[] {
  session.tape = commands; session.tick = [];
  try {
    let player: HeadlessCommand | undefined;
    for (const command of commands) if (command.kind === 'player') player = command;
    session.host.step(player?.kind === 'player' ? { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw,
      ...(player.attack === undefined ? {} : { attack: player.attack }) } : undefined);
  } finally { session.tape = []; }
  if (![session.host.player.position, ...[...session.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
  session.effects.push(...session.tick); return session.tick;
}

type Point = readonly [number, number];
interface Spot { readonly x: number; readonly y: number; readonly z: number }
/** Where a tape is: resumable from a checkpoint exactly as the uninterrupted tape continues. */
export interface TapeState { leg: number; waypoint: number; ticks: number }
/**
 * One stretch of the tape. `go` walks through waypoints (fixed, from the walk baseline's legs, or the navmesh's route
 * between two points, computed once from the route's own points, never from where the player happens to stand); `act`
 * presses a prompt once the player's eye is in its reach; `ride` holds still while the zipline carries the player.
 */
type Leg =
  | { kind: 'go'; path: readonly Point[] }
  | { kind: 'act'; value: number; at: Spot; reach: number; done: (host: SimHost) => boolean }
  | { kind: 'ride' };

/** The walk baseline's legs (scripts/physics-route.json): the porch, the lookout's five flights. */
const PORCH: readonly Point[] = [[0, -190], [-8, -150], [-30, -95], [-12, -52], [-1, -40], [-5.71, -31.7], [-7.99, -35.02], [-9.56, -34.66], [-10.87, -34.18]];
const OFF_PORCH: readonly Point[] = [[-9.56, -34.66], [-7.99, -35.02], [-5.71, -31.7], [0, -10]];
const LOOKOUT_FOOT: Point = [41.23, 211.92];
/** the lookout trail's foot on the den spur (layout.ts LOOKOUT_TRAIL: one graded traverse up the ridge's face to the pad) */
const TRAIL_FOOT: Point = LOOKOUT_TRAIL[0] ?? [150, 142];
const CLIMB: readonly Point[] = [[38.48, 213.08], [37.3, 213.28], [34.19, 213.79], [34.35, 214.78], [37.81, 214.21], [37.65, 213.22], [34.19, 213.79], [34.35, 214.78],
  [37.81, 214.21], [37.65, 213.22], [34.34, 213.77], [34.19, 212.83], [34.78, 212.73], [34.53, 211.25], [35.53, 211.14]];
/** up the flights and out of the hatch into the cab (the fire finder's flint; the door to the catwalk and the launch is next) */
const CAB = CLIMB.slice(0, 13);
const reverse = (path: readonly Point[]): Point[] => [...path].reverse();

/** The navmesh's walkable route between two ground points for the player's capsule (string-pulled corners). */
function navPath(nav: Navmesh, heightAt: (x: number, z: number) => number, from: Point, to: Point): Point[] {
  const out = nav.findPath({ x: from[0], y: heightAt(from[0], from[1]), z: from[1] }, { x: to[0], y: heightAt(to[0], to[1]), z: to[1] }, 0.4);
  if (out === null) throw new Error(`No navmesh route ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  return [...out.slice(1).map((p): Point => [p.x, p.z]), to];
}

function route(spots: PineSpots, nav: Navmesh, heightAt: (x: number, z: number) => number): Leg[] {
  const row = (id: string): Spot => requireValue(spots.rows.find(r => r.id === id)?.prompt, `missing prompt ${id}`);
  const logA = row('dam-log-a'), logB = row('dam-log-b'), glass = row('pond-glass'), flint = row('ridge-flint');
  const { talk, lanterns, zip } = spots;
  const walk = (from: Point, to: Point): Leg => ({ kind: 'go', path: navPath(nav, heightAt, from, to) });
  const act = (value: number, at: Spot, reach: number, flag: string): Leg => ({ kind: 'act', value, at, reach, done: host => host.flags.has(flag) });
  // the stands: a step short of each prompt, on its open side
  const atLogA: Point = [logA.x + 1.2, logA.z - 0.8], atLogB: Point = [logB.x - 1.2, logB.z - 0.8], atGlass: Point = [glass.x + 1.2, glass.z + 0.6];
  const atPond: Point = [lanterns.pond.x + 1.2, lanterns.pond.z - 0.6], atRidge: Point = [lanterns.ridge.x - 1.4, lanterns.ridge.z - 0.8];
  const atDen: Point = [lanterns.den.x - 1.2, lanterns.den.z - 1.2], landing: Point = [zip.landing.x, zip.landing.z];
  return [
    // 1. up the south road to the ranger's cabin and onto its porch; Hale
    { kind: 'go', path: PORCH }, act(PINE_ACT.talk, talk, talk.radius, 'talked:ranger'),
    // 2. off the porch and west to the beaver dam: both logs off, the sluice's glass
    { kind: 'go', path: OFF_PORCH }, walk(OFF_PORCH[OFF_PORCH.length - 1] ?? [0, -10], atLogA), act(PINE_ACT.logA, logA, 2.5, 'lever:dam-log-a'),
    walk(atLogA, atLogB), act(PINE_ACT.logB, logB, 2.5, 'lever:dam-log-b'),
    walk(atLogB, atGlass), act(PINE_ACT.glass, glass, 2.5, 'taken:pond-glass'),
    // 3. the pond's lantern
    walk(atGlass, atPond), act(PINE_ACT.pond, lanterns.pond, lanterns.pond.radius, 'lit:pond'),
    // 4. the lookout: up the five flights to the fire finder's flint, down to the ridge lantern
    walk(atPond, TRAIL_FOOT), { kind: 'go', path: [...LOOKOUT_TRAIL.slice(1, -1), LOOKOUT_FOOT, ...CAB] }, act(PINE_ACT.flint, flint, 2.5, 'taken:ridge-flint'),
    { kind: 'go', path: [[34.3, 213.0], ...reverse(CAB).slice(1), LOOKOUT_FOOT, atRidge] }, act(PINE_ACT.ridge, lanterns.ridge, lanterns.ridge.radius, 'lit:ridge'),
    // 5. up again to the launch; the zipline down to the Hollow
    { kind: 'go', path: [LOOKOUT_FOOT, ...CLIMB] }, act(PINE_ACT.zip, zip.prompt, zip.prompt.radius, 'used:ph-zip'), { kind: 'ride' },
    // 6. east past Old Blackpaw's cave to the den's lantern
    walk(landing, atDen), act(PINE_ACT.den, lanterns.den, lanterns.den.radius, 'lit:den'),
  ];
}

const ARRIVE = 0.6, LEG_LIMIT = 60 * 240;
const move = (moveX: number, moveZ: number, yaw: number): HeadlessCommand => ({ kind: 'player', moveX, moveZ, yaw });
/**
 * The tape: a closed loop over where the player stands, one tick's commands at a time. A `go` leg steers straight at its
 * next waypoint at full stick; an `act` leg first walks the eye into the prompt's reach, then presses it until its flag
 * holds (one press a tick, as a player's [E]).
 */
export class PineTape {
  private readonly legs: Leg[];
  private leg = 0;
  private waypoint = 0;
  private ticks = 0;
  readonly log: { leg: number; kind: string; tick: number; x: number; y: number; z: number }[] = [];
  constructor(legs: Leg[], from?: TapeState) { this.legs = legs; if (from !== undefined) ({ leg: this.leg, waypoint: this.waypoint, ticks: this.ticks } = from); }
  get state(): TapeState { return { leg: this.leg, waypoint: this.waypoint, ticks: this.ticks }; }
  get walked(): boolean { return this.leg >= this.legs.length; }
  next(host: SimHost): HeadlessCommand[] {
    const leg = this.legs[this.leg];
    if (leg === undefined) return [{ kind: 'player', moveX: 0, moveZ: 0, yaw: host.player.yaw }];
    this.ticks++;
    if (this.ticks > LEG_LIMIT) throw new Error(`The tape is stuck on leg ${String(this.leg)} (${leg.kind}, waypoint ${String(this.waypoint)}) at ${host.player.position.toArray().map(n => n.toFixed(2)).join(', ')}`);
    const commands = this.play(host, leg);
    if (commands === null) { this.done(host, leg); return this.next(host); }
    return commands;
  }
  private done(host: SimHost, leg: Leg): void {
    const p = host.player.position;
    this.log.push({ leg: this.leg, kind: leg.kind, tick: host.state.tick, x: p.x, y: p.y, z: p.z });
    this.leg++; this.waypoint = 0; this.ticks = 0;
  }
  private play(host: SimHost, leg: Leg): HeadlessCommand[] | null {
    const p = host.player.position;
    switch (leg.kind) {
      case 'go': {
        const target = leg.path[this.waypoint];
        if (target === undefined) return null;
        const dx = target[0] - p.x, dz = target[1] - p.z, d = Math.hypot(dx, dz);
        if (d < ARRIVE) { this.waypoint++; return this.play(host, leg); }
        return [move(dx / d, dz / d, Math.atan2(-dx, -dz))];
      }
      case 'act': {
        if (leg.done(host)) return null;
        const eye = new Vector3(p.x, p.y + EYE, p.z), d = eye.distanceTo(new Vector3(leg.at.x, leg.at.y, leg.at.z));
        if (d < leg.reach - 0.2) return [{ kind: 'script', actorId: PINE_INTERACT, value: leg.value }, move(0, 0, host.player.yaw)];
        const dx = leg.at.x - p.x, dz = leg.at.z - p.z, h = Math.max(1e-6, Math.hypot(dx, dz));
        return [move(dx / h, dz / h, Math.atan2(-dx, -dz))];
      }
      case 'ride': return host.flags.has('used:ph-zip') ? null : [move(0, 0, host.player.yaw)];
      default: return null;
    }
  }
}

/** The tape over Pine's route, from its first leg or where a checkpoint left it. */
export function pineTape(plan: HeadlessRuntimePlan, from?: TapeState): PineTape {
  const bytes = requireValue(assets.get(PINE_NAVMESH_ASSET), 'navmesh'), nav = requireValue(parseNavmesh(bytes.slice().buffer), 'navmesh parse');
  nav.datum = () => 0;
  const heightAt = requireValue(plan.ports?.heightAt, 'height query');
  return new PineTape(route(pineSpots(), nav, heightAt), from);
}

const facts = (effects: readonly HeadlessEffect[]): string[] => effects.flatMap(effect => effect.kind === 'fact' ? [`${effect.name}/${effect.actorId}`] : []);

/** The day's legs: the spawn to the den's lantern, by the tape alone (16,955 ticks at 2026-10-09; the quest then waits on the stag). */
export async function dayProof(rapier: Rapier, limit = 20_000): Promise<object> {
  const plan = await pinePlan(rapier), session = boot(plan, rapier), tape = pineTape(plan);
  try {
    for (let i = 0; i < limit && !tape.walked; i++) step(session, tape.next(session.host));
    const host = session.host, quest = host.quests.find(q => q.def.id === 'wardens-hollow');
    return { status: tape.walked ? 'passed' : 'failed', at: host.player.position.toArray().map(n => Number(n.toFixed(2))), tape: tape.state, ticksExecuted: host.state.tick, step: quest?.current?.id ?? null, hash: digest(host),
      facts: facts(session.effects), legs: tape.log.map(row => ({ leg: row.kind, tick: row.tick, at: [row.x, row.y, row.z].map(n => Number(n.toFixed(2))) })) };
  } finally { session.host.dispose(); }
}
