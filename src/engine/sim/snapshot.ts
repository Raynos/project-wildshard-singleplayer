import { Vector3 } from 'three';
import { serializeSnapshotData, serializeSnapshotDataSteps, decodeSnapshotData, finishSteps } from './snapshotData';
import { byteArray } from './snapshotPhysics';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel, type SimSlots, type SimValue } from '../sim';
import { SHOVE_TIME } from '../player/shove';
import type { AnimalSim } from '../entities/AnimalSim';
import type { StrikeRunner } from '../ai/strikes';
import type { PlayerHealth } from '../combat/health';
import type { GameClockState } from '../core/clock';
import { fnv1a32, type RngStreamsState } from '../core/rng';
import type { QuestState } from '../quest/core';
import type { EventMap } from '../events/maps';
import { Physics } from '../physics/Physics';
import { CharacterMotor } from '../physics/CharacterMotor';
import type { Rapier } from '../physics/rapier';
import { tagCollider, tagOf, type Material } from '../physics/surface';
import type { BandsState } from './bands';

/** Same-engine snapshot format; live callbacks and authored content are installed by the fresh host. */
export const SIM_SNAPSHOT_VERSION = 1;
/** Durable per-region ceiling in stored characters; the grid caller uses a logical checkpoint if exact encoding exceeds it. */
export const SIM_REGION_SNAPSHOT_CHAR_BUDGET = 512 * 1024;
/**
 * A supplied immutable basis differs after strict metadata and packed framing validation. This does not authenticate
 * old native bytes: logical fallback additionally requires the durable owner's integrity seal and portable checkpoint.
 * Missing basis, malformed chunks/references and incompatible engine versions never produce this error.
 */
export class SnapshotBasisMismatchError extends RangeError {
  readonly levelId: string;
  readonly tick: number;
  constructor(levelId: string, tick: number) { super('Snapshot physics basis mismatch'); this.name = 'SnapshotBasisMismatchError'; this.levelId = levelId; this.tick = tick; }
}
type EventValue =
  | { kind: 'value'; value: null | boolean | number | string }
  | { kind: 'undefined' }
  | { kind: 'number'; value: 'infinity' | '-infinity' | 'nan' }
  | { kind: 'vector'; value: number[] }
  | { kind: 'actor'; id: string }
  | { kind: 'entity'; id: string }
  | { kind: 'position'; id: string }
  | { kind: 'player' }
  | { kind: 'array'; items: EventValue[] }
  | { kind: 'record'; entries: [string, EventValue][] };
type MotorState = ReturnType<CharacterMotor['snapshot']>;
/** Engine continuations plus typed F1 slots. Rapier bytes and event actor references survive JSON round trips. */
export interface SimSnapshot {
  version: number; apiVersion: number; levelId: string; levelFingerprint: number;
  state: { tick: number; accumulator: number; timers: Record<string, number> };
  clock: GameClockState; rng: RngStreamsState;
  entities: { id: string; state: ReturnType<AnimalSim['snapshot']>; motor: MotorState | null }[];
  player: { id: string; position: number[]; yaw: number; health: EventValue; motor: MotorState; impulse?: number[] | undefined;
    fall?: { vy: number; grounded: boolean } | undefined; shove?: { t: number; vx: number; vz: number } | undefined };
  strikes: { id: string; state: ReturnType<StrikeRunner['snapshot']> }[];
  targets: readonly (readonly [string, string])[];
  events: { version: number; queue: { name: keyof EventMap; payload: EventValue }[]; frameCount: number; frameBound: boolean };
  physics: number[]; colliderTags: { handle: number; material: Material; owner: EventValue }[];
  flags: string[]; quests: ReturnType<QuestState['snapshot']>[];
  slots: SimSlots; adapters: { id: string; state: SimValue }[];
  /** SF72 body band clocks (SimHost.useBodyBands); absent for a host without bands, so its bytes are unchanged. */
  bands?: BandsState | undefined;
}

