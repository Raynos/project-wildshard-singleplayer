import { beforeAll, expect, test } from 'vitest';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { GroupBankV2 } from '../src/engine/script/groupBankV2';
import { GroupStepV2 } from '../src/engine/script/groupStepV2';
import { QueryRingV2 } from '../src/engine/script/queriesV2';
import { parseGroupStepV2, groupStepColumnV2, groupStepLayoutV2 } from '../src/format/scriptGroupStepV2';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { v2CoreSource } from '../src/sdk/as/wsV2';
import { groupStepSourceV2 } from '../src/sdk/as/groupStepV2';
import { groupBankSourceV2 } from '../src/sdk/as/groupBankV2';

const rows = parseGroupStepV2({ bank: [
  { name: 'held', kind: 'number', integer: true, min: 0, max: 65535 },
  { name: 'sum', kind: 'number' }, { name: 'target', kind: 'reference' },
  { name: 'random', kind: 'number' }, { name: 'reply', kind: 'number' },
], columns: [{ name: 'z.position', id: 7, source: { kind: 'actor', field: 'x' } },
  { name: 'a.alive', id: 900, source: { kind: 'actor', field: 'alive' } }],
  members: 16, signals: ['step', 'query', 'badAction', 'badState', 'random', 'badRef', 'badMember', 'rawActor', 'badReserved'],
  actions: [{ id: 1, words: 3, member: 0 }, { id: 2, words: 1, reference: { word: 0 } }],
  outputs: 4, pages: 1, fuel: 400000, queries: { pending: 4, scalars: 0 } });
