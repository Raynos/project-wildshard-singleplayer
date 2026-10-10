import * as v from 'valibot';
import type { Vector3 } from 'three';
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptSnapshot } from '@wildshard/engine/script/host';
import { ScriptWorld, SCRIPT_OP, type EffectTransaction, type ScriptEffect } from '@wildshard/engine/script/effects';
import type { EliteActor } from '@wildshard/engine/ai/EliteBrain';
import { sha256, speciesMath, SPECIES_MATH_QUERY } from './speciesScripts';

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

const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9_-]*$/u), v.maxLength(64));
/** An elite fight script's declaration: its module, parameters, slots, modes, voices, lanes, contacts and own actions. */
export const EliteScriptSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('elite-script'), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  parameters: v.pipe(v.array(finite), v.maxLength(64)),
  /** the fight's numeric state, with its spawn values */
  slots: v.pipe(v.array(v.strictObject({ field: name, initial: finite })), v.maxLength(8)),
  /** every mode the elite's brain can be in (the input and the `mode` verb use the index) */
  modes: v.pipe(v.array(name), v.minLength(1), v.maxLength(16)),
  /** the voices the `voice` verb names */
  voices: v.pipe(v.array(name), v.maxLength(16)),
  /** a lane that steps before the call while the elite is in `mode`; its hit shakes the view by `trauma` */
  lanes: v.pipe(v.array(v.strictObject({ mode: name, lane: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7)), trauma: finite })), v.maxLength(8)),
  /** the measured contacts the `contact` verb runs: on a hit, the stun seconds (0: none), then the blow, then the shake */
  contacts: v.pipe(v.array(v.strictObject({ strike: key, throughWalls: v.boolean(), stun: finite, trauma: finite })), v.maxLength(8)),
  /** the shard's own actions the `action` verb names (a fade, a burst from a den, a call for rivals) */
  actions: v.pipe(v.array(name), v.maxLength(8)),
  maxSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(40)),
  maxTurnRate: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(30)),
}), v.check(row => new Set(row.slots.map(s => s.field)).size === row.slots.length && new Set(row.modes).size === row.modes.length,
  'Unique elite script slots and modes'));
/** Validated elite script data. */
export type EliteScriptData = v.InferOutput<typeof EliteScriptSchema>;
/** Validate before admission or allocation. */
export function parseEliteScript(input: unknown): EliteScriptData { return v.parse(EliteScriptSchema, input); }

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
const ENTITY = 1, SLOT = 1, ARG = 41, SLOTS_AT = 21;
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
    data.slots.forEach((_, i) => { fields[SLOT + i] = [-1e9, 1e9]; });
    super({ fields, archetypes: [], events: [...VERBS], maxEntities: 1 },
      [{ id: ENTITY, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
    this.slotCount = data.slots.length;
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    if (self !== ENTITY || effects.some(e => (e.op !== SCRIPT_OP.field && e.op !== SCRIPT_OP.event)
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
      if (self !== ENTITY || request.length !== 8) throw new Error('Elite scripts query as their entity');
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
    const call = this.host.call(this.data.module, ENTITY, input);
    if (call.ok) this.host.rewind(this.data.module, this.admitted);
    else { if (!call.disabled) this.host.resume(this.data.module, ENTITY); return null; }
    const out: EliteCommand[] = [], args: [number, number] = [0, 0];
    for (const effect of call.effects) {
      if (effect.op === SCRIPT_OP.event) { out.push({ verb: effect.a, value: effect.c, args: [args[0], args[1]] }); continue; }
      if (effect.a === ARG) args[0] = effect.b;
      else if (effect.a === ARG + 1) args[1] = effect.b;
      else this.values[effect.a - SLOT] = effect.b;
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
  const answer = lane.decide([0, step.dt, step.t, ENTITY, mode, step.modeT, step.p2 ? 1 : 0, step.d, step.yaw, p.x, p.z,
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
