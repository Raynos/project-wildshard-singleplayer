import { expect, it } from 'vitest';
import { compileDirectorWhen, evaluateDirectorWhen } from '../src/format/directorWhen';
import { parseDirectorStages, DirectorStagesSchema } from '../src/format/directorStages';
import { Director } from '../src/sdk/director';
import { DirectorStageLane } from '../src/game/plugin/director';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';

const declaration = {
  id: 'fixture.finale', inputs: { altarLit: 'flag:fixture.altar', captainDead: 'actor:captain.dead', atCove: 'zone:cove' },
  stages: [
    { id: 'calm' },
    { id: 'summon', when: 'altarLit && !captainDead', do: [{ spawn: 'captain' }, { score: 'boss' }, { toast: 'finale.summon' }] },
    { id: 'won', when: 'captainDead && atCove', do: [{ despawn: 'captain' }, { flag: { key: 'fixture.won', value: true } }, { weather: 'calm' }, { reward: 'fixture.finale' }, { emit: 'finale.won', value: 1 }, { score: 'victory' }] },
  ],
};
const row = () => new Director(declaration).toJSON();

it('compiles precedence and parentheses to bounded JSON instructions, with every boolean observation combination', () => {
  const program = compileDirectorWhen('a || b && !c', ['a', 'b', 'c']);
  expect(program).toEqual([{ input: 'a' }, { input: 'b' }, { input: 'c' }, { op: 'not' }, { op: 'and' }, { op: 'or' }]);
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Persisted JSON, rather than an in-memory clone, is the author wire boundary under test.
  const transported = JSON.parse(JSON.stringify(program)) as typeof program;
  for (const a of [false, true]) for (const b of [false, true]) for (const c of [false, true]) {
    expect(evaluateDirectorWhen(transported, { a, b, c })).toBe(a || b && !c);
    expect(evaluateDirectorWhen(compileDirectorWhen('!(a || b) && (c || false)', ['a', 'b', 'c']), { a, b, c })).toBe(!(a || b) && c);
  }
});

it('refuses code execution, undeclared inputs, malformed operators and oversized or deeply nested expressions', () => {
  for (const source of ['a()', 'a.constructor', 'a = true', 'a & b', 'a ||', 'a b', '(a', '', 'unknown', `${'!'.repeat(17)}a`, `${'a && '.repeat(70)}a`, ' '.repeat(1025)]) {
    expect(() => compileDirectorWhen(source, ['a', 'b'])).toThrow();
  }
  expect(() => evaluateDirectorWhen([{ input: 'a' }], {})).toThrow('observation');
  expect(() => evaluateDirectorWhen([{ op: 'and' }], {})).toThrow('program');
  expect(() => evaluateDirectorWhen([{ literal: true }, { literal: false }], {})).toThrow('program');
});

it('admits all eight fixed actions, fills defaults, and keeps author objects independent from emitted JSON', () => {
  const director = new Director(declaration), data = director.toJSON();
  expect(data.version).toBe(2); expect(data.script).toBe(null); expect(data.stages[0]?.do).toEqual([]);
  data.stages.splice(1);
  expect(director.toJSON().stages).toHaveLength(3);
  expect(parseDirectorStages(director.toJSON())).toEqual(director.toJSON());
});

it('refuses undeclared guards, duplicate stages, dangling cycles, arbitrary actions and malformed native bindings', () => {
  const good = row();
  for (const change of [
    { inputs: { value: 'untrusted:eval' } }, { inputs: { true: 'flag:fixture.true' } },
    { stages: [{ id: 'calm', when: 'true' }] }, { stages: [{ id: 'calm', next: 'missing' }] },
    { stages: [{ id: 'calm' }, { id: 'calm' }] }, { stages: [{ id: 'calm' }, { id: 'won', when: 'missing' }] },
    { stages: [{ id: 'calm', do: [{ teleport: 'captain' }] }] },
    { stages: [{ id: 'calm', do: [{ spawn: 'captain', reward: 'fixture.won' }] }] },
    { stages: [{ id: 'calm', do: [{ emit: 'fixture.event', value: Infinity }] }] },
  ]) expect(() => parseDirectorStages({ ...good, ...change })).toThrow();
  expect(() => parseDirectorStages({ ...good, inputs: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`input${i}`, 'flag:fixture.input'])) })).toThrow();
  expect(() => parseDirectorStages({ ...good, stages: Array.from({ length: 65 }, (_, i) => ({ id: `stage${i}` })) })).toThrow();
  expect(() => parseDirectorStages({ ...good, stages: [{ id: 'calm', do: Array.from({ length: 33 }, () => ({ spawn: 'captain' })) }] })).toThrow();
});

