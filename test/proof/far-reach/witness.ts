// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads the shard's admitted in-tree bytes and the native physics module.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed checkpoints are gzipped snapshot wires.
import { gunzipSync, gzipSync } from 'node:zlib';
import * as v from 'valibot';
import source from '../../../src/shards/far-reach/shard.config';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { canonicalSimDigest } from '../../fake/simState';
import { SaveStore, type SaveStorage } from '../../../src/engine/saves/store';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { Ledger, LedgerEmitter, type LedgerReceipt } from '../../../src/game/ledger';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { HeadlessSimulation } from '../../../src/sdk/headless';
import { prepareHeadlessRuntime } from '../../../src/shards/far-reach/runtime/headless';
import { CROWN, DECK, FALLEN_BRIDGE, KEEPER, ROOST, RUIN, STEP, UPDRAFT, VANES, WINCH } from '../../../src/shards/far-reach/data/layout';
import { KEEPER_AT } from '../../../src/shards/far-reach/data/quests';
import { FAN_SWING } from '../../../src/shards/far-reach/data/items';
import { FLAGS, vaneFlag } from '../../../src/shards/far-reach/quest/flags';
import { FAN_ACT, FAN_ACTOR, FAN_AIM } from '../../../src/shards/far-reach/runtime/fan';
import { ROOST_IDS, SKY_ACT, SKY_INTERACT } from '../../../src/shards/far-reach/runtime/quest';
import { ROC_STEP } from '../../../src/shards/far-reach/runtime/roc';
import { ROC_ID } from '../../../src/shards/far-reach/runtime/rocEncounter';

/**
 * Sky Reach's whole-shard witness (E435 §C / SF72) on its trusted renderer-free entry, `runtime/headless.ts`, composed
 * exactly as the platform's trusted adapter composes it (`createTrustedHeadlessAdapter`: the plan's level and ports, one
 * install, the tick's commands lent to the runtime, its effects buffered per tick), and cross-checked against the shipping
 * worker (`HeadlessSimulation` + `trustedRuntime`) from the gale-wall checkpoint. The player's tape is tick commands only
 * (`player` moves, fan swings and HOVER presses; `script` prompts, GUSTs and the fan's aim), chosen each tick from what a
 * player sees: from the spawn on Sunrest to the keeper, over the grove rope bridge, on the board over the hover bridges to
 * the keeper's isle and the roost, on foot to the ruin, each vane GUSTed, the roost's rays felled by the fan, on the board
 * up the updraft to the step, the winch, the raised bridge to the crown and the Storm Roc felled by War Fan play. Nothing
 * writes health, flags, positions or facts: every outcome is gameplay.
 */
export const ENTRY = 'runtime/headless.ts';
const ROOT = new URL('../../../', import.meta.url);
const MODULE = new URL(`src/shards/far-reach/${ENTRY}`, ROOT).href;
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(new URL(`src/shards/far-reach/assets/${file.hash}`, ROOT)))]));
const EYE = 1.68;
const identity = { instance: 'far-reach-witness', shard: source.identity.slug, revision: source.identity.revision };

class ProfileStorage implements SaveStorage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}
const profile = (local: ProfileStorage): Ledger => new Ledger(new SaveStore({ local, session: null }), [{ id: identity.instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules: source.ledger }], []);

/** One authoritative session: the host, the tick's lent commands and its committed effects. */
interface Session { host: SimHost; tape: readonly HeadlessCommand[]; effects: HeadlessEffect[]; tick: HeadlessEffect[] }
const requireValue = <T>(value: T | undefined | null, message: string): T => { if (value === undefined || value === null) throw new Error(message); return value; };
/** A continuation's hash: the snapshot in canonical form (test/fake/simState.ts: Rapier's snapshot bytes are not canonical, so the
 *  native world counts as the state it restores to, exactly) */
const digest = (host: SimHost): string => canonicalSimDigest(snapshotSimHost(host));