/** Serialize exact physics (≤32 MB) in bounded lossless blocks; optional immutable fresh-world bytes serve as a checked basis. */
export function serializeSimSnapshot(saved: SimSnapshot, physicsBasis?: Uint8Array): string {
  return serializeSnapshotData(saved, SIM_API_VERSION, physicsBasis);
}
/** The same wire in stages: each `yield` is a pause a caller may spread across frames (a periodic autosave), and
 *  {@link finishSimSteps} runs it whole. The snapshot is read only before the first pause. */
export function serializeSimSnapshotSteps(saved: SimSnapshot, physicsBasis?: Uint8Array): Generator<undefined, string> {
  return serializeSnapshotDataSteps(saved, SIM_API_VERSION, physicsBasis);
}
/** Run a staged snapshot job to completion now. */
export function finishSimSteps<T>(steps: Generator<undefined, T>): T { return finishSteps(steps); }
/** Decode compressed/legacy JSON; a basis-referencing wire requires its exact checked basis. Never drops native geometry/state. */
export function decodeSimSnapshot(input: unknown, physicsBasis?: Uint8Array): SimSnapshot {
  return decodeSnapshotData(input, SIM_API_VERSION, physicsBasis, (levelId, tick) => new SnapshotBasisMismatchError(levelId, tick));
}

function encode(value: unknown, host: SimHost, parents = new Set<object>()): EventValue {
  if (value === undefined) return { kind: 'undefined' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { kind: 'number', value: Number.isNaN(value) ? 'nan' : value > 0 ? 'infinity' : '-infinity' };
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return { kind: 'value', value };
  if (typeof value !== 'object') throw new TypeError('Snapshot payload contains a callback or unsupported value');
  if (value === host.player || host.isExternalPlayerObject(value)) return { kind: 'player' };
  if (value === host.player.position) return { kind: 'position', id: host.player.id };
  if (value === host.player.health) return { kind: 'actor', id: host.player.id };
  for (const entity of host.entities.values()) {
    if (value === entity) return { kind: 'entity', id: entity.entityId };
    if (value === entity.position) return { kind: 'position', id: entity.entityId };
    if (value === entity.combatActor()) return { kind: 'actor', id: entity.entityId };
  }
  if (value instanceof Vector3) return { kind: 'vector', value: value.toArray() };
  if (parents.has(value)) throw new TypeError('Snapshot payload contains an unregistered cycle');
  const next = new Set(parents); next.add(value);
  if (Array.isArray(value)) return { kind: 'array', items: value.map((item: unknown) => encode(item, host, next)) };
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError('Snapshot payload contains an unsupported instance');
  return { kind: 'record', entries: Object.entries(value).map(([key, item]) => [key, encode(item, host, next)]) };
}
function decode(value: EventValue, host: SimHost): unknown {
  switch (value.kind) {
    case 'value': return value.value;
    case 'undefined': return undefined;
    case 'player': return host.player;
    case 'number': return value.value === 'nan' ? Number.NaN : value.value === 'infinity' ? Infinity : -Infinity;
    case 'vector': {
      if (value.value.length !== 3 || !value.value.every(Number.isFinite)) throw new RangeError('Invalid event vector');
      return new Vector3().fromArray(value.value);
    }
    case 'actor': {
      const actor = value.id === host.player.id ? host.player.health : host.entities.get(value.id)?.combatActor();
      if (actor === undefined) throw new RangeError(`Unknown snapshot actor: ${value.id}`);
      return actor;
    }
    case 'entity': {
      const entity = host.entities.get(value.id);
      if (entity === undefined) throw new RangeError(`Unknown snapshot entity: ${value.id}`);
      return entity;
    }
    case 'position': {
      const position = value.id === host.player.id ? host.player.position : host.entities.get(value.id)?.position;
      if (position === undefined) throw new RangeError(`Unknown snapshot position: ${value.id}`);
      return position;
    }
    case 'array': return value.items.map((item) => decode(item, host));
    case 'record': return Object.fromEntries(value.entries.map(([key, item]) => [key, decode(item, host)]));
    default: throw new RangeError('Invalid snapshot payload');
  }
}
function cloneValue(value: SimValue): SimValue {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Simulation slots require finite JSON values');
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}
function cloneSlots(slots: SimSlots): SimSlots {
  const record = (values: Record<string, SimValue>): Record<string, SimValue> => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneValue(value)]));
  return { scriptMemory: record(slots.scriptMemory), scriptGlobals: record(slots.scriptGlobals), questState: record(slots.questState), ledgerDedupe: [...slots.ledgerDedupe] };
}
function entityMotor(entity: AnimalSim): CharacterMotor | null {
  if (entity.motor === null) return null;
  if (!(entity.motor instanceof CharacterMotor)) throw new TypeError(`Entity ${entity.entityId} requires a registered motor snapshot adapter`);
  return entity.motor;
}