it('emits one ordered stage entry per accepted tick and never repeats terminal actions', () => {
  const lane = new DirectorStageLane(row()), calm = { altarLit: false, captainDead: false, atCove: false };
  expect(lane.stage).toBe(null); expect(lane.step(0, calm)).toEqual([]); expect(lane.stage).toBe('calm');
  expect(lane.step(1, calm)).toEqual([]);
  expect(lane.step(2, { ...calm, altarLit: true })).toEqual(row().stages[1]?.do);
  expect(lane.step(3, { ...calm, altarLit: true, captainDead: true })).toEqual([]);
  expect(lane.step(4, { ...calm, captainDead: true, atCove: true })).toEqual(row().stages[2]?.do);
  expect(lane.step(5, calm)).toEqual([]); expect(lane.stage).toBe('won');
});

it('restores mid-stage quietly and produces the identical action tape and snapshot hash over a complete suffix', () => {
  const data = row(), lane = new DirectorStageLane(data), initial = { altarLit: false, captainDead: false, atCove: false };
  lane.step(0, initial); lane.step(1, { ...initial, altarLit: true });
  const restored = new DirectorStageLane(data); restored.restore(lane.snapshot());
  expect(restored.snapshot()).toBe(lane.snapshot());
  for (let tick = 2; tick < 120; tick++) {
    const observation = { altarLit: true, captainDead: tick >= 20, atCove: tick >= 40 };
    expect(restored.step(tick, observation)).toEqual(lane.step(tick, observation));
    expect(restored.snapshot()).toBe(lane.snapshot());
  }
  const fresh = new DirectorStageLane(data), unstarted = fresh.snapshot(); fresh.restore(unstarted); expect(fresh.snapshot()).toBe(unstarted);
});

it('validates observations, ticks and snapshots before any mutation, and refuses unavailable scripted installations', () => {
  const lane = new DirectorStageLane(row()), before = lane.snapshot();
  expect(() => lane.step(0, { altarLit: true, captainDead: false })).toThrow('observation');
  expect(() => lane.step(-1, { altarLit: true, captainDead: false, atCove: false })).toThrow('tick');
  for (const state of [{ tick: -1, stage: 0 }, { tick: 0, stage: -1 }, { tick: 0, stage: 3 }, { tick: 0.5, stage: 0 }]) {
    expect(() => lane.restore(JSON.stringify({ version: 2, contract: row(), state }))).toThrow();
    expect(lane.snapshot()).toBe(before);
  }
  expect(() => lane.restore(JSON.stringify({ version: 2, contract: { ...row(), id: 'foreign.director' }, state: { tick: -1, stage: -1 } }))).toThrow();
  expect(lane.snapshot()).toBe(before);
  expect(() => new DirectorStageLane({ ...row(), script: 'a'.repeat(64) })).toThrow('typed script');
});

it('supports explicit cyclic and self transitions only when their destination guards admit them', () => {
  const data = new Director({ id: 'fixture.cycle', inputs: { requested: 'event:fixture.request' }, stages: [
    { id: 'idle' }, { id: 'active', when: 'requested', next: 'active', do: [{ emit: 'fixture.pulse' }] },
  ] }).toJSON(), lane = new DirectorStageLane(data);
  lane.step(0, { requested: false }); expect(lane.step(1, { requested: true })).toEqual([{ emit: 'fixture.pulse', value: 0 }]);
  expect(lane.step(2, { requested: false })).toEqual([]); expect(lane.step(3, { requested: true })).toEqual([{ emit: 'fixture.pulse', value: 0 }]);
  const cyclic = new DirectorStageLane(new Director({ id: 'fixture.cycle', inputs: { requested: 'event:fixture.request' }, stages: [
    { id: 'idle' }, { id: 'active', when: 'requested', next: 'idle' },
  ] }).toJSON());
  cyclic.step(0, { requested: false }); cyclic.step(1, { requested: true }); cyclic.step(2, { requested: false }); expect(cyclic.stage).toBe('idle');
});

it('publishes structural JSON Schema with mandatory defining semantic checks', () => {
  const schema = formatJsonSchema(DirectorStagesSchema);
  expect(schema.properties?.['version']).toEqual({ const: 2 });
  expect(schema['x-wildshard-checks']).toContain('@wildshard/format/directorStages#DirectorStagesSchema.pipe.1');
});