export function skyRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
export async function skyPlan(rapier: Rapier): Promise<HeadlessRuntimePlan> { const plan = await prepareHeadlessRuntime({ shard: source, assets, rapier }); return plan; }

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
function restore(plan: HeadlessRuntimePlan, rapier: Rapier, saved: string): Session {
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
      ...(player.attack === undefined ? {} : { attack: player.attack }), ...(player.hover === undefined ? {} : { hover: player.hover }) } : undefined);
  } finally { session.tape = []; }
  if (![session.host.player.position, ...[...session.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
  session.effects.push(...session.tick); return session.tick;
}

interface Encounter { state: string; phase: number; attempts: number }
function encounter(host: SimHost): Encounter {
  const saved = host.adapters.get(ROC_STEP)?.snapshot();
  if (typeof saved !== 'string') throw new Error('Missing Roc continuation');
  const value = JSON.parse(saved) as { boss: Encounter };
  return { state: value.boss.state, phase: value.boss.phase, attempts: value.boss.attempts };
}

type Point = readonly [number, number];
/** Where a tape is: resumable from a checkpoint exactly as the uninterrupted tape continues. */
export interface TapeState { leg: number; waypoint: number; ticks: number; hold: Point | null }
/**
 * One stretch of the tape. `go` walks (or rides, on the board) through waypoints; `mode` stops and presses HOVER once
 * the player has come to rest; `act` presses a prompt once it is in reach; `gust` faces a vane and GUSTs until it turns;
 * `roost` holds the roost's deck and swings at its rays until they are down; `winch` waits for the raised bridge;
 * `crown` fights the Storm Roc to its fall.
 */
type Leg =
  | { kind: 'go'; path: readonly Point[] }
  | { kind: 'mode'; board: boolean }
  | { kind: 'act'; value: number }
  | { kind: 'gust'; vane: string; yaw: number }
  | { kind: 'roost'; stand: Point }
  | { kind: 'winch' }
  | { kind: 'crown' };

/** The route, in the order a player takes it (the waypoints are the walk / board legs of scripts/physics-route.json). */
const GROVE_BRIDGE: readonly Point[] = [[-6, -1], [-14.1, 1.3], [-22.5, 2.1], [-29.4, 2.7], [-36.4, 3.4], [-44.8, 4.1], [-52, 4]];
const KEEPER_BRIDGE: readonly Point[] = [[-52, 2], [-54.7, -5.9], [-55.4, -17.5], [-56.0, -27.5], [-56.6, -37.5], [-57.3, -49.1], [-57, -58]];
const ROOST_BRIDGE: readonly Point[] = [[8, -2], [15.3, -3.1], [24.3, -4.9], [31.9, -6.4], [39.5, -7.9], [48.5, -9.7], [56, -14]];
const RUIN_BRIDGE: readonly Point[] = [[59, -18], [60.9, -22.2], [61.7, -32.9], [62.5, -42.0], [63.3, -51.1], [64.1, -61.8], [66, -68]];
const WINDMILL_BRIDGE: readonly Point[] = [[0, -14], [0, -30], [0, -48], [-3, -56]];
const reverse = (path: readonly Point[]): Point[] => [...path].reverse();
const vane = (id: string): { x: number; z: number } => requireValue(VANES.find(row => row.id === id), `missing vane ${id}`);
function route(): Leg[] {
  // the updraft ramp's run, from a few metres short of its foot on the windmill isle to the step's middle
  const ux = UPDRAFT.x1 - UPDRAFT.x0, uz = UPDRAFT.z1 - UPDRAFT.z0, ul = Math.hypot(ux, uz), foot: Point = [UPDRAFT.x0 - ux / ul * 4, UPDRAFT.z0 - uz / ul * 4];
  const keeperVane = vane('keeper'), groveVane = vane('grove'), ruinVane = vane('ruin');
  return [
    // 1. the keeper on Sunrest: walk up to him and talk (his notes)
    { kind: 'go', path: [[KEEPER_AT.x + 0.6, KEEPER_AT.z + 1.2]] }, { kind: 'act', value: SKY_ACT.talk },
    // the grove over its rope bridge; its vane
    { kind: 'go', path: [[-3, -2], ...GROVE_BRIDGE, [groveVane.x, groveVane.z + 6]] }, { kind: 'gust', vane: 'grove', yaw: 0 },
    // on the board over the keeper hover bridge to the keeper's isle; its vane, from its south side
    { kind: 'go', path: [[-52, 4]] }, { kind: 'mode', board: true }, { kind: 'go', path: KEEPER_BRIDGE }, { kind: 'mode', board: false },
    { kind: 'go', path: [[keeperVane.x, keeperVane.z - 6]] }, { kind: 'gust', vane: 'keeper', yaw: Math.PI },
    // on the board back over both bridges, Sunrest and the roost hover bridge to the roost; its three rays
    { kind: 'go', path: [[KEEPER.x + 1, KEEPER.z + 2]] }, { kind: 'mode', board: true },
    { kind: 'go', path: [...reverse(KEEPER_BRIDGE).slice(1), ...reverse(GROVE_BRIDGE).slice(1), ...ROOST_BRIDGE] }, { kind: 'mode', board: false },
    { kind: 'roost', stand: [56, -14] },
    // on foot over the ruin rope bridge; its vane; back to the roost
    { kind: 'go', path: [...RUIN_BRIDGE, [ruinVane.x, ruinVane.z + 6]] }, { kind: 'gust', vane: 'ruin', yaw: 0 },
    { kind: 'go', path: [[RUIN.x, RUIN.z + 2], ...reverse(RUIN_BRIDGE).slice(1), [ROOST.x - 4, ROOST.z - 2]] },
    // on the board back to Sunrest, on foot over the windmill rope bridge, on the board up the updraft to the step
    { kind: 'mode', board: true }, { kind: 'go', path: [...reverse(ROOST_BRIDGE).slice(1), [2, -6]] }, { kind: 'mode', board: false },
    { kind: 'go', path: [...WINDMILL_BRIDGE, foot] }, { kind: 'mode', board: true },
    { kind: 'go', path: [[UPDRAFT.x0, UPDRAFT.z0], [UPDRAFT.x1, UPDRAFT.z1], [STEP.x, STEP.z]] }, { kind: 'mode', board: false },
    // the winch (unlocked: the roost is quiet and the vanes turn), the raised bridge, the crown
    { kind: 'go', path: [[WINCH.x, WINCH.z + 2]] }, { kind: 'act', value: SKY_ACT.winch }, { kind: 'winch' },
    { kind: 'go', path: [[FALLEN_BRIDGE.x0, FALLEN_BRIDGE.z0], [FALLEN_BRIDGE.x1, FALLEN_BRIDGE.z1], [CROWN.x, CROWN.z + 6]] },
    { kind: 'crown' },
  ];
}

/** Within the fan's light reach of the player's eye (its arc aims at the body): a creature the player swings at. */
const swingable = (host: SimHost, actor: AnimalSim): boolean => {
  if (!actor.alive) return false;
  const p = host.player.position, dy = actor.position.y + actor.dims.bodyY * actor.scale - (p.y + EYE);
  return Math.hypot(actor.position.x - p.x, dy, actor.position.z - p.z) < FAN_SWING.reach + actor.dims.bodyRadius * actor.scale;
};
const facing = (host: SimHost, x: number, z: number): number => Math.atan2(host.player.position.x - x, host.player.position.z - z);
/** The browser's light swing aims along the camera: the player turns to what it swings at. */
const CROWN_REACH = 17, ARRIVE = 0.8, ARRIVE_BOARD = 1.5, REST = 0.25, CRUISE = 9, STICK = 3;

/**
 * The tape: a closed loop over what the player sees, one tick's commands at a time. On foot it swings the fan at any
 * creature in reach (the Roc's only in its fight); on the board the fan is stowed and it steers. In the Roc's fight it
 * holds the crown under the bird (never past CROWN_REACH from the crown's middle), swinging as it stoops and GUSTing at it
 * at the camera pitch that frames it (the War Fan alone fells it).
 */
export class SkyTape {
  private readonly legs = route();
  private leg = 0;
  private waypoint = 0;
  /** The leg's ticks (a `mode` press waits for rest; a stuck leg fails the tape rather than looping). */
  private ticks = 0;
  /** The last point a `go` leg reached: a `mode` press brakes onto it before stepping off the board. */
  private hold: Point | null = null;
  readonly log: { leg: number; kind: string; tick: number; x: number; y: number; z: number }[] = [];
  /** A tape resumed where a checkpoint left it (its leg, waypoint, leg ticks and held point ride the checkpoint). */
  constructor(from?: TapeState) { if (from !== undefined) ({ leg: this.leg, waypoint: this.waypoint, ticks: this.ticks, hold: this.hold } = from); }
  get state(): TapeState { return { leg: this.leg, waypoint: this.waypoint, ticks: this.ticks, hold: this.hold }; }
  /** Past the board's last leg: on foot on the step, the winch next. */
  get atStep(): boolean { return this.leg >= this.legs.findIndex(leg => leg.kind === 'act' && leg.value === SKY_ACT.winch) - 1; }
  next(host: SimHost): HeadlessCommand[] {
    const leg = this.legs[this.leg];
    if (leg === undefined) return [{ kind: 'player', moveX: 0, moveZ: 0, yaw: host.player.yaw }];
    this.ticks++;
    if (this.ticks > 60 * 600) throw new Error(`The tape is stuck on leg ${String(this.leg)} (${leg.kind}) at ${host.player.position.toArray().map(n => n.toFixed(2)).join(', ')}`);
    const commands = this.play(host, leg);
    if (commands === null) { this.done(host, leg); return this.next(host); }
    return commands;
  }
  get walked(): boolean { return this.leg >= this.legs.length - 1; }
  private done(host: SimHost, leg: Leg): void {
    const p = host.player.position;
    this.log.push({ leg: this.leg, kind: leg.kind, tick: host.state.tick, x: p.x, y: p.y, z: p.z });
    this.leg++; this.waypoint = 0; this.ticks = 0;
  }
  /** This leg's commands for the tick, or null once it is complete. */
  private play(host: SimHost, leg: Leg): HeadlessCommand[] | null {
    const p = host.player.position, board = host.playerBoard.on;
    switch (leg.kind) {
      case 'go': {
        const target = leg.path[this.waypoint];
        if (target === undefined) return null;
        const dx = target[0] - p.x, dz = target[1] - p.z, d = Math.hypot(dx, dz), last = this.waypoint === leg.path.length - 1;
        if (d < (board ? ARRIVE_BOARD : ARRIVE)) { this.hold = target; this.waypoint++; return this.play(host, leg); }
        if (board) return [this.ride(host, target, last)];
        return [this.walk(host, dx / d, dz / d, Math.atan2(-dx, -dz))];
      }
      case 'mode': {
        if (board === leg.board) return null;
        // a rider brakes onto the leg's last point before stepping off; a walker stands still and steps on
        const bv = host.boardVelocity, moving = board && Math.hypot(bv.x, bv.z) > REST;
        if (moving && this.hold !== null) return [this.ride(host, this.hold, true)];
        return [{ kind: 'player', moveX: 0, moveZ: 0, yaw: host.player.yaw, ...(moving ? {} : { hover: true as const }) }];
      }
      case 'act': {
        if (this.ticks > 1) return null;
        return [{ kind: 'script', actorId: SKY_INTERACT, value: leg.value }, { kind: 'player', moveX: 0, moveZ: 0, yaw: host.player.yaw }];
      }
      case 'gust': {
        if (host.flags.has(vaneFlag(leg.vane))) return null;
        return [{ kind: 'player', moveX: 0, moveZ: 0, yaw: leg.yaw }, { kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.gust }];
      }
      case 'roost': {
        if (host.flags.has(FLAGS.roost)) return null;
        const live = ROOST_IDS.flatMap(id => { const a = host.entities.get(id); return a !== undefined && swingable(host, a) ? [a] : []; });
        const dx = leg.stand[0] - p.x, dz = leg.stand[1] - p.z, d = Math.hypot(dx, dz), walk = d > ARRIVE;
        const target = live[0];
        return [{ kind: 'player', moveX: walk ? dx / d : 0, moveZ: walk ? dz / d : 0, yaw: target === undefined ? host.player.yaw : facing(host, target.position.x, target.position.z),
          ...(target === undefined ? {} : { attack: { targetId: target.entityId } }) }];
      }
      case 'winch': {
        if (host.flags.has(FLAGS.raised)) return null;
        return [this.walk(host, 0, 0, host.player.yaw)];
      }
      case 'crown': {
        if (host.flags.has(FLAGS.roc)) return null;
        const roc = requireValue(host.entities.get(ROC_ID), 'missing Roc');
        const rx = roc.position.x - CROWN.x, rz = roc.position.z - CROWN.z, out = Math.hypot(rx, rz);
        const grounded = roc.position.y < CROWN.y + 3, follow = grounded || roc.speed < 0.5, k = !follow ? 0 : out > CROWN_REACH ? CROWN_REACH / out : 1;
        const gx = CROWN.x + rx * k - p.x, gz = CROWN.z + rz * k - p.z, g = Math.hypot(gx, gz), near = grounded ? 2 : 1;
        const pitch = Math.atan2(roc.position.y - (p.y + EYE), Math.hypot(roc.position.x - p.x, roc.position.z - p.z));
        return [{ kind: 'player', moveX: g > near ? gx / g : 0, moveZ: g > near ? gz / g : 0, yaw: facing(host, roc.position.x, roc.position.z), attack: { targetId: ROC_ID } },
          { kind: 'script', actorId: FAN_AIM, value: pitch }, { kind: 'script', actorId: FAN_ACTOR, value: FAN_ACT.gust }];
      }
      default: return null;
    }
  }
  /**
   * The board's stick toward a point: the board keeps its momentum, so the rider steers its velocity, not its heading,
   * toward CRUISE m/s along the line to the point (slowing into the last one), full stick against any larger error.
   */
  private ride(host: SimHost, to: Point, last: boolean): HeadlessCommand {
    const p = host.player.position, bv = host.boardVelocity, dx = to[0] - p.x, dz = to[1] - p.z, d = Math.max(1e-6, Math.hypot(dx, dz));
    const speed = last ? Math.min(CRUISE, d * 1.2) : CRUISE, ex = (dx / d) * speed - bv.x, ez = (dz / d) * speed - bv.z, e = Math.max(STICK, Math.hypot(ex, ez));
    return { kind: 'player', moveX: ex / e, moveZ: ez / e, yaw: Math.atan2(-dx, -dz) };
  }
  /** A move; on foot it also swings at the nearest creature in reach (never the Roc outside its fight). */
  private walk(host: SimHost, moveX: number, moveZ: number, yaw: number): HeadlessCommand {
    if (host.playerBoard.on) return { kind: 'player', moveX, moveZ, yaw };
    const target = [...host.entities.values()].find(actor => actor.entityId !== ROC_ID && swingable(host, actor));
    return target === undefined ? { kind: 'player', moveX, moveZ, yaw } : { kind: 'player', moveX, moveZ, yaw: facing(host, target.position.x, target.position.z), attack: { targetId: target.entityId } };
  }
}

/** The parent's ingestion of committed fact effects: each fact under its declared rule's provenance, one cursor per origin. */
class FactIngress {
  readonly dedupe: string[] = [];
  private readonly emitters = new Map<string, LedgerEmitter>();
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
const coins = (effects: readonly HeadlessEffect[]): number => effects.reduce((sum, effect) => sum + (effect.kind === 'coins' ? effect.amount : 0), 0);
const facts = (effects: readonly HeadlessEffect[]): string[] => effects.flatMap(effect => effect.kind === 'fact' ? [effect.name] : []);
const LIMIT = 60_000, AFTER = 120;
/** The player never leaves the islands: below the lowest deck's 4 m margin the tape has fallen, and the witness fails. */
const FLOOR = DECK - 3 - 4;

/** Spawn to the Roc's fall: run the tape until the Roc is down, then `AFTER` more ticks. */
function play(session: Session, tape: SkyTape, until: (host: SimHost) => boolean = () => false): { victoryTick: number | null } {
  let victoryTick: number | null = null;
  for (let i = 0; i < LIMIT; i++) {
    if (until(session.host)) return { victoryTick };
    step(session, tape.next(session.host));
    if (session.host.player.position.y < FLOOR) throw new Error(`The player fell at tick ${String(session.host.state.tick)}: ${JSON.stringify(tape.log.at(-1))}`);
    if (victoryTick === null && session.host.flags.has(FLAGS.roc)) victoryTick = session.host.state.tick;
    if (victoryTick !== null && session.host.state.tick >= victoryTick + AFTER) return { victoryTick };
  }
  throw new Error(`The tape did not finish within ${String(LIMIT)} ticks: ${JSON.stringify(tape.log.at(-1))}`);
}

export async function headlessProof(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), session = boot(plan, rapier), tape = new SkyTape();
  let boardTicks = 0, lifted = 0, peak = -Infinity;
  try {
    // observation only: the ticks ridden, the ticks the updraft's lift ran, the highest the board flew
    const { victoryTick } = play(session, tape, host => {
      if (host.playerBoard.on) { boardTicks++; peak = Math.max(peak, host.player.position.y); if (host.playerImpulse.y > 0) lifted++; }
      return false;
    }), host = session.host, done = encounter(host);
    const quest = host.quests.find(q => q.def.id === source.quests.quests[0]?.id) ?? null;
    if (victoryTick === null || done.state !== 'victory' || !tape.walked || !host.flags.has(FLAGS.complete)) throw new Error(`No gameplay victory: ${JSON.stringify({ done, quest: quest?.isComplete })}`);
    const entries = requireValue(plan.proveEntries, 'Missing entry proof')(host);
    if (entries.lanes < 1 || entries.steps < 1) throw new Error('Empty entry proof');
    return { status: 'passed', ticksExecuted: host.state.tick, hash: digest(host), victoryTick, attempts: done.attempts, questComplete: true,
      facts: facts(session.effects), coins: coins(session.effects), boardTicks, updraftTicks: lifted, boardPeak: Number(peak.toFixed(2)),
      legs: tape.log.map(row => ({ leg: row.kind, tick: row.tick, at: [row.x, row.y, row.z].map(n => Number(n.toFixed(2))) })), entries };
  } finally { session.host.dispose(); }
}

export async function replayProof(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), original = boot(plan, rapier), tape = new SkyTape();
  let restored: Session | undefined, worker: HeadlessSimulation | undefined;
  try {
    // the gale-wall checkpoint: the Roc's second phase, the fight running
    play(original, tape, host => {
      if (!tape.walked || host.state.tick % 30 !== 0) return false;
      const e = encounter(host); return e.state === 'fight' && e.phase === 1;
    });
    const mid = encounter(original.host), hp = original.host.entities.get(ROC_ID)?.hp ?? null, checkpoint = serializeSimSnapshot(snapshotSimHost(original.host)), checkpointTick = original.host.state.tick;
    const before = original.effects.length;
    restored = restore(plan, rapier, checkpoint);
    if (digest(restored.host) !== canonicalSimDigest(checkpoint)) throw new Error('Restore is not exact');
    const commands: HeadlessCommand[][] = [], WORKER = 60;
    let victoryTick: number | null = null, atWorker = '';
    for (let i = 0; i < LIMIT; i++) {
      const tick = tape.next(original.host); commands.push(tick);
      step(original, tick); step(restored, tick);
      if (i + 1 === WORKER) atWorker = digest(restored.host);
      if (victoryTick === null && original.host.flags.has(FLAGS.roc)) victoryTick = original.host.state.tick;
      if (victoryTick !== null && original.host.state.tick >= victoryTick + AFTER) break;
    }
    if (victoryTick === null) throw new Error('The suffix did not reach the Roc\'s fall');
    const hash = digest(original.host), replayHash = digest(restored.host);
    if (hash !== replayHash || JSON.stringify(original.effects.slice(before)) !== JSON.stringify(restored.effects)) throw new Error('Continuation diverged');
    // the shipping worker, started from the same checkpoint, continues to the same state
    worker = await HeadlessSimulation.create(source, assets, checkpoint, { deadline: 'advisory', trustedRuntime: { module: MODULE } });
    let commit;
    for (const tick of commands.slice(0, WORKER)) commit = await worker.step([{ source: 'witness.tape', commands: tick }]);
    if (commit === undefined || canonicalSimDigest(commit.snapshot) !== atWorker) throw new Error('The worker continuation diverged from the in-process restore');
    return { status: 'passed', checkpointCaptured: true, checkpointTick, checkpoint: { state: mid.state, phase: mid.phase, hp },
      suffixTicksExecuted: commands.length, victoryTick, hash, replayHash, workerTicks: WORKER, workerExact: true, suffixFacts: facts(restored.effects), suffixCoins: coins(restored.effects) };
  } finally { await worker?.dispose(); restored?.host.dispose(); original.host.dispose(); }
}

export async function ledgerProof(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), session = boot(plan, rapier), tape = new SkyTape(), local = new ProfileStorage(), ledger = profile(local);
  const ingress = new FactIngress(ledger, () => session.host.state.tick);
  let after: Session | undefined;
  try {
    const receipts: LedgerReceipt[] = [];
    for (let i = 0; i < LIMIT; i++) {
      receipts.push(...ingress.ingest(step(session, tape.next(session.host))));
      if (session.host.flags.has(FLAGS.roc) && session.host.flags.has(FLAGS.complete)) break;
    }
    for (let i = 0; i < AFTER; i++) receipts.push(...ingress.ingest(step(session, tape.next(session.host))));
    const durable = ledger.state(), rows = Object.values(durable.facts), achievements = Object.values(durable.achievements);
    if (rows.length !== 2 || receipts.length !== 2 || receipts.some(r => r.status !== 'granted') || achievements.some(a => !a.earned || a.count !== 1)) throw new Error('Gameplay facts did not grant once');
    // a restored session re-emits nothing; the reopened profile holds the same grants and refuses a replayed fact
    after = restore(plan, rapier, serializeSimSnapshot(snapshotSimHost(session.host)));
    for (let i = 0; i < AFTER; i++) step(after, tape.next(after.host));
    const reopened = profile(local), replayed = rows.map(row => reopened.record(row).status);
    if (after.effects.length > 0 || JSON.stringify(reopened.state()) !== JSON.stringify(durable) || replayed.some(status => status !== 'duplicate')) throw new Error('Ledger was not durable and deduplicated');
    return { status: 'passed', rules: source.ledger.length, facts: rows.map(row => ({ name: row.name, origin: `${row.origin.kind}.${row.origin.source}`, tick: row.tick, entity: row.entity })),
      achievements: achievements.map(a => ({ id: a.id, count: a.count, earned: a.earned })), durableReload: true, duplicateStable: true, restoredReemits: 0, gameplayEmissionProven: true };
  } finally { after?.host.dispose(); session.host.dispose(); }
}

