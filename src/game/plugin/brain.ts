import type { AnimalSimSpec, AnimalSim } from "@wildshard/engine/entities/AnimalSim";
import type { SimStrike, SimValue, SimHost } from "@wildshard/engine/sim";
import { type StrikeSpec, StrikeRunner, type StrikeContext } from "@wildshard/engine/ai/strikes";
import type { ShardRows } from "@wildshard/format/rows";
import { parseScriptSpecies, type ScriptSpeciesSchema, type ScriptSpeciesData } from "@wildshard/format/speciesScripts";
import { parseEliteScript, type EliteScriptData } from "@wildshard/format/eliteScripts";
import * as v from "valibot";
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptSnapshot } from "@wildshard/engine/script/host";
import { ScriptWorld, SCRIPT_OP, type EffectTransaction, type ScriptEffect } from "@wildshard/engine/script/effects";
import { readStrikeState } from "@wildshard/engine/ai/strikeState";
import { Vector3 } from "three";
import type { EliteActor } from "@wildshard/engine/ai/EliteBrain";
import type { SpeciesRow } from "@wildshard/engine/ai/species";
import type { Animal } from "@wildshard/engine/entities/AnimalView";
import type { ThinkCtx } from "@wildshard/engine/entities/species/registry";
import { SkirmisherBrain } from "@wildshard/engine/ai/skirmisher";
import { GuardianBrain } from "@wildshard/engine/ai/guardian";
import { PerchHunterBrain } from "@wildshard/engine/ai/perchHunter";
import { strikeFromData, type StrikeData } from "@wildshard/engine/ai/strikeRows";
import { RamGrazerBrain } from "@wildshard/engine/ai/ramGrazer";
import { OrbitDiverBrain } from "@wildshard/engine/ai/orbitDiver";
import { BurstFlyerBrain } from "@wildshard/engine/ai/burstFlyer";
import { ChallengeGrazerBrain } from "@wildshard/engine/ai/challengeGrazer";
import { PatrolDiverBrain } from "@wildshard/engine/ai/patrolDiver";
import { PhasedFlyerBrain } from "@wildshard/engine/ai/phasedFlyer";
import { canReach } from "@wildshard/engine/ai/reach";
import type { SimSnapshot } from "@wildshard/engine/sim/snapshot";
import { parseGrazer, grazerPreset, type GrazerSchema, parseChallengeGrazer, type ChallengeGrazerSchema, type ShardChallengeGrazer, type ShardRamGrazer } from "@wildshard/format/grazers";
import { parseDiver, diverPreset, type DiverSchema, parsePatrolDiver, type PatrolDiverSchema, type ShardPatrolDiver, type ShardOrbitDiver, type ShardBurstFlyer } from "@wildshard/format/flyers";
import { phasedDiverPreset, type PhasedDiverSchema, parsePhasedFlyer, type PhasedFlyerSchema, type ShardPhasedFlyer } from "@wildshard/format/phasedFlyers";
import { installHomeKeeper, type KeptBossBody, type KeptBossRow, type KeptHome, type KeptHomeRow } from "../shardfile/homeKeeper";
import { type StalkerSchema, parseStalker, stalkerPreset, type GuardianPatternsSchema, guardianPreset, parseGuardianPattern, parseSkirmisher, parseGuardian, parsePerchHunter, type SkirmisherSchema, type GuardianSchema, type PerchHunterSchema, type ShardSkirmisher, type ShardGuardian, type ShardPerchHunter } from "@wildshard/format/brains";

/** Resolve both species and variant, preserving authored health and gameplay multipliers. */
export function speciesResolver(rows: ShardRows): (speciesId: string, variantId: string) => AnimalSimSpec {
  const catalogue = new Map(rows.species.map((row) => [row.id, row]));
  return (speciesId, variantId) => {
    const row = catalogue.get(speciesId), selected = row?.variants.find((variantRow) => variantRow.id === variantId);
    if (row === undefined || selected === undefined) throw new Error('Unresolved declared species/variant');
    return { kind: row.kind, label: selected.label, variant: selected.id, rarity: selected.rarity, hp: selected.hp, aggressive: row.aggressive, lockable: row.lockable,
      dims: { ...row.dims, feet: row.dims.feet.map(([x, z]) => [x, z]) }, mods: { ...selected.mods }, ...(row.flight === undefined ? {} : { flight: { ...row.flight } }) };
  };
}
/** Numeric strike rows feed the authoritative sim without a score callback. */
export function simStrikes(rows: ShardRows): ReadonlyMap<string, SimStrike> {
  return new Map(rows.strikes.map(({ weight: _weight, speed, ...row }) => [row.id, { ...row, motion: { speed } }]));
}
/** Legacy strike scoring is an engine-owned constant adapter over the declared weight. */
export function scoredStrikes(rows: ShardRows): readonly StrikeSpec[] {
  const numeric = simStrikes(rows);
  return rows.strikes.map((row) => { const spec = numeric.get(row.id); if (spec === undefined) throw new Error('Missing strike'); return { ...spec, weight: () => row.weight }; });
}

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
const speciesScriptsENTITY = 1, speciesScriptsSLOT = 1, MEMORY = 21, STEER = 31, INPUT_SLOTS = 17;
const PHASES = ['idle', 'windup', 'active', 'recover', 'cooldown'] as const;

