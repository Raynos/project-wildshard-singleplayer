import * as v from 'valibot';
import type { SimValue } from '../sim';
import type { SimSnapshot } from './snapshot';

const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const integer = v.pipe(nonnegative, v.safeInteger());
const uint32 = v.pipe(integer, v.maxValue(0xffffffff));
const id = v.pipe(v.string(), v.minLength(1));
const version = v.literal(1);
const vector = v.tuple([finite, finite, finite]);
const point = v.strictObject({ x: finite, y: finite, z: finite });
const nullableNumber = v.nullable(finite);
const motor = v.strictObject({
  version, colliderHandle: nonnegative, filter: uint32, ghost: v.string(), enabled: v.boolean(), yaw: finite,
  anchor: point, anchorBodyHandle: v.nullable(nonnegative), climbAngle: finite, slideAngle: finite,
  result: v.strictObject({ grounded: v.boolean(), groundNormalY: finite, downhillX: finite, downhillZ: finite,
    horizontalFreedom: finite, groundColliderHandle: v.nullable(nonnegative) }),
});
const simValue: v.GenericSchema<SimValue> = v.lazy(() => v.union([
  v.null(), v.boolean(), finite, v.string(), v.array(simValue), v.record(v.string(), simValue),
]));
type EventValue = SimSnapshot['player']['health'];
const eventValue: v.GenericSchema<EventValue> = v.lazy(() => v.variant('kind', [
  v.strictObject({ kind: v.literal('value'), value: v.union([v.null(), v.boolean(), finite, v.string()]) }),
  v.strictObject({ kind: v.literal('undefined') }),
  v.strictObject({ kind: v.literal('number'), value: v.picklist(['infinity', '-infinity', 'nan']) }),
  v.strictObject({ kind: v.literal('vector'), value: vector }),
  v.strictObject({ kind: v.literal('actor'), id }), v.strictObject({ kind: v.literal('entity'), id }),
  v.strictObject({ kind: v.literal('position'), id }), v.strictObject({ kind: v.literal('player') }),
  v.strictObject({ kind: v.literal('array'), items: v.array(eventValue) }),
  v.strictObject({ kind: v.literal('record'), entries: v.pipe(v.array(v.tuple([v.string(), eventValue])),
    v.check((entries) => new Set(entries.map(([key]) => key)).size === entries.length, 'Duplicate payload key')) }),
]));
const animal = v.strictObject({
  version, id,
  motion: v.strictObject({ hp: finite, maxHp: finite, yaw: finite, speed: finite, herd: finite, desiredYaw: finite,
    desiredSpeed: finite, turnRate: finite, lookWeight: finite, seed: finite, scale: finite, strafe: finite,
    desiredStrafe: finite, yOffset: finite, attackT: finite, attackDur: finite, flinch: finite, flinchRoll: finite,
    flinchPitch: finite, stunT: finite, pushT: finite, pushDist: finite, brace: finite, deathT: finite,
    deathSide: finite, groundY: finite, tiltRollT: finite, elapsed: finite, fallVelocity: finite }),
  flags: v.strictObject({ alive: v.boolean(), harnessHold: v.boolean(), aggressive: v.boolean(), driven: v.boolean(),
    levelGround: v.boolean(), scripted: v.boolean(), falling: v.boolean() }),
  kind: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']), label: v.string(),
  state: v.picklist(['idle', 'graze', 'wander', 'alert', 'flee', 'charge', 'stalk', 'dead', 'attack', 'perch', 'rise', 'hide', 'sidestep']),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }),
  mem: v.record(v.string(), finite), position: vector, lookTarget: vector, pushDir: vector, impulse: vector,
  lastHitT: nullableNumber, attackTurnCap: nullableNumber,
  flight: v.nullable(v.strictObject({ version, altitude: finite, sampleIn: finite, floor: nullableNumber, smoothFloor: nullableNumber })),
});
const strike = v.strictObject({ version, phase: v.picklist(['idle', 'windup', 'active', 'recover', 'cooldown']),
  currentId: v.nullable(id), hit: v.boolean(), elapsed: nonnegative, speedMul: v.pipe(finite, v.check((value) => value > 0)),
  clock: nonnegative, deadlines: v.array(v.strictObject({ id, at: finite })), scores: v.array(v.strictObject({ id, score: finite })),
  x0: finite, z0: finite, x1: finite, z1: finite, yaw: finite, length: finite });
