import type { Scope } from './scope';
import type { SystemSpec, TickRateId } from './systems';

export interface TickPoint { readonly x: number; readonly y: number; readonly z: number }
export interface TickActor { readonly position: TickPoint }
export interface TickBand { upTo: number; brainHz: number | 'paused'; body: 'frame' | 'half' | 'paused' }
export interface TickRate { bands: readonly TickBand[] }
export type InterruptReason = 'hit' | 'target.attack' | 'target.dodge' | 'lost.sight' | 'ally.died';
interface Clock { elapsed: number; credit: number; frame: number; dt: number; last: number; due: boolean }
interface Subject { brain: Clock; body: Clock; interrupt: number }
const clock = (): Clock => ({ elapsed: 0, credit: 0, frame: -1, dt: 0, last: 0, due: false });
interface Policy { pins: WeakMap<object, number>; interrupts: WeakMap<object, number>; wakes: WeakMap<object, () => void> }
const AI: TickRate = { bands: [
  { upTo: 60, brainHz: 20, body: 'frame' },
  { upTo: 160, brainHz: 10, body: 'half' },
  { upTo: Infinity, brainHz: 'paused', body: 'paused' },
] };
const ALWAYS: TickRate = { bands: [{ upTo: Infinity, brainHz: Infinity, body: 'frame' }] };
const ORIGIN: TickPoint = { x: 0, y: 0, z: 0 };
const DEFAULTS: readonly (readonly [string, TickRate])[] = [
  ['always', ALWAYS], ['ai', AI], ['npc', AI],
  ['fx', { bands: [{ upTo: 120, brainHz: 30, body: 'frame' }, { upTo: Infinity, brainHz: 'paused', body: 'paused' }] }],
  ['weather', { bands: [{ upTo: Infinity, brainHz: 10, body: 'frame' }] }],
];

