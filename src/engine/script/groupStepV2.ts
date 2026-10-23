/** One reusable AS group executable over the original group's borrowed bank.
 * Calls happen at the original native slot. There is no tick loop, body/RNG/save
 * owner, action dispatcher or per-group module instance in this transport. */
import { parseGroupStepV2, groupStepLayoutV2, type GroupStepNativeV2 } from '@wildshard/format/scriptGroupStepV2';
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
import type { AggressionDirector, AggressionService } from '../ai/director';
import type { Events } from '../events/events';
import type { CirclingPackPrey } from '../ai/stalker';

export type GroupStepReferenceV2 = GroupBankReferenceV2 & (
  | { readonly body: AnimalSim; readonly pose?: never }
  | { readonly body: CirclingPackPrey; readonly pose: true }
);
function validReference(row: GroupStepReferenceV2): boolean {
  return row.pose === true ? typeof row.body.alive === 'boolean' : row.body.entityId === row.identity;
}
function sameReference(current: GroupStepReferenceV2 | undefined, before: GroupStepReferenceV2): boolean {
  return current !== undefined && current.body === before.body && current.pose === before.pose
    && current.group === before.group && current.slot === before.slot && current.identity === before.identity
    && current.wire === before.wire && current.handle === before.handle && validReference(current);
}
export interface GroupStepOperationV2 {
  readonly id: number;
  readonly values: readonly number[];
  readonly member?: V2ActorColumnSlot;
  readonly reference?: GroupStepReferenceV2;
  readonly native?: Readonly<GroupStepNativeV2>;
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
    readonly references: readonly GroupStepReferenceV2[]; readonly random?: Rng; readonly contextRandom?: Rng;
    readonly queries?: { readonly ring: QueryRingV2; readonly binding: V2QueryBinding };
  }): {
    readonly operations: readonly GroupStepOperationV2[];
    readonly validate: () => void;
    readonly accept: () => void;
    readonly prepareNative: (owners: GroupStepNativeOwnersV2) => {
      readonly validate: () => void;
      readonly accept: () => readonly GroupStepNativeResultV2[];
    };
  } {
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
        if (!validReference(row)) throw new Error('Foreign group reference body');
        return Object.freeze({ ...row });
      });
      for (const row of refs) if (row.group === input.group && (row.pose === true || input.members[row.slot]?.self.actor !== row.body))
        throw new Error('Foreign group member reference');
      const identities = input.members.filter(owners => owners.self.actor !== null).map(owners => owners.self.identity);
      if (new Set(identities).size !== identities.length) throw new Error('Duplicate group body loan');
      const members = input.members.map((owners, slot) => {
        if (owners.scope !== this.scope || owners.self.group !== input.group || owners.self.slot !== slot) throw new Error('Foreign group member loan');
        const referenceOwner = owners.references, references = referenceOwner === undefined ? [] : [...referenceOwner].map(([name, loan]) => {
          if (loan !== null && !refs.some(row => row.body === loan.body && row.identity === loan.identity && row.handle === loan.handle))
            throw new Error('Foreign observed group reference');
          return { name, loan, body: loan?.body, identity: loan?.identity, handle: loan?.handle };
        });
        return { source: owners, self: Object.freeze({ ...owners.self }), referenceOwner, references, values: profile.columns.capture(owners) };
      });
      const fields = members.flatMap((member, slot) => [...member.values].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map((row, column) => ({
        name: `${String(slot).padStart(2, '0')}/${row.name}`, id: slot * profile.rows.columns.length + column + 1, value: row.value,
      })));
      if (originalState.some((value, index) => !Object.is(value, input.state[index]))
        || input.references.length !== refs.length || refs.some((row, index) => !sameReference(input.references[index], row))) throw new Error('Group state or reference changed during capture');
      const random = input.random, contextRandom = input.contextRandom;
      if (contextRandom !== undefined && (this.rows.randomStreams !== 2 || random === undefined || contextRandom === random))
        throw new Error('Undeclared or aliased group RNG streams');
      const randoms = [random, contextRandom].flatMap((owner, index) => owner === undefined ? [] : [{
        owner, stream: index + 1, before: owner.snapshot(), restore: Reflect.get(owner, 'restore'),
        snapshot: Reflect.get(owner, 'snapshot'), next: Reflect.get(owner, 'next'),
      }]);
      const rng = prepareV2Rng(this.layout, randoms.map(loan => ({ binding: input.handle, stream: loan.stream, algorithm: 1,
        state: [loan.before.state, loan.before.initial, Number(loan.before.scrambledFork), 0, 0, 0] })));
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
            ...(member === undefined ? {} : { member }), ...(reference === undefined ? {} : { reference }),
            ...(action.native === undefined ? {} : { native: freezeNative(action.native) }) }));
        }
        const queries = actual[10] ?? 0;
        if (queries !== 0 && input.queries === undefined) throw new Error('Missing group query authority');
        const query = input.queries?.ring.prepareFrame(view, queries, input.tick, new Map(binding === undefined ? [] : [[input.handle, binding]]), delivery?.consumed ?? []);
        const next = rng.readCandidate(view, actual[21] ?? 0, new Set([input.handle]));
        return { prepared, operations: Object.freeze(operations), query, next };
      }).value;
      let accepted = false;
      const validate = (): void => {
        this.live();
        if (accepted || revision !== this.revision) throw new Error('Group step already accepted or superseded');
        if (input.group !== envelope.group || input.handle !== envelope.handle || input.signal !== envelope.signal
          || input.tick !== envelope.tick || input.profile !== envelope.profile || input.state !== stateOwner || input.random !== random || input.contextRandom !== contextRandom || input.queries !== queryLoan
          || binding !== undefined && (binding.observed.size !== queryObserved.length || binding.operations.size !== queryOperations.length
            || queryObserved.some(([key, value]) => binding.observed.get(key) !== value) || queryOperations.some(op => !binding.operations.has(op))))
          throw new Error('Changed group continuation owner');
        candidate.prepared.validate(); candidate.query?.validate();
        if (input.members.length !== members.length || members.some((member, slot) => {
          const owners = input.members[slot];
          return owners !== member.source || owners.scope !== this.scope || owners.self.actor !== member.self.actor
            || owners.self.group !== member.self.group || owners.self.slot !== member.self.slot || owners.self.identity !== member.self.identity
            || member.self.actor !== null && member.self.actor.entityId !== member.self.identity
            || owners.references !== member.referenceOwner || (owners.references?.size ?? 0) !== member.references.length
            || member.references.some(reference => {
              const current = owners.references?.get(reference.name);
              return current !== reference.loan || current?.body !== reference.body || current?.identity !== reference.identity || current?.handle !== reference.handle;
            });
        }) || input.references.length !== refs.length || refs.some((row, index) => !sameReference(input.references[index], row))) throw new Error('Changed group body loan');
        if (randoms.some(loan => Reflect.get(loan.owner, 'restore') !== loan.restore || Reflect.get(loan.owner, 'snapshot') !== loan.snapshot
          || Reflect.get(loan.owner, 'next') !== loan.next || !sameRng(loan.before, loan.owner.snapshot())
          || !candidate.next.some(row => row.stream === loan.stream))) throw new Error('Changed group RNG owner');
      };
      const accept = (): void => {
        validate(); candidate.query?.(); candidate.prepared.accept();
        for (const loan of randoms) {
          const next = candidate.next.find(row => row.stream === loan.stream);
          if (next === undefined) throw new Error('Missing group RNG candidate');
          loan.owner.restore({ ...loan.before, state: next.state[0] });
        }
        accepted = true; this.revision++;
      };
      return { operations: candidate.operations, validate, accept, prepareNative: owners => {
        if (owners.scope !== this.scope || owners.members !== input.members
          || owners.references !== undefined && owners.references !== input.references) throw new Error('Foreign native group result scope');
        const native = prepareGroupNativeV2(candidate.operations, owners);
        const validateNative = (): void => { validate();native.validate(); };
        return { validate: validateNative, accept: () => {
          validateNative();accept();return native.run();
        } };
      } };
    } finally { this.busy = false; }
  }
}