let bytes: Uint8Array;
beforeAll(async () => {
  bytes = await compileScriptV2(`import * as core from './sdk/as/wsV2';import * as group from './sdk/as/groupBankV2';import * as slots from './sdk/as/groupStepV2';
    export function ws_abi():i32{return 2;}export function ws_io():i32{return 0;}
    export function ws_init(lo:i32,hi:i32,fuel:i32):i32{return fuel;}
    export function ws_project(fuel:i32):i32{core.beginState();assert(core.beginBinding(0));
      const signal=i32(core.parameter(0)),members=i32(core.parameter(1));let sum:f64=0;
      for(let slot=0;slot<members;slot++){assert(core.fieldId(slot*2)==slot*2+1);sum+=slots.member(slot,1);}
      group.write(1,sum);assert(group.claim(0,15,1));assert(!group.claim(0,0,1));
      if(signal==2){if(core.count(12)>0)group.write(4,core.replyValue(0,4));
        if(core.currentTick()==0)core.query(10,1,0,0,0,0,30,5);}
      else if(signal==5)group.write(3,core.random(1));
      else if(signal==4)group.write(0,70000);
      else if(signal==6)core.pageOutput(2,98);
      else if(signal==7)core.pageOutput(1,16,2,0);
      else if(signal==8)core.actorCommand(1,0,1,2,3);
      else {core.pageOutput(1,15,core.field(31),-0.0);core.pageOutput(signal==3?3:2,99);
        if(signal==9)store<u32>(core.row(10,1)+12,1);}
      core.endBinding();return fuel;}`, { lane: 'project', ioBytes: groupStepLayoutV2(rows).bytes,
    sources: { 'sdk/as/wsV2.ts': v2CoreSource(0), 'sdk/as/groupBankV2.ts': groupBankSourceV2(0, 5), 'sdk/as/groupStepV2.ts': groupStepSourceV2(2,16) } });
});
function actor(id: string): AnimalSim {
  return new AnimalSim({ kind: 'test', label: 'Test', variant: 'plain', rarity: 'common', hp: 20, aggressive: false,
    dims: { bodyY: .6, bodyHalfLen: .5, bodyRadius: .3, headRadius: .2, legLen: .5, feet: [], halfWidth: .3 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 5, relentless: false } },
  1, 1, id, { heightAt: () => 0, random: () => .5 });
}
function fixture(declarations = rows) {
  const root = new Scope('group-root'), scope = root.child('original-group');
  const bodies = Array.from({ length: 16 }, (_, slot) => { const body = actor(`body:${slot}`);body.position.x = slot;body.alive = slot !== 3;return body; });
  const other = actor('other-body');
  const references = [...bodies.map((body, slot) => ({ group: 'original', slot, identity: body.entityId,
    wire: body.entityId, handle: slot + 1, body })), { group: 'other', slot: 0, identity: other.entityId,
    wire: 'other/member', handle: 99, body: other }];
  const members = bodies.map((body, slot) => ({ scope, self: { group: 'original', slot, identity: body.entityId, actor: body },
    observed: new Map(), player: { position: { x: 0, z: 0 } }, t: 0, dt: .1 }));
  const state = new GroupBankV2(rows.bank).encode({ held: 0, sum: 0, target: 'other/member', random: 0, reply: 0 }, 'original', references);
  const runner = new GroupStepV2(bytes, declarations, scope), random = new Rng(20);
  const input = { group: 'original', handle: 100, signal: 'step', tick: 0, state, members, references, random };
  return { root, scope, bodies, other, references, members, state, runner, random, input };
}
test('real AS sees sixteen stable ordered slots and detached original native operation loans', () => {
  const f = fixture();
  try {
    expect(groupStepColumnV2(rows, 15, 'z.position')).toBe(31);
    const before = f.state.slice(), saved = JSON.stringify(f.bodies.map(body => body.snapshot()));
    const ready = f.runner.prepare(f.input);
    expect(f.state).toStrictEqual(before);
    expect(ready.operations.map(op => op.id)).toStrictEqual([1, 2]);
    expect(ready.operations[0]?.member?.actor).toBe(f.bodies[15]);
    expect(ready.operations[1]?.reference?.body).toBe(f.other);
    expect(Object.is(ready.operations[0]?.values[2], -0)).toBe(true);
    ready.validate();ready.accept();
    expect(Array.from(f.state)).toStrictEqual([32768, 120, 99, 0, 0]);
    expect(JSON.stringify(f.bodies.map(body => body.snapshot()))).toBe(saved);
    expect(f.bodies[3]?.alive).toBe(false);
    expect(() => ready.accept()).toThrow('accepted');
  } finally { f.root.dispose(); }
});
test('malformed state, action suffix, actor authority and reference operands publish nothing', () => {
  const f = fixture();
  try {
    const before = f.state.slice(), rng = f.random.snapshot();
    for (const signal of ['badAction', 'badState', 'badRef', 'badMember', 'rawActor', 'badReserved']) {
      expect(() => f.runner.prepare({ ...f.input, signal })).toThrow();
      expect(f.state).toStrictEqual(before);expect(f.random.snapshot()).toStrictEqual(rng);
    }
    f.runner.prepare(f.input).accept();expect(f.state[1]).toBe(120);
  } finally { f.root.dispose(); }
});
test('the same ai RNG advances only on accepted calls and stale preparations refuse', () => {
  const f = fixture();
  try {
    const original = f.random.snapshot(), oracle = new Rng(0);oracle.restore(original);
    const expected = oracle.next(), ready = f.runner.prepare({ ...f.input, signal: 'random' });
    expect(f.random.snapshot()).toStrictEqual(original);expect(f.state[3]).toBe(0);
    ready.accept();expect(f.state[3]).toBe(expected);expect(f.random.snapshot()).toStrictEqual(oracle.snapshot());
    const stale = f.runner.prepare({ ...f.input, signal: 'random' });f.random.next();
    expect(() => stale.accept()).toThrow('RNG');expect(f.state[3]).toBe(expected);
  } finally { f.root.dispose(); }
});
test('actor replacement, a changed bank and ancestor retirement refuse before publication', () => {
  const f = fixture();
  try {
    const member = f.members[0];if (member === undefined) throw new Error('Missing member');
    const ready = f.runner.prepare(f.input), original = member.self.actor;member.self.actor = actor('replacement');
    expect(() => ready.accept()).toThrow('body loan');member.self.actor = original;
    f.state[1] = 20;expect(() => ready.accept()).toThrow('bank');f.state[1] = 0;
    const retired = f.runner.prepare(f.input), steps = f.root.disposeSteps();steps.next();
    expect(() => retired.accept()).toThrow('disposed');
    for (const _step of steps) { /* Original scope completes retirement. */ }
    expect(f.state[1]).toBe(0);
  } finally { f.root.dispose(); }
});
test('the existing query ring keeps afterBodies and next-tick delivery atomic with the same bank', () => {
  const f = fixture(), ring = new QueryRingV2(f.runner.layout, new Map([['original', { pending: 4, operations: new Map([[10, 0]]) }]]));
  const binding = { identity: 'original', handle: 100, observed: new Map(f.references.map(row => [row.handle, row.identity])), operations: new Set([10] as const) };
  try {
    const input = { ...f.input, signal: 'query', queries: { ring, binding } };
    const ready = f.runner.prepare(input);expect(ring.snapshot().entries).toHaveLength(0);ready.accept();
    expect(ring.snapshot().entries).toHaveLength(1);
    ring.afterBodies(0, requests => { expect(requests[0]?.values).toStrictEqual([0, 0, 0, 30, 5, 0, 0]);
      return [{ status: 1, kind: 'nearest', actor: { id: f.other.entityId, point: [3, 0, 4], distance: 5 } }]; });
    const next = f.runner.prepare({ ...input, tick: 1 });
    expect(f.state[4]).toBe(0);expect(ring.snapshot().entries).toHaveLength(1);
    next.accept();expect(f.state[4]).toBe(5);expect(ring.snapshot().entries).toHaveLength(0);
  } finally { f.root.dispose(); }
});
test('strict metadata rejects duplicate columns, bank fields and overlapping operand selectors', () => {
  expect(() => parseGroupStepV2({ ...rows, bank: [...rows.bank, rows.bank[0]] })).toThrow();
  expect(() => parseGroupStepV2({ ...rows, columns: [...rows.columns, rows.columns[0]] })).toThrow();
  expect(() => parseGroupStepV2({ ...rows, actions: [{ id: 1, words: 1, member: 0, reference: { word: 0 } }] })).toThrow('operands');
});

