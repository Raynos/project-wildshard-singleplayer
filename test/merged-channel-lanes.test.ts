import { expect, test } from 'vitest';
import { parseClientChannels, type ClientChannelProgram } from '../src/format/clientChannels';
import { admittedClientChannels, planMergedChannels, publishMergedChannels } from '../src/game/plugin/channels';
import { NumericInputError } from '../src/engine/core/faults';
import { CRAB_CLIPS } from '../src/shards/driftwood-isle/generators/crabClips';
import { THRALL_CLIPS } from '../src/shards/pine-hollow/generators/thrallClips';

// DW story margin: a rig's pose programs evaluated as one merged lane publish exactly the values each lane computes on its
// own, frame after frame; signed zeros never merge; a refused merged frame refuses in the lanes too.
const table = (programs: readonly { readonly numeric: object }[]): ClientChannelProgram[] =>
  parseClientChannels(programs.map(program => ({ ...program, numeric: { ...program.numeric, inputs: [] } })));
const names = (programs: readonly ClientChannelProgram[]): string[] => [...new Set(programs.flatMap(program => program.reads))];

test.each([['crab', CRAB_CLIPS.programs], ['thrall', THRALL_CLIPS.programs]] as const)('%s pose programs: merged frames equal the lanes', (_name, rows) => {
  const programs = table(rows), reads = names(programs), plan = planMergedChannels(programs, reads);
  if (plan === null) throw new Error('unmerged');
  expect(plan.program.nodes.length).toBeLessThan(programs.reduce((sum, program) => sum + program.nodes.length, 0));
  const own = programs.map(program => admittedClientChannels(program)), lanes = programs.map(program => admittedClientChannels(program));
  const merged = admittedClientChannels(plan.program);
  let seed = 5; const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let time = 0, values = reads.map(() => 0);
  for (let frame = 0; frame < 300; frame++) {
    const delta = 1 / 30; time += delta;
    // a third of the frames repeat their reads (the lanes' own repeat shortcut), the rest move every read
    if (frame % 3 !== 0) values = reads.map(() => rnd() * 4 - 2);
    for (const [i, lane] of own.entries()) { const program = programs[i]; if (program === undefined) throw new Error('program');
      lane.evaluate({ time, delta, values: program.reads.map(id => values[reads.indexOf(id)] ?? Number.NaN) }); }
    merged.evaluate({ time, delta, values }); publishMergedChannels(plan, merged, lanes);
    for (const [i, program] of programs.entries()) for (const channel of program.channels)
      expect(Object.is(lanes[i]?.frame[channel.property], own[i]?.frame[channel.property])).toBe(true);
  }
});

const program = (nodes: unknown[], property = 'x'): unknown => ({ id: `p-${property}`, reads: ['r'], nodes, channels: [{ property, value: nodes.length - 1 }] });
test('signed zeros stay distinct: atan2(0, -0) and atan2(0, 0) keep their own nodes', () => {
  const programs = parseClientChannels([
    program([{ op: 'constant', value: 0 }, { op: 'constant', value: -0 }, { op: 'atan2', a: 0, b: 1 }], 'x'),
    program([{ op: 'constant', value: 0 }, { op: 'constant', value: 0 }, { op: 'atan2', a: 0, b: 1 }], 'y'),
  ]);
  const plan = planMergedChannels(programs, ['r']); if (plan === null) throw new Error('unmerged');
  const lanes = programs.map(row => admittedClientChannels(row)), merged = admittedClientChannels(plan.program);
  merged.evaluate({ time: 0, delta: 0, values: [1] }); publishMergedChannels(plan, merged, lanes);
  expect(lanes[0]?.frame.x).toBe(Math.PI); expect(lanes[1]?.frame.y).toBe(0);
});

test('a refused merged frame is refused by the lane that owns the expression, which then evaluates itself', () => {
  const programs = parseClientChannels([program([{ op: 'read', index: 0 }, { op: 'sqrt', a: 0 }], 'x'), program([{ op: 'read', index: 0 }, { op: 'abs', a: 0 }], 'y')]);
  const plan = planMergedChannels(programs, ['r']); if (plan === null) throw new Error('unmerged');
  const lanes = programs.map(row => admittedClientChannels(row)), merged = admittedClientChannels(plan.program);
  merged.evaluate({ time: 0, delta: 0, values: [4] }); publishMergedChannels(plan, merged, lanes);
  expect([lanes[0]?.frame.x, lanes[1]?.frame.y]).toEqual([2, 4]);
  expect(() => { merged.evaluate({ time: 0, delta: 0, values: [-4] }); }).toThrow(NumericInputError);
  expect(() => { lanes[0]?.evaluate({ time: 0, delta: 0, values: [-4] }); }).toThrow(NumericInputError);
  lanes[1]?.evaluate({ time: 0, delta: 0, values: [-4] }); expect(lanes[1]?.frame.y).toBe(4);
});

test('programs with private locals are not merged', () => {
  const [row] = parseClientChannels([{ id: 'l', reads: ['r'], nodes: [{ op: 'local', index: 0 }, { op: 'read', index: 0 }], channels: [{ property: 'x', value: 0 }], locals: [{ initial: { op: 'constant', value: 0 }, next: 1 }] }]);
  if (row === undefined) throw new Error('row');
  expect(planMergedChannels([row], ['r'])).toBeNull();
});
