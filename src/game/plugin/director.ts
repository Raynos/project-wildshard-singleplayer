import * as v from "valibot";
import { BossBrain, type BossContinuation, type BossDefinition, type BossPorts, type BossPresentation, type BossSaved, type BossScript } from '@wildshard/engine/ai/BossBrain';
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptQuery } from "@wildshard/engine/script/host";
import { ScriptWorld, type EffectTransaction, type ScriptEffect } from "@wildshard/engine/script/effects";
import { parseDirector, type DirectorData, type DirectorEvent } from "@wildshard/format/director";
import { parseDirectorStages, type DirectorStagesData, type DirectorAction } from '@wildshard/format/directorStages';
import { compileDirectorWhen, evaluateDirectorWhen, type DirectorWhenInstruction } from '@wildshard/format/directorWhen';

function payload(row: DirectorData['events'][number], value: number): boolean {
  return Number.isFinite(value) && value >= row.min && value <= row.max && (row.type === 'number' || Number.isInteger(value));
}
class DirectorWorld extends ScriptWorld {
  private readonly data: DirectorData;
  constructor(data: DirectorData) {
    super({ fields: {}, archetypes: [], events: data.events.filter((row) => row.direction === 'output').map((row) => row.id), maxEntities: 1 },
      [{ id: data.entity, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
    this.data = data;
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    for (const effect of effects) {
      const row = this.data.events.find((entry) => entry.id === effect.a && entry.direction === 'output');
      if (effect.op !== 3 || effect.b !== self || row === undefined || !payload(row, effect.c)) throw new Error('Invalid typed director event');
    }
    return super.prepare(effects, self, spawns, events);
  }
}
const pendingSchema = v.array(v.strictObject({ type: v.number(), value: v.number() }));
const worldSchema = v.pipe(v.array(v.strictObject({ id: v.number(), name: v.string(), position: v.tuple([v.number(), v.number(), v.number()]), fields: v.record(v.string(), v.number()), frozen: v.boolean(), interactive: v.boolean() })), v.length(1));

/** Bounded authoritative director lane; full Wasm state, quotas, failure history and pending typed input survive replay. */
export class DirectorLane {
  readonly data: DirectorData;
  readonly host: ScriptHost;
  private currentTick = -1;
  private pending: { type: number; value: number }[] = [];
  constructor(data: DirectorData, bytes: Uint8Array, seed: number, query: ScriptQuery = () => []) {
    this.data = parseDirector(data);
    if (!Number.isSafeInteger(seed)) throw new Error('Invalid director seed');
    this.host = new ScriptHost({ world: new DirectorWorld(this.data), query: (kind, request, self) => {
      if (kind !== SCRIPT_PARAMETER_QUERY) return query(kind, request, self);
      if (self !== this.data.entity || request.length !== 8 || request.some((value) => value !== 0)) throw new Error('Director parameters require trusted self');
      return [...this.data.parameters];
    } });
    this.host.install(this.data.module, bytes, seed | 0, Math.floor(seed / 4294967296) | 0);
  }
  /** Last admitted fixed tick; restored installations resume without maintaining a second clock. */
  get tick(): number { return this.currentTick; }
  /** Queue a subscribed shard event for the next fixed tick; callers cannot choose an entity or invoke an export. */
  enqueue(key: string, value = 0, scope: 'shard' | 'grid' = 'shard'): void {
    if (scope === 'grid') throw new Error('Grid director delivery is reserved');
    const row = this.data.events.find((entry) => entry.key === key && entry.direction === 'input');
    if (row === undefined || !this.data.subscriptions.some((entry) => entry.scope === scope && entry.event === key) || !payload(row, value)) throw new Error('Invalid subscribed director event');
    if (this.pending.length >= this.host.limits.events) throw new Error('Director event allowance');
    this.pending.push({ type: row.id, value });
  }
  /** Stable input ordering and the engine's unchanged fuel, event, query and memory ceilings. */
  step(tick: number, observation: Readonly<Record<string, number>>, dt = 1 / 60): readonly DirectorEvent[] {
    const input = this.observation(observation, dt);
    this.host.beginTick(tick);
    this.currentTick = tick;
    return this.call(input, dt);
  }
  /** Deliver an immediate trusted request at zero elapsed time, sharing this tick's remaining allowances. */
  dispatch(observation: Readonly<Record<string, number>>): readonly DirectorEvent[] {
    if (this.currentTick < 0) throw new Error('Director is not initialized');
    return this.call(this.observation(observation, 0), 0);
  }
  private observation(observation: Readonly<Record<string, number>>, dt: number): number[] {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1) throw new Error('Invalid director delta');
    const input = this.data.inputs.map((row) => {
      const value = observation[row.key]; if (value === undefined || !Number.isFinite(value) || value < row.min || value > row.max) throw new Error('Invalid director observation'); return value;
    });
    return input;
  }
  private call(input: readonly number[], dt: number): readonly DirectorEvent[] {
    const tick = this.currentTick;
    const events = this.pending.flatMap((row) => [row.type, this.data.entity, row.value, 0, 0, 0]); this.pending = [];
    const call = this.host.call(this.data.module, this.data.entity, [tick, dt, 0, this.data.entity, 0, 0, ...input], events);
    if (!call.ok) return [];
    return call.events.map((event) => {
      const row = this.data.events.find((entry) => entry.id === event.type); if (row === undefined) throw new Error('Undeclared director output');
      return { director: this.data.id, tick, key: row.key, type: row.type, value: event.value };
    });
  }
  /** Complete same-engine continuation, including queued subscriptions and author memory/globals. */
  snapshot(): string { return JSON.stringify({ contract: this.data, host: this.host.checkpoint(), world: this.host.world.state(), pending: this.pending }); }
  /** Restore a matching installed lane atomically; initialization and output callbacks are never replayed. */
  restore(text: string): void {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || !('contract' in raw) || !('host' in raw) || !('world' in raw) || !('pending' in raw)
      || JSON.stringify(raw.contract) !== JSON.stringify(this.data)) throw new Error('Incompatible director snapshot');
    const pending = v.parse(pendingSchema, raw.pending);
    if (pending.length > this.host.limits.events || pending.some((row) => {
      const event = this.data.events.find((entry) => entry.id === row.type && entry.direction === 'input');
      return event === undefined || !payload(event, row.value) || !this.data.subscriptions.some((entry) => entry.scope === 'shard' && entry.event === event.key);
    })) throw new Error('Invalid director pending events');
    const savedWorld = v.parse(worldSchema, raw.world);
    if (savedWorld[0]?.id !== this.data.entity) throw new Error('Invalid director identity');
    // Roll back both participants if host validation rejects a checkpoint after world validation.
    const before = this.host.checkpoint(), world = this.host.world.state();
    try {
      const savedHost = raw.host as ReturnType<ScriptHost['checkpoint']>;
      this.host.world.restore(savedWorld); this.host.restoreState(savedHost); this.pending = pending; this.currentTick = savedHost.tick;
    } catch (error) { this.host.world.restore(world); this.host.restoreState(before); throw error; }
  }
}

/** Admit immutable module bytes once; each invocation installs fresh author state with the unchanged engine ceilings. */
export async function prepareDirectorModule(data: DirectorData, bytes: Uint8Array): Promise<(seed: number, query?: ScriptQuery) => DirectorLane> {
  const checked = parseDirector(data), copy = Uint8Array.from(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
  if ([...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('') !== checked.module) throw new Error('Director module hash mismatch');
  return (seed, query) => new DirectorLane(checked, copy, seed, query);
}

/** Verify immutable module bytes before allocating an admitted director; each installation receives its own copied author memory. */
export async function createDirectorLane(data: DirectorData, bytes: Uint8Array, seed: number, query?: ScriptQuery): Promise<DirectorLane> {
  return (await prepareDirectorModule(data, bytes))(seed, query);
}

const stageState = v.strictObject({ tick: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(Number.MAX_SAFE_INTEGER)), stage: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(63)) });

/** Version-two row interpreter. Native bindings supply observations; returned actions belong to their real owners.
 * Enter the first stage on the first tick, then at most one successor per tick. An explicit next target permits a cycle.
 * No callback or service is installed, and no stage action is replayed during restore. */
export class DirectorStageLane {
  private readonly definition: DirectorStagesData;
  private readonly conditions: readonly (readonly DirectorWhenInstruction[])[];
  private readonly successors: readonly (readonly { target: number; condition: readonly DirectorWhenInstruction[] }[])[];
  private currentTick = -1;
  private currentStage = -1;
  constructor(data: unknown) {
    this.definition = structuredClone(parseDirectorStages(data));
    if (this.definition.script !== null) throw new Error('Scripted stage directors require a typed script installation');
    const names = Object.keys(this.definition.inputs);
    this.conditions = this.definition.stages.map(stage => compileDirectorWhen(stage.when ?? 'true', names));
    this.successors = this.definition.stages.map((stage, index) => {
      const targets = typeof stage.next === 'string' ? [{ target: stage.next, when: 'true' }] : stage.next;
      return targets === undefined ? [{ target: index + 1, condition: compileDirectorWhen('true', names) }]
        : targets.map(target => ({ target: this.definition.stages.findIndex(row => row.id === target.target), condition: compileDirectorWhen(target.when, names) }));
    });
  }
  /** An independent copy of the installed immutable author contract. */
  get data(): DirectorStagesData { return structuredClone(this.definition); }
  /** The last accepted fixed tick, including ticks that did not change stage. */
  get tick(): number { return this.currentTick; }
  /** The active stage identity, or null before the first accepted tick. */
  get stage(): string | null { return this.definition.stages[this.currentStage]?.id ?? null; }
  /** Validate a complete native observation before advancing; commands retain author order and cannot mutate installed rows. */
  step(tick: number, observation: Readonly<Record<string, boolean>>): readonly DirectorAction[] {
    if (!Number.isSafeInteger(tick) || tick < 0 || tick <= this.currentTick) throw new Error('Invalid stage director tick');
    const names = Object.keys(this.definition.inputs);
    if (Object.keys(observation).length !== names.length || names.some(name => !Object.hasOwn(observation, name) || typeof observation[name] !== 'boolean')) throw new Error('Invalid stage director observation');
    let target = this.currentStage, entered = false;
    if (target < 0) { target = 0; entered = true; }
    else {
      const stage = this.definition.stages[target];
      if (stage === undefined) throw new Error('Invalid installed director stage');
      for (const successor of this.successors[target] ?? []) {
        const condition = this.conditions[successor.target];
        if (condition !== undefined && evaluateDirectorWhen(successor.condition, observation) && evaluateDirectorWhen(condition, observation)) {
          target = successor.target; entered = true; break;
        }
      }
    }
    const actions = entered ? structuredClone(this.definition.stages[target]?.do ?? []) : [];
    this.currentTick = tick; this.currentStage = target;
    return actions;
  }
  /** Persist the exact author contract and cursor; stage-entry effects are absent from the continuation. */
  snapshot(): string { return JSON.stringify({ version: 2, contract: this.definition, state: { tick: this.currentTick, stage: this.currentStage } }); }
  /** Refuse a foreign contract or malformed cursor before mutation. Restore never evaluates guards or emits effects. */
  restore(text: string): void {
    const saved = v.parse(v.strictObject({ version: v.literal(2), contract: v.unknown(), state: stageState }), JSON.parse(text));
    if (JSON.stringify(saved.contract) !== JSON.stringify(this.definition) || saved.state.stage >= this.definition.stages.length
      || (saved.state.tick === -1) !== (saved.state.stage === -1)) throw new Error('Incompatible stage director snapshot');
    this.currentTick = saved.state.tick; this.currentStage = saved.state.stage;
  }
}

/** External-clock stage installation with an admitted AS escape handler. The native lane owns elapsed time,
 * quotas and typed observations; ordered output events select authored stage actions without a second scheduler.
 * Publication also carries the admitted AS event for bounded native parameters; row actions retain their authored values.
 * initialDt preserves the admitted handler's native initialization ABI; its default is a zero-time observation. */
export class DirectorScriptStageLane {
  private readonly definition: DirectorStagesData;
  private readonly stages: DirectorStageLane;
  private readonly script: DirectorLane;
  private readonly ports: {
    readonly observe: () => Readonly<Record<string, number>>;
    readonly publish: (action: DirectorAction, source?: Readonly<DirectorEvent>) => void;
  };
  constructor(data: unknown, script: DirectorLane, ports: {
    readonly observe: () => Readonly<Record<string, number>>;
    readonly publish: (action: DirectorAction, source?: Readonly<DirectorEvent>) => void;
  }, restoring = false, initialDt = 0) {
    if (!Number.isFinite(initialDt) || initialDt < 0 || initialDt > 1) throw new Error('Invalid director initial delta');
    this.definition = structuredClone(parseDirectorStages(data));
    if (this.definition.script !== script.data.module) throw new Error('Stage escape handler hash mismatch');
    const outputs = script.data.events.filter(event => event.direction === 'output');
    for (const binding of Object.values(this.definition.inputs)) {
      if (!binding.startsWith('event:') || !outputs.some(event => binding === `event:${event.key}`)) throw new Error('Undeclared stage handler output');
    }
    if (outputs.some(event => !Object.values(this.definition.inputs).includes(`event:${event.key}`))) throw new Error('Unbound stage handler output');
    this.stages = new DirectorStageLane({ ...this.definition, script: null });
    this.script = script; this.ports = ports;
    if (!restoring) {
      if (script.tick !== -1) throw new Error('Stage escape handler already initialized');
      this.publish(this.stages.step(0, this.observation()));
      this.deliver(script.step(0, ports.observe(), initialDt));
    }
  }
  /** Deliver real flag/request edges at zero dt within the existing native tick's remaining allowance. */
  changed(): void { this.deliver(this.script.dispatch(this.ports.observe())); }
  /** Advance once at the owner's existing clock phase, retaining fractional dt and native output order. */
  update(dt: number): void { this.deliver(this.script.step(this.script.tick + 1, this.ports.observe(), dt)); }
  /** Versioned complete continuation: immutable stage rows, cursor and the unchanged AS native checkpoint. */
  snapshot(): string { return JSON.stringify({ version: 3, contract: this.definition, stages: this.stages.snapshot(), script: this.script.snapshot() }); }
  /** Restore both owners quietly and atomically; pre-row snapshots require an explicit migration and are refused. */
  restore(text: string): void {
    const saved = v.parse(v.strictObject({ version: v.literal(3), contract: v.unknown(), stages: v.string(), script: v.string() }), JSON.parse(text));
    if (JSON.stringify(saved.contract) !== JSON.stringify(this.definition)) throw new Error('Incompatible scripted stage snapshot');
    const stages = this.stages.snapshot(), script = this.script.snapshot();
    try { this.stages.restore(saved.stages); this.script.restore(saved.script); }
    catch (error) { this.stages.restore(stages); this.script.restore(script); throw error; }
  }
  private observation(event?: DirectorEvent): Record<string, boolean> {
    return Object.fromEntries(Object.entries(this.definition.inputs).map(([name, binding]) => [name, binding === `event:${event?.key ?? ''}`]));
  }
  private deliver(events: readonly DirectorEvent[]): void {
    for (const event of events) this.publish(this.stages.step(this.stages.tick + 1, this.observation(event)), event);
  }
  private publish(actions: readonly DirectorAction[], source?: Readonly<DirectorEvent>): void { for (const action of actions) this.ports.publish(action, source); }
}

/** Encounter rows select transitions for native bosses; clocks, body callbacks, rewards and views stay BossBrain's.
 * Sky's held Roc and Signal's respawning Matriarch use the same owner in their page and renderer-free hosts. */
export class DirectorBossBrain extends BossBrain {
  private readonly stages: DirectorStageLane;
  private readonly observations = { arena: false, intro: false, beat: false, dead: false, phase: false };
  constructor(def: BossDefinition, script: BossScript, ports: BossPorts, presentation: BossPresentation, saved: BossSaved, rows: unknown) {
    super(def, script, ports, presentation, saved);
    this.stages = new DirectorStageLane(rows);
    const keys = new Set(['boss.intro', 'boss.fight', 'boss.resume', 'boss.won', 'boss.phase']);
    if (this.stages.data.stages.some(stage => stage.do.length > 1 || stage.do.some(action => !('emit' in action) || action.value !== 0 || !keys.has(action.emit)))) throw new Error('Invalid authored boss action');
    this.stages.step(0, this.observations);
  }
  private select(input: keyof DirectorBossBrain['observations'], eligible: boolean, event: string): boolean {
    this.observations[input] = eligible;
    try {
      const action = this.stages.step(this.stages.tick + 1, this.observations)[0];
      return action !== undefined && 'emit' in action && action.emit === event;
    } finally { this.observations[input] = false; }
  }
  protected override introReady(inside: boolean): boolean { return this.select('arena', inside, 'boss.intro'); }
  protected override fightReady(elapsed: number, skip: number, length: number): boolean {
    return this.select('intro', elapsed >= length || skip >= 0.6, 'boss.fight');
  }
  protected override beatReady(elapsed: number): boolean { return this.select('beat', elapsed >= 1.5, 'boss.resume'); }
  protected override winReady(dead: boolean): boolean { return this.select('dead', dead, 'boss.won'); }
  protected override phaseReady(at: number): boolean { return this.select('phase', this.script.hpFrac <= at, 'boss.phase'); }
  /** Preserve native continuation fields and add the exact author contract/cursor, without emitting effects. */
  override snapshot(): BossContinuation { return { ...super.snapshot(), director: this.stages.snapshot() }; }
  /** A pre-row or foreign snapshot refuses; restore both owners quietly and atomically. */
  override restore(value: BossContinuation): void {
    if (value.director === undefined) throw new Error('Authored boss requires its director continuation');
    const before = this.stages.snapshot();
    this.stages.restore(value.director);
    try { super.restore(value); } catch (error) { this.stages.restore(before); throw error; }
  }
}