test('reentrant native column capture refuses while a valid call still uses the original sampler', () => {
  const declarations = parseGroupStepV2({ ...rows, columns: [rows.columns[1], { name: 'z.position', id: 7, source: { kind: 'grass', at: 'self' } }] });
  const f = fixture(declarations);
  try {
    let captures = 0;
    const members = f.members.map(member => ({ ...member, environment: { playerCrouched: false, playerFwdX: 0, playerFwdZ: 1,
      playerMounted: false, playerHealth01: 1, light: 1, storm: false, wind: { x: 0, z: 1, strength: 1 },
      grassHeightAt: (x: number) => { captures++;expect(() => f.runner.prepare(f.input)).toThrow('Reentrant');return x; } } }));
    f.runner.prepare({ ...f.input, members }).accept();expect(captures).toBe(16);expect(f.state[1]).toBe(120);
  } finally { f.root.dispose(); }
});
test('changed native query capabilities refuse the entire prepared transaction', () => {
  const f = fixture(), ring = new QueryRingV2(f.runner.layout, new Map([['original', { pending: 4, operations: new Map([[10, 0]]) }]]));
  const observed = new Map(f.references.map(row => [row.handle, row.identity]));
  const binding = { identity: 'original', handle: 100, observed, operations: new Set([10] as const) };
  try {
    const ready = f.runner.prepare({ ...f.input, signal: 'query', queries: { ring, binding } });
    observed.delete(99);expect(() => ready.accept()).toThrow('continuation owner');
    expect(ring.snapshot().entries).toHaveLength(0);expect(f.state[1]).toBe(0);
  } finally { f.root.dispose(); }
});
