/** Encounter rosters driven by admitted route, lifetime and firing projections.
 * This value host owns groups and clocks; bodies and drawing remain external. */
import type { ReturnProgram } from '../population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';
import type { EncounterPatrolRows,EncounterSlotsRows,CoupledEncounterRows } from '@wildshard/format/encounterRows';

export interface PatrolMember { readonly id: string; readonly state: Record<string, number>; group: PatrolGroup | null; slot: number }
export interface PatrolGroup { readonly members: PatrolMember[]; readonly state: Record<string, number> }
export interface PatrolObservation { readonly id: string; readonly x: number; readonly z: number; readonly alive: number; readonly hidden: number }
export interface PatrolEffect { readonly member: PatrolMember; readonly killed: boolean; readonly retire: boolean; readonly shoot: boolean }
/** Borrowed actor and its existing native roster. No presentation is retained. */
export interface PatrolActor { readonly entityId: string; readonly position: { readonly x: number; readonly z: number }; readonly mem: Record<string, number>; readonly alive: boolean; readonly hidden: boolean; herd: number }
export interface PatrolActorRoster<A extends PatrolActor> {
  readonly factory: { model: (kind: string, variant: string) => unknown };
  spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => A;
  retire: (actor: A) => void;
}
export interface PatrolActorBinding<A extends PatrolActor> { readonly a: A; readonly law: PatrolMember }
/** Data-only transport over the existing boss/encounter decision host. The guest
 * owns phase admission, respawn, routing, fades and fire intervals. */
export class EncounterPatrol<A extends PatrolActor = PatrolActor> {
  readonly members: PatrolMember[] = [];
  readonly groups: PatrolGroup[] = [];
  private readonly rows: EncounterPatrolRows;
  private elapsed = 0;
  private readonly cycle = { respawn: -1, phase: -1, kills: 0 };
  private roster: PatrolActorRoster<A> | null = null;
  private readonly actors = new Map<string, PatrolActorBinding<A>>();
  constructor(input: EncounterPatrolRows, private readonly program: ReturnProgram, private readonly random: Rng) { this.rows = input; }
  get kills(): number { return this.cycle.kills; }
  get living(): number { return this.members.filter(member => member.state['dead'] !== 1).length; }
  attachActors(roster: PatrolActorRoster<A>): void {
    const rows = this.rows.actors; if (rows === undefined) throw new Error('Missing patrol actor rows');
    roster.factory.model(rows.kind, rows.variant); this.roster = roster;
  }
  spawnActor(at: { readonly x: number; readonly z: number; readonly yaw: number; readonly variant?: string; readonly quiet?: number }, group: PatrolGroup | null = null, slot = 0): PatrolActorBinding<A> | null {
    const rows = this.rows.actors; if (rows === undefined || this.roster === null) return null;
    const a = this.roster.spawn(rows.kind, at.x, at.z, at.yaw, at.variant ?? rows.variant);
    a.herd = rows.herd;
    const bound = { a, law: this.add(a.entityId, { quiet: at.quiet ?? 0 }, group, slot) }; this.actors.set(a.entityId, bound); return bound;
  }
  spawnActors(player: { readonly x: number; readonly z: number }, options: { readonly count?: number; readonly leader?: boolean; readonly at?: number }): readonly PatrolActorBinding<A>[] {
    const rows = this.rows.actors; if (rows === undefined || this.roster === null) return [];
    const plan = this.plan(options.count ?? rows.count, options.at ?? -1, player), out: PatrolActorBinding<A>[] = [];
    for (const [slot, at] of plan.slots.entries()) {
      const bound = this.spawnActor({ x: at['x'] ?? 0, z: at['z'] ?? 0, yaw: at['yaw'] ?? 0, variant: slot === 0 && options.leader === true ? rows.leader : rows.variant }, plan.group, slot);
      if (bound !== null) out.push(bound);
    }
    return out;
  }
  dissolveActor(actor: A): void { const bound = this.actors.get(actor.entityId); if (bound !== undefined) this.dissolve(bound.law); }
  retireActor(actor: A): void {
    const bound = this.actors.get(actor.entityId); if (bound === undefined) return;
    this.roster?.retire(actor); this.remove(bound.law); this.actors.delete(actor.entityId);
  }
  /** Apply the guest's movement to declared memory slots once per patrol step. */
  updateActors(dt: number, frame: Readonly<Record<string, number>>, freeze = false): ReturnType<EncounterPatrol['update']> {
    const rows = this.rows.actors; if (rows === undefined) throw new Error('Missing patrol actor rows');
    const step = this.update(this.roster === null ? 0 : dt, frame, [...this.actors.values()].map(({ a }) => ({ id: a.entityId, x: a.position.x, z: a.position.z, alive: Number(a.alive), hidden: Number(a.hidden) })));
    for (const { a, law } of this.actors.values()) {
      a.mem[rows.player.x] = frame['px'] ?? 0; a.mem[rows.player.z] = frame['pz'] ?? 0;
      if (law.group !== null) for (const [slot, channel] of Object.entries(rows.steering)) {
        const value = law.state[channel]; if (value !== undefined) a.mem[slot] = value;
      }
      if (freeze) { a.mem[rows.target.x] = a.position.x; a.mem[rows.target.z] = a.position.z; }
    }
    return step;
  }
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
  update(dt: number, frame: Readonly<Record<string, number>>, observations: readonly PatrolObservation[]): { spawn: boolean; effects: readonly PatrolEffect[]; dt: number } {
    this.elapsed += dt;
    if (this.elapsed + 1e-9 < .1) return { spawn: false, effects: [], dt: 0 };
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
    return { spawn: cycle['spawn'] === 1, effects, dt: step };
  }
}