/** Clocks belong to subjects, not rate classes. Paused time is discarded, never replayed on return. */
export class TickScheduler {
  private readonly rates = new Map<TickRateId, TickRate>(DEFAULTS);
  private subjects = new WeakMap<object, Map<TickRateId, Subject>>();
  private readonly policy: Policy;
  private time = 0;
  private frame = 0;
  private frameDt = 0;
  private player: TickPoint = ORIGIN;
  constructor(parent?: TickScheduler) {
    this.policy = parent?.policy ?? { pins: new WeakMap(), interrupts: new WeakMap(), wakes: new WeakMap() };
  }
  get frameHz(): number { return this.frameDt > 0 ? 1 / this.frameDt : 60; }
  configure(overrides: Readonly<Record<string, TickRate>> = {}): void {
    this.rates.clear();
    for (const [id, rate] of DEFAULTS) this.rates.set(id, rate);
    for (const [id, rate] of Object.entries(overrides)) this.rate(id, rate);
    this.subjects = new WeakMap();
  }
  beginFrame(dt: number, player: TickPoint = this.player): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Scheduler dt must be finite and nonnegative');
    this.time += dt; this.frameDt = dt; this.frame++; this.player = player;
  }
  rate(id: TickRateId, rate: TickRate): void {
    let previous = -Infinity;
    for (const band of rate.bands) {
      if (!(band.upTo > previous) || (band.brainHz !== 'paused' && !(band.brainHz > 0))) throw new Error(`Invalid tick rate: ${id}`);
      previous = band.upTo;
    }
    if (previous !== Infinity) throw new Error(`Tick rate must cover every distance: ${id}`);
    this.rates.set(id, { bands: rate.bands.map((band) => ({ ...band })) });
  }
  pin(actor: object, scope: Scope): void {
    if (scope.disposed) return;
    this.policy.pins.set(actor, (this.policy.pins.get(actor) ?? 0) + 1);
    scope.onDispose(() => { const count = (this.policy.pins.get(actor) ?? 1) - 1; if (count === 0) this.policy.pins.delete(actor); else this.policy.pins.set(actor, count); });
  }
  pinned(actor: object): boolean { return this.policy.pins.has(actor); }
  onInterrupt(actor: object, wake: () => void): void { this.policy.wakes.set(actor, wake); }
  interrupt(actor: object, _why: InterruptReason): void {
    this.policy.interrupts.set(actor, (this.policy.interrupts.get(actor) ?? 0) + 1);
    this.policy.wakes.get(actor)?.();
  }
  forget(actor: object): void { this.subjects.delete(actor); }
  reset(): void { this.subjects = new WeakMap(); }
  private band(id: TickRateId, actor: TickActor, subject: object = actor): TickBand {
    const rate = this.rates.get(id);
    if (!rate) throw new Error(`Unknown tick rate: ${id}`);
    const distance = this.pinned(subject) ? 0 : Math.hypot(actor.position.x - this.player.x, actor.position.y - this.player.y, actor.position.z - this.player.z);
    const band = rate.bands.find((entry) => distance < entry.upTo);
    if (!band) throw new Error(`Uncovered tick distance: ${id}`);
    return band;
  }
  brainHz(id: TickRateId, actor: TickActor): number { const hz = this.band(id, actor).brainHz; return hz === 'paused' ? 0 : hz; }
  private subject(id: TickRateId, actor: object): Subject {
    let rows = this.subjects.get(actor);
    if (!rows) { rows = new Map(); this.subjects.set(actor, rows); }
    let row = rows.get(id);
    if (!row) {
      // A driven/scripted actor can switch cadence. Its inactive clock must not catch up on return.
      rows.clear();
      row = { brain: clock(), body: clock(), interrupt: 0 };
      row.brain.last = this.time - this.frameDt; row.body.last = this.time - this.frameDt;
      rows.set(id, row);
    }
    return row;
  }
  private due(id: TickRateId, actor: TickActor, body: boolean, subject: object = actor): number {
    const row = this.subject(id, subject), state = body ? row.body : row.brain, band = this.band(id, actor, subject);
    const interrupt = this.policy.interrupts.get(subject) ?? 0;
    const urgent = !body && interrupt !== row.interrupt;
    if (state.frame === this.frame && !urgent) return state.dt;
    const step = this.time - state.last;
    state.last = this.time;
    const paused = body ? band.body === 'paused' : band.brainHz === 'paused';
    // An interrupt wakes decisions only, without catching up the time spent far away.
    if (paused) { state.elapsed = 0; state.credit = 0; }
    else { state.elapsed += step; state.credit += step; }
    state.frame = this.frame; state.dt = 0; state.due = false;
    if (!body) row.interrupt = interrupt;
    if (urgent || (!paused && (body ? band.body === 'frame' || this.frame % 2 === 0 : band.brainHz !== 'paused' && state.credit + 1e-9 >= 1 / band.brainHz))) {
      state.due = urgent || state.elapsed > 0; state.dt = state.elapsed; state.elapsed = 0;
      state.credit = urgent || body || band.brainHz === 'paused' || band.brainHz === Infinity ? 0
        : Math.max(0, state.credit - Math.floor((state.credit + 1e-9) * band.brainHz) / band.brainHz);
    }
    return state.dt;
  }
  brainDt(id: TickRateId, actor: TickActor): number { return this.due(id, actor, false); }
  takeBrainDt(id: TickRateId, actor: TickActor): number {
    const dt = this.brainDt(id, actor), state = this.subject(id, actor).brain; state.dt = 0; state.due = false; return dt;
  }
  /** Instanced ambient rows have stable identities but store their position beside the row. */
  takeBrainDtAt(id: TickRateId, subject: object, point: TickPoint): number {
    const dt = this.due(id, { position: point }, false, subject), state = this.subject(id, subject).brain; state.dt = 0; state.due = false; return dt;
  }
  bodyDt(id: TickRateId, actor: TickActor): number { return this.due(id, actor, true); }
  brainDue(id: TickRateId, actor: TickActor): boolean { this.brainDt(id, actor); return this.subject(id, actor).brain.due; }
  bodyDue(id: TickRateId, actor: TickActor): boolean { this.bodyDt(id, actor); return this.subject(id, actor).body.due; }
  /** A system without an actor is located at the player; creature systems schedule their own subjects. */
  systemDt(system: SystemSpec, dt: number): number {
    if (!system.tick || system.tick === 'always') return dt;
    const subject = this.subject(system.tick, system), state = subject.brain;
    state.elapsed += dt;
    state.credit += dt;
    const hz = this.rates.get(system.tick)?.bands[0]?.brainHz;
    if (hz === undefined) throw new Error(`Unknown tick rate: ${system.tick}`);
    if (hz === 'paused' || state.credit + 1e-9 < 1 / hz) return 0;
    state.credit = hz === Infinity ? 0 : Math.max(0, state.credit - Math.floor((state.credit + 1e-9) * hz) / hz);
    const elapsed = state.elapsed; state.elapsed = 0; return elapsed;
  }
}
