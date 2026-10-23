import { expect, test } from 'vitest';
import * as v from 'valibot';
import { GroupBankV2 } from '../src/engine/script/groupBankV2';
import { Scope } from '../src/engine/app/scope';
import { GroupBrain } from '../src/engine/ai/GroupBrain';
import { AggressionDirector } from '../src/engine/ai/director';
import { GroupBankV2Schema, parseGroupBankV2 } from '../src/format/scriptGroupBankV2';
import { layoutV2, writeV2Frame, validateV2Frame } from '../src/format/scriptWireV2';
import { prepareV2Observations } from '../src/engine/script/observationsV2';
import { ScriptModuleV2 } from '../src/engine/script/moduleV2';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { v2CoreSource } from '../src/sdk/as/wsV2';
import { groupBankSourceV2 } from '../src/sdk/as/groupBankV2';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const members = Array.from({ length: 16 }, (_, slot) => ({ entityId: `body:${slot}`, alive: slot !== 3 }));
const roster = members.map((actor, slot) => ({ group: 'first', slot, identity: actor.entityId,
  wire: actor.entityId, handle: slot + 1 }));
const external = { group: 'other', slot: 0, identity: 'prey:0', wire: 'herd:other/prey:0', handle: 99 };
const fields = [
  { name: 'time', kind: 'nullable-number' },
  { name: 'initialized', kind: 'boolean' },
  { name: 'phase', kind: 'enum', values: ['rest', 'advance'] },
  { name: 'lead', kind: 'reference', own: true },
  { name: 'target', kind: 'reference' },
  { name: 'members', kind: 'references', own: true, capacity: 16 },
  { name: 'held', kind: 'references', own: true, capacity: 16 },
  { name: 'strength', kind: 'number', min: 0, max: 100 },
];
const record = () => ({ time: null, initialized: true, phase: 'advance', lead: 'body:15',
  target: external.wire, members: members.map(actor => actor.entityId), held: ['body:3', 'body:15'], strength: -0 });

test('finite columns preserve ordered sixteen-member and cross-group references without changing wire values', () => {
  const codec = new GroupBankV2(fields), input = record(), loans = [...roster, external];
  const bank = codec.encode(input, 'first', loans), output = codec.decode(bank, 'first', loans);
  expect(output).toStrictEqual(input);
  expect(Object.is(output['strength'], -0)).toBe(true);
  expect(JSON.stringify(output)).toBe(JSON.stringify(input));
  const next = { ...input, time: 4.25, target: null, members: ['body:15', 'body:0'] };
  expect(codec.decode(codec.encode(next, 'first', loans), 'first', loans)).toStrictEqual(next);
  expect(roster[3]?.identity).toBe('body:3'); // Death retains its original slot.
});

test('real GroupBrain JSON continuation round-trips through the bank and original restore owner', () => {
  class OriginalGroup extends GroupBrain<typeof members[number]> {
    sample(): void { this.groupDelta(7.5, .1); const director = this.groupDirector(2, () => false);
      const first = this.members[0], last = this.members[15];
      if (first === undefined || last === undefined) throw new Error('Missing member');
      director.take(last); director.take(first);
    }
    save(): string { return this.snapshotGroup(actor => actor.entityId); }
    load(input: string): void { this.restoreGroup(input, actor => actor.entityId); }
  }
  const schema = v.strictObject({ members: v.array(v.string()), time: v.nullable(v.number()),
    directors: v.array(v.strictObject({ cap: v.number(), held: v.array(v.string()) })) });
  const original = new OriginalGroup(members), restored = new OriginalGroup(members);
  original.sample();
  const saved = original.save(), value = v.parse(schema, JSON.parse(saved));
  const director = value.directors[0];
  if (director === undefined) throw new Error('Missing original director');
  const codec = new GroupBankV2([{ name: 'members', kind: 'references', capacity: 16, own: true },
    { name: 'time', kind: 'nullable-number' }, { name: 'capacity', kind: 'number', integer: true, min: 0, max: 16 },
    { name: 'held', kind: 'references', capacity: 16, own: true }]);
  const decoded = codec.decode(codec.encode({ members: value.members, time: value.time,
    capacity: director.cap, held: director.held }, 'first', roster), 'first', roster);
  restored.load(JSON.stringify({ members: decoded['members'], time: decoded['time'],
    directors: [{ cap: decoded['capacity'], held: decoded['held'] }] }));
  expect(restored.save()).toBe(saved);
});

test('malformed suffixes, forged references and accessors refuse before publication', () => {
  const codec = new GroupBankV2(fields), loans = [...roster, external], scope = new Scope('group-bank');
  const bank = codec.encode(record(), 'first', loans), before = bank.slice();
  try {
    let reads = 0;
    expect(() => codec.encode({ ...record(), get strength() { reads++; return 1; } }, 'first', loans)).toThrow('accessor');
    expect(reads).toBe(0);
    expect(() => codec.encode({ ...record(), lead: external.wire }, 'first', loans)).toThrow('reference');
    expect(() => codec.encode({ ...record(), members: ['body:0', 'body:0'] }, 'first', loans)).toThrow('references');
    expect(() => codec.encode(record(), 'first', [...loans, { ...external, handle: 1 }])).toThrow('Ambiguous');
    const malformed = bank.slice(); malformed[malformed.length - 1] = Number.NaN;
    expect(() => codec.prepare(bank, malformed, 'first', loans, scope)).toThrow('Non-finite');
    expect(bank).toStrictEqual(before);
    const next = codec.encode({ ...record(), strength: 80 }, 'first', loans);
    const ready = codec.prepare(bank, next, 'first', loans, scope);
    ready.validate(); ready.accept();
    expect(codec.decode(bank, 'first', loans)['strength']).toBe(80);
    expect(() => ready.accept()).toThrow('preparation');
  } finally { scope.dispose(); }
});