export interface SlotActor extends PatrolActor { readonly scale: number; yOffset: number }
export interface EncounterSlotSite { readonly x: number; readonly z: number; readonly yaw: number; readonly variant: number }
export interface EncounterSlotActor<A extends SlotActor> { readonly a: A; readonly index: number }
/** Static encounter slots share the same numeric observation/effect transport.
 * The guest owns each cycle's selection and each occupied slot's lifetime. */
export class EncounterSlots<A extends SlotActor = SlotActor> {
  readonly cycle: Record<string, number>;
  private readonly rows: EncounterSlotsRows;
  private readonly members = new Map<string, Record<string, number>>();
  private readonly retired = new Map<string, Readonly<Record<string, number>>>();
  private elapsed = 0;
  private roster: PatrolActorRoster<A> | null = null;
  private readonly actors = new Map<string, EncounterSlotActor<A>>();
  constructor(input: EncounterSlotsRows, private readonly program: ReturnProgram) {
    this.rows = input; this.cycle = { ...this.rows.cycle.initial };
  }
  attachActors(roster: PatrolActorRoster<A>): void {
    const rows = this.rows.actors; if (rows === undefined) throw new Error('Missing slot actor rows');
    for (const variant of new Set([rows.variant,...Object.values(rows.variants)])) roster.factory.model(rows.kind,variant);
    this.roster = roster;
  }
  spawnActors(sites: readonly EncounterSlotSite[], which?: readonly number[]): readonly EncounterSlotActor<A>[] {
    const rows = this.rows.actors; if (rows === undefined || this.roster === null) return [];
    const out: EncounterSlotActor<A>[] = [];
    for (const index of which ?? this.select({ count: sites.length, night: this.cycle['t'] ?? 0 })) {
      if (this.actors.size >= 8 || [...this.actors.values()].some(row => row.index === index)) continue;
      const site = sites[index]; if (site === undefined) continue;
      const yaw = site.yaw + rows.yaw, a = this.roster.spawn(rows.kind,site.x,site.z,yaw,rows.variants[String(site.variant)] ?? rows.variant);
      a.herd = rows.herd; Object.assign(a.mem,rows.memory);
      a.mem[rows.home.x] = site.x; a.mem[rows.home.z] = site.z; a.mem[rows.home.yaw] = yaw; a.yOffset = rows.sink * a.scale;
      this.add(a.entityId); const binding = { a,index }; this.actors.set(a.entityId,binding); out.push(binding);
    }
    return out;
  }
  dawnActors(): readonly number[] {
    const rows = this.rows.actors; if (rows === undefined) throw new Error('Missing slot actor rows');
    const released: number[] = [];
    for (const { a,index } of this.actors.values()) { if (a.alive) a.mem[rows.dawn] = 1; else if (a.hidden) released.push(index); }
    return released;
  }
  retireActor(actor: A, delayed: boolean): void {
    const row = this.actors.get(actor.entityId); if (row === undefined) return;
    this.roster?.retire(actor); this.actors.delete(actor.entityId);
    if (delayed) this.retire(actor.entityId,{ index: row.index }); else this.remove(actor.entityId);
  }
  updateActors(dt: number, frame: Readonly<Record<string, number>>): ReturnType<EncounterSlots['update']> {
    const rows = this.rows.actors; if (rows === undefined) throw new Error('Missing slot actor rows');
    return this.update(this.roster === null ? 0 : dt, frame, [...this.actors.values()].map(({ a }) => ({ id: a.entityId, fields: { alive: Number(a.alive), gone: a.mem[rows.gone] ?? 0 } })));
  }
  add(id: string): void {
    if (this.members.has(id)) throw new Error('Duplicate encounter slot');
    this.members.set(id, { ...this.rows.member.initial });
  }
  remove(id: string): void { this.members.delete(id); }
  retire(id: string, metadata: Readonly<Record<string, number>>): void {
    if (!this.members.has(id)) throw new Error('Unknown retired encounter slot');
    if(Object.values(metadata).some(value=>!Number.isFinite(value)))throw new Error('Invalid retired slot metadata');
    this.members.delete(id); this.retired.set(id, {...metadata});
  }
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
    cycle: Readonly<Record<string, number>>; members: ReadonlyMap<string, Readonly<Record<string, number>>>; released: readonly Readonly<Record<string, number>>[];
  } {
    this.elapsed += dt;
    const results = new Map<string, Readonly<Record<string, number>>>();
    if (this.elapsed + 1e-9 < .1) return { cycle: {}, members: results, released: [] };
    const step = this.elapsed; this.elapsed = 0;
    const cycle = this.program.project(this.rows.cycle.signal, { ...this.cycle, ...frame, dt: step });
    Object.assign(this.cycle, cycle);
    for (const row of observed) {
      const state = this.members.get(row.id);
      if (state === undefined) throw new Error('Unknown encounter slot observation');
      const result = this.program.project(this.rows.member.signal, { ...state, ...row.fields, dt: step });
      Object.assign(state, result); results.set(row.id, result);
    }
    const released = cycle[this.rows.release] === 1 ? [...this.retired.values()] : [];
    if (released.length > 0) this.retired.clear();
    return { cycle, members: results, released };
  }
}