/** Canonical logical continuation for a local authored region, without the profile-owned traveler or opaque world bytes. */
export function regionalContinuation(host: SimHost): string {
  const motorState = (motor: CharacterMotor | null) => {
    if (motor === null) return null;
    const state = motor.snapshot();
    const body = state.anchorBodyHandle === null ? null : host.physics.world.getRigidBody(state.anchorBodyHandle);
    return { filter: state.filter, ghost: state.ghost, enabled: state.enabled, yaw: state.yaw, anchor: state.anchor,
      anchorBody: body === null ? null : { position: body.translation(), rotation: body.rotation() }, climb: state.climbAngle, slide: state.slideAngle,
      result: { grounded: state.result.grounded, groundNormalY: state.result.groundNormalY, downhillX: state.result.downhillX, downhillZ: state.result.downhillZ, horizontalFreedom: state.result.horizontalFreedom } };
  };
  return JSON.stringify({ level: host.level, state: host.state, clock: host.clock.snapshot(), rng: host.rng.snapshot(),
    entities: [...host.entities].sort(([a], [b]) => a.localeCompare(b)).map(([id, entity]) => [id, entity.snapshot(), motorState(entityMotor(entity))]),
    strikes: [...host.strikes].filter(([id]) => id !== host.player.id).sort(([a], [b]) => a.localeCompare(b)).map(([id, runner]) => [id, runner.snapshot()]),
    targets: host.attackTargets().filter(([id]) => id !== host.player.id), flags: host.flags.all.sort((a, b) => a.localeCompare(b)), quests: host.quests.map((quest) => quest.snapshot()), slots: cloneSlots(host.slots),
    events: host.events.snapshot((value) => encode(value, host)),
    adapters: [...host.adapters].sort(([a], [b]) => a.localeCompare(b)).map(([id, adapter]) => [id, cloneValue(adapter.snapshot())]),
    ...bandsField(host) });
}
/** The body band clocks, omitted for a host without bands (its continuation bytes stay as they were). */
function bandsField(host: SimHost): { bands?: BandsState } {
  const bands = host.bodyBandState();
  return bands === undefined ? {} : { bands };
}

