/** ABI2 execution over an existing DecisionHost. The native owner retains its
 * state, RNG, staged commands and timers; this object owns only the saved input
 * inbox and the disposable Wasm transport. It installs no clock or body owner. */
import type { ScriptV1Event,ScriptV1Command } from '@wildshard/format/scriptAbiV1';
import type { ScriptInputStateV2 } from '@wildshard/format/scriptInputStateV2';
import { prepareV2Rng } from '@wildshard/format/scriptRngV2';
import type { V2Layout } from '@wildshard/format/scriptWireV2';
import type { DecisionHost,DecisionBinding,DecisionScript,DecisionSnapshot } from './decision';
import { InputInboxV2,type V2InputBinding } from './inputInboxV2';
import { SimBatchV2,type V2BatchResult } from './simBatchV2';
import type { V2BindingInput,V2PlayerInput } from './observationsV2';

export interface OwnedV2Binding { readonly binding: DecisionBinding; readonly script: DecisionScript }
export interface OwnedV2Sample {
  readonly id: number; readonly observed: ReadonlyMap<number,string>;
  readonly fields: V2BindingInput['fields']; readonly sample: V2BindingInput['sample'];
}
export interface OwnedV2Frame { readonly bindings: readonly OwnedV2Sample[]; readonly players: readonly V2PlayerInput[] }
export interface OwnedV2Input { readonly input: ScriptInputStateV2; readonly failures: number }
function withoutEvents(native: DecisionSnapshot): DecisionSnapshot {
  const bindings: DecisionSnapshot['bindings'][number][] = [];
  for (const row of native.bindings) bindings.push({ ...row,pending: [] });
  return { ...native,bindings };
}
function required<T>(value: T | undefined): T { if (value === undefined) throw new Error('Missing native v2 binding');return value; }
export class OwnedSimBatchV2 {
  private readonly inbox: InputInboxV2;
  private readonly batch: SimBatchV2;
  private readonly rows: readonly OwnedV2Binding[];
  private readonly layout: V2Layout;
  private readonly host: DecisionHost;
  private readonly seed: readonly [number,number];
  private readonly divisor: 2 | 6;
  private readonly fuel: number;
  private readonly kinds: ReadonlySet<number>;
  constructor(bytes: Uint8Array,options: {
    readonly host: DecisionHost; readonly bindings: readonly OwnedV2Binding[]; readonly layout: V2Layout;
    readonly divisor: 2 | 6; readonly fuel: number; readonly initFuel: number;
    readonly seed: readonly [number,number]; readonly eventKinds: ReadonlySet<number>;
  }) {
    this.host = options.host;this.rows = [...options.bindings].sort((a,b) => String(a.binding.id) < String(b.binding.id) ? -1 : String(a.binding.id) > String(b.binding.id) ? 1 : 0);
    this.layout = options.layout;this.divisor = options.divisor;this.seed = options.seed;this.fuel = options.fuel;this.kinds = new Set(options.eventKinds);
    this.inbox = new InputInboxV2(options.layout,{ bindings: new Set(this.rows.map(row => String(row.binding.id))),players: new Set(),actions: new Map(),eventKinds: this.kinds,lagTicks: 0 });
    this.batch = new SimBatchV2(bytes,{ layout: options.layout,ordinal: 0,handle: 1,divisor: options.divisor,
      bindings: this.rows.map(row => ({ identity: String(row.binding.id),handle: row.binding.id })),fuel: options.fuel,initFuel: options.initFuel,seed: options.seed,output: [] });
    this.batch.resumeAt(this.host.snapshot().tick,0);
  }
  clearInput(restart = false): void {
    this.inbox.restore({ version: 1,sequence: 0,receiptTick: -1,deliveryTick: -1,edges: [],events: [] });
    this.batch.resumeAt(this.host.snapshot().tick,restart ? 0 : this.batch.failures);
  }
  get failure(): Error | null { return this.batch.disabled ? this.batch.lastRefusal : null; }
  snapshot(): OwnedV2Input { return { input: this.inbox.snapshot(),failures: this.batch.failures }; }
  /** Event subjects are resolved at their original receipt, not at a later
   * frame. Payloads in this actor protocol are scalar recipe/move/signal values. */
  enqueue(tick: number,binding: number,event: ScriptV1Event,observed: ReadonlyMap<number,string>): void {
    if (this.batch.disabled) return;
    const subject = event[1] === 0 ? null : required(observed.get(event[1]));
    this.inbox.event(tick,{ binding: String(binding),kind: event[0],subject,player: null,values: [event[2],event[3],event[4],event[5]] });
  }
  /** Old six-scalar events have no timestamp. The original saved tick is their
   * explicit migration fallback. Validate on a detached inbox before publishing. */
  validateRestore(native: DecisionSnapshot,saved: OwnedV2Input | undefined,observed: ReadonlyMap<number,string>): OwnedV2Input {
    const next = new InputInboxV2(this.layout,{ bindings: new Set(this.rows.map(row => String(row.binding.id))),players: new Set(),actions: new Map(),eventKinds: this.kinds,lagTicks: 0 });
    if (saved !== undefined) {
      next.restore(saved.input);
      const identities = new Set(observed.values());
      if (saved.input.events.some(row => row.subject !== null && !identities.has(row.subject))) throw new Error('Stale restored v2 actor subject');
      if (saved.input.receiptTick > native.tick || saved.input.deliveryTick > native.tick || native.bindings.some(row => row.pending.length > 0)) throw new Error('Mixed v2/native input continuation');
    } else {
      for (const row of native.bindings) for (const event of row.pending) next.event(native.tick,{ binding: String(row.id),kind: event[0],subject: event[1] === 0 ? null : required(observed.get(event[1])),player: null,values: [event[2],event[3],event[4],event[5]] });
    }
    for (const staged of native.staged) {
      const owner = required(this.rows.find(row => row.binding.id === staged.binding));
      if (staged.observed.some(handle => !owner.binding.actors.includes(handle) && !observed.has(handle)) || staged.commands.some(row => [1,2,3,4,6].includes(row[0]) && !owner.binding.actors.includes(row[1]))) throw new Error('Foreign restored v2 command owner');
    }
    const failures = saved?.failures ?? 0;
    if (failures === 3 && native.bindings.some(row => row.enabled !== false)) throw new Error('Unfrozen disabled v2 continuation');
    if (!Number.isInteger(failures) || failures < 0 || failures > 3) throw new Error('Invalid native v2 quarantine');
    return { input: next.snapshot(),failures };
  }
  prepareRestore(native: DecisionSnapshot,saved: OwnedV2Input | undefined,observed: ReadonlyMap<number,string>): () => void {
    const next = this.validateRestore(native,saved,observed);
    const publish = this.host.prepareRestore(withoutEvents(native));
    return () => { publish.validate();publish();this.inbox.restore(next.input);this.batch.resumeAt(native.tick,next.failures); };
  }
  /** Called immediately after native stepExternal. Timers and scheduled tick
   * events retain that native tick; failed guest calls never consume them. */
  advance(tick: number,frame: (due: ReadonlySet<number>) => OwnedV2Frame,observed: ReadonlyMap<number,string>): V2BatchResult {
    if (this.host.externalTick !== tick) throw new Error('V2 owner tick mismatch');
    if (this.batch.disabled || (!this.host.pendingExternal && tick%this.divisor !== 0)) return this.batch.advance(tick,() => { throw new Error('Idle capture'); },() => { throw new Error('Idle publication'); });
    const native = this.host.snapshot();
    if (native.tick !== tick) throw new Error('V2 owner tick mismatch');
    if (native.bindings.some(row => row.pending.length > 0)) {
      const next = this.snapshot(), clone = new InputInboxV2(this.layout,{ bindings: new Set(this.rows.map(row => String(row.binding.id))),players: new Set(),actions: new Map(),eventKinds: this.kinds,lagTicks: 0 });
      clone.restore(next.input);
      for (const row of native.bindings) for (const event of row.pending) clone.event(tick,{ binding: String(row.id),kind: event[0],subject: event[1] === 0 ? null : required(observed.get(event[1])),player: null,values: [event[2],event[3],event[4],event[5]] });
      const publish = this.host.prepareRestore(withoutEvents(native));publish();this.inbox.restore(clone.snapshot());
    }
    const before = this.host.snapshot();
    let prepared: { readonly bindings: readonly V2BindingInput[]; readonly inputBindings: ReadonlyMap<string,V2InputBinding>; readonly rng: ReturnType<typeof prepareV2Rng> } | undefined;
    const result = this.batch.advance(tick,() => {
      const pending = this.inbox.snapshot().events;
      const active = new Set(before.bindings.filter(row => !row.disabled && row.enabled !== false && pending.some(event => event.binding === String(row.id))).map(row => row.id));
      const captured = frame(active), samples = new Map(captured.bindings.map(row => [row.id,row]));
      if (samples.size !== this.rows.length || captured.bindings.length !== this.rows.length) throw new Error('Changed native v2 samples');
      const bindings = this.rows.map(({ binding,script }): V2BindingInput => {
        const saved = required(before.bindings.find(row => row.id === binding.id)), sample = required(samples.get(binding.id));
        const enabled = !saved.disabled && saved.enabled !== false;
        return { identity: String(binding.id),handle: binding.id,self: binding.self,player: captured.players[0]?.handle ?? 0,
          observed: new Set([...binding.actors,...(binding.self === 0 ? [] : [binding.self]),...sample.observed.keys()]),enabled,due: enabled && pending.some(row => row.binding === String(binding.id)),divisor: this.divisor,fuel: this.fuel,
          previousTick: saved.lastCall ?? 0,currentTick: tick,state: script.state.map(slot => Number(required(saved.slots[slot.name]))),
          parameters: Object.entries(script.params).map(([name,value]) => ({ name,value })),fields: sample.fields,sample: sample.sample };
      });
      const inputBindings = new Map(bindings.map(row => [row.identity,{ handle: row.handle,due: row.due,observed: required(samples.get(row.handle)).observed }]));
      const input = this.inbox.capture(tick,inputBindings,new Map());
      const rng = prepareV2Rng(this.layout,this.rows.map(({ binding }) => ({ binding: binding.id,stream: 1,algorithm: 2 as const,
        state: [this.seed[0],this.seed[1],required(before.bindings.find(row => row.id === binding.id)).rng,binding.id,binding.instance,0] as const })));
      prepared = { bindings,inputBindings,rng };
      return { observations: { bindings,players: captured.players,edges: input.edges,events: input.events,actions: new Set(),eventKinds: this.kinds },extra: [{ kind: 21,count: rng.count,bytes: rng.bytes }] };
    },candidate => {
      const { bindings,inputBindings,rng } = required(prepared);
      for (const kind of [11,17,18,20]) if (candidate.counts[kind-1] !== 0) throw new Error('Unsupported native v2 output bank');
      const due = new Set(bindings.filter(row => row.due && row.handle !== candidate.excluded).map(row => row.handle));
      const random = rng.readCandidate(candidate.view,candidate.counts[21] ?? 0,due), commands = new Map<number,ScriptV1Command[]>();
      const commandRegion = required(this.layout.regions[9]), stateRegion = required(this.layout.regions[2]);
      if ((candidate.counts[9] ?? 0) > 128 || candidate.counts[2] !== bindings.reduce((sum,row) => sum+row.state.length,0)) throw new Error('Native v2 candidate quota');
      for (let i = 0; i < (candidate.counts[9] ?? 0); i++) {
        const at = this.layout.io+commandRegion.offset+i*64, view = candidate.view,binding = view.getUint32(at,true),op = view.getUint32(at+4,true);
        if (!due.has(binding) || ![1,2,3,4,5,6,7,12,13].includes(op) || view.getUint32(at+12,true) !== 0 || [40,48,56].some(offset => !Object.is(view.getFloat64(at+offset,true),0))) throw new Error('Invalid native v2 actor command');
        const target = view.getUint32(at+8,true), owner = required(this.rows.find(row => row.binding.id === binding));
        if ([1,2,3,4,6].includes(op) && !owner.binding.actors.includes(target)) throw new Error('Foreign native v2 actor command');
        const row: ScriptV1Command = [op,target,view.getFloat64(at+16,true),view.getFloat64(at+24,true),view.getFloat64(at+32,true)];
        if (!row.every(Number.isFinite)) throw new Error('Non-finite native v2 command');
        const list = commands.get(binding) ?? [];list.push(row);if (list.length > 32) throw new Error('Native v2 binding command quota');commands.set(binding,list);
      }
      let stateBase = 0;const staged: DecisionSnapshot['staged'][number][] = [];
      for (const row of bindings) {
        const declaration = required(this.rows.find(item => item.binding.id === row.handle)), saved = required(before.bindings.find(item => item.id === row.handle));
        const slots = Object.fromEntries(declaration.script.state.map((slot,index) => {
          const value = candidate.view.getFloat64(this.layout.io+stateRegion.offset+(stateBase+index)*8,true);
          if (!Number.isFinite(value) || (!due.has(row.handle) && !Object.is(value,row.state[index])) || (slot.type === 'bool' && value !== 0 && value !== 1)) throw new Error('Invalid native v2 state candidate');
          return [slot.name,slot.type === 'bool' ? value === 1 : value];
        }));stateBase += row.state.length;
        const nextRng = required(random.find(item => item.binding === row.handle));
        if (nextRng.draws > 0 && !declaration.script.reads.includes('random')) throw new Error('Undeclared native v2 RNG');
        if (due.has(row.handle)) staged.push({ binding: row.handle,tick,observed: [...row.observed],commands: commands.get(row.handle) ?? [],slots,timers: saved.timers,rng: nextRng.state[2],lastCall: tick });
      }
      const publish = this.host.prepareRestore({ ...before,staged });
      const accepted = new Map([...inputBindings].map(([key,row]) => [key,{ handle: row.handle,observed: row.observed,due: row.due && row.handle !== candidate.excluded }]));
      const input = this.inbox.capture(tick,accepted,new Map());
      return { accept: () => { publish.validate();input.validate();publish();input.accept(); },commit: () => undefined };
    });
    if (result.status === 'disabled') for (const { binding } of this.rows) this.host.setEnabled(binding.id,false);
    return result;
  }
}