// ── The CI slices (DEPLOY.md's headless budget: at most 10k ticks a test) ─────────────────────────────────────────────
// `run.mjs all` plays the whole spawn → victory tape in one run (the authoritative witness, compatibility.json); the
// vitest legs replay it in slices that resume from committed checkpoints of that same tape: spawn → step, step → the
// gale-wall phase (and its replay), the gale-wall phase → the storm phase, and the storm phase → the Roc's fall (the
// ledger). Every slice asserts outcomes only: a checkpoint is data, so x64 CI restores it exactly, but its continuation
// is not compared byte for byte across platforms. A checkpoint carries the hash of the witness's headless inputs, and
// `run.mjs fresh` refuses a stale set; `run.mjs checkpoints` regenerates them.

export type CheckpointName = 'step' | 'gale' | 'storm';
const CHECKPOINT_NAMES: readonly CheckpointName[] = ['step', 'gale', 'storm'];
const CheckpointSchema = v.object({ tick: v.number(), tape: v.object({ leg: v.number(), waypoint: v.number(), ticks: v.number(), hold: v.nullable(v.tuple([v.number(), v.number()])) }), snapshot: v.string() });
const ManifestSchema = v.object({ inputs: v.string(), ticks: v.object({ step: v.number(), gale: v.number(), storm: v.number() }) });
type Checkpoint = v.InferOutput<typeof CheckpointSchema>;
const CHECKPOINTS = new URL('test/proof/far-reach/checkpoints/', ROOT);
const checkpointFile = (name: CheckpointName): URL => new URL(`${name}.snap.gz`, CHECKPOINTS);
const MANIFEST = new URL('manifest.json', CHECKPOINTS);
const readCheckpoint = (name: CheckpointName): Checkpoint => v.parse(CheckpointSchema, JSON.parse(gunzipSync(readFileSync(checkpointFile(name))).toString('utf8')));
/** A slice's own budget: past it the slice failed (the tape is stuck), never a long CI wait. */
const SLICE = 10_000;
/** The Roc's fight in a phase (the gale wall is phase 1, the storm phase 2), checked every 30th tick as the draft did. */
const fighting = (tape: SkyTape, phase: number) => (host: SimHost): boolean => {
  if (!tape.walked || host.state.tick % 30 !== 0) return false;
  const e = encounter(host); return e.state === 'fight' && e.phase === phase;
};
/** Run the tape until `until` holds (checked after each tick), at most `limit` ticks; the ticks it ran. */
function playUntil(session: Session, tape: SkyTape, until: (host: SimHost) => boolean, limit: number): number {
  for (let i = 0; i < limit; i++) {
    if (until(session.host)) return i;
    step(session, tape.next(session.host));
    if (session.host.player.position.y < FLOOR) throw new Error(`The player fell at tick ${String(session.host.state.tick)}: ${JSON.stringify(tape.log.at(-1))}`);
  }
  throw new Error(`The slice did not finish within ${String(limit)} ticks: ${JSON.stringify(tape.log.at(-1))}`);
}
/** A session resumed from a committed checkpoint, its restore proven exact (canonical state), and the tape where it was. */
function resume(plan: HeadlessRuntimePlan, rapier: Rapier, name: CheckpointName): { session: Session; tape: SkyTape; checkpoint: Checkpoint } {
  const checkpoint = readCheckpoint(name), session = restore(plan, rapier, checkpoint.snapshot);
  if (digest(session.host) !== canonicalSimDigest(checkpoint.snapshot)) { session.host.dispose(); throw new Error(`The ${name} checkpoint does not restore exactly`); }
  return { session, tape: new SkyTape(checkpoint.tape), checkpoint };
}