/** Capture at a fixed-step boundary; pending events are preserved without flushing them. */
export function snapshotSimHost(host: SimHost): SimSnapshot {
  if (host.embedded) throw new Error('Borrowed simulation snapshots belong to the client world owner');
  if (host.scope.disposed) throw new Error('Cannot snapshot a disposed host');
  const colliderTags: SimSnapshot['colliderTags'] = [];
  host.physics.world.forEachCollider((collider) => { const tag = tagOf(collider); if (tag !== undefined) colliderTags.push({ handle: collider.handle, material: tag.material, owner: encode(tag.owner, host) }); });
  return { version: SIM_SNAPSHOT_VERSION, apiVersion: SIM_API_VERSION, levelId: host.level.id, levelFingerprint: fnv1a32(JSON.stringify(host.level)),
    state: { tick: host.state.tick, accumulator: host.state.accumulator, timers: { ...host.state.timers } }, clock: host.clock.snapshot(), rng: host.rng.snapshot(),
    entities: [...host.entities].map(([id, entity]) => ({ id, state: entity.snapshot(), motor: entityMotor(entity)?.snapshot() ?? null })),
    // a resting impulse is omitted (canonical: absent = zero), so a host that was never shoved keeps its exact bytes
    player: { id: host.player.id, position: host.player.position.toArray(), yaw: host.player.yaw, health: encode(host.player.health.snapshot(), host), motor: host.player.motor.snapshot(),
      ...(host.playerImpulse.lengthSq() > 0 ? { impulse: host.playerImpulse.toArray() } : {}),
      // likewise a player at rest on the ground (the fall law's canonical state) is omitted
      ...(host.playerFall.grounded && host.playerFall.vy === 0 ? {} : { fall: { ...host.playerFall } }),
      ...(host.playerShove.t > 0 ? { shove: { ...host.playerShove } } : {}) },
    strikes: [...host.strikes].map(([id, runner]) => ({ id, state: runner.snapshot() })), targets: host.attackTargets(),
    events: host.events.snapshot((value) => encode(value, host)), physics: byteArray(host.physics.snapshot()), colliderTags,
    flags: host.flags.all, quests: host.quests.map((quest) => quest.snapshot()), slots: cloneSlots(host.slots),
    adapters: [...host.adapters].map(([id, adapter]) => ({ id, state: cloneValue(adapter.snapshot()) })), ...bandsField(host) };
}

function sameIds(actual: readonly string[], expected: Iterable<string>): boolean {
  const wanted = new Set(expected);
  return wanted.size === actual.length && new Set(actual).size === actual.length && actual.every((id) => wanted.has(id));
}

