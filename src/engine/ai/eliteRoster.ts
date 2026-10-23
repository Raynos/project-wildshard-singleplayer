import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';
import { HandleIdSchema } from '@wildshard/format/sceneRefs';
import { EliteContinuationRowsSchema, EliteCoreContinuationSchema } from '@wildshard/format/eliteContinuation';
import type { AnimalSim } from '../entities/AnimalSim';
import type { SimHost } from '../sim';
import { NativeEliteKernels, type NativeEliteKernelLoans } from './eliteKernels';
import { NativeEliteLifecycle, type NativeElitePopulation } from './eliteLifecycle';
import { GrazerBrain } from './grazer';
import { NativeEliteContinuation, type EliteContinuationCore, type EliteContinuationGroups, type EliteContinuationMember } from './eliteContinuation';

const finite = v.pipe(v.number(), v.finite());
const definition = v.object({ id: HandleIdSchema, lair: v.object({ x: finite, z: finite, r: finite }),
  awareR: finite, engageR: finite, leashR: finite, rule: v.picklist(['always', 'dusk', 'night', 'storm']), respawnMin: finite });
const rowSchema = v.object({ ...EliteContinuationRowsSchema.entries.rows.item.entries, def: definition });
const rowsSchema = v.strictObject({ step: HandleIdSchema, version: finite, wire: EliteContinuationRowsSchema.entries.wire,
  rows: v.pipe(v.array(rowSchema), v.minLength(1), v.maxLength(64)), roles: v.array(v.picklist(['native', 'borrowed'])), kernels: v.unknown() });
type Definition = v.InferOutput<typeof definition>;
type ReadonlyRows<T> = T extends object ? { readonly [K in keyof T]: ReadonlyRows<T[K]> } : T;
/** Canonical admitted native roster declaration; reused by compiled lenders. */
export type NativeEliteRosterRows = ReadonlyRows<v.InferOutput<typeof rowsSchema>>;
/** The original Core consumes the same scripts and member objects. */
export interface NativeEliteScript {
  readonly def: Definition; readonly animal: AnimalSim | null;
  readonly spawn: () => void; readonly despawn: () => void; readonly reset: () => void; readonly enterPhase2: () => void;
  readonly trophy: () => void; readonly tick: (dt: number, t: number, engaged: boolean, leashing: boolean) => void;
  readonly broken?: () => boolean; readonly retired?: () => boolean; readonly canSpawn?: () => boolean;
}
export interface NativeEliteRosterCore extends EliteContinuationCore {
  readonly player: { readonly position: { readonly x: number; readonly z: number } };
  readonly add: (script: NativeEliteScript) => unknown; readonly update: (dt: number, time: number) => void;
  readonly initialize: () => void; readonly signature: (id: string) => void;
}
/** Original mutable state, including the raw declared row used by its lender. */
export interface NativeEliteMember extends EliteContinuationMember { readonly row: { readonly def: Definition } }
/** Original concrete loans for compiled roster construction. */
export interface NativeEliteRosterLoans {
  readonly host: SimHost; readonly core: NativeEliteRosterCore;
  readonly bindings: { readonly brains: NativeEliteKernelLoans['brains']; readonly pinned: Set<AnimalSim> };
  readonly kernel?: Omit<NativeEliteKernelLoans, 'scope' | 'host' | 'lifecycle' | 'brains'>;
  readonly groups?: EliteContinuationGroups;
}
function method<O extends object>(owner: O, key: keyof O): unknown { return owner[key]; }
function scriptMethods(script: NativeEliteScript): readonly unknown[] {
  const descriptor = Object.getOwnPropertyDescriptor(script, 'animal');
  return [script.spawn, script.despawn, script.reset, script.enterPhase2, script.trophy, script.tick, script.broken, script.retired, script.canSpawn,
    descriptor === undefined ? undefined : method(descriptor, 'get')];
}
/** Ordered native construction and registration on the original Core and host.
 * Borrowed controllers are lent at their original row position, never made by
 * an authored factory. They retain all decisions and continuation authority. */