test('publication fences original bank, reference slot identity and ancestor sliced retirement', () => {
  const codec = new GroupBankV2(fields), root = new Scope('parent'), scope = root.child('group');
  const loans = [...roster, { ...external }], bank = codec.encode(record(), 'first', loans);
  const next = codec.encode({ ...record(), strength: 12 }, 'first', loans);
  try {
    const staleBank = codec.prepare(bank, next, 'first', loans, scope); bank[bank.length - 1] = 2;
    expect(() => staleBank.accept()).toThrow('Changed group bank'); bank[bank.length - 1] = -0;
    const staleRef = codec.prepare(bank, next, 'first', loans, scope);
    const last = loans[loans.length - 1]; if (last === undefined) throw new Error('Missing reference');
    last.identity = 'replacement';
    expect(() => staleRef.accept()).toThrow('reference loan'); last.identity = external.identity;
    const retiring = codec.prepare(bank, next, 'first', loans, scope), steps = root.disposeSteps(); steps.next();
    expect(() => retiring.accept()).toThrow('Retired'); expect(Object.is(bank[bank.length - 1], -0)).toBe(true);
    for (const _step of steps) { /* Complete the same original retirement. */ }
  } finally { root.dispose(); }
});

test('real AS claims observe earlier writes in the same group call and match the original director', async () => {
  const codec = new GroupBankV2([{ name: 'held', kind: 'number', integer: true, min: 0, max: 65535 },
    { name: 'first', kind: 'boolean' }, { name: 'second', kind: 'boolean' }, { name: 'repeat', kind: 'boolean' }]);
  const bank = codec.encode({ held: 0, first: false, second: false, repeat: false }, 'first', roster);
  const layout = layoutV2(0, 1, new Map([[1, 1], [2, codec.width], [3, codec.width], [5, 1]]));
  const source = `import * as core from './sdk/as/wsV2'; import * as group from './sdk/as/groupBankV2';
    export function ws_abi():i32{return 2;} export function ws_io():i32{return 0;}
    export function ws_init(lo:i32,hi:i32,fuel:i32):i32{return fuel;}
    export function ws_project(fuel:i32):i32{core.beginState();assert(core.beginBinding(0));
      group.write(1,group.claim(0,2,1)?1:0);group.write(2,group.claim(0,3,1)?1:0);
      group.write(3,group.claim(0,2,1)?1:0);core.endBinding();return fuel;}`;
  const bytes = await compileScriptV2(source, { lane: 'project', ioBytes: layout.bytes,
    sources: { 'sdk/as/wsV2.ts': v2CoreSource(0), 'sdk/as/groupBankV2.ts': groupBankSourceV2(0, codec.width) } });
  const module = new ScriptModuleV2(bytes, { seed: [0, 0], initFuel: 400000, output: [], ioBytes: layout.bytes });
  const input = prepareV2Observations(layout, 0, { bindings: [{ identity: 'original-group', handle: 1,
    self: 0, player: 0, observed: new Set(), enabled: true, due: true, divisor: 6, fuel: 400000,
    previousTick: 0, currentTick: 0, state: Array.from(bank), parameters: [], fields: [], sample: { atTick: 0, target: 0 } }],
    players: [], edges: [], events: [], actions: new Set(), eventKinds: new Set() });
  let authority: ReturnType<typeof writeV2Frame> | undefined;
  const result = module.project(400000, view => {
    authority = writeV2Frame(view, layout, { lane: 2, module: 1, sequence: 0, tick: 0, due: 1 }, input.counts);
    input.write(view);
  }, view => {
    if (authority === undefined) throw new Error('Missing frame');
    const counts = validateV2Frame(view, layout, authority), state = layout.regions[2];
    if (state === undefined || counts[2] !== codec.width) throw new Error('Incomplete candidate');
    return Float64Array.from({ length: codec.width }, (_, index) => view.getFloat64(state.offset + index * 8, true));
  }).value;
  const director = new AggressionDirector(1), first = members[2], second = members[3];
  if (first === undefined || second === undefined) throw new Error('Missing member');
  const expected = { held: 4, first: director.take(first), second: director.take(second), repeat: director.take(first) };
  expect(codec.decode(result, 'first', roster)).toStrictEqual(expected);
  expect(bank).toStrictEqual(Float64Array.of(0, 0, 0, 0));
});

test('metadata admission is strict and emits the same finite named schema', () => {
  expect(() => parseGroupBankV2([{ name: '__proto__', kind: 'boolean' }])).toThrow();
  expect(() => parseGroupBankV2([{ name: 'phase', kind: 'enum', values: ['x', 'x'] }])).toThrow('Duplicate');
  expect(() => parseGroupBankV2([{ name: 'value', kind: 'number', min: 2, max: 1 }])).toThrow('Inverted');
  const schema = namedJsonSchema(GroupBankV2Schema);
  expect(validateNamedJsonSchema(schema, new TextEncoder().encode(JSON.stringify(fields)))).toStrictEqual(fields);
});