const rng = v.strictObject({ version, state: uint32, initial: uint32, scrambledFork: v.boolean() });
const entries = {
  version, apiVersion: integer, levelId: id, levelFingerprint: uint32,
  state: v.strictObject({ tick: integer, accumulator: v.pipe(finite, v.minValue(-Number.EPSILON)), timers: v.record(v.string(), nonnegative) }),
  clock: v.strictObject({ version, elapsed: nonnegative, wall: nonnegative, frames: integer,
    captureFps: v.nullable(v.pipe(finite, v.check((value) => value > 0))), paused: v.boolean(), scale: nonnegative }),
  rng: v.strictObject({ version, seed: uint32, streams: v.array(v.strictObject({
    name: v.picklist(['gameplay', 'ai', 'spawn', 'cosmetic']), state: rng })) }),
  entities: v.array(v.strictObject({ id, state: animal, motor: v.nullable(motor) })),
  player: v.strictObject({ id, position: vector, yaw: finite, health: eventValue, motor }),
  strikes: v.array(v.strictObject({ id, state: strike })), targets: v.array(v.tuple([id, id])),
  events: v.strictObject({ version, queue: v.array(v.strictObject({
    name: v.custom<SimSnapshot['events']['queue'][number]['name']>((input) => typeof input === 'string' && input.length > 0), payload: eventValue })),
    frameCount: v.pipe(integer, v.maxValue(1000)), frameBound: v.boolean() }),
  colliderTags: v.array(v.strictObject({ handle: nonnegative,
    material: v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']), owner: eventValue })),
  flags: v.array(id), quests: v.array(v.strictObject({ version, id, started: v.boolean(), currentId: v.nullable(id) })),
  slots: v.strictObject({ scriptMemory: v.record(v.string(), simValue), scriptGlobals: v.record(v.string(), simValue),
    questState: v.record(v.string(), simValue), ledgerDedupe: v.array(v.string()) }),
  adapters: v.array(v.strictObject({ id, state: simValue })),
};
const snapshot: v.GenericSchema<SimSnapshot> = v.strictObject({ ...entries,
  physics: v.pipe(v.array(v.pipe(integer, v.maxValue(255))), v.minLength(1)) });
const packedSnapshot = v.strictObject({ ...entries,
  physics: v.strictObject({ encoding: v.literal('base64'), data: v.pipe(v.string(), v.minLength(4)), checksum: uint32 }) });
const wire = v.strictObject({ format: v.literal('sim.snapshot'), version, snapshot: packedSnapshot });
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// A JSON-tree fence also rejects cycles/accessors/classes before lazy recursive schemas run.
function jsonTree(input: unknown, parents = new Set<object>(), depth = 0): void {
  if (depth > 64) throw new RangeError('Snapshot nesting exceeds 64');
  if (input === null || typeof input === 'string' || typeof input === 'boolean' || (typeof input === 'number' && Number.isFinite(input))) return;
  if (typeof input !== 'object' || parents.has(input)) throw new TypeError('Snapshot must contain finite, acyclic JSON data');
  if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw new TypeError('Snapshot must contain plain JSON objects');
  parents.add(input);
  for (const key of Reflect.ownKeys(input)) {
    if (Array.isArray(input) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Snapshot contains a non-JSON property');
    jsonTree(descriptor.value, parents, depth + 1);
  }
  parents.delete(input);
}
function checksum(bytes: readonly number[]): number {
  let value = 2166136261;
  for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
  return value >>> 0;
}
function pack(bytes: readonly number[]): string {
  const chunks: string[] = [];
  let chunk = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0, b = bytes[index + 1] ?? 0, c = bytes[index + 2] ?? 0;
    chunk += alphabet[a >>> 2] ?? '';
    chunk += alphabet[((a & 3) << 4) | (b >>> 4)] ?? '';
    chunk += index + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >>> 6)] ?? '' : '=';
    chunk += index + 2 < bytes.length ? alphabet[c & 63] ?? '' : '=';
    if (chunk.length >= 8192) { chunks.push(chunk); chunk = ''; }
  }
  chunks.push(chunk);
  return chunks.join('');
}
function unpack(data: string): number[] {
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new RangeError('Invalid snapshot base64');
  const bytes: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const a = alphabet.indexOf(data.charAt(index)), b = alphabet.indexOf(data.charAt(index + 1));
    const c = alphabet.indexOf(data.charAt(index + 2)), d = alphabet.indexOf(data.charAt(index + 3));
    bytes.push((a << 2) | (b >>> 4));
    if (c !== -1) bytes.push(((b & 15) << 4) | (c >>> 2));
    if (d !== -1) bytes.push(((c & 3) << 6) | d);
  }
  if (pack(bytes) !== data) throw new RangeError('Noncanonical snapshot base64');
  return bytes;
}
const health = v.strictObject({ version, attributes: v.pipe(v.record(v.string(), v.union([v.number(), v.undefined()])),
  v.check((attributes) => Number.isFinite(attributes['health']) && Number.isFinite(attributes['maxHealth']))),
  effectTags: v.array(v.string()), lastHurt: finite,
  cause: v.nullable(v.strictObject({ kind: v.string(), label: v.string(), text: v.optional(v.string()) })),
  previousMode: v.picklist(['foot', 'board', 'swim', 'ride']) });
