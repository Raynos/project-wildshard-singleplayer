/** Encounter rosters driven by admitted route, lifetime and firing projections.
 * This value host owns groups and clocks; bodies and drawing remain external. */
import type { ReturnProgram } from '../population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';
import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const numbers = v.record(v.string(), finite);
export const EncounterPatrolSchema = v.strictObject({
  parameters: numbers, member: numbers, group: numbers,
  signals: v.strictObject({ cycle: v.string(), empty: v.string(), dissolve: v.string(),
    member: v.string(), fire: v.string(), retry: v.string(), start: v.string(), slot: v.string(), group: v.string(), target: v.string() }),
});
export interface PatrolMember { readonly id: string; readonly state: Record<string, number>; group: PatrolGroup | null; slot: number }
export interface PatrolGroup { readonly members: PatrolMember[]; readonly state: Record<string, number> }
export interface PatrolObservation { readonly id: string; readonly x: number; readonly z: number; readonly alive: number; readonly hidden: number }
export interface PatrolEffect { readonly member: PatrolMember; readonly killed: boolean; readonly retire: boolean; readonly shoot: boolean }
/** Data-only transport over the existing boss/encounter decision host. The guest
 * owns phase admission, respawn, routing, fades and fire intervals. */
export class EncounterPatrol {
  readonly members: PatrolMember[] = [];
  readonly groups: PatrolGroup[] = [];
  private readonly rows: v.InferOutput<typeof EncounterPatrolSchema>;
  private elapsed = 0;
  private readonly cycle = { respawn: -1, phase: -1, kills: 0 };
  constructor(input: unknown, private readonly program: ReturnProgram, private readonly random: Rng) { this.rows = v.parse(EncounterPatrolSchema, input); }
  get kills(): number { return this.cycle.kills; }
  get living(): number { return this.members.filter(member => member.state['dead'] !== 1).length; }
  add(id: string, observations: Readonly<Record<string, number>>, group: PatrolGroup | null = null, slot = 0): PatrolMember {
    if (this.members.some(member => member.id === id) || (group !== null && !this.groups.includes(group))) throw new Error('Invalid patrol member');
    const state = { ...this.rows.member, ...observations, ...this.program.project(this.rows.signals.retry, { first: 1 }, this.random) };
    const member = { id, state, group, slot };
    this.members.push(member); group?.members.push(member); return member;
  }
  remove(member: PatrolMember): void {
    const at = this.members.indexOf(member); if (at !== -1) this.members.splice(at, 1);
    const index = member.group?.members.indexOf(member) ?? -1;
    if (index !== -1) member.group?.members.splice(index, 1);
  }
  dissolve(member: PatrolMember): void { Object.assign(member.state, this.program.project(this.rows.signals.dissolve, member.state)); }
  /** Source-ordered placements for a group; no body or random draw is duplicated
   * by its external presentation adapter. */
  plan(count: number, at: number, player: { readonly x: number; readonly z: number }): { group: PatrolGroup; slots: readonly Readonly<Record<string, number>>[] } {
    if (!Number.isSafeInteger(count) || count < 0 || count > 8) throw new RangeError('Invalid patrol group size');
    const start = this.program.project(this.rows.signals.start, { ...this.rows.parameters, at, px: player.x, pz: player.z }, this.random);
    const group: PatrolGroup = { members: [], state: { ...this.rows.group, ...start } };
    const slots = Array.from({ length: count }, (_, slot) => this.program.project(this.rows.signals.slot, { ...this.rows.parameters, ...group.state, slot }));
    this.groups.push(group); return { group, slots };
  }
  /** Retirements and shots are emitted once per bounded decision step. */
  update(dt: number, frame: Readonly<Record<string, number>>, observations: readonly PatrolObservation[]): { spawn: boolean; effects: readonly PatrolEffect[] } {
    this.elapsed += dt;
    if (this.elapsed + 1e-9 < .1) return { spawn: false, effects: [] };
    const step = this.elapsed; this.elapsed = 0;
    const live = new Map(observations.map(row => [row.id, row]));
    const cycle = this.program.project(this.rows.signals.cycle, { ...frame, ...this.cycle, dt: step, living: this.living });
    this.cycle.respawn = cycle['respawn'] ?? this.cycle.respawn;
    this.cycle.phase = cycle['phase'] ?? this.cycle.phase; this.cycle.kills = cycle['kills'] ?? this.cycle.kills;
    if (cycle['dissolve'] === 1) for (const member of this.members) this.dissolve(member);
    for (const group of this.groups) {
      const lead = group.members.find(member => member.state['dead'] !== 1), actor = lead === undefined ? undefined : live.get(lead.id);
      if (actor === undefined) continue;
      Object.assign(group.state, this.program.project(this.rows.signals.group, { ...this.rows.parameters, ...group.state, ...frame, dt: step, ax: actor.x, az: actor.z }));
      for (const member of group.members) {
        const body = live.get(member.id); if (body === undefined || member.state['dead'] === 1) continue;
        const target = this.program.project(this.rows.signals.target, { ...this.rows.parameters, ...group.state, ...frame, slot: member.slot, ax: body.x, az: body.z });
        member.state['tx'] = target['x'] ?? body.x; member.state['tz'] = target['z'] ?? body.z;
        member.state['v'] = target['speed'] ?? 0; member.state['turn'] = target['turn'] ?? 0;
      }
    }
    const effects: PatrolEffect[] = [];
    for (const member of this.members) {
      const body = live.get(member.id); if (body === undefined) continue;
      const state = member.state;
      const result = this.program.project(this.rows.signals.member, { ...state, dt: step, alive: body.alive });
      Object.assign(state, result);
      const fire = this.program.project(this.rows.signals.fire, { ...state, dt: step, hidden: body.hidden,
        distance: Math.hypot((frame['px'] ?? 0) - body.x, (frame['pz'] ?? 0) - body.z),
        engaged: Number(member.group === null || member.group.state['mode'] === 1) });
      state['fireT'] = fire['fireT'] ?? state['fireT'] ?? 0;
      if (fire['shoot'] === 1) Object.assign(state, this.program.project(this.rows.signals.retry, { first: 0 }, this.random));
      effects.push({ member, killed: result['killed'] === 1, retire: result['retire'] === 1, shoot: fire['shoot'] === 1 });
    }
    const counted = this.program.project(this.rows.signals.empty, { ...this.cycle, ...frame,
      living: this.living, killed: effects.filter(effect => effect.killed).length,
      empty: Number(this.groups.some(group => group.members.every(member => member.state['dead'] === 1 || live.get(member.id)?.hidden === 1))) });
    this.cycle.kills = counted['kills'] ?? this.cycle.kills; this.cycle.respawn = counted['respawn'] ?? this.cycle.respawn;
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const group = this.groups[i];
      if (group?.members.every(member => member.state['dead'] === 1 || live.get(member.id)?.hidden === 1) === true) this.groups.splice(i, 1);
    }
    return { spawn: cycle['spawn'] === 1, effects };
  }
}