/** `run.mjs checkpoints`: play the whole tape once and write its three checkpoints and their inputs hash. */
export async function writeCheckpoints(rapier: Rapier, inputs: string): Promise<object> {
  const plan = await skyPlan(rapier), session = boot(plan, rapier), tape = new SkyTape(), ticks: Partial<Record<CheckpointName, number>> = {};
  const at = { step: (): boolean => tape.atStep, gale: fighting(tape, 1), storm: fighting(tape, 2) };
  try {
    mkdirSync(CHECKPOINTS, { recursive: true });
    for (const name of CHECKPOINT_NAMES) {
      playUntil(session, tape, at[name], LIMIT);
      const state = tape.state, hold = state.hold === null ? null : [state.hold[0], state.hold[1]] satisfies [number, number];
      const checkpoint: Checkpoint = { tick: session.host.state.tick, tape: { ...state, hold }, snapshot: serializeSimSnapshot(snapshotSimHost(session.host)) };
      writeFileSync(checkpointFile(name), gzipSync(JSON.stringify(checkpoint), { level: 9 }));
      ticks[name] = checkpoint.tick;
    }
    const manifest = v.parse(ManifestSchema, { inputs, ticks });
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    return { status: 'written', ...manifest };
  } finally { session.host.dispose(); }
}
/** `run.mjs fresh`: the committed checkpoints were written from these headless inputs. */
export function checkpointsFresh(inputs: string): object {
  const manifest = v.parse(ManifestSchema, JSON.parse(readFileSync(MANIFEST, 'utf8')));
  return { status: manifest.inputs === inputs ? 'fresh' : 'stale', inputs, recorded: manifest.inputs, ticks: manifest.ticks };
}

