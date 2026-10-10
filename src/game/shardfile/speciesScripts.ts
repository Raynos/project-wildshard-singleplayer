import * as v from 'valibot';
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptSnapshot } from '@wildshard/engine/script/host';
import { ScriptWorld, SCRIPT_OP, type EffectTransaction, type ScriptEffect } from '@wildshard/engine/script/effects';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { readStrikeState } from '@wildshard/engine/ai/strikeState';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimValue } from '@wildshard/engine/sim';

/**
 * Admitted AssemblyScript species brains (SHARD-PLATFORM SF27): a species row's `brain: { archetype: 'script', data }`
 * names a module the game admits on its own ScriptHost under the unchanged ABI-v0 fuel, memory, event, query and failure
 * ceilings (as the shard directors and the weapon hooks). Each decision is a pure call: the module's memory and globals
 * return to their admitted state after it, and the creature's state lives in the host as declared numeric slots, so a
 * policy's continuation is its slots and its strike clock, never module memory.
 *
 * The call's input slots (f64): 0 the call's tick, 1 dt, 2 the phase (1 think, 2 act), 3 the module's entity, 4 alive,
 * 5 calm, 6 the clock, 7 the horizontal distance to the player, 8 the yaw toward the player, 9-10 the player's x z,
 * 11-12 the actor's x z, 13 its yaw, 14 its seed hash (`seedHash`), 15 its strike phase (0 idle, 1 windup, 2 active,
 * 3 recover, 4 cooldown), 16 strike busy, 17… its `slots` in order, then its declared `memory` fields' values. The
 * answer is field records on the entity — 1… the new slots, 21… new memory values, 31-33 a steer (yaw, speed, turn rate,
 * speed and turn within the declared bounds) — and at most one declared strike event (trigonometry goes through the math
 * query, `SPECIES_MATH_QUERY`, so it matches the host's Math exactly): the host then asks reach, then an
 * attack token, then picks the strike from the declared catalogue (the trusted StrikeRunner owns windup, contact, damage
 * and cooldown). A trap, a fuel overrun or an undeclared record refuses the call (the body stands still that step).
 */

const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const id = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9_]*$/u), v.maxLength(64));
/** A script species brain's declaration: its module, parameters, state slots, actor memory and strike catalogue. */
export const ScriptSpeciesSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('script'), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  parameters: v.pipe(v.array(finite), v.maxLength(64)),
  /** the creature's numeric state, with its spawn values */
  slots: v.pipe(v.array(finite), v.maxLength(8)),
  /** actor memory fields the module reads and writes (a pose's `mem`), with their spawn values */
  memory: v.pipe(v.array(v.strictObject({ field, initial: finite })), v.maxLength(4)),
  maxSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  maxTurnRate: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(30)),
  strikes: v.pipe(v.array(v.strictObject({ event: id, strike: key })), v.minLength(1), v.maxLength(8)),
}), v.check(row => new Set(row.strikes.map(s => s.event)).size === row.strikes.length && new Set(row.memory.map(m => m.field)).size === row.memory.length,
  'Unique script species strikes and memory fields'));
/** Validated script species data. */
export type ScriptSpeciesData = v.InferOutput<typeof ScriptSpeciesSchema>;
/** Validate before admission or allocation. */
export function parseScriptSpecies(input: unknown): ScriptSpeciesData { return v.parse(ScriptSpeciesSchema, input); }

/**
 * The math query (kind 1): `[op, kx, x, ky, y, 0, 0, 0]` answers `[f(kx * 8192 + x, ky * 8192 + y)]` with the host's own
 * Math (op 1 sin, 2 cos, 3 atan2), so a module's trigonometry is bit-identical to the TypeScript policies' in every
 * client; a large argument is split into an exact multiple of 8192 and a remainder, inside the query's ±10,000 inputs.
 */
export const SPECIES_MATH_QUERY = 1;
/** The math query's answer for one request (`SPECIES_MATH_QUERY`). */
export function speciesMath(request: readonly number[]): number {
  const [op, kx = 0, x = 0, ky = 0, y = 0] = request, a = kx * 8192 + x, b = ky * 8192 + y;
  if (op === 1) return Math.sin(a);
  if (op === 2) return Math.cos(a);
  if (op === 3) return Math.atan2(a, b);
  throw new Error('Unknown species math operation');
}
/** The phase selector in input slot 2. */
export const SPECIES_SCRIPT_PHASE = Object.freeze({ think: 1, act: 2 });
const ENTITY = 1, SLOT = 1, MEMORY = 21, STEER = 31, INPUT_SLOTS = 17;
const PHASES = ['idle', 'windup', 'active', 'recover', 'cooldown'] as const;

/** A module's bytes from the base64 its bake wrote (a trusted runtime imports them as data, so admission stays synchronous). */
export function moduleBytes(base64: string): Uint8Array { return Uint8Array.from(atob(base64), char => char.codePointAt(0) ?? 0); }
/** A stable per-actor hash of its seed (an integer below 43,759): `seedHash(seed) % n` is its slot of n. */
export function seedHash(seed: number): number { return Math.floor(Math.abs(Math.sin(seed * 12.9898 + 1.7) * 43758.5)); }