function freezeNative(input: GroupStepNativeV2): Readonly<GroupStepNativeV2> {
  const row = structuredClone(input);
  if (row.kind === 'hearing') Object.freeze(row.radii);
  return Object.freeze(row);
}

/** Concrete original authorities for same-call result barriers. No native
 * operation is selected by a callback, object path or content identifier. */
export interface GroupStepNativeOwnersV2 {
  readonly scope: Scope;
  readonly members: readonly V2ColumnOwners[];
  readonly references?: readonly GroupStepReferenceV2[];
  readonly rosters?: ReadonlyMap<string, readonly GroupStepReferenceV2[]>;
  readonly ground?: { readonly normalY: (x: number, z: number) => number };
  readonly grass?: { readonly grassHeightAt: (x: number, z: number) => number };
  readonly aggression?: {
    readonly kind: 'events';
    readonly service: AggressionService;
    readonly events: Events;
    readonly director: AggressionDirector<AnimalSim>;
  } | {
    readonly kind: 'tokens';
    readonly owners: WeakMap<AnimalSim, AggressionDirector<AnimalSim>>;
    readonly director: AggressionDirector<AnimalSim>;
  };
}
export interface GroupStepNativeResultV2 {
  readonly channel: string;
  readonly value: number;
  readonly member?: V2ActorColumnSlot;
}