/** Slice 1, spawn → step and on to the 10,000th tick: the quest's spoken, GUSTed, felled and ridden legs, up the updraft to the step, the winch and the raised bridge. */
export async function stepSlice(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), session = boot(plan, rapier), tape = new SkyTape();
  let boardTicks = 0, lifted = 0, peak = -Infinity;
  try {
    const ticks = playUntil(session, tape, host => {
      if (host.playerBoard.on) { boardTicks++; peak = Math.max(peak, host.player.position.y); if (host.playerImpulse.y > 0) lifted++; }
      return tape.atStep;
    }, SLICE), host = session.host, p = host.player.position;
    const onStep = Math.hypot(p.x - STEP.x, p.z - STEP.z) < STEP.r && Math.abs(p.y - STEP.y) < 0.6, stepTick = host.state.tick;
    const flags = { vanes: VANES.every(row => host.flags.has(vaneFlag(row.id))), roost: host.flags.has(FLAGS.roost) };
    if (!onStep || !flags.vanes || !flags.roost) throw new Error(`Not on the step with the vanes turned and the roost quiet: ${JSON.stringify({ at: p.toArray(), flags })}`);
    // on to the platform's 10,000 headless ticks (the slice budget's cap): the winch, its quest fact and the raised bridge
    const more = playUntil(session, tape, () => host.state.tick >= SLICE, SLICE);
    if (!host.flags.has(FLAGS.raised) || !host.flags.has(FLAGS.complete)) throw new Error('The winch did not raise the bridge');
    const entries = requireValue(plan.proveEntries, 'Missing entry proof')(host);
    if (entries.lanes < 1 || entries.steps < 1) throw new Error('Empty entry proof');
    return { status: 'passed', ticksExecuted: ticks + more, stepTick, onStep, flags, raised: true, alive: host.player.health.attributes.health > 0, boardTicks, updraftTicks: lifted, boardPeak: Number(peak.toFixed(2)),
      facts: facts(session.effects), legs: tape.log.map(row => row.kind), entries };
  } finally { session.host.dispose(); }
}