class SpeciesScriptWorld extends ScriptWorld {
  private readonly data: ScriptSpeciesData;
  constructor(data: ScriptSpeciesData) {
    const fields: Record<number, readonly [number, number]> = { [STEER]: [-1000, 1000], [STEER + 1]: [0, data.maxSpeed], [STEER + 2]: [0, data.maxTurnRate] };
    data.slots.forEach((_, i) => { fields[SLOT + i] = [-1e9, 1e9]; });
    data.memory.forEach((_, i) => { fields[MEMORY + i] = [-1e6, 1e6]; });
    super({ fields, archetypes: [], events: data.strikes.map(s => s.event), maxEntities: 1 },
      [{ id: ENTITY, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
    this.data = data;
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    if (self !== ENTITY || effects.filter(e => e.op === SCRIPT_OP.event).length > 1
      || effects.some(e => (e.op !== SCRIPT_OP.field && e.op !== SCRIPT_OP.event) || (e.op === SCRIPT_OP.event && !this.data.strikes.some(s => s.event === e.a)))) throw new Error('Invalid species script answer');
    return super.prepare(effects, self, spawns, events);
  }
}

/** One call's decoded answer. */
export interface SpeciesScriptAnswer { readonly slots: ReadonlyMap<number, number>; readonly memory: ReadonlyMap<number, number>; readonly steer: readonly [number, number, number] | null; readonly strike: string | null }

/** One admitted species module: `decide(phase, observations)` answers one pure call. */
export class SpeciesScriptLane {
  readonly data: ScriptSpeciesData;
  private readonly host: ScriptHost;
  private readonly admitted: ScriptSnapshot;
  private tick = 0;
  constructor(data: ScriptSpeciesData, bytes: Uint8Array) {
    this.data = parseScriptSpecies(data);
    if (sha256(bytes) !== this.data.module) throw new Error('Species script module hash mismatch');
    this.host = new ScriptHost({ world: new SpeciesScriptWorld(this.data), query: (kind, request, self) => {
      if (self !== ENTITY || request.length !== 8) throw new Error('Species scripts query as their entity');
      if (kind === SPECIES_MATH_QUERY) return [speciesMath(request)];
      if (kind !== SCRIPT_PARAMETER_QUERY || request.some(value => value !== 0)) throw new Error('Species scripts query only their parameters and the math query');
      return [...this.data.parameters];
    } });
    this.host.install(this.data.module, Uint8Array.from(bytes));
    this.admitted = this.host.snapshot(this.data.module);
  }
  /** Calls made so far (each is its own script tick). */
  get calls(): number { return this.tick; }
  /** One pure call; null when the module refused it (a trap, fuel, an undeclared record). */
  decide(phase: number, observations: readonly number[]): SpeciesScriptAnswer | null {
    this.host.beginTick(++this.tick);
    const call = this.host.call(this.data.module, ENTITY, [this.tick, ...observations.slice(1)]);
    if (call.ok) this.host.rewind(this.data.module, this.admitted);
    else { if (!call.disabled) this.host.resume(this.data.module, ENTITY); return null; }
    const slots = new Map<number, number>(), memory = new Map<number, number>(), steer: number[] = [];
    let strike: string | null = null;
    for (const effect of call.effects) {
      if (effect.op === SCRIPT_OP.event) { strike = this.data.strikes.find(s => s.event === effect.a)?.strike ?? null; continue; }
      if (effect.a >= STEER) steer[effect.a - STEER] = effect.b;
      else if (effect.a >= MEMORY) memory.set(effect.a - MEMORY, effect.b);
      else slots.set(effect.a - SLOT, effect.b);
    }
    const [yaw, speed, turn] = steer;
    if (phase !== SPECIES_SCRIPT_PHASE.think && phase !== SPECIES_SCRIPT_PHASE.act) throw new Error('Unknown species script phase');
    return { slots, memory, strike, steer: yaw === undefined || speed === undefined || turn === undefined ? null : [yaw, speed, turn] };
  }
}

/** What a script species policy observes (the browser's ThinkCtx and the headless HomeObservation both satisfy it). */
export interface ScriptSpeciesPorts<A extends AnimalSim> {
  dt: number; t: number; player: A['position']; calm: boolean;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
}

const saved = v.strictObject({ version: v.literal(1), actor: v.string(), slots: v.array(v.pipe(v.number(), v.finite())), strikes: v.unknown() });

/** One body's script policy: its slots, its strike clock and the shared admitted lane. */
export class ScriptSpeciesPolicy<A extends AnimalSim> {
  private readonly actor: A;
  private readonly lane: SpeciesScriptLane;
  private readonly catalogue: readonly StrikeSpec[];
  private readonly strikes = new StrikeRunner();
  private readonly slots: number[];
  private readonly input: number[];
  private observation: ScriptSpeciesPorts<A> | null = null;
  private readonly contact: { actor: A; target: A['position']; canReach: () => boolean; hit: (spec: StrikeSpec) => void };
  constructor(actor: A, lane: SpeciesScriptLane, catalogue: readonly StrikeSpec[]) {
    this.actor = actor; this.lane = lane; this.catalogue = catalogue;
    this.slots = [...lane.data.slots]; this.input = Array.from({ length: INPUT_SLOTS + this.slots.length + lane.data.memory.length }, () => 0);
    for (const row of lane.data.memory) actor.mem[row.field] = row.initial;
    this.contact = { actor, target: actor.position, canReach: () => this.observation?.reach(actor) === true, hit: spec => { this.observation?.hurt(spec.damage); } };
  }
  /** The policy's current slot values (a witness; the continuation is `snapshot`). */
  get state(): readonly number[] { return this.slots; }
  private context(ports: ScriptSpeciesPorts<A>): StrikeContext { this.observation = ports; this.contact.target = ports.player; return this.contact; }
  private call(phase: number, ports: ScriptSpeciesPorts<A>): void {
    const a = this.actor, input = this.input, dx = ports.player.x - a.position.x, dz = ports.player.z - a.position.z;
    input[1] = ports.dt; input[2] = phase; input[4] = a.alive ? 1 : 0; input[5] = ports.calm ? 1 : 0; input[6] = ports.t;
    input[7] = Math.hypot(dx, dz); input[8] = Math.atan2(dx, dz); input[9] = ports.player.x; input[10] = ports.player.z;
    input[11] = a.position.x; input[12] = a.position.z; input[13] = a.yaw; input[14] = seedHash(a.seed);
    input[15] = PHASES.indexOf(this.strikes.state); input[16] = this.strikes.busy ? 1 : 0;
    this.slots.forEach((value, i) => { input[INPUT_SLOTS + i] = value; });
    this.lane.data.memory.forEach((row, i) => { input[INPUT_SLOTS + this.slots.length + i] = a.mem[row.field] ?? 0; });
    const answer = this.lane.decide(phase, input);
    if (answer === null) { ports.steer(a, a.yaw, 0, 0); return; }
    answer.slots.forEach((value, i) => { if (i < this.slots.length) this.slots[i] = value; });
    answer.memory.forEach((value, i) => { const row = this.lane.data.memory[i]; if (row !== undefined) a.mem[row.field] = value; });
    if (answer.steer !== null) ports.steer(a, answer.steer[0], answer.steer[1], answer.steer[2]);
    if (answer.strike !== null && !this.strikes.busy && ports.reach(a) && ports.claim(a)) {
      const pick = this.strikes.pick(this.catalogue, this.context(ports)); if (pick) this.strikes.start(pick, a, ports.player);
    }
  }
  /** A decision (the module's think phase). */
  think(ports: ScriptSpeciesPorts<A>): void { this.call(SPECIES_SCRIPT_PHASE.think, ports); }
  /** A movement step: the strike clock advances while alive, then the module's act phase. */
  act(ports: ScriptSpeciesPorts<A>): void {
    if (this.actor.alive) this.strikes.update(ports.dt, this.context(ports));
    this.call(SPECIES_SCRIPT_PHASE.act, ports);
  }
  /** Complete continuation: the slots and the strike clock; no decision, motion or strike runs on restore. */
  snapshot(): SimValue { return JSON.stringify({ version: 1, actor: this.actor.entityId, slots: this.slots, strikes: this.strikes.snapshot() }); }
  restore(input: SimValue): void {
    if (typeof input !== 'string') throw new Error('Invalid script species continuation');
    const parsed: unknown = JSON.parse(input), value = v.parse(saved, parsed);
    if (value.actor !== this.actor.entityId || value.slots.length !== this.slots.length) throw new Error('Incompatible script species continuation');
    this.strikes.restore(readStrikeState(value.strikes, this.catalogue), this.catalogue);
    value.slots.forEach((slot, i) => { this.slots[i] = slot; });
  }
}

const K = Uint32Array.from([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb,
  0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c,
  0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
/** SHA-256 of a module's bytes as lowercase hex (synchronous, so a trusted runtime admits in its synchronous setup). */
export function sha256(bytes: Uint8Array): string {
  const length = bytes.length, padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(bytes); padded[length] = 0x80;
  const view = new DataView(padded.buffer), bits = length * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000)); view.setUint32(padded.length - 4, bits >>> 0);
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] ?? 0, b = w[i - 2] ?? 0;
      w[i] = ((w[i - 16] ?? 0) + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + (w[i - 7] ?? 0) + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0, h[3] ?? 0, h[4] ?? 0, h[5] ?? 0, h[6] ?? 0, h[7] ?? 0];
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, k].forEach((value, i) => { h[i] = ((h[i] ?? 0) + value) >>> 0; });
  }
  return [...h].map(word => word.toString(16).padStart(8, '0')).join('');
}
