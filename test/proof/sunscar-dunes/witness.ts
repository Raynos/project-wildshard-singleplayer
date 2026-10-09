// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads the shard's admitted in-tree bytes and the native physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete serialized continuations.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { SaveStore, type SaveStorage } from '../../../src/engine/saves/store';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { Ledger, LedgerEmitter, type LedgerReceipt } from '../../../src/game/ledger';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import { HeadlessSimulation } from '../../../src/sdk/headless';
import { prepareHeadlessRuntime, signalSpots } from '../../../src/shards/sunscar-dunes/runtime/headless';
import { SIGNAL_ACT, SIGNAL_INTERACT, type SignalSpot } from '../../../src/shards/sunscar-dunes/runtime/quest';
import { MATRIARCH_STEP } from '../../../src/shards/sunscar-dunes/runtime/matriarch';
import { MATRIARCH_ID } from '../../../src/shards/sunscar-dunes/combat/matriarchFight';
import { lashContact } from '../../../src/shards/sunscar-dunes/weapons/lash';
import { WHIP_ITEM } from '../../../src/shards/sunscar-dunes/data/items';
import { SCOUT_AT } from '../../../src/shards/sunscar-dunes/data/flags';
import { BASIN } from '../../../src/shards/sunscar-dunes/layout';
import { COMPLETE_FLAG, MATRIARCH_FLAG } from '../../../src/shards/sunscar-dunes/quests/signal';

/**
 * Signal Dunes' whole-shard witness (E435 §C / SF72) on its trusted renderer-free entry, `runtime/headless.ts`, composed
 * exactly as the platform's trusted adapter composes it (`createTrustedHeadlessAdapter`: the plan's level and ports, one
 * install, the tick's commands lent to the runtime, its effects buffered per tick), and cross-checked against the
 * shipping worker (`HeadlessSimulation` + `trustedRuntime`) from the mid-fight checkpoint. The player's tape is a set of
 * tick commands only (`player` moves and whip attacks, `script` interactions), chosen each tick from what a player sees:
 * the prompts in reach, the creature in the lash's reach. It walks the signal quest from the spawn, lights the fire and
 * fights the Dune Matriarch to her fall. Nothing writes health, flags, positions or facts: every outcome is gameplay.
 */
export const ENTRY = 'runtime/headless.ts';
const ROOT = new URL('../../../', import.meta.url);
const MODULE = new URL(`src/shards/sunscar-dunes/${ENTRY}`, ROOT).href;
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(new URL(`src/shards/sunscar-dunes/assets/${file.hash}`, ROOT)))]));
const EYE = 1.68;
const identity = { instance: 'sunscar-witness', shard: source.identity.slug, revision: source.identity.revision };

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
const digest = (host: SimHost): string => createHash('sha256').update(serializeSimSnapshot(snapshotSimHost(host))).digest('hex');