/** Slice 2, step → the gale wall: the winch, the raised bridge, the Roc's second phase; its checkpoint restored exactly (canonical state), in process and in the shipping worker. */
export async function replaySlice(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), { session: original, tape, checkpoint: from } = resume(plan, rapier, 'step');
  let restored: Session | undefined, worker: HeadlessSimulation | undefined;
  try {
    const prefixTicks = playUntil(original, tape, fighting(tape, 1), SLICE), prefixFacts = facts(original.effects);
    const mid = encounter(original.host), hp = original.host.entities.get(ROC_ID)?.hp ?? null, checkpoint = serializeSimSnapshot(snapshotSimHost(original.host)), checkpointTick = original.host.state.tick;
    const before = original.effects.length;
    restored = restore(plan, rapier, checkpoint);
    if (digest(restored.host) !== canonicalSimDigest(checkpoint)) throw new Error('Restore is not exact');
    const commands: HeadlessCommand[][] = [], WORKER = 60, SUFFIX = 1500;
    let atWorker = '';
    for (let i = 0; i < SUFFIX; i++) {
      const tick = tape.next(original.host); commands.push(tick);
      step(original, tick); step(restored, tick);
      if (i + 1 === WORKER) atWorker = digest(restored.host);
    }
    const hash = digest(original.host), replayHash = digest(restored.host);
    if (hash !== replayHash || JSON.stringify(original.effects.slice(before)) !== JSON.stringify(restored.effects)) throw new Error('Continuation diverged');
    worker = await HeadlessSimulation.create(source, assets, checkpoint, { deadline: 'advisory', trustedRuntime: { module: MODULE } });
    let commit;
    for (const tick of commands.slice(0, WORKER)) commit = await worker.step([{ source: 'witness.tape', commands: tick }]);
    if (commit === undefined || canonicalSimDigest(commit.snapshot) !== atWorker) throw new Error('The worker continuation diverged from the in-process restore');
    return { status: 'passed', resumedFrom: 'step', resumedTick: from.tick, prefixTicks, prefixFacts, checkpointCaptured: true, checkpointTick, checkpoint: { state: mid.state, phase: mid.phase, hp },
      suffixTicksExecuted: SUFFIX, hash, replayHash, workerTicks: WORKER, workerExact: true };
  } finally { await worker?.dispose(); restored?.host.dispose(); original.host.dispose(); }
}