export interface CoupledMember { readonly id: string; readonly state: Record<string, number> }
/** Native actors remain owned by their roster; the encounter borrows only its
 * declared health, steering slots and live position for cohort effects. */
export interface CoupledActor {
  readonly entityId: string; readonly scale: number; readonly position: { readonly x: number; readonly z: number };
  readonly mem: Record<string, number>; readonly alive: boolean; hp: number; maxHp: number;
}
const coupledDamage = new WeakMap<CoupledActor, { host: CoupledEncounter; member: CoupledMember; player: { readonly x: number; readonly z: number } }>();
/** Species damage reads the actual attached cohort instead of lending a
 * per-actor callback from the shard. A cleared or retired slot has no modifier. */
export function coupledActorDamage(actor: CoupledActor, point: { readonly x: number; readonly z: number }): number {
  const owner = coupledDamage.get(actor);
  return owner === undefined ? 1 : owner.host.damage(owner.member, { x: point.x, z: point.z, px: owner.player.x, pz: owner.player.z, radius: actor.scale });
}
/** Bounded support cohorts share their boss's health and scheduling projection.
 * The guest selects commits and retirements; native slots retain numeric state. */
export class CoupledEncounter {
  readonly members: CoupledMember[] = [];
  private readonly rows: CoupledEncounterRows;
  private state: Record<string, number>;
  private readonly actors = new Map<string, CoupledActor>();
  constructor(input: CoupledEncounterRows, private readonly program: ReturnProgram, private readonly random: Rng) {
    this.rows = input; this.state = { ...this.rows.initial };
  }
  add(id: string, initial: Readonly<Record<string, number>>): CoupledMember {
    if (this.members.some(member => member.id === id) || this.members.length >= 8) throw new Error('Invalid coupled encounter member');
    const member = { id, state: { ...this.rows.member, ...initial } }; this.members.push(member); return member;
  }
  /** Bind an already spawned native body using the admitted actor rows. */
  addActor(actor: CoupledActor, initial: Readonly<Record<string, number>>, player: { readonly x: number; readonly z: number }): CoupledMember {
    if (this.rows.actors === undefined || coupledDamage.has(actor)) throw new Error('Invalid coupled actor binding');
    const member = this.add(actor.entityId, initial);
    actor.maxHp = this.rows.actors.hp; actor.hp = this.rows.actors.hp;
    this.actors.set(actor.entityId, actor); coupledDamage.set(actor, { host: this, member, player }); return member;
  }
  clear(): void { for (const actor of this.actors.values()) coupledDamage.delete(actor); this.actors.clear(); this.members.length = 0; }
  reset(): void { this.clear(); this.state = { ...this.rows.initial }; }
  damage(member: CoupledMember, observations: Readonly<Record<string, number>>): number {
    if (!this.members.includes(member)) return 1;
    return this.program.project(this.rows.signals.damage, { ...member.state, ...observations })['alpha'] ?? 1;
  }
  /** Called from the arena's bounded step, with no authored native callbacks. */
  updateActors(frame: Readonly<Record<string, number>>): ReturnType<CoupledEncounter['update']> {
    const step = this.update(frame, [...this.actors.values()].map(actor => ({ id: actor.entityId, x: actor.position.x, z: actor.position.z, alive: actor.alive })));
    for (const id of step.retired) { const actor = this.actors.get(id); if (actor !== undefined) coupledDamage.delete(actor); this.actors.delete(id); }
    for (const [id, result] of step.members) {
      const actor = this.actors.get(id); if (actor === undefined) throw new Error('Missing bound cohort actor');
      for (const [slot, channel] of Object.entries(this.rows.actors?.memory ?? {})) {
        const value = result[channel]; if (value === undefined) throw new Error('Missing cohort actor channel'); actor.mem[slot] = value;
      }
    }
    return step;
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