const SlotRows = v.strictObject({
  cycle: v.strictObject({ signal: v.string(), initial: numbers }),
  member: v.strictObject({ signal: v.string(), initial: numbers }),
  select: v.strictObject({ signal: v.string(), count: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(8)) }),
});
/** Static encounter slots share the same numeric observation/effect transport.
 * The guest owns each cycle's selection and each occupied slot's lifetime. */
export class EncounterSlots {
  readonly cycle: Record<string, number>;
  private readonly rows: v.InferOutput<typeof SlotRows>;
  private readonly members = new Map<string, Record<string, number>>();
  private elapsed = 0;
  constructor(input: unknown, private readonly program: ReturnProgram) {
    this.rows = v.parse(SlotRows, input); this.cycle = { ...this.rows.cycle.initial };
  }
  add(id: string): void {
    if (this.members.has(id)) throw new Error('Duplicate encounter slot');
    this.members.set(id, { ...this.rows.member.initial });
  }
  remove(id: string): void { this.members.delete(id); }
  select(observations: Readonly<Record<string, number>>): number[] {
    const selected = new Set<number>();
    for (let slot = 0; slot < this.rows.select.count; slot++) {
      const result = this.program.project(this.rows.select.signal, { ...this.cycle, ...observations, slot });
      const index = result['index'];
      if (index !== undefined) {
        if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid encounter slot selection');
        selected.add(index);
      }
    }
    return [...selected];
  }
  update(dt: number, frame: Readonly<Record<string, number>>, observed: readonly { readonly id: string; readonly fields: Readonly<Record<string, number>> }[]): {
    cycle: Readonly<Record<string, number>>; members: ReadonlyMap<string, Readonly<Record<string, number>>>;
  } {
    this.elapsed += dt;
    const results = new Map<string, Readonly<Record<string, number>>>();
    if (this.elapsed + 1e-9 < .1) return { cycle: {}, members: results };
    const step = this.elapsed; this.elapsed = 0;
    const cycle = this.program.project(this.rows.cycle.signal, { ...this.cycle, ...frame, dt: step });
    Object.assign(this.cycle, cycle);
    for (const row of observed) {
      const state = this.members.get(row.id);
      if (state === undefined) throw new Error('Unknown encounter slot observation');
      const result = this.program.project(this.rows.member.signal, { ...state, ...row.fields, dt: step });
      Object.assign(state, result); results.set(row.id, result);
    }
    return { cycle, members: results };
  }
}

const CoupledRows = v.strictObject({ initial: numbers, member: numbers, commit: numbers, parameters: numbers,
  signals: v.strictObject({ couple: v.string(), member: v.string(), damage: v.string() }) });
export interface CoupledMember { readonly id: string; readonly state: Record<string, number> }
/** Bounded support cohorts share their boss's health and scheduling projection.
 * The guest selects commits and retirements; native slots retain numeric state. */
