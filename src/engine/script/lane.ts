import * as v from 'valibot';
import type { SimHost } from '../sim';
import type { DeclaredScriptWorld } from './state';
import { ScriptHost, type ScriptCall, type ScriptHostOptions } from './host';
import type { ScriptEvent } from './effects';
import type { ScriptRole, ScriptSchedule } from './composition';

/** A content binding; the actor id is supplied by the trusted host, never an effect or script input. */
export interface ScriptBinding { module: string; entity: number; actorId: string | null; kind: 'server' | 'entity' }
/** Admitted bytecode and its stable module identity and initialization seed. */
export interface ScriptModule { name: string; bytes: Uint8Array; seedLo: number; seedHi: number }
/** Explicit dependencies for one local authoritative script lane. */
export interface ScriptLaneOptions extends Omit<ScriptHostOptions, 'world'> { world: DeclaredScriptWorld; modules: readonly ScriptModule[]; bindings: readonly ScriptBinding[]; divisor: number }
/** Numeric-state facade for a standalone lane or a level-wide composed host; no concrete implementation cast is required. */
export interface ScriptLanePort {
  readonly host: ScriptHost; readonly world: DeclaredScriptWorld; readonly divisor: number;
  step: (tick: number, commands?: ReadonlyMap<string, number>) => readonly ScriptCall[];
  enqueue: (event: ScriptEvent) => void; snapshot: () => string; restore: (text: string) => void;
}
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const vec3 = v.tuple([finite, finite, finite]);
const checkpointSchema = v.strictObject({
  version: v.literal(0), contract: v.string(),
  world: v.strictObject({ entities: v.array(v.strictObject({ id: natural, name: v.string(), position: vec3, fields: v.record(v.string(), finite), frozen: v.boolean(), interactive: v.boolean() })), shared: v.array(finite), players: v.array(v.strictObject({ actorId: v.string(), values: v.array(finite) })) }),
  host: v.strictObject({ tick: v.pipe(finite, v.integer(), v.minValue(-1)), used: v.strictObject({ effects: natural, spawns: natural, events: natural, queries: natural, fuel: natural }),
    pending: v.array(v.strictObject({ type: natural, target: natural, value: finite })), modules: v.array(v.strictObject({ name: v.string(), memory: v.array(natural), globals: v.array(v.strictObject({ name: v.string(), type: v.picklist(['number', 'bigint']), value: v.string() })), failures: natural, disabled: v.boolean() })) }),
});
/** Numeric-state scheduler dependencies; construction never installs a module or starts a host tick. */
export type ScriptDriverOptions = Pick<ScriptLaneOptions, 'world' | 'modules' | 'bindings' | 'divisor' | 'query'>;
/** Declared numeric state is validated in its own trusted role, separate from creature motion intentions. */
export class ScriptDriver {
  readonly world: DeclaredScriptWorld;
  readonly divisor: number;
  readonly contract: string;
  private readonly bindings: readonly ScriptBinding[];
  private readonly actors: readonly string[];
  private readonly query: ScriptHostOptions['query'];
  constructor(options: ScriptDriverOptions) {
    if (!Number.isInteger(options.divisor) || options.divisor < 1 || 60 % options.divisor !== 0) throw new Error('Script divisor divides 60');
    this.divisor = options.divisor; this.world = options.world; this.query = options.query;
    const keys = new Set<string>();
    for (const binding of options.bindings) {
      const key = `${binding.module}:${binding.entity}`;
      if (keys.has(key) || !options.modules.some(m => m.name === binding.module) || !this.world.entity(binding.entity)
        || (this.world.actor(binding.entity) ?? null) !== binding.actorId) throw new Error('Invalid script binding');
      keys.add(key);
    }
    this.bindings = options.bindings.map(b => ({ ...b })).sort((a, b) => a.module < b.module ? -1 : a.module > b.module ? 1 : a.entity - b.entity);
    this.actors = [...new Set(this.bindings.flatMap(b => b.actorId === null ? [] : [b.actorId]))].sort();
    this.contract = JSON.stringify({ divisor: this.divisor, bindings: this.bindings, state: this.world.declaration, modules: options.modules.map(m => ({ name: m.name, bytes: Array.from(m.bytes), seedLo: m.seedLo, seedHi: m.seedHi })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0) });
  }
  /** Only this role may publish its declared shared/player fields; actor provenance stays host-bound. */
  role(id: string): ScriptRole { return { id, world: this.world, query: this.query, events: 'deliver', snapshot: () => this.snapshot(), restore: text => { this.restore(text); } }; }
  /** Prepare numeric inputs for due bindings; the owning composition starts the one global fixed tick. */
  schedule(id: string, role: string, commands: () => ReadonlyMap<string, number> = () => new Map()): ScriptSchedule {
    return { id, role, bindings: this.bindings.map(binding => ({ module: binding.module, entity: binding.entity, divisor: this.divisor })),
      input: (scheduled, tick) => {
        const binding = this.bindings.find(b => b.entity === scheduled.entity && b.module === scheduled.module);
        if (binding === undefined) throw new Error('Missing numeric script binding');
        const actor = binding.actorId, command = actor === null ? 0 : commands().get(actor) ?? 0;
        return [tick, this.divisor / 60, command, binding.entity, actor === null ? 0 : this.actors.indexOf(actor) + 1, binding.kind === 'server' ? 0 : 1, ...this.world.input(binding.entity)];
      }, committed: () => undefined };
  }
  /** Role state only; the composed host snapshots module memory, events and quotas exactly once. */
  snapshot(): string { return JSON.stringify({ contract: this.contract, world: this.world.checkpoint() }); }
  /** Restore typed shared/player data without invoking scripts or resetting their host. */
  restore(text: string): void {
    const saved = v.parse(v.strictObject({ contract: v.string(), world: checkpointSchema.entries.world }), JSON.parse(text));
    if (saved.contract !== this.contract) throw new Error('Incompatible script lane snapshot'); this.world.restoreState(saved.world);
  }
}
/** Standalone numeric lane; composed levels use ScriptDriver under their single ScriptComposition host. */
export class ScriptLane {
  readonly host: ScriptHost;
  readonly world: DeclaredScriptWorld;
  readonly divisor: number;
  private readonly driver: ScriptDriver;
  private readonly schedule: ScriptSchedule;
  private commands: ReadonlyMap<string, number> = new Map();
  constructor(options: ScriptLaneOptions) {
    this.driver = new ScriptDriver(options); this.world = this.driver.world; this.divisor = this.driver.divisor;
    this.schedule = this.driver.schedule('numeric', 'numeric', () => this.commands); this.host = new ScriptHost(options);
    for (const module of options.modules) this.host.install(module.name, module.bytes, module.seedLo, module.seedHi);
  }
  /** Stable fixed-tick input: tick, dt, actor command, entity, actor token, role, state counts, state values. */
  step(tick: number, commands: ReadonlyMap<string, number> = new Map()): readonly ScriptCall[] {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('Invalid script lane tick');
    if (tick % this.divisor !== 0) return [];
    this.commands = commands;
    const pending = this.host.beginTick(tick), calls: ScriptCall[] = [];
    for (const binding of this.schedule.bindings) {
      const input = this.schedule.input(binding, tick); if (input === undefined) throw new Error('Missing numeric script input');
      const events = pending.flatMap(event => event.target === binding.entity ? [event.type, event.target, event.value, 0, 0, 0] : []);
      calls.push(this.host.call(binding.module, binding.entity, input, events));
    }
    return calls;
  }
  /** Schedule a declared scene/gameplay event for the next tick; conditions read the resulting declared fields. */
  enqueue(event: ScriptEvent): void { this.host.enqueue(event); }
  /** JSON snapshot includes all world state, complete module state, budgets, pending events and failure history. */
  snapshot(): string { return JSON.stringify({ version: 0, contract: this.driver.contract, world: this.world.checkpoint(), host: this.host.checkpoint() }); }
  /** Restores a matching installed lane, without invoking author initialization. */
  restore(text: string): void {
    const raw: unknown = JSON.parse(text), saved = v.parse(checkpointSchema, raw), previousWorld = this.world.checkpoint();
    if (saved.contract !== this.driver.contract) throw new Error('Incompatible script lane snapshot');
    this.world.restoreState(saved.world);
    try { this.host.restoreState(saved.host); } catch (error) { this.world.restoreState(previousWorld); throw error; }
  }
}
/** Install fixed-step work and a same-engine continuation adapter, scoped to the real headless/client sim host. */
export function installScriptLane(sim: Pick<SimHost, 'onStep' | 'state'>, id: string, lane: ScriptLanePort, commands: () => ReadonlyMap<string, number> = () => new Map()): () => void {
  return sim.onStep(id, () => { lane.step(sim.state.tick, commands()); }, { snapshot: () => lane.snapshot(), restore: (value) => {
    if (typeof value !== 'string') throw new Error('Invalid script adapter snapshot'); lane.restore(value);
  } });
}