function healthData(value: EventValue): unknown {
  switch (value.kind) {
    case 'value': return value.value;
    case 'undefined': return undefined;
    case 'number': return value.value === 'nan' ? Number.NaN : value.value === 'infinity' ? Infinity : -Infinity;
    case 'array': return value.items.map(healthData);
    case 'record': return Object.fromEntries(value.entries.map(([key, entry]) => [key, healthData(entry)]));
    case 'actor': case 'entity': case 'player': case 'position': case 'vector':
      throw new RangeError('Health continuation contains a live reference');
    default: throw new RangeError('Invalid health continuation');
  }
}

function identities(saved: SimSnapshot, apiVersion: number): SimSnapshot {
  v.parse(health, healthData(saved.player.health));
  if (saved.apiVersion !== apiVersion) throw new RangeError('Incompatible simulation engine version');
  const unique = (ids: readonly (string | number)[]) => new Set(ids).size === ids.length;
  if (!unique(saved.entities.map((entity) => entity.id)) || !unique(saved.strikes.map((entry) => entry.id))
    || !unique(saved.adapters.map((entry) => entry.id)) || !unique(saved.quests.map((entry) => entry.id))
    || !unique(saved.rng.streams.map((entry) => entry.name)) || !unique(saved.colliderTags.map((entry) => entry.handle))
    || !unique(saved.targets.map(([source]) => source)) || !unique(saved.flags)
    || saved.entities.some((entity) => entity.id !== entity.state.id || entity.id === saved.player.id)) throw new RangeError('Invalid snapshot identities');
  return saved;
}
// JSON.parse preserves the valid numeric literal -0; JSON.stringify normally loses its sign.
function stringify(value: unknown): string {
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item: unknown) => stringify(item)).join(',')}]`;
  if (typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${stringify(item)}`).join(',')}}`;
  throw new TypeError('Snapshot contains a non-JSON value');
}

/** Internal packed wire writer; the defining public entry supplies its current engine version. */
export function serializeSnapshotData(input: SimSnapshot, apiVersion: number): string {
  jsonTree(input);
  const saved = identities(v.parse(snapshot, input), apiVersion);
  return stringify({ format: 'sim.snapshot', version: 1, snapshot: { ...saved,
    physics: { encoding: 'base64', data: pack(saved.physics), checksum: checksum(saved.physics) } } });
}
/** Internal strict wire parser; unknown static fields are refused at every nesting level. */
export function decodeSnapshotData(input: unknown, apiVersion: number): SimSnapshot {
  const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  jsonTree(parsed);
  const saved = v.parse(wire, parsed).snapshot;
  const physics = unpack(saved.physics.data);
  if (checksum(physics) !== saved.physics.checksum) throw new RangeError('Snapshot physics checksum mismatch');
  return identities(v.parse(snapshot, { ...saved, physics }), apiVersion);
}