export class CoupledEncounter {
  readonly members: CoupledMember[] = [];
  private readonly rows: v.InferOutput<typeof CoupledRows>;
  private state: Record<string, number>;
  constructor(input: unknown, private readonly program: ReturnProgram, private readonly random: Rng) {
    this.rows = v.parse(CoupledRows, input); this.state = { ...this.rows.initial };
  }
  add(id: string, initial: Readonly<Record<string, number>>): CoupledMember {
    if (this.members.some(member => member.id === id) || this.members.length >= 8) throw new Error('Invalid coupled encounter member');
    const member = { id, state: { ...this.rows.member, ...initial } }; this.members.push(member); return member;
  }
  clear(): void { this.members.length = 0; }
  reset(): void { this.clear(); this.state = { ...this.rows.initial }; }
  damage(member: CoupledMember, observations: Readonly<Record<string, number>>): number {
    if (!this.members.includes(member)) return 1;
    return this.program.project(this.rows.signals.damage, { ...member.state, ...observations })['alpha'] ?? 1;
  }
  update(frame: Readonly<Record<string, number>>, observed: readonly { readonly id: string; readonly x: number; readonly z: number; readonly alive: boolean }[]): {
    state: Readonly<Record<string, number>>; retired: readonly string[]; members: ReadonlyMap<string, Readonly<Record<string, number>>>;
  } {
    const actors = new Map(observed.map(actor => [actor.id, actor]));
    const candidates = this.members.map(member => {
      const actor = actors.get(member.id); if (actor === undefined) throw new Error('Missing coupled encounter body');
      return { x: actor.x, z: actor.z, hit: Number(actor.alive), mode: member.state['mode'] ?? 0 };
    });
    const state = this.program.project(this.rows.signals.couple, { ...this.rows.parameters, ...this.state, ...frame, count: this.members.length }, this.random, candidates);
    Object.assign(this.state, state);
    const selected = this.members[state['index'] ?? -1];
    if (selected !== undefined) {
      Object.assign(selected.state, this.rows.commit);
      for (const key of ['x0', 'z0', 'x1', 'z1']) selected.state[key] = state[key] ?? 0;
    }
    const retired: string[] = [], results = new Map<string, Readonly<Record<string, number>>>();
    for (let index = this.members.length - 1; index >= 0; index--) {
      const member = this.members[index]; if (member === undefined) continue;
      if (((state['mask'] ?? 0) & (1 << index)) !== 0) { retired.push(member.id); this.members.splice(index, 1); continue; }
      const actor = actors.get(member.id); if (actor === undefined) throw new Error('Missing coupled encounter body');
      const result = this.program.project(this.rows.signals.member, { ...this.rows.parameters, ...member.state, ...frame, ax: actor.x, az: actor.z });
      Object.assign(member.state, result); results.set(member.id, result);
    }
    return { state, retired, members: results };
  }
}

const ScheduleRows = v.strictObject({ signal: v.string(), initial: numbers, parameters: numbers, retain: v.record(v.string(), v.string()) });
/** A projected attack clock retains only declared numeric slots. Rendering
 * borrows the last result; an event never installs a second decision owner. */
export class EncounterSchedule {
  readonly state: Record<string, number>;
  private readonly rows: v.InferOutput<typeof ScheduleRows>;
  constructor(input: unknown, private readonly program: ReturnProgram) { this.rows = v.parse(ScheduleRows, input); this.state = { ...this.rows.initial }; }
  value(key: string): number { const value = this.state[key]; if (value === undefined) throw new Error('Unknown encounter schedule slot'); return value; }
  set(values: Readonly<Record<string, number>>): void {
    if (Object.entries(values).some(([key, value]) => !Object.hasOwn(this.rows.initial, key) || !Number.isFinite(value))) throw new Error('Invalid encounter schedule state');
    Object.assign(this.state, values);
  }
  reset(values: Readonly<Record<string, number>> = {}): void { Object.assign(this.state, this.rows.initial); this.set(values); }
  project(frame: Readonly<Record<string, number>>, random?: Rng): Readonly<Record<string, number>> {
    const result = this.program.project(this.rows.signal, { ...this.rows.parameters, ...this.state, ...frame }, random);
    const next: Record<string, number> = {};
    for (const [channel, slot] of Object.entries(this.rows.retain)) { const value = result[channel]; if (value !== undefined) next[slot] = value; }
    this.set(next); return result;
  }
}

/** A bounded native position history; authored sample cadence is never faster
 * than the decision host. Samples are values, with no actor or view references. */
export class EncounterTrail {
  readonly points: { x: number; z: number }[] = [];
  private elapsed = 0;
  private readonly capacity: number;
  private readonly seconds: number;
  constructor(input: unknown) {
    const row = v.parse(v.strictObject({ capacity: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(64)), seconds: v.pipe(finite, v.minValue(.1)) }), input);
    this.capacity = row.capacity; this.seconds = row.seconds;
  }
  clear(): void { this.points.length = 0; this.elapsed = 0; }
  update(dt: number, point: { readonly x: number; readonly z: number }): void {
    this.elapsed += dt;
    if (this.elapsed + 1e-9 < this.seconds) return;
    this.elapsed = 0; this.points.push({ x: point.x, z: point.z });
    if (this.points.length > this.capacity) this.points.shift();
  }
}
