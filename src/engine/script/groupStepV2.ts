/** One reusable AS group executable over the original group's borrowed bank.
 * Calls happen at the original native slot. There is no tick loop, body/RNG/save
 * owner, action dispatcher or per-group module instance in this transport. */
import { parseGroupStepV2, groupStepLayoutV2 } from '@wildshard/format/scriptGroupStepV2';
import type { GroupBankReferenceV2 } from '@wildshard/format/scriptGroupBankV2';
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import { prepareV2Rng } from '@wildshard/format/scriptRngV2';
import { writeV2Frame, validateV2Frame, layoutV2, type V2FrameAuthority, type V2Layout } from '@wildshard/format/scriptWireV2';
import type { V2QueryBinding } from '@wildshard/format/scriptQueriesV2';
import { GroupBankV2 } from './groupBankV2';
import { ObservationColumnsV2, type V2ColumnOwners, type V2ActorColumnSlot } from './observationColumnsV2';
import { prepareV2Observations } from './observationsV2';
import { ScriptModuleV2 } from './moduleV2';
import type { QueryRingV2 } from './queriesV2';
import type { Scope } from '../app/scope';
import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng, RngState } from '../core/rng';

export interface GroupStepReferenceV2 extends GroupBankReferenceV2 { readonly body: AnimalSim }
export interface GroupStepOperationV2 {
  readonly id: number;
  readonly values: readonly number[];
  readonly member?: V2ActorColumnSlot;
  readonly reference?: GroupStepReferenceV2;
}
function sameRng(a: RngState, b: RngState): boolean {
  return a.version === b.version && a.state === b.state && a.initial === b.initial && a.scrambledFork === b.scrambledFork;
}
export class GroupStepV2 {
  private readonly rows;
  readonly layout;
  private readonly profiles;
  private readonly module: ScriptModuleV2;
  private busy = false;
  private revision = 0;
  private readonly scope: Scope;
  constructor(bytes: Uint8Array, input: unknown, scope: Scope, shared?: { readonly module: ScriptModuleV2; readonly layout: V2Layout }) {
    this.scope = scope;
    this.live();
    this.rows = structuredClone(parseGroupStepV2(input));
    const minimum=groupStepLayoutV2(this.rows);
    this.layout=shared===undefined?minimum:layoutV2(0,this.rows.pages,new Map(shared.layout.regions.map(row=>[row.kind,row.capacity])));
    if(shared!==undefined&&(this.layout.bytes!==shared.layout.bytes||this.layout.io!==shared.layout.io||this.layout.pages!==shared.layout.pages
      ||minimum.regions.some(row=>(this.layout.regions[row.kind-1]?.capacity??-1)<row.capacity)
      ||!shared.module.owns(bytes,this.layout.io,this.layout.bytes)))throw new Error('Foreign shared group executable');
    this.profiles = [this.rows, ...(this.rows.profiles ?? [])].map((rows, index) => ({
      id: index === 0 ? 'main' : this.rows.profiles?.[index - 1]?.id,
      rows, bank: new GroupBankV2(rows.bank), columns: new ObservationColumnsV2(rows.columns, scope),
    }));
    const source = Uint8Array.from(bytes), admitted = admitScriptV2(source, { lane: 'project', ioBytes: this.layout.bytes });
    if (admitted.io !== 0 || admitted.initialPages !== this.rows.pages) throw new Error('Group step module layout mismatch');
    this.module = shared?.module ?? new ScriptModuleV2(source, { seed: [0, 0], initFuel: this.rows.fuel, ioBytes: this.layout.bytes, output: [] });
    this.live();
  }
  private live(): void {
    if (this.scope.disposed || this.scope.disposing) throw new Error('Group step owner disposed');
  }
  /** Capture once, execute once, then validate ALL state/actions/queries/RNG.
   * The original native owner preflights its concrete operation loans before
   * validate/accept and drains the returned ordered operations at that slot.
   * A synchronous native barrier requires another segment at the SAME slot;
   * this transport never invents a delayed mount/adopt/bond transaction. */
  prepare(input: {
    readonly group: string; readonly handle: number; readonly signal: string; readonly tick: number; readonly profile?: string;
    readonly state: Float64Array; readonly members: readonly V2ColumnOwners[];
    readonly references: readonly GroupStepReferenceV2[]; readonly random?: Rng;
    readonly queries?: { readonly ring: QueryRingV2; readonly binding: V2QueryBinding };
  }): { readonly operations: readonly GroupStepOperationV2[]; readonly validate: () => void; readonly accept: () => void } {
    this.live();
    if (this.busy) throw new Error('Reentrant group step');
    this.busy = true;
    try {
      const revision = this.revision, stateOwner = input.state;
      const envelope = { group: input.group, handle: input.handle, signal: input.signal, tick: input.tick, profile: input.profile };
      const profileIndex = this.profiles.findIndex(row => row.id === (input.profile ?? 'main'));
      const profile = this.profiles[profileIndex];
      if (profile === undefined) throw new Error('Unknown group step profile');
      const signal = profile.rows.signals.indexOf(input.signal) + 1;
      if (signal === 0 || input.group.length === 0 || input.members.length > profile.rows.members
        || !Number.isInteger(input.handle) || input.handle < 1 || input.handle > 0x7fffffff) throw new Error('Invalid group step input');
      const originalState = input.state.slice();
      profile.bank.decode(originalState, input.group, input.references);
      const refs = input.references.map(row => {
        if (row.body.entityId !== row.identity) throw new Error('Foreign group reference body');
        return Object.freeze({ ...row });
      });
      for (const row of refs) if (row.group === input.group && input.members[row.slot]?.self.actor !== row.body)
        throw new Error('Foreign group member reference');
      const identities = input.members.filter(owners => owners.self.actor !== null).map(owners => owners.self.identity);
      if (new Set(identities).size !== identities.length) throw new Error('Duplicate group body loan');
      const members = input.members.map((owners, slot) => {
        if (owners.scope !== this.scope || owners.self.group !== input.group || owners.self.slot !== slot) throw new Error('Foreign group member loan');
        return { source: owners, self: Object.freeze({ ...owners.self }), values: profile.columns.capture(owners) };
      });
      const fields = members.flatMap((member, slot) => [...member.values].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map((row, column) => ({
        name: `${String(slot).padStart(2, '0')}/${row.name}`, id: slot * profile.rows.columns.length + column + 1, value: row.value,
      })));
      if (originalState.some((value, index) => !Object.is(value, input.state[index]))
        || input.references.length !== refs.length || refs.some((row, index) => {
          const current = input.references[index];
          return current?.body !== row.body || current.group !== row.group || current.slot !== row.slot
            || current.identity !== row.identity || current.wire !== row.wire || current.handle !== row.handle;
        })) throw new Error('Group state or reference changed during capture');
      const random = input.random, before = random?.snapshot();
      const restore: unknown = random === undefined ? undefined : Reflect.get(random, 'restore');
      const snapshot: unknown = random === undefined ? undefined : Reflect.get(random, 'snapshot');
      const nextRandom: unknown = random === undefined ? undefined : Reflect.get(random, 'next');
      const rng = prepareV2Rng(this.layout, before === undefined ? [] : [{ binding: input.handle, stream: 1, algorithm: 1,
        state: [before.state, before.initial, Number(before.scrambledFork), 0, 0, 0] }]);
      const binding = input.queries?.binding;
      if (binding !== undefined && (binding.identity !== input.group || binding.handle !== input.handle
        || binding.observed.size !== refs.length || refs.some(row => binding.observed.get(row.handle) !== row.identity))) throw new Error('Foreign group query loan');
      const queryLoan = input.queries;
      const queryObserved = binding === undefined ? [] : [...binding.observed];
      const queryOperations = binding === undefined ? [] : [...binding.operations];
      const delivery = input.queries?.ring.delivery(input.tick, new Map([[input.group, binding ?? { identity: input.group,
        handle: input.handle, observed: new Map(), operations: new Set() }]]), new Set([input.group]));
      const observations = prepareV2Observations(this.layout, input.tick, { bindings: [{
        identity: input.group, handle: input.handle, self: 0, player: 0, observed: new Set(), enabled: true, due: true,
        divisor: 6, fuel: this.rows.fuel, previousTick: input.tick, currentTick: input.tick, state: Array.from(originalState),
        parameters: [{ name: 'a.signal', value: signal }, { name: 'b.members', value: members.length },
          ...(this.rows.profiles === undefined ? [] : [{ name: 'c.profile', value: profileIndex }])], fields,
        sample: { atTick: input.tick, target: 0 },
      }], players: [], edges: [], events: [], actions: new Set(), eventKinds: new Set() });
      const counts = new Map(observations.counts), extra = delivery?.banks ?? [];
      for (const bank of extra) counts.set(bank.kind, bank.count);
      counts.set(21, rng.count);
      let authority: V2FrameAuthority | undefined;
      const candidate = this.module.project(this.rows.fuel, view => {
        authority = writeV2Frame(view, this.layout, { lane: 2, module: 1, sequence: 0, tick: input.tick, due: 1 }, counts);
        observations.write(view);
        for (const bank of [...extra, { kind: 21, count: rng.count, bytes: rng.bytes }]) {
          const region = this.layout.regions[bank.kind - 1];
          if (region === undefined || bank.bytes.length !== bank.count * region.stride || bank.count > region.capacity) throw new Error('Group input bank capacity');
          new Uint8Array(view.buffer, this.layout.io + region.offset, bank.bytes.length).set(bank.bytes);
        }
      }, view => {
        if (authority === undefined) throw new Error('Missing group frame authority');
        const actual = validateV2Frame(view, this.layout, authority), state = this.layout.regions[2], actions = this.layout.regions[9];
        if (state === undefined || actions === undefined || actual[2] !== profile.bank.width || (actual[9] ?? 0) > this.rows.outputs) throw new Error('Incomplete group candidate');
        const bank = Float64Array.from({ length: profile.bank.width }, (_, index) => view.getFloat64(this.layout.io + state.offset + index * 8, true));
        const prepared = profile.bank.prepare(input.state, bank, input.group, input.references, this.scope);
        const operations: GroupStepOperationV2[] = [];
        for (let index = 0; index < (actual[9] ?? 0); index++) {
          const at = this.layout.io + actions.offset + index * 64, id = view.getUint32(at + 8, true);
          const action = profile.rows.actions.find(row => row.id === id);
          if (action === undefined || view.getUint32(at, true) !== input.handle || view.getUint32(at + 4, true) !== 25
            || view.getUint32(at + 12, true) !== 0) throw new Error('Undeclared group operation');
          const values = Array.from({ length: 6 }, (_, word) => view.getFloat64(at + 16 + word * 8, true));
          if (values.some((value, word) => !Number.isFinite(value) || word >= action.words && !Object.is(value, 0))) throw new Error('Invalid group operation operands');
          const slot = action.member === undefined ? undefined : values[action.member];
          const member = slot === undefined ? undefined : members[slot]?.self;
          const body = member?.actor;
          if (slot !== undefined && (!Number.isInteger(slot) || slot < 0 || body === undefined || body === null)) throw new Error('Unknown group operation member');
          const handle = action.reference === undefined ? undefined : values[action.reference.word];
          const reference = handle === undefined || handle === 0 ? undefined : refs.find(row => row.handle === handle);
          if (action.reference !== undefined && (handle === undefined || !Number.isInteger(handle)
            || (handle === 0 ? action.reference.nullable !== true : reference === undefined)
            || reference !== undefined && action.reference.own === true && reference.group !== input.group)) throw new Error('Unknown group operation reference');
          operations.push(Object.freeze({ id, values: Object.freeze(values.slice(0, action.words)),
            ...(member === undefined ? {} : { member }), ...(reference === undefined ? {} : { reference }) }));
        }
        const queries = actual[10] ?? 0;
        if (queries !== 0 && input.queries === undefined) throw new Error('Missing group query authority');
        const query = input.queries?.ring.prepareFrame(view, queries, input.tick, new Map(binding === undefined ? [] : [[input.handle, binding]]), delivery?.consumed ?? []);
        const next = rng.readCandidate(view, actual[21] ?? 0, new Set([input.handle]))[0];
        return { prepared, operations: Object.freeze(operations), query, next };
      }).value;
      let accepted = false;
      const validate = (): void => {
        this.live();
        if (accepted || revision !== this.revision) throw new Error('Group step already accepted or superseded');
        if (input.group !== envelope.group || input.handle !== envelope.handle || input.signal !== envelope.signal
          || input.tick !== envelope.tick || input.profile !== envelope.profile || input.state !== stateOwner || input.random !== random || input.queries !== queryLoan
          || binding !== undefined && (binding.observed.size !== queryObserved.length || binding.operations.size !== queryOperations.length
            || queryObserved.some(([key, value]) => binding.observed.get(key) !== value) || queryOperations.some(op => !binding.operations.has(op))))
          throw new Error('Changed group continuation owner');
        candidate.prepared.validate(); candidate.query?.validate();
        if (input.members.length !== members.length || members.some((member, slot) => {
          const owners = input.members[slot];
          return owners !== member.source || owners.scope !== this.scope || owners.self.actor !== member.self.actor
            || owners.self.group !== member.self.group || owners.self.slot !== member.self.slot || owners.self.identity !== member.self.identity
            || member.self.actor !== null && member.self.actor.entityId !== member.self.identity;
        }) || input.references.length !== refs.length || refs.some((row, index) => input.references[index]?.body !== row.body || row.body.entityId !== row.identity)) throw new Error('Changed group body loan');
        if (random !== undefined && (Reflect.get(random, 'restore') !== restore || Reflect.get(random, 'snapshot') !== snapshot || Reflect.get(random, 'next') !== nextRandom || before === undefined
          || !sameRng(before, random.snapshot()) || candidate.next === undefined)) throw new Error('Changed group RNG owner');
      };
      return { operations: candidate.operations, validate, accept: () => {
        validate(); candidate.query?.(); candidate.prepared.accept();
        if (random !== undefined && before !== undefined && candidate.next !== undefined) random.restore({ ...before, state: candidate.next.state[0] });
        accepted = true; this.revision++;
      } };
    } finally { this.busy = false; }
  }
}
