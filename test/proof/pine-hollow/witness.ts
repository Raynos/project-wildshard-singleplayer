// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads Pine's native bakes and the native physics module.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Committed gameplay checkpoints are compressed native save wires.
import { gunzipSync, gzipSync } from 'node:zlib';
import { Vector3 } from 'three';
import * as v from 'valibot';
import source from '../../../src/shards/pine-hollow/shard.config';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { parseNavmesh, type Navmesh } from '../../../src/engine/physics/navmesh';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { PINE_NAVMESH_ASSET, PINE_TERRAIN_ASSET, prepareHeadlessRuntime } from '../../../src/shards/pine-hollow/runtime/headless';
import { PINE_ACT, PINE_INTERACT, QUEST_STEP, pineSpots, type PineSpots } from '../../../src/shards/pine-hollow/runtime/quest';
import { PinePackSchema } from '../../../src/shards/pine-hollow/runtime/pack';
import { KINGS_CLEARING, LOOKOUT_TRAIL } from '../../../src/shards/pine-hollow/layout';
import { STAG_PATH } from '../../../src/shards/pine-hollow/quest/stagWalk';
import { QUEST_DONE } from '../../../src/shards/pine-hollow/quest/wardensHollow';
import { KING_RECORD, KING_STEP } from '../../../src/shards/pine-hollow/runtime/king';
import { LEVER_FLAG, LOADOUT_STEP, PINE_WEAPON, WEAPON_COMMAND } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLoadout';
import { LEVER_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessLever';
import { CROSSBOW_STEP } from '../../../src/shards/pine-hollow/runtime/weapons/headlessCrossbow';
import { AIM_COMMAND, AIM_RIBS } from '../../../src/shards/pine-hollow/runtime/weapons/headlessRanged';
import { canonicalSimDigest } from '../../fake/simState';
import { SaveStore, type SaveStorage } from '../../../src/engine/saves/store';
import { Ledger, LedgerEmitter, type LedgerReceipt } from '../../../src/game/ledger';

/**
 * Pine Hollow's whole-shard witness (E435 §C / SF72), on its trusted renderer-free entry `runtime/headless.ts`, composed as
 * the platform's trusted adapter composes it (the plan's level and ports, one install, the tick's commands lent to the
 * runtime, its effects buffered per tick). The player's tape is tick commands only (`player` moves and `script` prompt
 * presses, `pine.interact`), chosen each tick from where the player stands: from the spawn on the south road to Hale on
 * the cabin's porch, the beaver dam's two logs and its glass, the pond's lantern, up the lookout's five flights to the
 * fire finder's flint, down to the ridge lantern, up again to the launch, the zipline to the Hollow and on to the den's
 * lantern. Nothing writes health, flags or positions: every outcome is gameplay. The night (the stag's walk, the Antler
 * King and dawn) are walked on the same tape, with the remaining systems listed in OPEN.
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

function context(session: Omit<Session, 'host'>, saved?: SimSnapshot): HeadlessRuntimeInstallation {
  return { restoring: saved !== undefined, ...(saved === undefined ? {} : { snapshot: saved }), commands: () => session.tape, emit: effect => { session.tick.push(effect); } };
}
function boot(plan: HeadlessRuntimePlan, rapier: Rapier): Session {
  const session = { tape: [] as readonly HeadlessCommand[], effects: [] as HeadlessEffect[], tick: [] as HeadlessEffect[] };
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  plan.install(host, context(session));
  if (session.tick.length > 0) throw new Error('Installation emitted gameplay effects');
  return Object.assign(session, { host });
}
/** A session restored from a snapshot wire (the replay leg). */
export function restore(plan: HeadlessRuntimePlan, rapier: Rapier, saved: SimSnapshot): Session {
  const session = { tape: [] as readonly HeadlessCommand[], effects: [] as HeadlessEffect[], tick: [] as HeadlessEffect[] }, ports = { ...plan.ports, rapier };
  const host = restoreSimHost(plan.level, ports, saved, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context(session, saved)); });
  if (session.tick.length > 0) throw new Error('Restore emitted gameplay effects');
  return Object.assign(session, { host });
}
/** One tick as the trusted adapter runs it (its last `player` command steps the host); only a completed tick commits its effects. */
function step(session: Session, commands: readonly HeadlessCommand[]): HeadlessEffect[] {
  session.tape = commands; session.tick = [];
  try {
    let player: HeadlessCommand | undefined;
    for (const command of commands) if (command.kind === 'player') player = command;
    session.host.step(player?.kind === 'player' ? { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw, ...(player.attack === undefined ? {} : { attack: player.attack }),
      ...(player.hover === undefined ? {} : { hover: player.hover }), ...(player.jump === undefined ? {} : { jump: player.jump }), ...(player.dodge === undefined ? {} : { dodge: player.dodge }) } : undefined);
  } finally { session.tape = []; }
  if (![session.host.player.position, ...[...session.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
  session.effects.push(...session.tick); return session.tick;
}

type Point = readonly [number, number];
interface Spot { readonly x: number; readonly y: number; readonly z: number }
/** Where a tape is: resumable from a checkpoint exactly as the uninterrupted tape continues. */
export interface TapeState { leg: number; waypoint: number; ticks: number; best: number; stall: number }
/**
 * One stretch of the tape. `go` walks through waypoints (fixed, from the walk baseline's legs, or the navmesh's route
 * between two points, computed once from the route's own points, never from where the player happens to stand); `act`
 * presses a prompt once the player's eye is in its reach; `ride` holds still while the zipline carries the player.
 */
type Leg =
  | { kind: 'go'; path: readonly Point[] }
  | { kind: 'act'; value: number; at: Spot; reach: number; done: (host: SimHost) => boolean }
  | { kind: 'ride' }
  | { kind: 'wait'; until: (host: SimHost) => boolean }
  | { kind: 'king' };

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
/** the road below the porch, and the stag's first bend on the west road */
const OFF_ROAD: Point = OFF_PORCH[OFF_PORCH.length - 1] ?? [0, -10], STAG_FIRST: Point = [STAG_PATH[0]?.[0] ?? 30, STAG_PATH[0]?.[1] ?? -2];
/** the host's day clock's night (0 day … 1 night) */
const night = (host: SimHost): number => host.dayClock?.night ?? 0;

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
  const act = (value: number, at: Spot, reach: number, flag: string): Extract<Leg, { kind: 'act' }> => ({ kind: 'act', value, at, reach, done: host => host.flags.has(flag) });
  // the stands: a step short of each prompt, on its open side
  const atLogA: Point = [logA.x + 1.2, logA.z - 0.8], atLogB: Point = [logB.x - 1.2, logB.z - 0.8], atGlass: Point = [glass.x + 1.2, glass.z + 0.6];
  const atPond: Point = [lanterns.pond.x + 1.2, lanterns.pond.z - 0.6], atRidge: Point = [lanterns.ridge.x - 1.4, lanterns.ridge.z - 0.8];
  const atDen: Point = [lanterns.den.x - 1.2, lanterns.den.z - 1.2], landing: Point = [zip.landing.x, zip.landing.z];
  return [
    // 1. up the south road to the ranger's cabin and onto its porch; Hale
    { kind: 'go', path: PORCH }, act(PINE_ACT.talk, talk, talk.radius, 'talked:ranger'),
    // the lever-action off its pegs inside the cabin (its pickup selects it)
    act(PINE_ACT.rifle, spots.rifle, spots.rifle.radius, LEVER_FLAG),
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
    // 7. finish Hale's watch dialogue. Its completion starts the night clock and immediately consumes wait:night.
    walk(atDen, OFF_ROAD), { kind: 'go', path: reverse(OFF_PORCH).slice(1) }, { kind: 'act', value: PINE_ACT.talk, at: talk, reach: talk.radius,
      done: host => night(host) > 0.5 || v.parse(v.object({ fast: v.nullable(v.unknown()) }), host.adapters.get(QUEST_STEP)?.snapshot()).fast !== null },
    { kind: 'wait', until: host => night(host) > 0.5 },
    // 8. off the porch and down the west road after the Ghost Stag, bend to bend, into the stones
    { kind: 'go', path: OFF_PORCH }, walk(OFF_ROAD, STAG_FIRST), ...STAG_PATH.slice(1).map((bend, i) => walk(STAG_PATH[i] ?? STAG_FIRST, [bend[0], bend[1]])),
    { kind: 'wait', until: host => host.flags.has('followed:stag') },
    // 9. the Antler King, by weapon play; 10. the dawn
    { kind: 'king' }, { kind: 'wait', until: host => host.flags.has(QUEST_DONE) },
  ];
}

const ARRIVE = 0.6, LEG_LIMIT = 60 * 90, STALL = 45, SIDESTEP = 90;
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
  /** a `go` leg's nearest approach to its waypoint and the ticks since it last closed in (a body in the way: step round it) */
  private best = Number.MAX_VALUE;
  private stall = 0;
  readonly log: { leg: number; kind: string; tick: number; x: number; y: number; z: number }[] = [];
  constructor(legs: Leg[], from?: TapeState) { this.legs = legs; if (from !== undefined) ({ leg: this.leg, waypoint: this.waypoint, ticks: this.ticks, best: this.best, stall: this.stall } = from); }
  get state(): TapeState { return { leg: this.leg, waypoint: this.waypoint, ticks: this.ticks, best: this.best, stall: this.stall }; }
  get walked(): boolean { return this.leg >= this.legs.length; }
  /** the current leg's kind (null: walked) */
  get current(): Leg['kind'] | null { return this.legs[this.leg]?.kind ?? null; }
  next(host: SimHost): HeadlessCommand[] {
    const leg = this.legs[this.leg];
    if (leg === undefined) return [{ kind: 'player', moveX: 0, moveZ: 0, yaw: host.player.yaw }];
    // a creature hunting the player (a bear's pursuit, a boar's charge) is shot down with the crossbow before the tape goes on
    if (leg.kind !== 'ride' && leg.kind !== 'king') { const defend = defence(host); if (defend !== null) return defend; }
    this.ticks++;
    if (this.ticks > LEG_LIMIT) throw new Error(`The tape is stuck on leg ${String(this.leg)} (${leg.kind}, waypoint ${String(this.waypoint)}) at ${host.player.position.toArray().map(n => n.toFixed(2)).join(', ')} (health ${String(host.player.health.attributes.health)}, night ${night(host).toFixed(2)})`);
    const commands = this.play(host, leg);
    if (commands === null) { this.done(host, leg); return this.next(host); }
    return commands;
  }
  private done(host: SimHost, leg: Leg): void {
    const p = host.player.position;
    this.log.push({ leg: this.leg, kind: leg.kind, tick: host.state.tick, x: p.x, y: p.y, z: p.z });
    this.leg++; this.waypoint = 0; this.ticks = 0; this.best = Number.MAX_VALUE; this.stall = 0;
  }
  private play(host: SimHost, leg: Leg): HeadlessCommand[] | null {
    const p = host.player.position;
    switch (leg.kind) {
      case 'go': {
        const target = leg.path[this.waypoint];
        if (target === undefined) return null;
        const dx = target[0] - p.x, dz = target[1] - p.z, d = Math.hypot(dx, dz);
        if (d < ARRIVE) { this.waypoint++; this.best = Number.MAX_VALUE; this.stall = 0; return this.play(host, leg); }
        if (d < this.best - 0.05) { this.best = d; this.stall = 0; } else this.stall++;
        // held up (a creature's body across the way): a second and a half to the left of the line, then to the right
        if (this.stall > STALL) {
          if (this.stall > STALL + 2 * SIDESTEP) { this.stall = 0; this.best = Number.MAX_VALUE; }
          const side = this.stall > STALL + SIDESTEP ? -1 : 1, sx = dx / d * 0.4 - dz / d * side, sz = dz / d * 0.4 + dx / d * side, sl = Math.hypot(sx, sz);
          return [move(sx / sl, sz / sl, Math.atan2(-dx, -dz))];
        }
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
      case 'wait': return leg.until(host) ? null : [move(0, 0, host.player.yaw)];
      case 'king': return host.flags.has(KING_RECORD.defeated) ? null : kingPlay(host);
      default: return null;
    }
  }
}

const LoadoutRow = v.object({ held: v.number() });
const KingRow = v.object({ boss: v.object({ state: v.string(), phase: v.number(), attempts: v.number() }),
  fight: v.object({ king: v.nullable(v.string()), mode: v.string(), open: v.number(), waves: v.array(v.object({ r: v.number(), on: v.boolean(), delay: v.number() })),
    thralls: v.array(v.object({ a: v.string(), mode: v.string() })) }) });
/** The King's encounter and fight as the boss row continues them (what a player sees: his state, his root rings, his thralls). */
export function kingRow(host: SimHost): v.InferOutput<typeof KingRow> {
  const saved = host.adapters.get(KING_STEP)?.snapshot();
  if (typeof saved !== 'string') throw new Error('Missing the King\'s continuation');
  return v.parse(KingRow, (JSON.parse(saved) as { boss: unknown; fight: unknown }));
}
const LeverRow = v.object({ tube: v.number(), chambered: v.boolean(), phase: v.string(), reserve: v.number() });
const lever = (host: SimHost): v.InferOutput<typeof LeverRow> => v.parse(LeverRow, host.adapters.get(LEVER_STEP)?.snapshot());
/** the King's band: out of his antlers' sweep (7.1 m) and short of the stones' soft wall (27.5 m round the clearing) */
const NEAR = 10, FAR = 15, RING = 21, JUMP_AHEAD = 2.4;
/** Aim at the native cage point; the ordinary ray still chooses the first collision surface. */
const RIBS = AIM_RIBS;
/**
 * The King by weapon play, a tick at a time from what the player sees: into the stones; then a band round him (out of his
 * sweep, inside the ring), circling so his lanes miss; a jump over each root ring as it reaches the player; the lever-action
 * fired at him (a thrall that closes in first) while the action is idle (an empty trigger reloads), the crossbow once its
 * rounds are spent.
 */
function kingPlay(host: SimHost): HeadlessCommand[] {
  const p = host.player.position, row = kingRow(host), C = KINGS_CLEARING;
  const king = row.fight.king === null ? undefined : host.entities.get(row.fight.king);
  const cx = C.x - p.x, cz = C.z - p.z, toCentre = Math.hypot(cx, cz);
  if (king === undefined || row.boss.state !== 'fight') {
    // into the stones (the fog seals at 22 m) and wait out his intro
    if (toCentre > 14) return [move(cx / toCentre, cz / toCentre, Math.atan2(-cx, -cz))];
    const kx = (king?.position.x ?? C.x) - p.x, kz = (king?.position.z ?? C.z) - p.z;
    return [move(0, 0, Math.atan2(-kx, -kz))];
  }
  const kx = king.position.x - p.x, kz = king.position.z - p.z, d = Math.max(1e-6, Math.hypot(kx, kz));
  // radial: hold the band; tangential: circle him; inward when near the soft wall
  const radial = d < NEAR ? -1 : d > FAR ? 1 : 0;
  let mx = (kx / d) * radial + (-kz / d) * 0.9, mz = (kz / d) * radial + (kx / d) * 0.9;
  if (toCentre > RING) { mx += (cx / toCentre) * 1.5; mz += (cz / toCentre) * 1.5; }
  const m = Math.max(1e-6, Math.hypot(mx, mz));
  // a root ring about to reach the player: jump it
  const jump = row.fight.waves.some(w => w.on && w.delay <= 0 && d - w.r > 0 && d - w.r < JUMP_AHEAD);
  // the target: a thrall within 12 m, else the King
  let target: { id: string; x: number; z: number } = { id: king.entityId, x: king.position.x, z: king.position.z };
  for (const th of row.fight.thralls) {
    const a = host.entities.get(th.a);
    if (a !== undefined && a.alive && Math.hypot(a.position.x - p.x, a.position.z - p.z) < 12) { target = { id: a.entityId, x: a.position.x, z: a.position.z }; break; }
  }
  const tx = target.x - p.x, tz = target.z - p.z, yaw = Math.atan2(-tx, -tz), gun = lever(host);
  const spent = gun.reserve === 0 && gun.tube === 0 && !gun.chambered;
  const commands: HeadlessCommand[] = [];
  const held = v.parse(LoadoutRow, host.adapters.get(LOADOUT_STEP)?.snapshot()).held, want = spent ? PINE_WEAPON.crossbow : PINE_WEAPON.lever;
  if (held !== want) commands.push({ kind: 'script', actorId: WEAPON_COMMAND, value: want });
  // the King only into his open ribcage (×3; shut ×0.6, the bark ×0.25), aimed at it; a thrall at its middle
  const ready = spent || gun.phase === 'idle', onKing = target.id === king.entityId;
  // An empty trigger starts the page's reload; waiting for a chambered round would deadlock the tape.
  const fire = ready && (!onKing || !gun.chambered || row.fight.open > 0.5);
  if (fire && onKing) commands.push({ kind: 'script', actorId: AIM_COMMAND, value: RIBS });
  commands.push({ kind: 'player', moveX: mx / m, moveZ: mz / m, yaw, ...(fire ? { attack: { targetId: target.id } } : {}), ...(jump && host.playerFall.grounded ? { jump: true } : {}) });
  return commands;
}

const HUNTING = new Set(['stalk', 'charge']), DEFEND_R = 18;
const CrossbowRow = v.object({ loaded: v.boolean(), quiver: v.number() });
/** Stand and shoot the nearest hunter within 18 m. Use the first pickup's crossbow while it has ammunition;
 * an owned, supplied rifle takes over when the bow is dry, through the ordinary loadout swap and trigger. */
function defence(host: SimHost): HeadlessCommand[] | null {
  const p = host.player.position;
  let near: { id: string; x: number; z: number; d: number } | null = null;
  for (const body of host.entities.values()) {
    if (!body.alive || !HUNTING.has(body.state)) continue;
    const d = Math.hypot(body.position.x - p.x, body.position.z - p.z);
    if (d < DEFEND_R && (near === null || d < near.d)) near = { id: body.entityId, x: body.position.x, z: body.position.z, d };
  }
  if (near === null) return null;
  const yaw = Math.atan2(-(near.x - p.x), -(near.z - p.z)), held = v.parse(LoadoutRow, host.adapters.get(LOADOUT_STEP)?.snapshot()).held;
  const bow = v.parse(CrossbowRow, host.adapters.get(CROSSBOW_STEP)?.snapshot()), gun = lever(host);
  const suppliedRifle = host.flags.has(LEVER_FLAG) && (gun.chambered || gun.tube > 0 || gun.reserve > 0);
  const want = !bow.loaded && bow.quiver === 0 && suppliedRifle ? PINE_WEAPON.lever : PINE_WEAPON.crossbow;
  if (held !== want) return [{ kind: 'script', actorId: WEAPON_COMMAND, value: want }, move(0, 0, yaw)];
  return [{ kind: 'player', moveX: 0, moveZ: 0, yaw, attack: { targetId: near.id } }];
}

/** The tape over Pine's route, from its first leg or where a checkpoint left it. */
export function pineTape(plan: HeadlessRuntimePlan, from?: TapeState): PineTape {
  const bytes = requireValue(assets.get(PINE_NAVMESH_ASSET), 'navmesh'), nav = requireValue(parseNavmesh(bytes.slice().buffer), 'navmesh parse');
  nav.datum = () => 0;
  const heightAt = requireValue(plan.ports?.heightAt, 'height query');
  return new PineTape(route(pineSpots(), nav, heightAt), from);
}

const facts = (effects: readonly HeadlessEffect[]): string[] => effects.flatMap(effect => effect.kind === 'fact' ? [`${effect.name}/${effect.actorId}`] : []);

/** Bound a failed fight separately from the whole walk. The current tape wins in 3,122 fight ticks. */
const KING_PROBE = 5000;
/**
 * The tape from the spawn: the day's legs to the den's lantern, Hale's watch till dark, the Ghost Stag's walk into the
 * stones, the Antler King's fight by weapon play, and dawn. `KING_PROBE` bounds a failed fight. `at-king`: the tape reached his fight and the player stands; `walked`: every leg,
 * the dawn included.
 */
export async function tapeProof(rapier: Rapier, limit = 60_000): Promise<object> {
  const plan = await pinePlan(rapier), session = boot(plan, rapier), tape = pineTape(plan);
  try {
    let fought = 0;
    for (let i = 0; i < limit && !tape.walked && fought < KING_PROBE; i++) {
      step(session, tape.next(session.host));
      if (tape.current === 'king' && kingRow(session.host).boss.state === 'fight') fought++;
    }
    const host = session.host, quest = host.quests.find(q => q.def.id === 'wardens-hollow'), row = kingRow(host);
    const body = row.fight.king === null ? undefined : host.entities.get(row.fight.king);
    const alive = host.player.health.attributes.health > 0, status = tape.walked ? 'walked' : fought >= KING_PROBE && alive ? 'at-king' : 'failed';
    return { status, at: host.player.position.toArray().map(n => Number(n.toFixed(2))), tape: tape.state, ticksExecuted: host.state.tick, step: quest?.current?.id ?? null, hash: digest(host),
      king: { state: row.boss.state, phase: row.boss.phase, attempts: row.boss.attempts, hp: body?.hp ?? null, maxHp: body?.maxHp ?? null, foughtTicks: fought },
      facts: facts(session.effects), legs: tape.log.map(entry => ({ leg: entry.kind, tick: entry.tick, at: [entry.x, entry.y, entry.z].map(n => Number(n.toFixed(2))) })) };
  } finally { session.host.dispose(); }
}


// ── Committed gameplay checkpoints and bounded CI continuations ──
export const CHECKPOINT_NAMES = ['dam', 'ridge', 'night', 'king', 'fallen'] as const;
export type CheckpointName = typeof CHECKPOINT_NAMES[number];
const CHECKPOINTS = new URL('test/proof/pine-hollow/checkpoints/', ROOT);
const MANIFEST = new URL('manifest.json', CHECKPOINTS);
const CheckpointSchema = v.strictObject({ tick: v.number(), tape: v.strictObject({ leg: v.number(), waypoint: v.number(), ticks: v.number(), best: v.number(), stall: v.number() }), snapshot: v.string() });
const ManifestSchema = v.strictObject({ inputs: v.string(), ticks: v.record(v.string(), v.number()), hashes: v.record(v.string(), v.string()) });
const checkpointFile = (name: CheckpointName): URL => new URL(`${name}.snap.gz`, CHECKPOINTS);
const BASIS = new URL('basis.snap.gz', CHECKPOINTS);
const readCheckpoint = (name: CheckpointName): { tick: number; tape: TapeState; snapshot: SimSnapshot } => {
  const row = v.parse(CheckpointSchema, JSON.parse(gunzipSync(readFileSync(checkpointFile(name))).toString('utf8')));
  return { ...row, snapshot: decodeSimSnapshot(row.snapshot, gunzipSync(readFileSync(BASIS))) };
};
const SLICE = 10_000;
const atCheckpoint = (name: CheckpointName, host: SimHost): boolean => {
  switch (name) {
    case 'dam': return host.state.tick >= 8000;
    case 'ridge': return host.state.tick >= 16000;
    case 'night': return host.state.tick >= 24000;
    case 'king': { const row = kingRow(host); return row.boss.state === 'fight' && row.boss.phase === 1; }
    case 'fallen': return host.flags.has(KING_RECORD.defeated);
    default: throw new Error('Unknown checkpoint');
  }
};
function playUntil(session: Session, tape: PineTape, until: (host: SimHost) => boolean, limit: number): number {
  for (let i = 0; i < limit; i++) {
    if (until(session.host)) return i;
    step(session, tape.next(session.host));
    if (session.host.player.health.attributes.health <= 0) throw new Error(`The witness player died at ${String(session.host.state.tick)}`);
  }
  throw new Error(`Pine tape exceeded ${String(limit)} ticks at ${JSON.stringify(tape.state)}`);
}
function resume(plan: HeadlessRuntimePlan, rapier: Rapier, name: CheckpointName): { session: Session; tape: PineTape; tick: number; snapshot: SimSnapshot } {
  const checkpoint = readCheckpoint(name), session = restore(plan, rapier, checkpoint.snapshot);
  if (digest(session.host) !== canonicalSimDigest(checkpoint.snapshot)) { session.host.dispose(); throw new Error(`Inexact ${name} restore`); }
  return { session, tape: pineTape(plan, checkpoint.tape), tick: checkpoint.tick, snapshot: checkpoint.snapshot };
}
/** Bake outputs of one uninterrupted gameplay tape, with the exact loaded-module and native-asset inputs hash. */
export async function writeCheckpoints(rapier: Rapier, inputs: string): Promise<object> {
  const plan = await pinePlan(rapier), session = boot(plan, rapier), tape = pineTape(plan), ticks: Record<string, number> = {}, hashes: Record<string, string> = {};
  try {
    mkdirSync(CHECKPOINTS, { recursive: true });
    const basis = session.host.physics.snapshot();
    writeFileSync(BASIS, gzipSync(basis, { level: 9 }));
    for (const name of CHECKPOINT_NAMES) {
      playUntil(session, tape, host => atCheckpoint(name, host), 60_000);
      const state = snapshotSimHost(session.host);
      const checkpoint = { tick: session.host.state.tick, tape: tape.state, snapshot: serializeSimSnapshot(state, basis) };
      hashes[name] = canonicalSimDigest(state);
      writeFileSync(checkpointFile(name), gzipSync(JSON.stringify(checkpoint), { level: 9 })); ticks[name] = checkpoint.tick;
    }
    playUntil(session, tape, host => host.flags.has(QUEST_DONE), SLICE);
    hashes['dawn'] = digest(session.host);
    writeFileSync(MANIFEST, `${JSON.stringify({ inputs, ticks, hashes }, null, 2)}\n`);
    return { status: 'written', inputs, ticks, hashes };
  } finally { session.host.dispose(); }
}
export function checkpointsFresh(inputs: string): object {
  const manifest = v.parse(ManifestSchema, JSON.parse(readFileSync(MANIFEST, 'utf8')));
  if (Object.keys(manifest.ticks).join(',') !== CHECKPOINT_NAMES.join(',')) throw new Error('Incomplete Pine checkpoint set');
  if (Object.keys(manifest.hashes).join(',') !== [...CHECKPOINT_NAMES, 'dawn'].join(',')) throw new Error('Incomplete Pine canonical digests');
  return { status: manifest.inputs === inputs ? 'fresh' : 'stale', inputs, recorded: manifest.inputs, ticks: manifest.ticks };
}
/** One <=10k-tick leg of the same gameplay tape; no test fixture moves or damages a body. */
export async function walkSlice(rapier: Rapier, to: CheckpointName | 'dawn'): Promise<object> {
  const plan = await pinePlan(rapier), i = CHECKPOINT_NAMES.indexOf(to === 'dawn' ? 'fallen' : to);
  const from = to === 'dawn' ? 'fallen' : i > 0 ? CHECKPOINT_NAMES[i - 1] : undefined;
  const start = from === undefined ? { session: boot(plan, rapier), tape: pineTape(plan), tick: 0 } : resume(plan, rapier, from);
  try {
    const ticks = playUntil(start.session, start.tape, host => to === 'dawn' ? host.flags.has(QUEST_DONE) : atCheckpoint(to, host), SLICE);
    const host = start.session.host, hash = digest(host);
    const manifest = v.parse(ManifestSchema, JSON.parse(readFileSync(MANIFEST, 'utf8')));
    if (hash !== manifest.hashes[to]) throw new Error(`Inexact ${to} gameplay continuation`);
    return { status: 'passed', resumedFrom: from ?? 'spawn', resumedTick: start.tick, ticksExecuted: ticks, to, tick: host.state.tick,
      alive: host.player.health.attributes.health > 0, flags: host.flags.all, facts: facts(start.session.effects), king: kingRow(host).boss, hash };
  } finally { start.session.host.dispose(); }
}
/** Exact continuation of the King's phase-II checkpoint, with the identical player commands in both worlds. */
export async function replayProof(rapier: Rapier): Promise<object> {
  const plan = await pinePlan(rapier), original = resume(plan, rapier, 'king');
  let replay: Session | undefined;
  try {
    const saved = original.snapshot, before = digest(original.session.host);
    replay = restore(plan, rapier, saved);
    if (digest(replay.host) !== before) throw new Error('King checkpoint changed on restore');
    const SUFFIX = 1200;
    for (let i = 0; i < SUFFIX; i++) { const commands = original.tape.next(original.session.host); step(original.session, commands); step(replay, commands); }
    const hash = digest(original.session.host), replayHash = digest(replay.host);
    if (hash !== replayHash || JSON.stringify(original.session.effects) !== JSON.stringify(replay.effects)) throw new Error('King replay diverged');
    return { status: 'passed', checkpointCaptured: true, checkpointTick: original.tick, suffixTicksExecuted: SUFFIX, hash, replayHash,
      checkpoint: { state: 'fight', phase: 1 }, facts: facts(replay.effects), restoredReemits: 0 };
  } finally { replay?.host.dispose(); original.session.host.dispose(); }
}

const identity = { instance: 'pine-hollow-witness', shard: source.identity.slug, revision: source.identity.revision };
class ProfileStorage implements SaveStorage {
  private readonly data = new Map<string, string>();
  refuse = false;
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { if (this.refuse) throw new Error('Witness quota refusal'); this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}
const profile = (local: ProfileStorage): Ledger => new Ledger(new SaveStore({ local, session: null }), [{ id: identity.instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules: source.ledger }], []);
/** Ingest only effects committed by gameplay, under the declared origin and the gameplay tick. */
class FactIngress {
  private readonly emitters = new Map<string, LedgerEmitter>();
  private readonly dedupe: string[] = [];
  private readonly ledger: Ledger;
  private readonly now: () => number;
  constructor(ledger: Ledger, now: () => number) { this.ledger = ledger; this.now = now; }
  ingest(effects: readonly HeadlessEffect[]): LedgerReceipt[] {
    return effects.flatMap(effect => {
      if (effect.kind !== 'fact') return [];
      const rule = requireValue(source.ledger.find(row => row.fact === effect.name), `Undeclared fact ${effect.name}`), key = JSON.stringify(rule.origin);
      let emitter = this.emitters.get(key);
      if (emitter === undefined) { emitter = new LedgerEmitter(this.ledger, identity, rule.origin, this.now, this.dedupe); this.emitters.set(key, emitter); }
      return [emitter.emit(effect.name, effect.actorId)];
    });
  }
}
/** Entire tape once, including actual fact ingress, quota refusal/retry and a reopened durable profile. */
async function collectGameplayProof(rapier: Rapier, from?: 'night') {
  const plan = await pinePlan(rapier), start = from === undefined ? { session: boot(plan, rapier), tape: pineTape(plan), tick: 0 } : resume(plan, rapier, from);
  const { session, tape } = start, local = new ProfileStorage(), ledger = profile(local);
  const ingress = new FactIngress(ledger, () => session.host.state.tick), receipts: LedgerReceipt[] = [];
  let refused = false;
  try {
    for (let i = 0; i < (from === undefined ? 60_000 : SLICE) && !tape.walked; i++) {
      const effects = step(session, tape.next(session.host));
      if (!refused && effects.some(effect => effect.kind === 'fact')) {
        local.refuse = true; receipts.push(...ingress.ingest(effects));
        if (ledger.flush() || Object.keys(profile(local).state().facts).length > 0) throw new Error('Refused fact became durable');
        local.refuse = false; if (!ledger.flush()) throw new Error('Fact retry failed'); refused = true;
      } else receipts.push(...ingress.ingest(effects));
      if (session.host.player.health.attributes.health <= 0) throw new Error('Player died');
    }
    if (!tape.walked || !session.host.flags.has(QUEST_DONE) || !session.host.flags.has(KING_RECORD.defeated)) throw new Error('King/dawn tape unfinished');
    const durable = ledger.state(), rows = Object.values(durable.facts), reopened = profile(local);
    if (JSON.stringify(reopened.state()) !== JSON.stringify(durable) || rows.some(row => reopened.record(row).status !== 'duplicate')) throw new Error('Gameplay ledger not durable/deduplicated');
    const pack = v.parse(v.object({ pack: PinePackSchema }), session.host.adapters.get(QUEST_STEP)?.snapshot()).pack;
    return { status: 'passed', resumedFrom: from ?? 'spawn', ticksExecuted: session.host.state.tick - start.tick, tick: session.host.state.tick, alive: true, kingDefeated: true, dawn: session.host.flags.has('seen:dawn'),
      hash: digest(session.host), pack, resinCount: session.host.flags.count('resin:'), facts: rows.map(row => ({ name: row.name, entity: row.entity, tick: row.tick, origin: row.origin })),
      achievements: Object.values(durable.achievements), rules: source.ledger.length, gameplayEmissionProven: true, refusedWriteRetried: refused,
      durableReload: true, duplicateStable: true, receipts: receipts.map(row => row.status), legs: tape.log };
  } finally { session.host.dispose(); }
}

/** Run gameplay once; its ledger receipt comes from those same committed effects. */
export function gameplayProof(rapier: Rapier, from?: 'night'): ReturnType<typeof collectGameplayProof> {
  return collectGameplayProof(rapier, from);
}

/** These omissions can change damage, inventory, quest/ledger outcomes or persistence relative to the browser. */
export const OUTCOME_DIFFERENCES = [
  'Native projectile gusts, rainy iron-bolt flight, moving spread and longbow recovery are hosted; variable page-frame clocks, aimed/mounted input and special-ammunition selection remain unproved. Stopped crossbow bolts are visual-only on the page.',
  'Hale dialogue completion, input guard and cancellation are hosted; named prompt commands still omit nearest/line-of-sight selection and the other NPCs.',
  'Resin walk-in takes, the eight carved tokens, lookout bench and seven-kind pack are hosted; hollow-log/islet secrets, miller, journal and lodge/streak producers remain unhosted, so their ledger outcomes are absent.',
  'Night-roaming thralls, millrace and lodge are not hosted: their combat and quest outcomes are absent.',
  'King victory resin has no item effect, including refights; the first bow is granted before the page pickup, so reward timing and inventory can differ.',
  'Rain wander goals are null: creature positions can differ.',
  'The page King record uses pine.bosses instead of host flags; browser-save interoperability for refights is not proved.',
];
/** Missing recorded paths alone do not establish a difference in the already-hosted rule. */
export const COVERAGE_GAPS = [
  'Alternate routes, other elite encounters and repeat fights lack their own uninterrupted recorded tapes.',
  'The recorded tape is standalone; grid entry walls are removed in a separate native entry proof, not a recorded grid quest tape.',
];
export const OPEN = [...OUTCOME_DIFFERENCES, ...COVERAGE_GAPS];
