import { SCRIPT_ABI } from './abi';
import { admitScript, type ScriptAdmission } from './admission';
import { SCRIPT_OP, type ScriptEffect, type ScriptEvent, type ScriptWorld } from './effects';
import { scriptFailure } from './strings';
import { observeWasmMemory } from '../core/memoryResources';
import { currentOwner } from '../app/ownership';

/** Per-level tick allowances shared by every module and entity, not reset by individual calls. */
export interface ScriptLimits { instances: number; memoryBytes: number; effects: number; spawns: number; events: number; queries: number; fuelPerCall: number; fuelPerTick: number; failures: number }
/** Conservative defaults; all are hard platform ceilings and may only be lowered by a host. */
export const SCRIPT_LIMITS: Readonly<ScriptLimits> = Object.freeze({ instances: 8, memoryBytes: 24000000, effects: 128, spawns: 8, events: 32, queries: 64, fuelPerCall: 2000000, fuelPerTick: 8000000, failures: 3 });
/** Deterministic, read-only query input/output; replies may be recorded for replay/conformance. */
export type ScriptQuery = (kind: number, input: readonly number[], entity: number) => readonly number[];
/** Read-only declared numeric parameters; the host supplies the trusted calling entity to the query adapter. */
export const SCRIPT_PARAMETER_QUERY = 410;
/** A complete linear-memory + mutable-global snapshot, never a live view of Wasm state. */
export interface ScriptSnapshot { memory: Uint8Array; globals: ReadonlyMap<string, number | bigint> }
/** JSON-compatible complete continuation; counters, pending events and quarantine history affect replay. */
export interface ScriptHostState {
  tick: number; used: { effects: number; spawns: number; events: number; queries: number; fuel: number }; pending: readonly ScriptEvent[];
  modules: readonly { name: string; memory: readonly number[]; globals: readonly { name: string; type: 'number' | 'bigint'; value: string }[]; failures: number; disabled: boolean }[];
}
/** Trusted schedulers retain events for sleeping bindings and consume request-only outputs without redelivery. */
export interface ScriptEventDelivery { targets: ReadonlySet<number>; consume: ReadonlySet<number> }
/** Results expose validated requests only after the atomic world-state transaction succeeds. */
export interface ScriptCall { ok: boolean; effects: readonly ScriptEffect[]; events: readonly ScriptEvent[]; fuel: number; reason: string | undefined; disabled: boolean }
/** Host dependencies are explicitly installed; no import creates an instance or changes a service. */
export interface ScriptHostOptions { world: ScriptWorld; query: ScriptQuery; limits?: Partial<ScriptLimits>; development?: boolean; toast?: (text: string) => void; onDisabled?: (disabled: ScriptDisabled) => void }
/** A module crossed its failure limit and stays switched off (G168): told once per module, never on a restored checkpoint. */
export interface ScriptDisabled { module: string; entity: string; reason: string; failures: number }
interface Layout { input: number; inputBytes: number; output: number; outputRecords: number }
interface Running { memory: WebAssembly.Memory; instance: WebAssembly.Instance }
interface ModuleState { bytes: Uint8Array; admission: ScriptAdmission; maximumPages: number; running: Running | undefined; layout: Layout; good: ScriptSnapshot; failures: number; disabled: boolean; remaining: number; depth: number; entity: number; busy: boolean }
function integer(n: number, min: number, max: number): boolean { return Number.isSafeInteger(n) && n >= min && n <= max; }
function bounds(ptr: number, bytes: number, memory: WebAssembly.Memory): void {
  if (!integer(ptr, 0, memory.buffer.byteLength) || ptr % 8 !== 0 || !integer(bytes, 0, memory.buffer.byteLength) || ptr + bytes > memory.buffer.byteLength) throw new Error('ABI buffer outside memory');
}
function invoke(running: Running, name: string, args: readonly number[] = []): number {
  const fn = running.instance.exports[name]; if (typeof fn !== 'function') throw new Error(`Missing callable ${name}`);
  const value = (fn as (...values: number[]) => unknown)(...args); if (value === undefined) return 0; if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Non-finite ABI result'); return value;
}
function currentInstance(state: ModuleState): Running { if (!state.running) throw new Error('Uninitialized script'); return state.running; }
function snapshot(state: ModuleState): ScriptSnapshot {
  const current = currentInstance(state);
  const globals = new Map<string, number | bigint>();
  for (const name of state.admission.globals) { const global = current.instance.exports[name]; if (!(global instanceof WebAssembly.Global)) throw new Error('Missing state global'); const value: unknown = global.value; if (typeof value !== 'number' && typeof value !== 'bigint') throw new Error('Non-numeric global'); globals.set(name, value); }
  return { memory: new Uint8Array(current.memory.buffer).slice(), globals };
}
function clone(s: ScriptSnapshot): ScriptSnapshot { return { memory: s.memory.slice(), globals: new Map(s.globals) }; }
/** One module instance per host; every call carries its current entity handle in IN[3]. */
export class ScriptHost {
  readonly world: ScriptWorld;
  readonly limits: Readonly<ScriptLimits>;
  private readonly options: ScriptHostOptions;
  private readonly modules = new Map<string, ModuleState>();
  private tick = -1;
  private used = { effects: 0, spawns: 0, events: 0, queries: 0, fuel: 0 };
  private pending: ScriptEvent[] = [];
  private active = false;
  private reservedMemory = 0;
  constructor(options: ScriptHostOptions) {
    this.options = { ...options }; this.world = options.world;
    const limits = { ...SCRIPT_LIMITS, ...options.limits };
    for (const key of Object.keys(SCRIPT_LIMITS) as (keyof ScriptLimits)[]) if (!integer(limits[key], 1, SCRIPT_LIMITS[key])) throw new Error(`Invalid script limit: ${key}`);
    this.limits = Object.freeze(limits);
  }
  /** Read the authoritative tick without copying module memories or checkpoint data. */
  get currentTick(): number { return this.tick; }
  private charge(state: ModuleState, cost: number): void {
    if (!integer(cost, 1, 0x7fffffff)) throw new Error('Invalid fuel cost');
    state.remaining -= cost; if (state.remaining < 0) throw new Error('Script fuel exhausted');
    if (state.busy) { this.used.fuel += cost; if (this.used.fuel > this.limits.fuelPerTick) throw new Error('Script tick fuel exhausted'); }
  }
  private instantiate(state: ModuleState, saved?: ScriptSnapshot): Running {
    const memory = new WebAssembly.Memory({ initial: saved ? saved.memory.length / 65536 : state.admission.initialPages, maximum: state.maximumPages });
    observeWasmMemory(memory, { owner: currentOwner()?.name ?? 'engine/script', asset: `script/entity:${state.entity}` });
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(state.bytes)), { env: {
      memory,
      enter: () => { this.charge(state, 1); if (++state.depth > SCRIPT_ABI.callDepth) throw new Error('Script call-depth exhausted'); },
      leave: () => { if (--state.depth < 0) throw new Error('Invalid call depth'); },
      fuel: (cost: number) => this.charge(state, cost),
      finite32: (value: number) => { this.charge(state, 1); if (!Number.isFinite(value)) throw new Error('Non-finite script number'); return value; },
      finite64: (value: number) => { this.charge(state, 1); if (!Number.isFinite(value)) throw new Error('Non-finite script number'); return value; },
      abort: () => { throw new Error('Script abort'); },
      query: (kind: number, request: number, response: number) => {
        if (!state.busy || (!integer(kind, 1, 4) && kind !== SCRIPT_PARAMETER_QUERY)) throw new Error('Query outside a tick');
        this.charge(state, 256); if (++this.used.queries > this.limits.queries) throw new Error('Query allowance');
        bounds(request, 64, memory); bounds(response, 768, memory);
        const input = Array.from(new Float64Array(memory.buffer, request, 8));
        if (!input.every(Number.isFinite) || input.some((n) => Math.abs(n) > 10000)) throw new Error('Invalid query input');
        const answer = this.options.query(kind, input, state.entity);
        if (answer.length > 96 || !answer.every(Number.isFinite)) throw new Error('Invalid query response');
        new Float64Array(memory.buffer, response, 96).fill(0); new Float64Array(memory.buffer, response, answer.length).set(answer);
        return answer.length;
      },
    } });
    if (saved) {
      new Uint8Array(memory.buffer).set(saved.memory);
      for (const [name, value] of saved.globals) { const global = instance.exports[name]; if (!(global instanceof WebAssembly.Global)) throw new Error('Missing saved global'); global.value = value; }
    }
    return { memory, instance };
  }
  /** Admit before instantiation; one instance is shared by all handles invoking this module. */
  install(name: string, bytes: Uint8Array, seedLo = 0, seedHi = 0): void {
    if (this.active || this.modules.has(name) || this.modules.size >= this.limits.instances) throw new Error('Instance allowance or duplicate module');
    if (!integer(seedLo, -0x80000000, 0x7fffffff) || !integer(seedHi, -0x80000000, 0x7fffffff)) throw new Error('Invalid seed');
    const owned = new Uint8Array(bytes), admission = admitScript(owned);
    // Reserve three full copies: live memory, last-good snapshot and an in-flight snapshot/restore copy.
    const maximumPages = Math.min(admission.maximumPages, Math.floor((this.limits.memoryBytes - this.reservedMemory) / (3 * 65536)));
    if (maximumPages < admission.initialPages) throw new Error('Aggregate script memory allowance');
    // Imports cannot run until instance construction has completed: admission forbids a start section.
    const state: ModuleState = { bytes: owned, admission, maximumPages, running: undefined, layout: { input: 0, inputBytes: 0, output: 0, outputRecords: 0 }, good: { memory: new Uint8Array(), globals: new Map() }, failures: 0, disabled: false, remaining: this.limits.fuelPerCall, depth: 0, entity: 0, busy: false };
    state.running = this.instantiate(state);
    invoke(state.running, '__start'); if (invoke(state.running, 'abi_version') !== SCRIPT_ABI.version) throw new Error('Wrong script ABI version');
    invoke(state.running, 'init', [seedLo, seedHi]);
    const input = invoke(state.running, 'in_ptr'), inputBytes = invoke(state.running, 'in_cap'), output = invoke(state.running, 'out_ptr'), outputRecords = invoke(state.running, 'out_cap');
    bounds(input, inputBytes, state.running.memory); bounds(output, outputRecords * 40, state.running.memory);
    if (inputBytes < 33 * 8 || inputBytes % 8 !== 0 || !integer(outputRecords, 1, SCRIPT_LIMITS.effects) || !(input + inputBytes <= output || output + outputRecords * 40 <= input)) throw new Error('Invalid/overlapping ABI regions');
    state.layout = { input, inputBytes, output, outputRecords }; state.good = snapshot(state); this.modules.set(name, state); this.reservedMemory += maximumPages * 3 * 65536;
  }
  /** Reset shared allowances only for a strictly later fixed tick; return prior queued events in insertion order. */
  beginTick(tick: number, delivery?: ScriptEventDelivery): readonly ScriptEvent[] {
    if (this.active || !integer(tick, 0, Number.MAX_SAFE_INTEGER) || tick <= this.tick) throw new Error('Non-monotonic script tick');
    if (delivery !== undefined && ([...delivery.targets, ...delivery.consume].some(id => !integer(id, 1, 0x7fffffff))
      || [...delivery.targets].some(id => delivery.consume.has(id)))) throw new Error('Invalid scheduled event delivery');
    const events: ScriptEvent[] = [], retained: ScriptEvent[] = [];
    for (const event of this.pending) {
      if (delivery?.consume.has(event.target)) continue;
      (delivery === undefined || delivery.targets.has(event.target) ? events : retained).push({ ...event });
    }
    // Retained events occupy the same allowance as deliveries and newly emitted events.
    this.tick = tick; this.used = { effects: 0, spawns: 0, events: retained.length, queries: 0, fuel: 0 }; this.pending = retained; return events;
  }
  /** Queue a declared gameplay/scene event for the next script tick, under the same bounded event allowance. */
  enqueue(event: ScriptEvent): void {
    if (this.active || this.pending.length >= this.limits.events) throw new Error('Script event queue allowance');
    const checked = this.world.prepare([{ op: SCRIPT_OP.event, a: event.type, b: event.target, c: event.value, d: 0 }], event.target, 0, 1);
    this.pending.push(...checked.events);
  }
  /** Snapshot copies are safe to retain for deterministic replay. */
  snapshot(name: string): ScriptSnapshot { const state = this.modules.get(name); if (!state) throw new Error('Unknown module'); return clone(state.good); }
  /** Admission can detect a refused call without copying every guest memory into a checkpoint. */
  get failureCount(): number { let total = 0; for (const state of this.modules.values()) total += state.failures; return total; }
  /** Capture at a fixed-step boundary; module memory and globals are detached copies. */
  checkpoint(): ScriptHostState {
    if (this.active) throw new Error('Active script checkpoint');
    return { tick: this.tick, used: { ...this.used }, pending: this.pending.map((e) => ({ ...e })), modules: [...this.modules].map(([name, state]) => ({
      name, memory: Array.from(state.good.memory), globals: [...state.good.globals].map(([key, value]) => ({ name: key, type: typeof value === 'bigint' ? 'bigint' as const : 'number' as const, value: String(value) })), failures: state.failures, disabled: state.disabled,
    })) };
  }
  /** Restore all instances before publishing; no initialization, query or author function is run. */
  restoreState(saved: ScriptHostState): void {
    if (this.active || !integer(saved.tick, -1, Number.MAX_SAFE_INTEGER) || saved.modules.length !== this.modules.size
      || new Set(saved.modules.map((m) => m.name)).size !== saved.modules.length || Object.values(saved.used).some((n) => !integer(n, 0, Number.MAX_SAFE_INTEGER))
      || saved.pending.length > this.limits.events || saved.pending.some((e) => !integer(e.type, 1, 0x7fffffff) || !integer(e.target, 1, 0x7fffffff) || !Number.isFinite(e.value))) throw new Error('Invalid host checkpoint');
    const staged: { state: ModuleState; good: ScriptSnapshot; running: Running; failures: number; disabled: boolean }[] = [];
    for (const entry of saved.modules) {
      const state = this.modules.get(entry.name);
      if (!state || !integer(entry.failures, 0, Number.MAX_SAFE_INTEGER) || entry.disabled !== (entry.failures >= this.limits.failures)
        || entry.memory.length < state.admission.initialPages * 65536 || entry.memory.length > state.maximumPages * 65536 || entry.memory.length % 65536 !== 0
        || entry.memory.some((n) => !integer(n, 0, 255)) || entry.globals.length !== state.admission.globals.length || new Set(entry.globals.map((g) => g.name)).size !== entry.globals.length) throw new Error('Invalid module checkpoint');
      const globals = new Map<string, number | bigint>();
      for (const global of entry.globals) {
        const value = global.type === 'bigint' ? BigInt(global.value) : Number(global.value);
        if (!state.admission.globals.includes(global.name) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid saved global');
        globals.set(global.name, value);
      }
      const good = { memory: Uint8Array.from(entry.memory), globals };
      staged.push({ state, good, running: this.instantiate(state, good), failures: entry.failures, disabled: entry.disabled });
    }
    for (const entry of staged) { entry.state.good = entry.good; entry.state.running = entry.running; entry.state.failures = entry.failures; entry.state.disabled = entry.disabled; entry.state.depth = 0; entry.state.busy = false; }
    this.tick = saved.tick; this.used = { ...saved.used }; this.pending = saved.pending.map((e) => ({ ...e }));
  }
  /**
   * Return a module to a snapshot of its own in place (a pure call's admitted state): the bytes are copied into the live
   * memory and the globals set, with no new instance, when the memory has not grown; otherwise as `restore`.
   */
  rewind(name: string, saved: ScriptSnapshot): void {
    const state = this.modules.get(name); if (!state || this.active) throw new Error('Unknown or active module');
    const running = currentInstance(state);
    if (running.memory.buffer.byteLength !== saved.memory.length || saved.globals.size !== state.admission.globals.length) { this.restore(name, saved); return; }
    for (const [global, value] of saved.globals) { const live = running.instance.exports[global]; if (!(live instanceof WebAssembly.Global)) throw new Error('Missing saved global'); live.value = value; }
    new Uint8Array(running.memory.buffer).set(saved.memory); state.good = clone(saved); state.remaining = this.limits.fuelPerCall; state.depth = 0;
  }
  /** Restore complete state into a new instance without running initialization again. */
  restore(name: string, saved: ScriptSnapshot): void {
    const state = this.modules.get(name); if (!state || this.active) throw new Error('Unknown or active module');
    if (saved.memory.length % 65536 !== 0 || saved.memory.length < state.admission.initialPages * 65536 || saved.memory.length > state.maximumPages * 65536 || saved.globals.size !== state.admission.globals.length || state.admission.globals.some((n) => !saved.globals.has(n)) || [...saved.globals.values()].some((v) => typeof v === 'number' && !Number.isFinite(v))) throw new Error('Invalid script snapshot');
    const owned = clone(saved); state.remaining = this.limits.fuelPerCall; state.depth = 0; state.running = this.instantiate(state, owned); state.good = owned;
  }
  /** Resume only by an explicit host action; repeated offenders remain disabled. */
  resume(name: string, entity: number): void { const state = this.modules.get(name); if (!state || state.disabled || this.active) throw new Error('Disabled or active module'); this.world.freeze(entity, false); }
  /** Execute and validate a full batch, then publish numeric world state and script snapshot together. */
  call(name: string, entity: number, input: readonly number[], events: readonly number[] = []): ScriptCall {
    const state = this.modules.get(name), current = this.world.entity(entity);
    if (!state || !current || state.disabled || current.frozen) return { ok: false, effects: [], events: [], fuel: 0, reason: 'Unavailable script/entity', disabled: state?.disabled ?? false };
    if (this.used.fuel >= this.limits.fuelPerTick) return { ok: false, effects: [], events: [], fuel: 0, reason: 'Script tick fuel allowance', disabled: false };
    if (this.active || this.tick < 0) throw new Error('Reentrant call or missing fixed tick');
    state.remaining = this.limits.fuelPerCall; state.depth = 0; state.entity = entity; state.busy = true; this.active = true;
    const currentRunning = currentInstance(state);
    try {
      if (input.length > 32 || input[0] !== this.tick || !input.every(Number.isFinite) || events.length % 6 !== 0 || events.length / 6 + this.used.events > this.limits.events || !events.every(Number.isFinite)) throw new Error('Invalid input/events');
      this.used.events += events.length / 6;
      const { input: ptr, inputBytes, output, outputRecords } = state.layout;
      bounds(ptr, inputBytes, currentRunning.memory); if (33 * 8 + events.length * 8 > inputBytes) throw new Error('Input/event capacity');
      const slots = new Float64Array(currentRunning.memory.buffer, ptr, inputBytes / 8); slots.fill(0); slots.set(input); slots[3] = entity; slots[32] = events.length / 6; slots.set(events, 33);
      new Float64Array(currentRunning.memory.buffer, output, outputRecords * 5).fill(0);
      invoke(currentRunning, 'on_tick'); const count = invoke(currentRunning, 'out_count');
      if (!integer(count, 0, outputRecords) || count + this.used.effects > this.limits.effects) throw new Error('Effect allowance');
      const view = new Float64Array(currentRunning.memory.buffer, output, count * 5), effects: ScriptEffect[] = [];
      for (let i = 0; i < count; i++) { const at = i * 5; effects.push({ op: view[at] ?? Number.NaN, a: view[at + 1] ?? Number.NaN, b: view[at + 2] ?? Number.NaN, c: view[at + 3] ?? Number.NaN, d: view[at + 4] ?? Number.NaN }); }
      const eventAllowance = Math.min(this.limits.events - this.used.events, this.limits.events - this.pending.length);
      const tx = this.world.prepare(effects, entity, this.limits.spawns - this.used.spawns, eventAllowance);
      const good = snapshot(state); tx.commit(); state.good = good;
      this.used.effects += count; this.used.spawns += tx.spawns; this.used.events += tx.events.length; this.pending.push(...tx.events);
      return { ok: true, effects, events: tx.events, fuel: this.limits.fuelPerCall - state.remaining, reason: undefined, disabled: false };
    } catch (error) {
      const fuel = this.limits.fuelPerCall - state.remaining;
      state.failures++; state.disabled = state.failures >= this.limits.failures;
      state.remaining = this.limits.fuelPerCall; state.depth = 0; state.running = this.instantiate(state, state.good);
      this.world.freeze(entity, true);
      const reason = error instanceof Error ? error.message : 'Script trap';
      if (this.options.development) this.options.toast?.(scriptFailure(current.name, name, reason, state.disabled));
      // a disabled module never reaches this call, so this is its one crossing
      if (state.disabled) this.options.onDisabled?.({ module: name, entity: current.name, reason, failures: state.failures });
      return { ok: false, effects: [], events: [], fuel, reason, disabled: state.disabled };
    } finally { state.busy = false; this.active = false; }
  }
}
