import { Vector3 } from 'three';
import { serializeSnapshotData, decodeSnapshotData } from './snapshotData';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel, type SimSlots, type SimValue } from '../sim';
import type { AnimalSim } from '../entities/AnimalSim';
import type { StrikeRunner, StrikeSpec } from '../ai/strikes';
import type { PlayerHealth } from '../combat/health';
import type { GameClockState } from '../core/clock';
import { fnv1a32, type RngStreamsState } from '../core/rng';
import type { QuestState } from '../quest/core';
import type { EventMap } from '../events/maps';
import { Physics } from '../physics/Physics';
import { CharacterMotor } from '../physics/CharacterMotor';
import type { Rapier } from '../physics/rapier';
import { tagCollider, tagOf, type Material } from '../physics/surface';

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
  player: { id: string; position: number[]; yaw: number; health: EventValue; motor: MotorState };
  strikes: { id: string; state: ReturnType<StrikeRunner['snapshot']> }[];
  targets: readonly (readonly [string, string])[];
  events: { version: number; queue: { name: keyof EventMap; payload: EventValue }[]; frameCount: number; frameBound: boolean };
  physics: number[]; colliderTags: { handle: number; material: Material; owner: EventValue }[];
  flags: string[]; quests: ReturnType<QuestState['snapshot']>[];
  slots: SimSlots; adapters: { id: string; state: SimValue }[];
}

/** Serialize exact physics (≤32 MB) in bounded lossless blocks; optional immutable fresh-world bytes serve as a checked basis. */
export function serializeSimSnapshot(saved: SimSnapshot, physicsBasis?: Uint8Array): string {
  return serializeSnapshotData(saved, SIM_API_VERSION, physicsBasis);
}
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
    adapters: [...host.adapters].sort(([a], [b]) => a.localeCompare(b)).map(([id, adapter]) => [id, cloneValue(adapter.snapshot())]) });
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
    player: { id: host.player.id, position: host.player.position.toArray(), yaw: host.player.yaw, health: encode(host.player.health.snapshot(), host), motor: host.player.motor.snapshot() },
    strikes: [...host.strikes].map(([id, runner]) => ({ id, state: runner.snapshot() })), targets: host.attackTargets(),
    events: host.events.snapshot((value) => encode(value, host)), physics: Array.from(host.physics.snapshot()), colliderTags,
    flags: host.flags.all, quests: host.quests.map((quest) => quest.snapshot()), slots: cloneSlots(host.slots),
    adapters: [...host.adapters].map(([id, adapter]) => ({ id, state: cloneValue(adapter.snapshot()) })) };
}

function sameIds(actual: readonly string[], expected: Iterable<string>): boolean {
  const wanted = new Set(expected);
  return wanted.size === actual.length && new Set(actual).size === actual.length && actual.every((id) => wanted.has(id));
}
function specs(level: SimLevel, id: string): StrikeSpec[] {
  const spec = id === 'actor.player' ? level.weapon : level.entities.find((entity) => entity.id === id)?.strike;
  return spec === undefined ? [] : [{ ...spec, weight: () => 1 }];
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
      || saved.player.position.length !== 3 || !saved.player.position.every(Number.isFinite) || !Number.isFinite(saved.player.yaw)) throw new RangeError('Snapshot instance registrations do not match');
    for (const entry of saved.entities) host.entities.get(entry.id)?.restore(entry.state);
    host.player.position.fromArray(saved.player.position); host.player.yaw = saved.player.yaw;
    host.player.health.restore(decode(saved.player.health, host) as ReturnType<PlayerHealth['snapshot']>);
    for (const entry of saved.strikes) host.strikes.get(entry.id)?.restore(entry.state, specs(level, entry.id));
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
    const actors = new Set([host.player.id, ...host.entities.keys()]);
    if (new Set(saved.targets.map(([id]) => id)).size !== saved.targets.length
      || saved.targets.some(([id, target]) => !host.strikes.has(id) || !actors.has(target))) throw new RangeError('Snapshot strike target does not exist');
    host.restoreAttackTargets(saved.targets);
    host.events.restore(saved.events, (value) => decode(value, host));
    replacement = new Physics(ports.rapier, Uint8Array.from(saved.physics));
    const playerMotor = new CharacterMotor(replacement, host.player.motor.opts, saved.player.motor);
    const motors = new Map<string, CharacterMotor>();
    for (const entry of saved.entities) {
      const entity = host.entities.get(entry.id), motor = entity === undefined ? null : entityMotor(entity);
      if ((entry.motor === null) !== (motor === null)) throw new RangeError('Snapshot motor registrations do not match');
      if (motor !== null && entry.motor !== null) motors.set(entry.id, new CharacterMotor(replacement, motor.opts, entry.motor));
    }
    host.player.motor.dispose(); for (const entity of host.entities.values()) entity.motor?.dispose(); host.physics.dispose();
    host.physics = replacement; replacement = null; host.player.motor = playerMotor;
    for (const [id, motor] of motors) { const entity = host.entities.get(id); if (entity !== undefined) entity.motor = motor; }
    for (const tag of saved.colliderTags) {
      if (!host.physics.world.colliders.contains(tag.handle)) throw new RangeError('Snapshot collider tag does not exist');
      tagCollider(host.physics.world.getCollider(tag.handle), tag.material, decode(tag.owner, host));
    }
    for (const adapter of host.adapters.values()) adapter.physicsRestored?.();
    return host;
  } catch (error) { replacement?.dispose(); host.dispose(); throw error; }
}