/** Slice 3, the gale wall → the storm: the War Fan carries the Roc through its second phase. */
export async function stormSlice(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), { session, tape, checkpoint } = resume(plan, rapier, 'gale');
  try {
    const hp = (): number => requireValue(session.host.entities.get(ROC_ID), 'missing Roc').hp, start = { encounter: encounter(session.host), hp: hp() };
    const ticks = playUntil(session, tape, fighting(tape, 2), SLICE), end = { encounter: encounter(session.host), hp: hp() };
    if (end.hp >= start.hp || end.encounter.attempts !== start.encounter.attempts || session.host.player.health.attributes.health <= 0) throw new Error(`No storm phase by fan play: ${JSON.stringify({ start, end })}`);
    return { status: 'passed', resumedFrom: 'gale', resumedTick: checkpoint.tick, ticksExecuted: ticks, from: { phase: start.encounter.phase, hp: start.hp }, to: { state: end.encounter.state, phase: end.encounter.phase, hp: end.hp }, attempts: end.encounter.attempts };
  } finally { session.host.dispose(); }
}

/** Slice 4, the ledger: the quest's fact past the winch (from the step) and the Roc's at its fall (from the storm), granted once, durably. */
export async function ledgerSlice(rapier: Rapier): Promise<object> {
  const plan = await skyPlan(rapier), local = new ProfileStorage(), ledger = profile(local), receipts: LedgerReceipt[] = [];
  const windows: { from: CheckpointName; ticks: number }[] = [];
  let after: Session | undefined, last: Session | undefined;
  try {
    // the two windows, one ingress each, into one profile (one restore a window: the quest's at the winch, the Roc's in the storm)
    for (const [from, done] of [['step', (host: SimHost) => host.flags.has(FLAGS.complete)], ['storm', (host: SimHost) => host.flags.has(FLAGS.roc)]] as const) {
      const { session, tape } = resume(plan, rapier, from), ingress = new FactIngress(ledger, () => session.host.state.tick);
      last?.host.dispose(); last = session;
      let ticks = 0;
      for (; ticks < SLICE && !done(session.host); ticks++) receipts.push(...ingress.ingest(step(session, tape.next(session.host))));
      if (from === 'storm') for (let i = 0; i < AFTER; i++, ticks++) receipts.push(...ingress.ingest(step(session, tape.next(session.host))));
      if (!done(session.host)) throw new Error(`The ${from} window did not finish within ${String(SLICE)} ticks`);
      windows.push({ from, ticks });
    }
    const durable = ledger.state(), rows = Object.values(durable.facts), achievements = Object.values(durable.achievements);
    if (rows.length !== 2 || receipts.length !== 2 || receipts.some(r => r.status !== 'granted') || achievements.some(a => !a.earned || a.count !== 1)) throw new Error('Gameplay facts did not grant once');
    // a restored session re-emits nothing; the reopened profile holds the same grants and refuses a replayed fact
    const ended = requireValue(last, 'missing storm window'), tail = new SkyTape(); // past its last leg the tape stands still
    after = restore(plan, rapier, serializeSimSnapshot(snapshotSimHost(ended.host)));
    for (let i = 0; i < AFTER; i++) step(after, tail.next(after.host));
    const reopened = profile(local), replayed = rows.map(row => reopened.record(row).status);
    if (after.effects.length > 0 || JSON.stringify(reopened.state()) !== JSON.stringify(durable) || replayed.some(status => status !== 'duplicate')) throw new Error('Ledger was not durable and deduplicated');
    return { status: 'passed', rules: source.ledger.length, windows, facts: rows.map(row => ({ name: row.name, origin: `${row.origin.kind}.${row.origin.source}`, entity: row.entity })),
      achievements: achievements.map(a => ({ id: a.id, count: a.count, earned: a.earned })), durableReload: true, duplicateStable: true, restoredReemits: 0, gameplayEmissionProven: true };
  } finally { after?.host.dispose(); last?.host.dispose(); }
}