/** Prepare a result-only segment without sampling or changing any native
 * owner. The original group accepts its candidate before run(), then feeds
 * these transient results into source:result columns and resumes at the SAME
 * call slot. A different operation in the bank refuses before any prefix. */
export function prepareGroupNativeV2(operations: readonly GroupStepOperationV2[], owners: GroupStepNativeOwnersV2): {
  readonly validate: () => void;
  readonly run: () => readonly GroupStepNativeResultV2[];
} {
  const scope = owners.scope, sources = owners.members.slice();
  const pins: (() => boolean)[] = [];
  const live = (): void => {
    if (owners.scope !== scope || scope.disposed || scope.disposing
      || owners.members.length !== sources.length || sources.some((row, index) => owners.members[index] !== row)
      || pins.some(pin => !pin())) throw new Error('Retired or replaced native group result owner');
  };
  live();
  if (operations.length > 512 || sources.length > 16) throw new Error('Native group result capacity');
  let used = false;
  const channels = new Set<string>();
  const prepared = operations.map(operation => {
    const request = operation.native;
    if (request === undefined || request.channel.length === 0 || request.channel.length > 128
      || operation.reference !== undefined || operation.values.some(value => !Number.isFinite(value)))
      throw new Error('Missing or invalid native group result declaration');
    const point = request.kind === 'grass' || request.kind === 'normal' || request.kind === 'nearest';
    if (operation.values.length !== (request.kind === 'nearest' ? 3 : point ? 2 : 1)) throw new Error('Native group result arity');
    const member = operation.member;
    const channel = JSON.stringify([member?.slot ?? null, request.channel]);
    if (channels.has(channel)) throw new Error('Duplicate native group result channel');
    channels.add(channel);
    const source = member === undefined ? undefined : sources[member.slot];
    if (point ? member !== undefined : member === undefined || source === undefined
      || !Number.isInteger(member.slot) || member.slot < 0 || operation.values[0] !== member.slot
      || source.scope !== scope || source.self.actor !== member.actor || member.actor === null
      || source.self.identity !== member.identity || source.self.group !== member.group
      || source.self.slot !== member.slot || member.actor.entityId !== member.identity)
      throw new Error('Foreign native group result member');
    if (member !== undefined && source !== undefined) {
      const body = member.actor;
      pins.push(() => source.scope === scope && source.self.actor === body && source.self.group === member.group
        && source.self.slot === member.slot && source.self.identity === member.identity
        && body !== null && body.entityId === member.identity);
    }
    let invoke: () => number;
    switch (request.kind) {
      case 'grass': {
        const owner = owners.grass, x = operation.values[0], z = operation.values[1];
        if (owner === undefined || typeof owner.grassHeightAt !== 'function' || x === undefined || z === undefined)
          throw new Error('Missing native grass owner');
        const sample = owner.grassHeightAt;
        pins.push(() => owners.grass === owner && owner.grassHeightAt === sample);
        invoke = () => sample.call(owner, x, z);
        break;
      }
      case 'normal': {
        const owner = owners.ground, x = operation.values[0], z = operation.values[1];
        if (owner === undefined || typeof owner.normalY !== 'function' || x === undefined || z === undefined)
          throw new Error('Missing native ground owner');
        const sample = owner.normalY;
        pins.push(() => owners.ground === owner && owner.normalY === sample);
        invoke = () => {
          const result = sample.call(owner, x, z);
          if (result < -1 || result > 1) throw new Error('Invalid native ground normal');
          return result;
        };
        break;
      }
      case 'nearest': {
        const owner = owners.rosters, roster = owner?.get(request.roster), references = owners.references;
        const x = operation.values[0], z = operation.values[1], radius = operation.values[2];
        if (owner === undefined || roster === undefined || references === undefined || owner.size > 64
          || roster.length > 1024 || references.length > 1024 || x === undefined || z === undefined || radius === undefined || radius < 0)
          throw new Error('Missing or invalid native nearest roster');
        const borrowed = roster.map(row => {
          if (!references.some(reference => sameReference(reference,row))) throw new Error('Foreign native nearest reference');
          return Object.freeze({...row});
        });
        if (new Set(borrowed.map(row => row.handle)).size !== borrowed.length) throw new Error('Duplicate native nearest reference');
        const valid = (): boolean => owners.rosters === owner && owner.get(request.roster) === roster
          && owners.references === references && roster.length === borrowed.length
          && borrowed.every((row,index) => sameReference(roster[index],row) && references.some(reference => sameReference(reference,row))
            && [row.body.position.x,row.body.position.z].every(Number.isFinite));
        if (!valid()) throw new Error('Invalid native nearest position');
        pins.push(valid);
        invoke = () => {
          let selected = 0, distance = radius;
          for (const row of borrowed) if (row.body.alive) {
            const next = Math.hypot(row.body.position.x-x,row.body.position.z-z);
            if (next < distance) { distance = next;selected = row.handle; }
          }
          return selected;
        };
        break;
      }
      case 'visibility': case 'hearing': case 'downwind': {
        const owner = source?.senses, context = source?.context, body = member?.actor;
        if (source === undefined || owner === undefined || context === undefined || body === undefined || body === null
          || owner.player !== source.player.position || !Number.isFinite(context.playerSpeed) || !Number.isFinite(source.t))
          throw new Error('Missing native group sense owner');
        const player = owner.player, speed = context.playerSpeed, time = source.t;
        const finitePose = (): boolean => [body.position.x, body.position.z, player.x, player.y, player.z].every(Number.isFinite);
        if (!finitePose()) throw new Error('Invalid native sense position');
        pins.push(finitePose);
        pins.push(() => source.senses === owner && source.context === context && source.player.position === player
          && owner.player === player && Object.is(context.playerSpeed, speed) && Object.is(source.t, time));
        if (request.kind === 'visibility') {
          const sample = owner.visibility;
          if (typeof sample !== 'function') throw new Error('Missing native visibility owner');
          pins.push(() => owner.visibility === sample);
          invoke = () => sample.call(owner, body.position.x, body.position.z, player, speed, time);
        } else if (request.kind === 'downwind') {
          const sample = owner.downwind;
          if (typeof sample !== 'function') throw new Error('Missing native downwind owner');
          pins.push(() => owner.downwind === sample);
          invoke = () => {
            const result = sample.call(owner, body.position.x, body.position.z, player);
            if (typeof result !== 'boolean') throw new Error('Invalid native downwind result');
            return Number(result);
          };
        } else {
          const sample = owner.hearing, radii = request.radii;
          if (typeof sample !== 'function' || radii.some(value => !Number.isFinite(value) || value < 0))
            throw new Error('Invalid native hearing owner or radii');
          const copied = structuredClone(radii);
          pins.push(() => owner.hearing === sample && radii.every((value, index) => Object.is(value, copied[index])));
          invoke = () => sample.call(owner, copied, player, speed);
        }
        break;
      }
      case 'claim': {
        const loan = owners.aggression, body = member?.actor;
        if (loan === undefined || body === undefined || body === null) throw new Error('Missing native aggression owner');
        const director = loan.director, take: unknown = Reflect.get(director, 'take');
        if (typeof take !== 'function') throw new Error('Invalid native aggression director');
        pins.push(() => owners.aggression === loan && loan.director === director && director.take === take);
        if (loan.kind === 'events') {
          const { service, events } = loan, register: unknown = Reflect.get(service, 'register'), ask: unknown = Reflect.get(events, 'ask');
          if (typeof register !== 'function' || typeof ask !== 'function') throw new Error('Invalid native aggression owner');
          pins.push(() => loan.service === service && loan.events === events && service.register === register && events.ask === ask);
          invoke = () => {
            service.register(body, director);
            const result = events.ask('ai.claim', body);
            if (typeof result !== 'boolean') throw new Error('Invalid native aggression result');
            return Number(result);
          };
        } else {
          const tokens = loan.owners, get: unknown = Reflect.get(tokens, 'get'), set: unknown = Reflect.get(tokens, 'set');
          if (typeof get !== 'function' || typeof set !== 'function') throw new Error('Invalid native token owner');
          pins.push(() => loan.owners === tokens && tokens.get === get && tokens.set === set);
          invoke = () => {
            tokens.set(body, director);
            const result = tokens.get(body)?.take(body) ?? true;
            if (typeof result !== 'boolean') throw new Error('Invalid native token result');
            return Number(result);
          };
        }
        break;
      }
      default: throw new Error('Unknown native group result operation');
    }
    return { channel: request.channel, member, invoke };
  });
  const validate = (): void => {
    live();
    if (used) throw new Error('Native group result segment already consumed');
  };
  validate();
  return { validate, run: () => {
    validate();used = true;
    const result = prepared.map(operation => {
      live();
      const value = operation.invoke();
      if (!Number.isFinite(value)) throw new Error('Non-finite native group result');
      return Object.freeze({ channel: operation.channel, value, ...(operation.member === undefined ? {} : { member: operation.member }) });
    });
    live();return Object.freeze(result);
  } };
}