/** A module's bytes from the base64 its bake wrote (a trusted runtime imports them as data, so admission stays synchronous). */
export function moduleBytes(base64: string): Uint8Array { return Uint8Array.from(atob(base64), char => char.codePointAt(0) ?? 0); }
/** A stable per-actor hash of its seed (an integer below 43,759): `seedHash(seed) % n` is its slot of n. */
export function seedHash(seed: number): number { return Math.floor(Math.abs(Math.sin(seed * 12.9898 + 1.7) * 43758.5)); }

class SpeciesScriptWorld extends ScriptWorld {
  private readonly data: ScriptSpeciesData;
  constructor(data: ScriptSpeciesData) {
    const fields: Record<number, readonly [number, number]> = { [STEER]: [-1000, 1000], [STEER + 1]: [0, data.maxSpeed], [STEER + 2]: [0, data.maxTurnRate] };
    data.slots.forEach((_, i) => { fields[speciesScriptsSLOT + i] = [-1e9, 1e9]; });
    data.memory.forEach((_, i) => { fields[MEMORY + i] = [-1e6, 1e6]; });
    super({ fields, archetypes: [], events: data.strikes.map(s => s.event), maxEntities: 1 },
      [{ id: speciesScriptsENTITY, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
    this.data = data;
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    if (self !== speciesScriptsENTITY || effects.filter(e => e.op === SCRIPT_OP.event).length > 1
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
      if (self !== speciesScriptsENTITY || request.length !== 8) throw new Error('Species scripts query as their entity');
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
    const call = this.host.call(this.data.module, speciesScriptsENTITY, [this.tick, ...observations.slice(1)]);
    if (call.ok) this.host.rewind(this.data.module, this.admitted);
    else { if (!call.disabled) this.host.resume(this.data.module, speciesScriptsENTITY); return null; }
    const slots = new Map<number, number>(), memory = new Map<number, number>(), steer: number[] = [];
    let strike: string | null = null;
    for (const effect of call.effects) {
      if (effect.op === SCRIPT_OP.event) { strike = this.data.strikes.find(s => s.event === effect.a)?.strike ?? null; continue; }
      if (effect.a >= STEER) steer[effect.a - STEER] = effect.b;
      else if (effect.a >= MEMORY) memory.set(effect.a - MEMORY, effect.b);
      else slots.set(effect.a - speciesScriptsSLOT, effect.b);
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

const speciesScriptsSaved = v.strictObject({ version: v.literal(1), actor: v.string(), slots: v.array(v.pipe(v.number(), v.finite())), strikes: v.unknown() });

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
    const parsed: unknown = JSON.parse(input), value = v.parse(speciesScriptsSaved, parsed);
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

/**
 * Admitted AssemblyScript elite fight scripts (SHARD-PLATFORM SF27): a named elite's fight — the moves it picks, its clocks
 * and its tells — is a module the game admits on its own ScriptHost under the unchanged ABI-v0 ceilings (as the species
 * scripts, the directors and the weapon hooks). The game's elite rules (lair, aware / engaged / leash, phase 2, respawn) and
 * the trusted strike runners stay the host's; each engaged step is one pure call (the module returns to its admitted memory
 * after it) whose state lives in the host as declared numeric `slots`, so the elite's continuation is its slots.
 *
 * The call's inputs (f64): 0 the call's tick, 1 dt, 2 the clock, 3 the module's entity, 4 the elite's mode (its index in
 * `modes`), 5 the mode's seconds, 6 phase 2, 7 the horizontal distance and 8 the yaw to the player, 9-10 the player's x z,
 * 11-12 the body's x z, 13 its seed, 14 its last hit time (never under -1e9), 15 god mode, 16-18 lane 0's state (0 none,
 * 1 tell, 2 run, 3 skid), clock and busy, 19-20 two shard-defined host values, 21… the slots in order. Before the call, the
 * ring tell's clock moves to the frame's, then a lane whose `lanes` row names the current mode steps on the body clock (its
 * hit hurts the player, then shakes by `trauma`).
 *
 * The answer is an ordered command stream: field records 1… are the new slots, 41-42 two argument registers, and each
 * event is one verb applied in order with its value and the registers (`ELITE_VERB`). Trigonometry and hypot go through
 * the math query (kind 1: op 1 sin, 2 cos, 3 atan2, 4 hypot on the host's Math), so a module matches the TypeScript goal
 * it replaces bit for bit; kind 2 draws the elite's own seeded stream. A trap, a fuel overrun or an undeclared record
 * refuses the call (the body stands still that step).
 */

/** The verbs an elite script's events name (event id → verb). */
export const ELITE_VERB = Object.freeze({
  /** value: the new mode's index (its clock restarts) */
  mode: 1,
  /** value: yaw; registers: speed, turn rate (inside the declared bounds) */
  steer: 2,
  /** value: look weight; registers: the target's height over the player, 1 to aim at the player (0 keeps the target) */
  look: 3,
  /** value: the voice's index */
  voice: 4,
  /** the elite's signature flash */
  signature: 5,
  /** value: the lane; registers: tell seconds, speed multiplier (aimed through the player) */
  lane: 6,
  /** value: the contact's index */
  contact: 7,
  /** value: the shake */
  trauma: 8,
  /** value: the body's attack seconds */
  attack: 9,
  /** value: the ring tell's radius round the body; register: its opacity */
  ring: 10,
  /** the ring tell off */
  ringHide: 11,
  /** value: the shard action's index */
  action: 12,
});
const VERBS: readonly number[] = Object.values(ELITE_VERB);
/** The random query (kind 2): one draw of the elite's own seeded stream. */
export const ELITE_RANDOM_QUERY = 2;
const eliteScriptsENTITY = 1, eliteScriptsSLOT = 1, ARG = 41, SLOTS_AT = 21;
const HYPOT = 4;

/** The math query's answer: the species math ops plus 4, hypot (`Math.hypot(a, b)`). */
export function eliteMath(request: readonly number[]): number {
  const [op, kx = 0, x = 0, ky = 0, y = 0] = request;
  return op === HYPOT ? Math.hypot(kx * 8192 + x, ky * 8192 + y) : speciesMath(request);
}

class EliteScriptWorld extends ScriptWorld {
  private readonly slotCount: number;
  constructor(data: EliteScriptData) {
    const fields: Record<number, readonly [number, number]> = { [ARG]: [-1e9, 1e9], [ARG + 1]: [-1e9, 1e9] };
    data.slots.forEach((_, i) => { fields[eliteScriptsSLOT + i] = [-1e9, 1e9]; });
    super({ fields, archetypes: [], events: [...VERBS], maxEntities: 1 },
      [{ id: eliteScriptsENTITY, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
    this.slotCount = data.slots.length;
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    if (self !== eliteScriptsENTITY || effects.some(e => (e.op !== SCRIPT_OP.field && e.op !== SCRIPT_OP.event)
      || (e.op === SCRIPT_OP.field && e.a > this.slotCount && e.a !== ARG && e.a !== ARG + 1))) throw new Error('Invalid elite script answer');
    return super.prepare(effects, self, spawns, events);
  }
}

/** One verb of an answer, with its value and the argument registers as they stood. */
export interface EliteCommand { readonly verb: number; readonly value: number; readonly args: readonly [number, number] }

/** One admitted elite module over one elite's slots and seeded stream: `decide(inputs)` answers one pure call. */
export class EliteScriptLane {
  readonly data: EliteScriptData;
  private readonly host: ScriptHost;
  private readonly admitted: ScriptSnapshot;
  private readonly values: number[];
  private tick = 0;
  constructor(data: EliteScriptData, bytes: Uint8Array, random: () => number) {
    this.data = parseEliteScript(data);
    if (sha256(bytes) !== this.data.module) throw new Error('Elite script module hash mismatch');
    this.values = this.data.slots.map(s => s.initial);
    this.host = new ScriptHost({ world: new EliteScriptWorld(this.data), query: (kind, request, self) => {
      if (self !== eliteScriptsENTITY || request.length !== 8) throw new Error('Elite scripts query as their entity');
      if (kind === SPECIES_MATH_QUERY) return [eliteMath(request)];
      if (kind === ELITE_RANDOM_QUERY && request.every(value => value === 0)) return [random()];
      if (kind !== SCRIPT_PARAMETER_QUERY || request.some(value => value !== 0)) throw new Error('Elite scripts query only their parameters, the math and their stream');
      return [...this.data.parameters];
    } });
    this.host.install(this.data.module, Uint8Array.from(bytes));
    this.admitted = this.host.snapshot(this.data.module);
  }
  /** A slot's value by its declared field. */
  slot(field: string): number {
    const i = this.data.slots.findIndex(s => s.field === field), value = this.values[i];
    if (value === undefined) throw new Error(`Elite script ${this.data.id} has no slot ${field}`);
    return value;
  }
  /** Set a slot (a restore, a dev move). */
  setSlot(field: string, value: number): void {
    const i = this.data.slots.findIndex(s => s.field === field);
    if (i === -1 || !Number.isFinite(value)) throw new Error(`Elite script ${this.data.id} cannot set ${field}`);
    this.values[i] = value;
  }
  /** One pure call over inputs 1-20 (`observations[0]` and [3] are the host's); null when the module refused it. */
  decide(observations: readonly number[]): readonly EliteCommand[] | null {
    this.host.beginTick(++this.tick);
    const input = observations.slice(0, SLOTS_AT);
    input[0] = this.tick; input.push(...this.values);
    const call = this.host.call(this.data.module, eliteScriptsENTITY, input);
    if (call.ok) this.host.rewind(this.data.module, this.admitted);
    else { if (!call.disabled) this.host.resume(this.data.module, eliteScriptsENTITY); return null; }
    const out: EliteCommand[] = [], args: [number, number] = [0, 0];
    for (const effect of call.effects) {
      if (effect.op === SCRIPT_OP.event) { out.push({ verb: effect.a, value: effect.c, args: [args[0], args[1]] }); continue; }
      if (effect.a === ARG) args[0] = effect.b;
      else if (effect.a === ARG + 1) args[1] = effect.b;
      else this.values[effect.a - eliteScriptsSLOT] = effect.b;
    }
    return out;
  }
}

/** The body an elite script drives (the browser's Animal and a renderer-free body alike). */
export interface EliteScriptBody extends EliteActor {
  readonly seed: number; readonly lastHitT: number; readonly yaw: number;
  startAttack: (seconds: number) => void;
}
/** One engaged step's view of the fight, as the elite's brain holds it. */
export interface EliteScriptStep<B extends EliteScriptBody> {
  readonly body: B; readonly dt: number; readonly t: number;
  readonly mode: string; readonly modeT: number; readonly p2: boolean;
  /** the horizontal distance and heading to the player, taken before any lane steps */
  readonly d: number; readonly yaw: number;
  readonly player: Vector3; readonly god: boolean;
}
/** A lane as the step reads it. */
export interface EliteLaneView { readonly state: 'none' | 'tell' | 'run' | 'skid'; readonly t: number; readonly busy: boolean }
/** What the verbs do in the shard's world. */
export interface EliteScriptPorts {
  setMode: (mode: string) => void;
  voice: (name: string) => void;
  signature: () => void;
  /** lane `index` as it stands (null: the elite has none; it reads as idle) */
  lane: (index: number) => EliteLaneView | null;
  /** step lane `index` on the body clock; its hit hurts the player, then shakes by `trauma` */
  stepLane: (index: number, trauma: number) => void;
  startLane: (index: number, tell: number, speedMul: number) => void;
  /** a measured contact (`strike` the declared row's id): its hit stuns, hurts and shakes as the row says */
  contact: (row: EliteScriptData['contacts'][number]) => void;
  trauma: (k: number) => void;
  ring: (radius: number, alpha: number) => void;
  ringHide: () => void;
  /** the ring tell's clock to the frame's (first, every engaged step) */
  ringTime?: () => void;
  action: (name: string) => void;
  /** the shard's two host values (inputs 19-20), read after the lanes step */
  hostValues?: () => readonly [number, number];
}
const LANE_STATES = ['none', 'tell', 'run', 'skid'] as const;
const NO_LANE: EliteLaneView = { state: 'none', t: 0, busy: false };

/** One engaged step of an elite script: the declared lanes step, then the call, then its verbs in order. */
export function stepEliteScript<B extends EliteScriptBody>(lane: EliteScriptLane, step: EliteScriptStep<B>, ports: EliteScriptPorts): void {
  const data = lane.data, a = step.body, p = step.player, mode = data.modes.indexOf(step.mode);
  if (mode === -1) throw new Error(`Elite script ${data.id} has no mode ${step.mode}`);
  ports.ringTime?.();
  for (const row of data.lanes) if (row.mode === step.mode) ports.stepLane(row.lane, row.trauma);
  const view = ports.lane(0) ?? NO_LANE, host = ports.hostValues?.() ?? [0, 0];
  const answer = lane.decide([0, step.dt, step.t, eliteScriptsENTITY, mode, step.modeT, step.p2 ? 1 : 0, step.d, step.yaw, p.x, p.z,
    a.position.x, a.position.z, a.seed, Math.max(-1e9, a.lastHitT), step.god ? 1 : 0, LANE_STATES.indexOf(view.state), view.t, view.busy ? 1 : 0, host[0], host[1]]);
  if (answer === null) { a.setMotion(a.yaw, 0, 0); return; }
  for (const { verb, value, args } of answer) {
    switch (verb) {
      case ELITE_VERB.mode: ports.setMode(data.modes[value] ?? step.mode); break;
      case ELITE_VERB.steer: a.setMotion(value, Math.min(data.maxSpeed, Math.max(0, args[0])), Math.min(data.maxTurnRate, Math.max(0, args[1]))); break;
      case ELITE_VERB.look: if (args[1] !== 0) { a.lookTarget.copy(p); a.lookTarget.y += args[0]; } a.lookWeight = value; break;
      case ELITE_VERB.voice: { const voice = data.voices[value]; if (voice !== undefined) ports.voice(voice); break; }
      case ELITE_VERB.signature: ports.signature(); break;
      case ELITE_VERB.lane: ports.startLane(value, args[0], args[1]); break;
      case ELITE_VERB.contact: { const row = data.contacts[value]; if (row !== undefined) ports.contact(row); break; }
      case ELITE_VERB.trauma: ports.trauma(value); break;
      case ELITE_VERB.attack: a.startAttack(value); break;
      case ELITE_VERB.ring: ports.ring(value, args[0]); break;
      case ELITE_VERB.ringHide: ports.ringHide(); break;
      case ELITE_VERB.action: { const action = data.actions[value]; if (action !== undefined) ports.action(action); break; }
      default: throw new Error(`Elite script ${data.id} named an unknown verb`);
    }
  }
}

/**
 * A species row's declared brain (SHARD-PLATFORM SF27): a platform archetype and its data, resolved the same way by the
 * browser client (`SpeciesBrains.bind`) and the headless host (`installSpeciesHomes`). A challenge grazer's circling
 * phase is the actor seed's slot in `[0, phaseSlots)` (`seedSlot`), so a pack spreads round its home. A `phased-flyer` is
 * a boss flyer its encounter drives through memory fields (circle, dive, climb; grounded from a phase).
 */
export type SpeciesBrain =
  | { readonly archetype: 'grazer'; readonly data: Extract<v.InferInput<typeof GrazerSchema>, { pattern: 'wander-ram' }> }
  | { readonly archetype: 'grazer'; readonly data: Extract<v.InferInput<typeof GrazerSchema>, { pattern: 'circle-challenge' }>; readonly phaseSlots: number }
  | { readonly archetype: 'diver'; readonly data: v.InferInput<typeof DiverSchema> | v.InferInput<typeof PhasedDiverSchema> }
  | { readonly archetype: 'challenge-grazer'; readonly data: v.InferInput<typeof ChallengeGrazerSchema>; readonly phaseSlots: number }
  | { readonly archetype: 'patrol-diver'; readonly data: v.InferInput<typeof PatrolDiverSchema> }
  | { readonly archetype: 'phased-flyer'; readonly data: v.InferInput<typeof PhasedFlyerSchema> }
  | { readonly archetype: 'script'; readonly data: v.InferInput<typeof ScriptSpeciesSchema> }
  | { readonly archetype: 'stalker'; readonly data: v.InferInput<typeof StalkerSchema> }
  | { readonly archetype: 'skirmisher'; readonly data: v.InferInput<typeof SkirmisherSchema> }
  | { readonly archetype: 'guardian'; readonly data: v.InferInput<typeof GuardianSchema> | v.InferInput<typeof GuardianPatternsSchema> }
  | { readonly archetype: 'perch-hunter'; readonly data: v.InferInput<typeof PerchHunterSchema> };
/** A species' gameplay data with an optional declared brain; a row without one keeps its runtime's own policy. */
export type BrainedSpecies = Omit<SpeciesRow, 'parent' | 'think' | 'act'> & { readonly brain?: SpeciesBrain };

/** A finite circular home supplied by the actual owning body before its policy initializes. */
export interface SpeciesBodyHome { readonly x: number; readonly z: number; readonly r: number; readonly y: number }
/** Resolve each browser body's existing home; this callback never allocates a body or draws random numbers. */
export type SpeciesBodyHomes = (actor: Animal) => SpeciesBodyHome;

/** Native policies require explicit live home/RNG (ram), attack permission/flight (orbit), or flight/player shove (burst), plus reach/claim/hurt. */
export type SpeciesDecision<A extends AnimalSim> =
  | { readonly archetype: 'ram-grazer'; readonly policy: RamGrazerBrain<A> }
  | { readonly archetype: 'orbit-diver'; readonly policy: OrbitDiverBrain<A> }
  | { readonly archetype: 'burst-flyer'; readonly policy: BurstFlyerBrain<A> }
  | { readonly archetype: 'skirmisher'; readonly policy: SkirmisherBrain<A> }
  | { readonly archetype: 'guardian'; readonly policy: GuardianBrain<A> }
  | { readonly archetype: 'perch-hunter'; readonly policy: PerchHunterBrain<A> };
/** A trusted browser body adapter, constructed once per animal without running a decision or consuming RNG. */
export type SpeciesNativeFactory = (actor: Animal, decision: SpeciesDecision<Animal>) => {
  think: (context: ThinkCtx) => void; act: (context: ThinkCtx) => void;
};

/** One policy's continuation-bearing surface: decisions, movement, and its exact snapshot / restore. */
export interface SpeciesPolicy<P> { think: (ports: P) => void; act: (ports: P) => void; snapshot: () => SimValue; restore: (value: SimValue) => void }

/**
 * What one home body's policy observes in the headless host, allocated once at its spawn and refreshed each call: the
 * union of every archetype's ports (and a runtime's own policies'), the host's player, attack tokens, reach and contact.
 */
export interface HomeObservation {
  dt: number; t: number; player: Vector3; calm: boolean; phaseOffset: number;
  reach: (actor: AnimalSim) => boolean; claim: (actor: AnimalSim) => boolean; hurt: (damage: number) => void;
  steer: (actor: AnimalSim, yaw: number, speed: number, turn: number) => void;
  flight: { steer: (actor: AnimalSim, yaw: number, speed: number, altitude: number, turn: number) => void };
}

type Admitted =
  | { readonly archetype: 'ram-grazer'; readonly data: ShardRamGrazer; readonly strike: StrikeSpec }
  | { readonly archetype: 'orbit-diver'; readonly data: ShardOrbitDiver; readonly strike: StrikeSpec }
  | { readonly archetype: 'burst-flyer'; readonly data: ShardBurstFlyer; readonly strike: StrikeSpec }
  | { readonly archetype: 'challenge-grazer'; readonly data: ShardChallengeGrazer; readonly phaseSlots: number; readonly charge: StrikeSpec; readonly close: StrikeSpec }
  | { readonly archetype: 'patrol-diver'; readonly data: ShardPatrolDiver; readonly strike: StrikeSpec }
  | { readonly archetype: 'phased-flyer'; readonly data: ShardPhasedFlyer; readonly dive: readonly StrikeSpec[]; readonly grounded: readonly StrikeSpec[] }
  | { readonly archetype: 'script'; readonly data: ScriptSpeciesData; readonly lane: SpeciesScriptLane; readonly catalogue: readonly StrikeSpec[] }
  | { readonly archetype: 'skirmisher'; readonly data: ShardSkirmisher }
  | { readonly archetype: 'guardian'; readonly data: ShardGuardian }
  | { readonly archetype: 'perch-hunter'; readonly data: ShardPerchHunter };

/** A stable small integer per actor (its seed hashed) in `[0, n)`: the slot a pack member takes round a ring. */
export function seedSlot(seed: number, n: number): number { return Math.floor(Math.abs(Math.sin(seed * 12.9898 + 1.7) * 43758.5)) % n; }

/** The admitted brains of a species catalogue, by kind: the browser rows, the live witness and the headless policies. */
export interface SpeciesBrains {
  /** The kinds that run a declared brain. */
  readonly kinds: ReadonlySet<string>;
  /**
   * The browser callbacks of a declared kind: `think` / `act` bound to one policy per animal, spread onto its species
   * row (`{ ...ROW, ...brains.bind(kind) }`). Each call binds a fresh policy table; a kind without a brain refuses.
   */
  bind: (kind: string, native?: SpeciesNativeFactory, homes?: SpeciesBodyHomes) => Required<Pick<SpeciesRow, 'think' | 'act'>>;
  /** Construct a decision-only family for a trusted native body adapter; refuses self-contained policy kinds. */
  decision: <A extends AnimalSim>(kind: string, actor: A, home?: SpeciesBodyHome) => SpeciesDecision<A>;
  /** The archetype a live browser animal runs (null when it runs none of these rows' brains). */
  witness: (actor: Animal) => string | null;
  /** A fresh headless policy for one body of a declared kind, or null when the kind declares no brain. */
  policy: (kind: string, actor: AnimalSim) => SpeciesPolicy<HomeObservation> | null;
  /** The headless phase offset of one body (its challenge grazer's seed slot, else 0). */
  phase: (kind: string, actor: AnimalSim) => number;
}

function strikeOf(strikes: ReadonlyMap<string, StrikeSpec>, id: string, kind: string): StrikeSpec {
  const strike = strikes.get(id); if (strike === undefined) throw new Error(`Species ${kind}'s brain names an undeclared strike ${id}`); return strike;
}
function admit(brain: SpeciesBrain, kind: string, strikes: ReadonlyMap<string, StrikeSpec>, modules: ReadonlyMap<string, Uint8Array>): Admitted {
  switch (brain.archetype) {
    case 'grazer': {
      const data = grazerPreset(parseGrazer(brain.data));
      if (data.kind === 'ram-grazer') return { archetype: data.kind, data, strike: strikeOf(strikes, data.strike, kind) };
      if (!('phaseSlots' in brain)) throw new Error(`Species ${kind}'s challenge grazer requires phase slots`);
      return admit({ archetype: 'challenge-grazer', data, phaseSlots: brain.phaseSlots }, kind, strikes, modules);
    }
    case 'diver': {
      if (brain.data.pattern === 'phased') return admit({ archetype: 'phased-flyer', data: phasedDiverPreset(brain.data) }, kind, strikes, modules);
      const data = diverPreset(parseDiver(brain.data));
      if (data.kind === 'orbit-diver') return { archetype: data.kind, data, strike: strikeOf(strikes, data.strike, kind) };
      if (data.kind === 'burst-flyer') return { archetype: data.kind, data, strike: strikeOf(strikes, data.strike, kind) };
      return admit({ archetype: 'patrol-diver', data }, kind, strikes, modules);
    }
    case 'stalker': return { archetype: 'skirmisher', data: stalkerPreset(parseStalker(brain.data)) };
    case 'skirmisher': return { archetype: brain.archetype, data: parseSkirmisher(brain.data) };
    case 'guardian': {
      const data = 'pattern' in brain.data ? guardianPreset(parseGuardianPattern(brain.data)) : parseGuardian(brain.data);
      return data.kind === 'guardian' ? { archetype: 'guardian', data } : { archetype: 'perch-hunter', data };
    }
    case 'perch-hunter': return { archetype: brain.archetype, data: parsePerchHunter(brain.data) };
    case 'challenge-grazer': {
      const data = parseChallengeGrazer(brain.data);
      if (!Number.isInteger(brain.phaseSlots) || brain.phaseSlots < 1 || brain.phaseSlots > 64) throw new Error(`Species ${kind}'s phase slots must be an integer in 1..64`);
      return { archetype: brain.archetype, data, phaseSlots: brain.phaseSlots, charge: strikeOf(strikes, data.charge, kind), close: strikeOf(strikes, data.close, kind) };
    }
    case 'patrol-diver': { const data = parsePatrolDiver(brain.data); return { archetype: brain.archetype, data, strike: strikeOf(strikes, data.strike, kind) }; }
    case 'phased-flyer': {
      const data = parsePhasedFlyer(brain.data);
      return { archetype: brain.archetype, data, dive: data.dive.map(id => strikeOf(strikes, id, kind)), grounded: data.grounded.map(id => strikeOf(strikes, id, kind)) };
    }
    case 'script': {
      const data = parseScriptSpecies(brain.data), bytes = modules.get(data.module);
      if (bytes === undefined) throw new Error(`Species ${kind}'s brain module ${data.module} was not supplied`);
      return { archetype: brain.archetype, data, lane: new SpeciesScriptLane(data, bytes), catalogue: data.strikes.map(row => strikeOf(strikes, row.strike, kind)) };
    }
    default: throw new Error(`Species ${kind} declares an unknown brain archetype`);
  }
}
type Callbacks = Required<Pick<SpeciesRow, 'think' | 'act'>>;
/** Browser callbacks bound to one policy per animal (built at its first decision); `live` answers the witness. */
function browserCallbacks(brain: Admitted, native?: SpeciesNativeFactory, homes?: SpeciesBodyHomes): { callbacks: Callbacks; live: (actor: Animal) => boolean } {
  switch (brain.archetype) {
    case 'ram-grazer': case 'orbit-diver': case 'burst-flyer': case 'skirmisher': case 'guardian': case 'perch-hunter': {
      if (native === undefined) throw new Error(`Species ${brain.archetype} requires a trusted native body adapter`);
      if ((brain.archetype === 'orbit-diver' || brain.archetype === 'burst-flyer') && homes === undefined) throw new Error(`Species ${brain.archetype} requires its native body home`);
      const live = new WeakMap<Animal, ReturnType<SpeciesNativeFactory>>();
      const of = (actor: Animal): ReturnType<SpeciesNativeFactory> => {
        let value = live.get(actor);
        if (value === undefined) { value = native(actor, decisionOf(brain, actor, homes?.(actor))); live.set(actor, value); }
        return value;
      };
      return { live: actor => live.has(actor), callbacks: { think: (actor, context) => { of(actor).think(context); },
        act: (actor, context) => { of(actor).act(context); } } };
    }
    case 'challenge-grazer': {
      const live = new WeakMap<Animal, ChallengeGrazerBrain<Animal>>(), slots = brain.phaseSlots;
      const of = (a: Animal): ChallengeGrazerBrain<Animal> => { let value = live.get(a); if (value === undefined) { value = new ChallengeGrazerBrain(a, brain.data, brain.charge, brain.close); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: {
        think: (a, c) => { of(a).think({ ...c, phaseOffset: seedSlot(a.seed, slots) }); }, act: (a, c) => { of(a).act({ ...c, phaseOffset: seedSlot(a.seed, slots) }); } } };
    }
    case 'patrol-diver': {
      const live = new WeakMap<Animal, PatrolDiverBrain<Animal>>();
      const of = (a: Animal): PatrolDiverBrain<Animal> => { let value = live.get(a); if (value === undefined) { value = new PatrolDiverBrain(a, brain.data, brain.data.home, brain.strike); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: { think: (a, c) => { of(a).think(c); }, act: (a, c) => { of(a).act(c); } } };
    }
    case 'phased-flyer': {
      const live = new WeakMap<Animal, PhasedFlyerBrain<Animal>>();
      const of = (a: Animal): PhasedFlyerBrain<Animal> => { let value = live.get(a); if (value === undefined) { value = new PhasedFlyerBrain(a, brain.data, brain); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: { think: (a, c) => { of(a).think(c); }, act: (a, c) => { of(a).act(c); } } };
    }
    case 'script': {
      const live = new WeakMap<Animal, ScriptSpeciesPolicy<Animal>>();
      const of = (a: Animal): ScriptSpeciesPolicy<Animal> => { let value = live.get(a); if (value === undefined) { value = new ScriptSpeciesPolicy(a, brain.lane, brain.catalogue); live.set(a, value); } return value; };
      return { live: a => live.has(a), callbacks: { think: (a, c) => { of(a).think(c); }, act: (a, c) => { of(a).act(c); } } };
    }
    default: throw new Error('Unknown admitted brain archetype');
  }
}

function decisionOf<A extends AnimalSim>(brain: Admitted, actor: A, home?: SpeciesBodyHome): SpeciesDecision<A> {
  switch (brain.archetype) {
    case 'ram-grazer': return { archetype: brain.archetype, policy: new RamGrazerBrain(actor, brain.data, brain.strike) };
    case 'orbit-diver': {
      if (home === undefined) throw new Error('Species orbit-diver requires its native body home');
      const data = { ...brain.data, home };
      return { archetype: brain.archetype, policy: new OrbitDiverBrain(actor, data, home, brain.strike) };
    }
    case 'burst-flyer': {
      if (home === undefined) throw new Error('Species burst-flyer requires its native body home');
      const data = { ...brain.data, home };
      return { archetype: brain.archetype, policy: new BurstFlyerBrain(actor, data, home, brain.strike) };
    }
    case 'skirmisher': return { archetype: brain.archetype, policy: new SkirmisherBrain(actor, brain.data) };
    case 'guardian': return { archetype: brain.archetype, policy: new GuardianBrain(actor, brain.data) };
    case 'perch-hunter': return { archetype: brain.archetype, policy: new PerchHunterBrain(actor, brain.data) };
    case 'challenge-grazer': case 'patrol-diver': case 'phased-flyer': case 'script':
      throw new Error(`Species ${brain.archetype} is not a native decision family`);
    default: throw new Error('Unknown admitted brain archetype');
  }
}

/**
 * Admit a species catalogue's declared brains (SF27) against its strike rows: every brain's data passes its archetype's
 * strict schema and every strike it names resolves, before any row, policy or actor exists; a script brain's module
 * (`modules`, by hash) is checked against its hash and admitted on its own ScriptHost. Duplicate kinds refuse.
 */
export function admitSpeciesBrains(species: readonly BrainedSpecies[], strikeRows: readonly StrikeData[], modules: ReadonlyMap<string, Uint8Array> = new Map()): SpeciesBrains {
  const strikes = new Map(strikeRows.map(row => [row.id, strikeFromData(row)] as const));
  if (strikes.size !== strikeRows.length || new Set(species.map(row => row.kind)).size !== species.length) throw new Error('Duplicate species kind or strike id');
  const admitted = new Map(species.flatMap(row => row.brain === undefined ? [] : [[row.kind, admit(row.brain, row.kind, strikes, modules)] as const]));
  const witnesses: { archetype: string; live: (actor: Animal) => boolean }[] = [];
  return {
    kinds: new Set(admitted.keys()),
    bind: (kind, native, homes) => {
      const brain = admitted.get(kind);
      if (brain === undefined) throw new Error(`Species ${kind} declares no brain`);
      const bound = browserCallbacks(brain, native, homes); witnesses.push({ archetype: brain.archetype, live: bound.live }); return bound.callbacks;
    },
    decision: (kind, actor, home) => {
      const brain = admitted.get(kind);
      if (brain === undefined) throw new Error(`Species ${kind} declares no brain`);
      return decisionOf(brain, actor, home);
    },
    witness: actor => witnesses.find(entry => entry.live(actor))?.archetype ?? null,
    policy: (kind, actor) => {
      const brain = admitted.get(kind);
      if (brain === undefined) return null;
      switch (brain.archetype) {
        case 'challenge-grazer': return new ChallengeGrazerBrain(actor, brain.data, brain.charge, brain.close);
        case 'patrol-diver': return new PatrolDiverBrain(actor, brain.data, brain.data.home, brain.strike);
        case 'phased-flyer': return new PhasedFlyerBrain(actor, brain.data, brain);
        case 'script': return new ScriptSpeciesPolicy(actor, brain.lane, brain.catalogue);
        case 'ram-grazer': case 'orbit-diver': case 'burst-flyer': case 'skirmisher': case 'guardian': case 'perch-hunter': throw new Error(`Species ${kind} requires a trusted native body adapter`);
        default: throw new Error('Unknown admitted brain archetype');
      }
    },
    phase: (kind, actor) => { const brain = admitted.get(kind); return brain?.archetype === 'challenge-grazer' ? seedSlot(actor.seed, brain.phaseSlots) : 0; },
  };
}

/** The melee shards' strike arc: a self-thinking species hurts only inside 70° of its facing (AnimalManager HURT_ARC). */
const HURT_ARC = (70 * Math.PI) / 180;

/** A declared catalogue's homes on the platform's renderer-free keeper, each body's policy its species' brain or the runtime's own. */
export interface SpeciesHomesSpec {
  /** The keeper's fixed-step id (`installHomeKeeper`). */
  readonly step: string;
  /** The level seed (the creature stream is `Rng(seed + 31)`). */
  readonly seed: number;
  readonly homes: readonly KeptHomeRow[];
  readonly boss?: KeptBossRow;
  /** Each kind's baked native spec. */
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** The catalogue's rows (each kind's scale range is its first variant's). */
  readonly species: readonly BrainedSpecies[];
  /** The catalogue's admitted brains (`admitSpeciesBrains` over the same rows). */
  readonly brains: SpeciesBrains;
  /** `fight.attackers` from the manifest. */
  readonly attackers: number;
  /** The decision band (the browser's 'legacy' band: every 6 ticks, 0.1 s). */
  readonly think: { readonly every: number; readonly dt: number };
  /** The contact's move id per kind (the browser's PlayerHurt.creature move). */
  readonly contactMove: (kind: string) => string;
  /** The runtime's own policy for a kind that declares no brain (a unique boss, a not-yet-declared creature). */
  readonly custom: (kind: string, actor: AnimalSim) => SpeciesPolicy<HomeObservation>;
  /** Runs first on every tick (a gate the homes read). */
  readonly beforeStep?: (homes: readonly KeptHome[]) => void;
}

/**
 * Declared homes whose policies come from their species rows (SF27): the keeper's stream, tokens, respawn clocks and
 * exact restore (`installHomeKeeper`), each body observing through one reused `HomeObservation`. Contacts reach the
 * player through the host's combat pipeline only inside the strike arc and with a clear line, filed as the browser's
 * PlayerHurt.creature files them: tagged `creature.<kind>`, `feel.blow` (the host's knockback) and `cover.checked` (the
 * reach test is the line check), the blow's point at the creature.
 */
export function installSpeciesHomes(host: SimHost, spec: SpeciesHomesSpec, saved?: Readonly<SimSnapshot>): { settle: () => void; homes: () => readonly KeptHome[]; boss: KeptBossBody | null } {
  const scales = new Map(spec.species.map(row => {
    const variant = row.variants[0]; if (variant === undefined) throw new Error(`Species ${row.kind} has no variant`);
    return [row.kind, variant.scale] as const;
  }));
  const player = host.player.position, reach = (a: AnimalSim): boolean => canReach(a, player, host.physics);
  return installHomeKeeper(host, { step: spec.step, seed: spec.seed, homes: spec.homes, ...(spec.boss === undefined ? {} : { boss: spec.boss }),
    specs: spec.specs, scales, attackers: spec.attackers, think: spec.think, ...(spec.beforeStep === undefined ? {} : { beforeStep: spec.beforeStep }),
    policy: (kind, actor, claim) => {
      const point = new Vector3(), dir = new Vector3(), from = new Vector3(), tags: readonly `${string}.${string}`[] = [`creature.${kind}`, 'feel.blow', 'cover.checked'], move = spec.contactMove(kind);
      const hurt = (damage: number): void => {
        let rel = Math.atan2(player.x - actor.position.x, player.z - actor.position.z) - actor.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) > HURT_ARC || !reach(actor)) return;
        point.copy(actor.position); dir.subVectors(player, actor.position).normalize(); from.copy(actor.position);
        host.combat.hit({ source: actor.combatActor(), sourceTags: tags, target: host.player.health, amount: damage, point, dir, from, moveId: move });
      };
      const ports: HomeObservation = { dt: 0, t: 0, player, calm: false, phaseOffset: spec.brains.phase(kind, actor), reach, claim, hurt,
        steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
        flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } } };
      const brain = spec.brains.policy(kind, actor) ?? spec.custom(kind, actor);
      const observe = (dt: number): void => { ports.dt = dt; ports.t = host.clock.now; };
      return {
        decide: dt => { observe(dt); brain.think(ports); },
        move: dt => { observe(dt); brain.act(ports); },
        snapshot: () => brain.snapshot(),
        restore: value => { brain.restore(value); },
      };
    } }, saved);
}