export function signalRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
export function signalPlan(rapier: Rapier): Promise<HeadlessRuntimePlan> { return Promise.resolve(prepareHeadlessRuntime({ shard: source, assets, rapier })); }

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
/** One tick as the trusted adapter runs it; only a completed tick commits its effects. */
function step(session: Session, commands: readonly HeadlessCommand[]): HeadlessEffect[] {
  session.tape = commands; session.tick = [];
  try {
    const player = commands.find(command => command.kind === 'player');
    session.host.step(player?.kind === 'player' ? { moveX: player.moveX, moveZ: player.moveZ, yaw: player.yaw, ...(player.attack === undefined ? {} : { attack: player.attack }) } : undefined);
  } finally { session.tape = []; }
  if (![session.host.player.position, ...[...session.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
  session.effects.push(...session.tick); return session.tick;
}

interface Encounter { state: string; phase: number; checkpoint: number; attempts: number; storm: number; saved: { defeated: boolean; rewardTaken: boolean; kills: number } }
function encounter(host: SimHost): Encounter {
  const saved = snapshotSimHost(host).adapters.find(adapter => adapter.id === MATRIARCH_STEP)?.state;
  if (typeof saved !== 'string') throw new Error('Missing Matriarch continuation');
  const value = JSON.parse(saved) as { boss: Omit<Encounter, 'storm'>; fight: { storm: number } };
  return { ...value.boss, storm: value.fight.storm };
}

/** The player's eyes: is a prompt in reach, is a creature inside the lash (the shared contact rule, weapons/lash.ts)? */
const eye = new Vector3(), ray = new Vector3(), at = new Vector3();
const volumes = { head: new Vector3(), headRadius: 0, a: new Vector3(), b: new Vector3(), bodyRadius: 0 };
function sees(host: SimHost, spot: SignalSpot, reach = 0): boolean {
  eye.copy(host.player.position); eye.y += EYE; return at.set(spot.x, spot.y, spot.z).distanceTo(eye) < spot.radius + reach;
}
function lashable(host: SimHost, actor: AnimalSim): boolean {
  if (!actor.alive) return false;
  at.copy(actor.position); at.y += actor.dims.bodyY * actor.scale; eye.copy(host.player.position); eye.y += EYE;
  ray.subVectors(at, eye); const length = ray.length(); if (length < 1e-6) return true; ray.multiplyScalar(1 / length);
  actor.headWorld(volumes.head); actor.bodyCapsule(volumes.a, volumes.b);
  volumes.headRadius = actor.dims.headRadius * actor.scale; volumes.bodyRadius = actor.dims.bodyRadius * actor.scale;
  return lashContact(eye, ray, WHIP_ITEM.light.range, WHIP_ITEM.light.width, volumes, actor.position) !== null;
}

/** The quest's walk: where to go, and the interaction the player presses once its prompt is in reach. */
interface Leg { to: readonly [number, number]; act?: number; ready?: (host: SimHost) => boolean }
function legs(): Leg[] {
  const { interact, crack } = signalSpots(), spot = (list: readonly SignalSpot[], id: string): SignalSpot => requireValue(list.find(s => s.id === id), `missing spot ${id}`);
  const sefa = (host: SimHost): boolean => { eye.copy(host.player.position); eye.y += EYE; return at.set(SCOUT_AT.x, host.groundHeightAt(SCOUT_AT.x, SCOUT_AT.z) + 1.62, SCOUT_AT.z).distanceTo(eye) < 3.5; };
  const waymark = (i: number, x: number, z: number): Leg[] => [
    { to: [x, z], act: SIGNAL_ACT.pour + i, ready: host => sees(host, spot(interact, `brazier.${String(i)}`)) },
    { to: [x, z], act: SIGNAL_ACT.light + i, ready: host => sees(host, spot(crack, `brazier.${String(i)}`), WHIP_ITEM.light.range) }];
  return [
    { to: [SCOUT_AT.x - 1, SCOUT_AT.z - 1], act: SIGNAL_ACT.talk, ready: sefa },
    { to: [-76.97, 32.6], act: SIGNAL_ACT.logbook, ready: host => sees(host, spot(interact, 'logbook')) },
    { to: [83, -6], act: SIGNAL_ACT.crank, ready: host => sees(host, spot(crack, 'well.crank'), WHIP_ITEM.heavy.range) },
    { to: [83, -6], act: SIGNAL_ACT.well, ready: host => sees(host, spot(interact, 'well')) },
    ...waymark(0, 58, -31.5), ...waymark(1, -44, -19.5), ...waymark(2, 34, -99.5),
    // the tower: in under its stair, up the stair onto the deck, the fire by hand, back down and on into the basin
    { to: [8.75, -57] }, { to: [8.75, -74], act: SIGNAL_ACT.fire, ready: host => sees(host, spot(interact, 'fire')) },
    { to: [8.75, -58] }, { to: [-6, -94] }, { to: [BASIN.x, BASIN.z + 12] },
  ];
}

/**
 * The tape: a closed loop over what the player sees, one tick's commands at a time. On the walk it lashes any creature
 * inside the lash; in her fight it circles a stand on the basin floor and cracks whenever her body is inside the lash,
 * and once she is grounded it walks in on her.
 */
export class SignalTape {
  private readonly route = legs();
  private leg = 0;
  next(host: SimHost): HeadlessCommand[] {
    const p = host.player.position, her = host.entities.get(MATRIARCH_ID);
    const route = this.route[this.leg];
    if (route !== undefined) {
      if (route.act !== undefined && route.ready?.(host) === true) { this.leg++; return [{ kind: 'script', actorId: SIGNAL_INTERACT, value: route.act }, { kind: 'player', moveX: 0, moveZ: 0, yaw: host.player.yaw }]; }
      const dx = route.to[0] - p.x, dz = route.to[1] - p.z, d = Math.hypot(dx, dz);
      if (route.act === undefined && d < 1) this.leg++;
      const target = [...host.entities.values()].find(actor => actor.entityId !== MATRIARCH_ID && lashable(host, actor));
      return [{ kind: 'player', moveX: d > 0.3 ? dx / d : 0, moveZ: d > 0.3 ? dz / d : 0, yaw: Math.atan2(dx, dz), ...(target === undefined ? {} : { attack: { targetId: target.entityId } }) }];
    }
    const t = host.state.tick / 60, stand = { x: BASIN.x, z: BASIN.z + 12 };
    let goal = { x: stand.x + Math.sin(t * 0.5) * 10, z: stand.z + Math.cos(t * 0.5) * 10 }, near = 1;
    if (her !== undefined && her.alive && (her.mem['phase'] ?? 0) >= 2) { goal = { x: her.position.x, z: her.position.z }; near = 7; }
    const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), walk = d > near;
    const strike = her !== undefined && lashable(host, her);
    return [{ kind: 'player', moveX: walk ? dx / d : 0, moveZ: walk ? dz / d : 0, yaw: host.player.yaw, ...(strike ? { attack: { targetId: MATRIARCH_ID } } : {}) }];
  }
  get walked(): boolean { return this.leg >= this.route.length; }
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
const LIMIT = 40_000, MIN_TICKS = 10_000, AFTER = 120;

/** Walk, light, fight: run the tape until her fall (and at least `MIN_TICKS`), then `AFTER` more ticks. */
function play(session: Session, tape: SignalTape, until: (host: SimHost) => boolean = () => false): { victoryTick: number | null } {
  let victoryTick: number | null = null;
  for (let i = 0; i < LIMIT; i++) {
    if (until(session.host)) return { victoryTick };
    step(session, tape.next(session.host));
    if (victoryTick === null && session.host.flags.has(MATRIARCH_FLAG)) victoryTick = session.host.state.tick;
    if (victoryTick !== null && session.host.state.tick >= Math.max(MIN_TICKS, victoryTick + AFTER)) return { victoryTick };
  }
  throw new Error(`The tape did not finish within ${String(LIMIT)} ticks: ${JSON.stringify(encounter(session.host))}`);
}

export async function headlessProof(rapier: Rapier): Promise<object> {
  const plan = await signalPlan(rapier), session = boot(plan, rapier), tape = new SignalTape();
  try {
    const { victoryTick } = play(session, tape), host = session.host, done = encounter(host);
    const quest = host.quests.find(q => q.def.id === 'sunscar.signal');
    if (victoryTick === null || done.state !== 'victory' || !tape.walked || quest?.isComplete !== true) throw new Error('No gameplay victory');
    const entries = requireValue(plan.proveEntries, 'Missing entry proof')(host);
    if (entries.lanes < 1 || entries.steps < 1) throw new Error('Empty entry proof');
    return { status: 'passed', ticksExecuted: host.state.tick, hash: digest(host), victoryTick, attempts: done.attempts, questComplete: true,
      facts: facts(session.effects), coins: coins(session.effects), entries };
  } finally { session.host.dispose(); }
}

export async function replayProof(rapier: Rapier): Promise<object> {
  const plan = await signalPlan(rapier), original = boot(plan, rapier), tape = new SignalTape();
  let restored: Session | undefined, worker: HeadlessSimulation | undefined;
  try {
    // the mid-fight checkpoint: her storm phase, the fight running, the storm half in
    play(original, tape, host => {
      const her = host.entities.get(MATRIARCH_ID);
      if (!tape.walked || her?.mem['phase'] !== 1 || host.state.tick % 30 !== 0) return false;
      const e = encounter(host); return e.state === 'fight' && e.storm > 0.3;
    });
    const mid = encounter(original.host), hp = original.host.entities.get(MATRIARCH_ID)?.hp ?? null, checkpoint = serializeSimSnapshot(snapshotSimHost(original.host)), checkpointTick = original.host.state.tick;
    if (original.effects.length > 0) throw new Error('Checkpoint after a reward');
    restored = restore(plan, rapier, checkpoint);
    if (serializeSimSnapshot(snapshotSimHost(restored.host)) !== checkpoint) throw new Error('Restore is not byte-exact');
    const commands: HeadlessCommand[][] = [], WORKER = 60;
    let victoryTick: number | null = null, atWorker = '';
    for (let i = 0; i < LIMIT; i++) {
      const tick = tape.next(original.host); commands.push(tick);
      step(original, tick); step(restored, tick);
      if (i + 1 === WORKER) atWorker = serializeSimSnapshot(snapshotSimHost(restored.host));
      if (victoryTick === null && original.host.flags.has(MATRIARCH_FLAG)) victoryTick = original.host.state.tick;
      if (victoryTick !== null && original.host.state.tick >= victoryTick + AFTER) break;
    }
    if (victoryTick === null) throw new Error('The suffix did not reach her fall');
    const hash = digest(original.host), replayHash = digest(restored.host);
    if (hash !== replayHash || JSON.stringify(original.effects) !== JSON.stringify(restored.effects)) throw new Error('Continuation diverged');
    // the shipping worker, started from the same checkpoint, continues to the same bytes
    worker = await HeadlessSimulation.create(source, assets, checkpoint, { deadline: 'advisory', trustedRuntime: { module: MODULE } });
    let commit;
    for (const tick of commands.slice(0, WORKER)) commit = await worker.step([{ source: 'witness.tape', commands: tick }]);
    if (commit?.snapshot !== atWorker) throw new Error('The worker continuation diverged from the in-process restore');
    return { status: 'passed', checkpointCaptured: true, checkpointTick, checkpoint: { state: mid.state, phase: mid.phase, storm: Number(mid.storm.toFixed(3)), hp },
      suffixTicksExecuted: commands.length, victoryTick, hash, replayHash, workerTicks: WORKER, workerExact: true, suffixFacts: facts(restored.effects), suffixCoins: coins(restored.effects) };
  } finally { await worker?.dispose(); restored?.host.dispose(); original.host.dispose(); }
}

export async function ledgerProof(rapier: Rapier): Promise<object> {
  const plan = await signalPlan(rapier), session = boot(plan, rapier), tape = new SignalTape(), local = new ProfileStorage(), ledger = profile(local);
  const ingress = new FactIngress(ledger, () => session.host.state.tick);
  let after: Session | undefined;
  try {
    const receipts: LedgerReceipt[] = [];
    for (let i = 0; i < LIMIT; i++) {
      receipts.push(...ingress.ingest(step(session, tape.next(session.host))));
      if (session.host.flags.has(MATRIARCH_FLAG) && session.host.flags.has(COMPLETE_FLAG)) break;
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
