import * as v from 'valibot';
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptHostState, type ScriptCall } from './host';
import { ScriptWorld, type ScriptEffect, type EffectTransaction } from './effects';
import type { ScriptModule } from './lane';

/** Presentation-only operations. Authoritative field, position, spawn, event and shared/player writes are refused. */
export const CLIENT_SCRIPT_OP = Object.freeze({ offset: 101, rotation: 102, scale: 103, particle: 104 });
/** Aggregate presentation ceilings; emitted particles are visual instances, never simulation entities. */
export const CLIENT_SCRIPT_LIMITS = Object.freeze({ bindings: 128, particlesPerTick: 256, particlesLive: 4096, emitters: 16, fields: 24, parameters: 64 });
/** An admitted visual emitter; its recipe, lifetime and limits are host declarations rather than script effects. */
export interface ClientScriptEmitter { id: number; perTick: number; live: number; lifetimeTicks: number }
/** One stable visual target. Parameters and read count are fixed before any bytecode is instantiated. */
export interface ClientScriptBinding {
  module: string; entity: number; name: string; readCount: number; parameters: readonly number[];
  pose: boolean; maxOffset: number; minScale: number; maxScale: number; emitters: readonly ClientScriptEmitter[];
}
/** A copied, read-only observation supplied by the platform; frozen describes the authoritative sim, not this lane. */
export interface ClientScriptObservation { position: readonly [number, number, number]; frozen: boolean; values: readonly number[] }
/** Validated particle request, published only after the entire script call commits. */
export interface ClientParticleRequest { emitter: number; count: number; lifetimeTicks: number }
/** A visual transform relative to the host's authoritative anchor, plus this tick's bounded particle requests. */
export interface ClientScriptFrame {
  entity: number; tick: number; offset: readonly [number, number, number]; rotation: readonly [number, number, number];
  scale: readonly [number, number, number]; particles: readonly ClientParticleRequest[];
}
/** Explicit module installation. The lane has no reference to physics, a save store or an authoritative script world. */
export interface ClientScriptOptions { modules: readonly ScriptModule[]; bindings: readonly ClientScriptBinding[]; divisor: number; memoryBytes?: number }

const finite = v.pipe(v.number(), v.finite()), natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const positive = v.pipe(natural, v.minValue(1), v.maxValue(0x7fffffff)), vec3 = v.tuple([finite, finite, finite]);
const bindingSchema = v.strictObject({ module: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), entity: positive, name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  readCount: v.pipe(natural, v.maxValue(CLIENT_SCRIPT_LIMITS.fields)), parameters: v.pipe(v.array(finite), v.maxLength(CLIENT_SCRIPT_LIMITS.parameters)),
  pose: v.boolean(), maxOffset: v.pipe(finite, v.minValue(0), v.maxValue(50)), minScale: v.pipe(finite, v.minValue(0.01), v.maxValue(1)), maxScale: v.pipe(finite, v.minValue(1), v.maxValue(16)),
  emitters: v.pipe(v.array(v.strictObject({ id: positive, perTick: v.pipe(positive, v.maxValue(256)), live: v.pipe(positive, v.maxValue(4096)), lifetimeTicks: v.pipe(positive, v.maxValue(3600)) })), v.maxLength(CLIENT_SCRIPT_LIMITS.emitters)),
});
const observationSchema = v.strictObject({ position: v.tuple([v.pipe(finite, v.minValue(-250), v.maxValue(250)), v.pipe(finite, v.minValue(-250), v.maxValue(250)), v.pipe(finite, v.minValue(-250), v.maxValue(250))]), frozen: v.boolean(), values: v.pipe(v.array(finite), v.maxLength(24)) });
const frameSchema = v.strictObject({ entity: positive, tick: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(Number.MAX_SAFE_INTEGER)), offset: vec3, rotation: vec3, scale: vec3,
  particles: v.pipe(v.array(v.strictObject({ emitter: positive, count: positive, lifetimeTicks: positive })), v.maxLength(128)) });