/** Boot a fresh matching level, reinstall scoped adapters, then restore every continuation before replay. */
export function restoreSimHost(level: SimLevel, ports: { rapier: Rapier }, saved: SimSnapshot, install?: (host: SimHost) => void): SimHost {
  if (saved.version !== SIM_SNAPSHOT_VERSION || saved.apiVersion !== SIM_API_VERSION || saved.levelId !== level.id
    || saved.levelFingerprint !== fnv1a32(JSON.stringify(level)) || !Number.isSafeInteger(saved.state.tick) || saved.state.tick < 0
    || !Number.isFinite(saved.state.accumulator) || saved.state.accumulator < -Number.EPSILON
    || !Object.values(saved.state.timers).every((value) => Number.isFinite(value) && value >= 0)
    || saved.physics.length === 0 || saved.physics.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new RangeError('Incompatible simulation snapshot');
  const host = createSimHost(level, ports);
  let replacement: Physics | null = null;
  try {
    install?.(host);
    if (saved.player.id !== host.player.id || !sameIds(saved.entities.map((entry) => entry.id), host.entities.keys())
      || !sameIds(saved.strikes.map((entry) => entry.id), host.strikes.keys()) || !sameIds(saved.adapters.map((entry) => entry.id), host.adapters.keys())
      || !sameIds(saved.quests.map((entry) => entry.id), host.quests.map((quest) => quest.def.id))
      || saved.player.position.length !== 3 || !saved.player.position.every(Number.isFinite) || !Number.isFinite(saved.player.yaw)
      || (saved.player.impulse !== undefined && (saved.player.impulse.length !== 3 || !saved.player.impulse.every(Number.isFinite) || saved.player.impulse.every(value => value === 0)))
      || (saved.player.fall !== undefined && (!Number.isFinite(saved.player.fall.vy) || (saved.player.fall.grounded && saved.player.fall.vy === 0)))
      || (saved.player.shove !== undefined && (![saved.player.shove.t, saved.player.shove.vx, saved.player.shove.vz].every(Number.isFinite) || saved.player.shove.t <= 0 || saved.player.shove.t > SHOVE_TIME))) throw new RangeError('Snapshot instance registrations do not match');
    for (const entry of saved.entities) host.entities.get(entry.id)?.restore(entry.state);
    host.player.position.fromArray(saved.player.position); host.player.yaw = saved.player.yaw;
    if (saved.player.impulse === undefined) host.playerImpulse.set(0, 0, 0); else host.playerImpulse.fromArray(saved.player.impulse);
    host.playerFall.vy = saved.player.fall?.vy ?? 0; host.playerFall.grounded = saved.player.fall?.grounded ?? true;
    Object.assign(host.playerShove, saved.player.shove ?? { t: 0, vx: 0, vz: 0 });
    host.player.health.restore(decode(saved.player.health, host) as ReturnType<PlayerHealth['snapshot']>);
    for (const entry of saved.strikes) host.strikes.get(entry.id)?.restore(entry.state, host.strikeSpecifications(entry.id));
    host.flags.restore(saved.flags);
    for (const quest of host.quests) { const state = saved.quests.find((entry) => entry.id === quest.def.id); if (state !== undefined) quest.restore(state); }
    host.rng.restore(saved.rng); host.clock.restore(saved.clock);
    host.state.tick = saved.state.tick; host.state.accumulator = saved.state.accumulator;
    for (const key of Object.keys(host.state.timers)) delete host.state.timers[key];
    Object.assign(host.state.timers, saved.state.timers);
    const slots = cloneSlots(saved.slots);
    for (const key of ['scriptMemory', 'scriptGlobals', 'questState'] as const) {
      for (const name of Object.keys(host.slots[key])) delete host.slots[key][name];
      Object.assign(host.slots[key], slots[key]);
    }
    host.slots.ledgerDedupe.splice(0, host.slots.ledgerDedupe.length, ...slots.ledgerDedupe);
    for (const entry of saved.adapters) host.adapters.get(entry.id)?.restore(cloneValue(entry.state));
    host.restoreBodyBands(saved.bands);
    const actors = new Set([host.player.id, ...host.entities.keys()]);
    if (new Set(saved.targets.map(([id]) => id)).size !== saved.targets.length
      || saved.targets.some(([id, target]) => !host.strikes.has(id) || !actors.has(target))) throw new RangeError('Snapshot strike target does not exist');
    host.restoreAttackTargets(saved.targets);
    host.events.restore(saved.events, (value) => decode(value, host));
    replacement = new Physics(ports.rapier, new Uint8Array(saved.physics));
    const playerMotor = new CharacterMotor(replacement, host.player.motor.opts, saved.player.motor);
    const motors = new Map<string, CharacterMotor>();
    // under the physics body LOD the saved bodies hold motors by distance: each saved one reconnects in the page's capsule
    const lod = host.bodyBands?.physics === true;
    for (const entry of saved.entities) {
      const entity = host.entities.get(entry.id), motor = entity === undefined ? null : entityMotor(entity);
      if (lod) { if (entity !== undefined && entry.motor !== null) motors.set(entry.id, new CharacterMotor(replacement, host.creatureMotorOptions(entity), entry.motor)); continue; }
      if ((entry.motor === null) !== (motor === null)) throw new RangeError('Snapshot motor registrations do not match');
      if (motor !== null && entry.motor !== null) motors.set(entry.id, new CharacterMotor(replacement, motor.opts, entry.motor));
    }
    host.player.motor.dispose(); for (const entity of host.entities.values()) entity.motor?.dispose(); host.physics.dispose();
    host.physics = replacement; replacement = null; host.player.motor = playerMotor;
    if (lod) for (const [id, entity] of host.entities) entity.motor = motors.get(id) ?? null;
    else for (const [id, motor] of motors) { const entity = host.entities.get(id); if (entity !== undefined) entity.motor = motor; }
    for (const tag of saved.colliderTags) {
      if (!host.physics.world.colliders.contains(tag.handle)) throw new RangeError('Snapshot collider tag does not exist');
      tagCollider(host.physics.world.getCollider(tag.handle), tag.material, decode(tag.owner, host));
    }
    for (const adapter of host.adapters.values()) adapter.physicsRestored?.();
    return host;
  } catch (error) { replacement?.dispose(); host.dispose(); throw error; }
}