export class NativeEliteRoster {
  private readonly input: NativeEliteRosterRows; private readonly rows: NativeEliteRosterRows['rows']; private readonly roles: NativeEliteRosterRows['roles']; private readonly rowOwner: NativeEliteRosterRows['rows']; private readonly roleOwner: NativeEliteRosterRows['roles'];
  private readonly host: SimHost; private readonly scope: SimHost['scope']; private readonly clock: SimHost['clock']; private readonly core: NativeEliteRosterCore; private readonly entries: NativeEliteRosterCore['entries']; private readonly bindings: NativeEliteRosterLoans['bindings'];
  private readonly kernelOwner: NativeEliteRosterLoans['kernel']; private readonly groups: NativeEliteRosterLoans['groups']; private readonly kernels: NativeEliteKernels | null; private readonly lifecycle: NativeEliteLifecycle | null;
  private readonly brains: NativeEliteRosterLoans['bindings']['brains']; private readonly pinned: Set<AnimalSim>; private readonly packs: EliteContinuationGroups['packs'] | undefined; private readonly guards: EliteContinuationGroups['herds'] | undefined;
  private readonly borrowedGroups: readonly (EliteContinuationGroups['herds'][number] | undefined)[]; private readonly kernelLoans: readonly unknown[];
  private readonly calls: readonly unknown[]; private readonly loans: NativeEliteRosterLoans;
  private readonly members: NativeEliteMember[] = []; private readonly prepared: NativeEliteScript[] = [];
  private readonly borrowed: { member: NativeEliteMember; script: NativeEliteScript; controller: EliteContinuationMember['controller']; calls: readonly unknown[]; continuation: readonly unknown[] }[] = [];
  private installed = false;
  constructor(input: unknown, loans: NativeEliteRosterLoans) {
    if (!isJsonData(input)) throw new Error('Elite roster requires plain JSON rows');
    if (!v.is(rowsSchema, input)) throw new Error('Invalid elite roster rows');
    this.input = input; this.rows = [...input.rows]; this.roles = [...input.roles]; this.rowOwner = input.rows; this.roleOwner = input.roles; this.loans = loans;
    this.host = loans.host; this.scope = loans.host.scope; this.clock = loans.host.clock; this.core = loans.core; this.entries = loans.core.entries;
    this.bindings = loans.bindings; this.kernelOwner = loans.kernel; this.groups = loans.groups;
    this.brains = this.bindings.brains; this.pinned = this.bindings.pinned; this.packs = this.groups?.packs; this.guards = this.groups?.herds;
    this.borrowedGroups = this.rows.map(row => row.continuation?.borrowed === undefined ? undefined : this.guards?.[row.continuation.borrowed.group]); this.kernelLoans = this.kernelMembers();
    const ids = this.rows.map(row => row.def.id), keys = ['version', ...Object.keys(EliteCoreContinuationSchema.entries), ...(input.wire.detached === undefined ? [] : [input.wire.detached]), ...this.rows.map(row => row.snapshot)];
    if (new Set(ids).size !== ids.length || input.roles.length !== ids.length || this.entries.length > 0 || this.core.player !== this.host.player
      || new Set(keys).size !== keys.length || keys.some(key => key.length === 0 || ['__proto__', 'constructor', 'prototype'].includes(key))
      || this.rows.some(row => (row.pack !== undefined && this.groups === undefined)
        || (row.continuation?.borrowed !== undefined && !(this.groups?.herds[row.continuation.borrowed.group] instanceof GrazerBrain)))
      || this.host.hasStep(input.step)) throw new Error('Invalid elite roster owners or identities');
    this.calls = this.callables(); if (this.calls.some(callable => typeof callable !== 'function')) throw new Error('Missing elite roster operation');
    this.kernels = loans.kernel === undefined ? null : new NativeEliteKernels(input.kernels, { ...loans.kernel, host: this.host, scope: this.scope, lifecycle: this.core, brains: this.bindings.brains });
    const nativeIds = this.rows.flatMap((row, i) => this.roles[i] === 'native' ? [row.def.id] : []);
    if (nativeIds.length !== (this.kernels?.declaredRows.length ?? 0) || nativeIds.some(id => !this.kernels?.declaredRows.some(row => row.id === id))) throw new Error('Incomplete native elite kernels');
    this.lifecycle = this.kernels === null ? null : new NativeEliteLifecycle(this.rows.filter((_row, i) => this.roles[i] === 'native'), { host: this.host, kernels: this.kernels, bindings: this.bindings });
    this.validate(); this.advanceConstruction();
  }
  private callables(): readonly unknown[] {
    return [method(this.host, 'onStep'), method(this.host, 'hasStep'), method(this.core, 'add'), method(this.core, 'update'), method(this.core, 'initialize'), method(this.core, 'signature'), method(this.core, 'snapshot'), method(this.core, 'prepareRestore'),
      method(this.brains, 'clear'), method(this.brains, 'set'), method(this.pinned, 'clear'), method(this.pinned, 'add'), method(this.pinned, 'delete')];
  }
  private kernelMembers(): readonly unknown[] { const owner = this.kernelOwner; return owner === undefined ? [] : [owner.contacts, owner.strikes, owner.terrain, owner.environment, owner.ledges]; }
  private validate(): void {
    const loans = this.loans; this.lifecycle?.validate();
    if (this.scope.disposed || this.scope.disposing || this.host.scope !== this.scope || this.host.clock !== this.clock || loans.host !== this.host || loans.core !== this.core || this.core.player !== this.host.player
      || loans.bindings !== this.bindings || loans.kernel !== this.kernelOwner || loans.groups !== this.groups || this.core.entries !== this.entries
      || this.prepared.length !== this.members.length
      || this.bindings.brains !== this.brains || this.bindings.pinned !== this.pinned || this.groups?.packs !== this.packs || this.groups?.herds !== this.guards || this.kernelMembers().some((owner, i) => owner !== this.kernelLoans[i])
      || this.rows.some((row, i) => row.continuation?.borrowed !== undefined && this.guards?.[row.continuation.borrowed.group] !== this.borrowedGroups[i])
      || this.entries.length !== (this.installed ? this.prepared.length : 0) || (this.installed && this.entries.some((entry, i) => entry.script !== this.prepared[i]))
      || this.input.rows !== this.rowOwner || this.input.roles !== this.roleOwner || this.rowOwner.length !== this.rows.length || this.roleOwner.length !== this.roles.length
      || this.rows.some((row, i) => this.rowOwner[i] !== row || this.roleOwner[i] !== this.roles[i]) || this.callables().some((callable, i) => callable !== this.calls[i])
      || this.borrowed.some(loan => loan.member.controller !== loan.controller || loan.member.row.def !== loan.script.def || scriptMethods(loan.script).some((callable, i) => callable !== loan.calls[i])
        || [method(loan.controller, 'snapshot'), method(loan.controller, 'prepareRestore')].some((callable, i) => callable !== loan.continuation[i]))) throw new Error('Retired or replaced elite roster owner');
  }
  private advanceConstruction(): void {
    while (this.members.length < this.rows.length && this.roles[this.members.length] === 'native') {
      this.validate(); const row = this.rows[this.members.length]; if (row === undefined || this.lifecycle === null) throw new Error('Missing native elite lifecycle');
      const state = { animal: null, phase2: false, pack: null, adopted: false, detached: false }, { controller, script } = this.lifecycle.create(row.def, state);
      this.members.push(Object.assign(state, { row, controller })); this.prepared.push(script);
    }
  }
  /** The next concrete borrowed owner is constructed by its original lender here. */
  get borrowedIndex(): number | null { this.validate(); return this.members.length === this.rows.length ? null : this.members.length; }
  bindBorrowed(index: number, member: NativeEliteMember, script: NativeEliteScript): void {
    this.validate(); const row = this.rows[index];
    if (this.installed || index !== this.members.length || this.roles[index] !== 'borrowed' || row === undefined || member.row !== row || script.def !== row.def
      || member.animal !== null || member.pack !== null || member.phase2 || member.adopted || member.detached || script.animal !== member.animal
      || this.members.some(prior => prior === member || prior.controller === member.controller) || this.prepared.includes(script)
      || [member.controller.snapshot, member.controller.prepareRestore, ...scriptMethods(script).slice(0, 6)].some(callable => typeof callable !== 'function')) throw new Error('Foreign or duplicate borrowed elite owner');
    this.borrowed.push({ member, script, controller: member.controller, calls: scriptMethods(script), continuation: [method(member.controller, 'snapshot'), method(member.controller, 'prepareRestore')] });
    this.members.push(member); this.prepared.push(script); this.validate(); this.advanceConstruction();
  }
  /** Register the complete ordered bank only after every controller is present. */
  install(): void {
    this.validate(); if (this.installed || this.members.length !== this.rows.length || this.host.hasStep(this.input.step)) throw new Error('Incomplete or duplicate elite roster installation');
    Object.freeze(this.prepared); for (const script of this.prepared) this.core.add(script);
    this.installed = true;
    const continuation = new NativeEliteContinuation({ version: this.input.version, wire: this.input.wire, rows: this.rows }, {
      host: this.host, core: this.core, members: this.members, bindings: this.bindings, kernels: this.kernels,
      ...(this.lifecycle === null ? {} : { lifecycle: this.lifecycle }), ...(this.groups === undefined ? {} : { groups: this.groups }),
    });
    this.host.onStep(this.input.step, dt => { if (this.scope.disposed || this.scope.disposing) return; this.validate(); this.core.update(dt, this.clock.now); }, continuation);
  }
  get scripts(): readonly NativeEliteScript[] { this.validate(); if (this.members.length !== this.rows.length) throw new Error('Incomplete elite roster'); return Object.freeze(this.prepared); }
  initialize(): void { this.validate(); if (!this.installed) throw new Error('Uninstalled elite roster'); this.core.initialize(); }
  bindPopulation(population: NativeElitePopulation): void { this.validate(); if (!this.installed) throw new Error('Uninstalled elite roster'); this.lifecycle?.bindPopulation(population); }
}