const liveSchema = v.pipe(v.array(v.strictObject({ entity: positive, emitter: positive, count: positive, expires: natural })), v.maxLength(4096));
function copy(frame: ClientScriptFrame): ClientScriptFrame {
  return { ...frame, offset: [...frame.offset], rotation: [...frame.rotation], scale: [...frame.scale], particles: frame.particles.map((p) => ({ ...p })) };
}

class ClientWorld extends ScriptWorld {
  readonly bindings: ReadonlyMap<number, ClientScriptBinding>;
  private frames = new Map<number, ClientScriptFrame>();
  private live: v.InferOutput<typeof liveSchema> = [];
  private tick = -1;
  private particles = 0;
  constructor(bindings: readonly ClientScriptBinding[]) {
    super({ fields: {}, archetypes: [], events: [], maxEntities: Math.max(1, bindings.length) }, bindings.map((b) => ({ id: b.entity, name: b.name, position: [0, 0, 0], fields: {}, frozen: false, interactive: false })));
    this.bindings = new Map(bindings.map((b) => [b.entity, b]));
    for (const b of bindings) this.frames.set(b.entity, { entity: b.entity, tick: -1, offset: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], particles: [] });
  }
  beginTick(tick: number): void {
    this.tick = tick; this.particles = 0; this.live = this.live.filter((p) => p.expires > tick);
    this.frames = new Map([...this.frames].map(([id, frame]) => [id, { ...frame, tick, particles: [] }]));
  }
  outputs(): readonly ClientScriptFrame[] { return [...this.frames.values()].sort((a, b) => a.entity - b.entity).map(copy); }
  private pose(frame: ClientScriptFrame, binding: ClientScriptBinding): boolean {
    return frame.offset.every((n) => Math.abs(n) <= binding.maxOffset) && frame.rotation.every((n) => Math.abs(n) <= Math.PI)
      && frame.scale.every((n) => n >= binding.minScale && n <= binding.maxScale);
  }
  override prepare(effects: readonly ScriptEffect[], self: number, _spawns: number, _events: number): EffectTransaction {
    const binding = this.bindings.get(self), current = this.frames.get(self), before = this.frames;
    if (binding === undefined || current === undefined) throw new Error('Unknown client script target');
    const frame = copy(current); let particles = this.particles;
    const live = [...this.live], seen = new Set<number>();
    for (const effect of effects) {
      const { op, a, b, c, d } = effect;
      if (![op, a, b, c, d].every(Number.isFinite)) throw new Error('Non-finite client effect');
      if (op === CLIENT_SCRIPT_OP.particle) {
        const emitter = binding.emitters.find((row) => row.id === a);
        if (emitter === undefined || !Number.isSafeInteger(b) || b < 1 || c !== 0 || d !== 0) throw new Error('Undeclared client particle request');
        const emitted = frame.particles.filter((p) => p.emitter === a).reduce((n, p) => n + p.count, 0), alive = live.filter((p) => p.entity === self && p.emitter === a).reduce((n, p) => n + p.count, 0);
        if (emitted + b > emitter.perTick || alive + b > emitter.live || particles + b > CLIENT_SCRIPT_LIMITS.particlesPerTick || live.reduce((n, p) => n + p.count, 0) + b > CLIENT_SCRIPT_LIMITS.particlesLive) throw new Error('Client particle allowance');
        const expires = this.tick + emitter.lifetimeTicks; if (!Number.isSafeInteger(expires)) throw new Error('Client particle lifetime overflow');
        live.push({ entity: self, emitter: a, count: b, expires }); particles += b;
        frame.particles = [...frame.particles, { emitter: a, count: b, lifetimeTicks: emitter.lifetimeTicks }];
      } else {
        if (!binding.pose || (op !== CLIENT_SCRIPT_OP.offset && op !== CLIENT_SCRIPT_OP.rotation && op !== CLIENT_SCRIPT_OP.scale) || d !== 0 || seen.has(op)) throw new Error('Client scripts cannot write authoritative state');
        seen.add(op);
        if (op === CLIENT_SCRIPT_OP.offset) frame.offset = [a, b, c];
        else if (op === CLIENT_SCRIPT_OP.rotation) frame.rotation = [a, b, c];
        else frame.scale = [a, b, c];
        if (!this.pose(frame, binding)) throw new Error('Client pose outside declared range');
      }
    }
    return { spawns: 0, events: [], commit: () => {
      if (this.frames !== before) throw new Error('Stale client transaction');
      this.frames = new Map(before); this.frames.set(self, frame); this.live = live; this.particles = particles;
    } };
  }
  snapshot(): object { return { tick: this.tick, particles: this.particles, frames: this.outputs(), live: this.live.map((p) => ({ ...p })), entities: this.state() }; }
  restoreSnapshot(input: unknown): void {
    const saved = v.parse(v.strictObject({ tick: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(Number.MAX_SAFE_INTEGER)), particles: v.pipe(natural, v.maxValue(256)), frames: v.pipe(v.array(frameSchema), v.maxLength(128)), live: liveSchema,
      entities: v.array(v.strictObject({ id: positive, name: v.string(), position: vec3, fields: v.record(v.string(), finite), frozen: v.boolean(), interactive: v.boolean() })) }), input);
    if (saved.frames.length !== this.bindings.size || saved.entities.length !== this.bindings.size || new Set(saved.frames.map((f) => f.entity)).size !== saved.frames.length || saved.frames.some((f) => {
      const binding = this.bindings.get(f.entity); return binding === undefined || f.tick !== saved.tick || !this.pose(f, binding) || f.particles.some((p) => !binding.emitters.some((e) => e.id === p.emitter && e.lifetimeTicks === p.lifetimeTicks && f.particles.filter((q) => q.emitter === e.id).reduce((n, q) => n + q.count, 0) <= e.perTick));
    }) || new Set(saved.entities.map((e) => e.id)).size !== saved.entities.length || saved.frames.reduce((n, f) => n + f.particles.reduce((m, p) => m + p.count, 0), 0) !== saved.particles || saved.live.reduce((n, p) => n + p.count, 0) > CLIENT_SCRIPT_LIMITS.particlesLive || saved.live.some((p) => {
      const emitter = this.bindings.get(p.entity)?.emitters.find((e) => e.id === p.emitter);
      return emitter === undefined || p.expires <= saved.tick || p.expires > saved.tick + emitter.lifetimeTicks || saved.live.filter((q) => q.entity === p.entity && q.emitter === p.emitter).reduce((n, q) => n + q.count, 0) > emitter.live;
    }) || saved.entities.some((e) => this.bindings.get(e.id)?.name !== e.name || e.position.some((n) => n !== 0) || Object.keys(e.fields).length > 0)) throw new Error('Invalid client continuation');
    this.restore(saved.entities); this.frames = new Map(saved.frames.map((f) => [f.entity, copy(f)])); this.tick = saved.tick; this.particles = saved.particles; this.live = saved.live;
  }
}

