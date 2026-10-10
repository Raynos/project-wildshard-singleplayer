import * as v from 'valibot';
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptQuery } from '@wildshard/engine/script/host';
import { ScriptWorld, type EffectTransaction, type ScriptEffect } from '@wildshard/engine/script/effects';
import { parseDirector, type DirectorData, type DirectorEvent } from './director';

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