/** Bounded presentation lane with private Wasm memory and private visual output; a frozen sim is never stepped or mutated. */
export class ClientScriptLane {
  private host: ScriptHost | undefined;
  private readonly world: ClientWorld;
  private readonly contract: string;
  readonly divisor: number;
  constructor(options: ClientScriptOptions) {
    if (!Number.isSafeInteger(options.divisor) || options.divisor < 1 || 60 % options.divisor !== 0 || options.bindings.length > CLIENT_SCRIPT_LIMITS.bindings) throw new Error('Invalid client script cadence or target cap');
    this.divisor = options.divisor;
    const bindings = options.bindings.map((b) => v.parse(bindingSchema, b)).sort((a, b) => a.entity - b.entity), modules = [...options.modules].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    if (new Set(bindings.map((b) => b.entity)).size !== bindings.length || new Set(modules.map((m) => m.name)).size !== modules.length || bindings.some((b) => !modules.some((m) => m.name === b.module) || new Set(b.emitters.map((e) => e.id)).size !== b.emitters.length)
      || modules.some((m) => !bindings.some((b) => b.module === m.name))) throw new Error('Invalid client module/target binding');
    this.world = new ClientWorld(bindings);
    this.host = new ScriptHost({ world: this.world, limits: { fuelPerCall: 200000, fuelPerTick: 2000000, ...(options.memoryBytes === undefined ? {} : { memoryBytes: options.memoryBytes }) }, query: (kind, request, entity) => {
      const binding = this.world.bindings.get(entity);
      if (kind !== SCRIPT_PARAMETER_QUERY || request.some((n) => n !== 0) || binding === undefined) throw new Error('Client query requires declared parameters');
      return [...binding.parameters];
    } });
    for (const module of modules) this.host.install(module.name, module.bytes, module.seedLo, module.seedHi);
    this.contract = JSON.stringify({ divisor: this.divisor, bindings, memoryBytes: this.host.limits.memoryBytes, modules: modules.map((m) => ({ name: m.name, seedLo: m.seedLo, seedHi: m.seedHi, bytes: Array.from(m.bytes) })) });
  }
  /** Fixed presentation ticks are supplied by the page, independently of each authoritative sim's frozen tick. */
  step(tick: number, observations: ReadonlyMap<number, ClientScriptObservation>): readonly ScriptCall[] {
    const host = this.host; if (host === undefined) throw new Error('Disposed client script lane');
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('Invalid client script tick');
    if (tick % this.divisor !== 0) return [];
    const checked = new Map<number, ClientScriptObservation>();
    for (const [entity, binding] of this.world.bindings) {
      const observation = v.parse(observationSchema, observations.get(entity));
      if (observation.values.length !== binding.readCount) throw new Error('Invalid read-only client observation');
      checked.set(entity, observation);
    }
    host.beginTick(tick); this.world.beginTick(tick);
    const calls: ScriptCall[] = [];
    for (const [entity, binding] of this.world.bindings) {
      const o = checked.get(entity); if (!o) throw new Error('Missing client observation');
      calls.push(host.call(binding.module, entity, [tick, this.divisor / 60, Number(o.frozen), entity, ...o.position, binding.readCount, ...o.values]));
    }
    return calls;
  }
  /** Detached output copies are safe for renderer adapters; no command is applied to simulation entities. */
  frames(): readonly ClientScriptFrame[] { if (this.host === undefined) return []; return this.world.outputs(); }
  /** A failed presentation binding may resume explicitly; its authoritative entity was never quarantined. */
  resume(entity: number): void { const binding = this.world.bindings.get(entity); if (binding === undefined || this.host === undefined) throw new Error('Unknown/disposed client binding'); this.host.resume(binding.module, entity); }
  /** Complete same-engine visual replay, including author memory, failure history and outstanding particle lifetimes. */
  snapshot(): string { if (this.host === undefined) throw new Error('Disposed client script lane'); return JSON.stringify({ contract: this.contract, host: this.host.checkpoint(), world: this.world.snapshot() }); }
  /** Restore visual continuation only; no authoritative snapshot, query or author callback is invoked. */
  restore(text: string): void {
    const host = this.host; if (host === undefined) throw new Error('Disposed client script lane');
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || !('contract' in raw) || !('host' in raw) || !('world' in raw) || raw.contract !== this.contract) throw new Error('Incompatible client script continuation');
    const before = host.checkpoint(), world = this.world.snapshot();
    try { this.world.restoreSnapshot(raw.world); host.restoreState(raw.host as ScriptHostState);
      const savedTick = v.parse(v.object({ tick: v.number() }), raw.world).tick; if (host.checkpoint().tick !== savedTick) throw new Error('Client continuation tick mismatch'); }
    catch (error) { this.world.restoreSnapshot(world); host.restoreState(before); throw error; }
  }
  /** Release all guest instances; further ticks or restores are refused and no output remains visible. */
  dispose(): void { this.host = undefined; }
}
