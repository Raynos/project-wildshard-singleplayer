import { expect, test } from 'vitest';
import type { HookPracticeRow } from '../src/format/practiceCourseRows';
import { isJsonData } from '../src/format/json';
import { ProjectedState, ReturnProgram } from '../src/game/population/returnProgram';
import { practiceFrame } from '../src/shards/nine-dragon-stack/generators/practiceFrame';
import course from '../src/shards/nine-dragon-stack/data/grappleCourse.json' with { type: 'json' };
import program from '../src/shards/nine-dragon-stack/behaviour/practice.generated.json' with { type: 'json' };

function guest(row: HookPracticeRow = course) {
  const law = new ProjectedState({ initial: { phase: 0, started: 0, elapsed: 0, best: -1, checkpoint: 0, visited: 0 } }, ReturnProgram.page(program));
  const frame = practiceFrame(row);
  return { law, event: (signal: string, x: number, y: number, z: number, grounded = true, now = 10) => law.event(signal, { ...frame, x, y, z, grounded: Number(grounded), now }) };
}

test('the guest selects all eleven real pads and preserves closed edges and strict floor tolerance', () => {
  for (const [index, pad] of course.pads.entries()) {
    const run = guest(), out = run.event('step', pad.x, pad.top, pad.z);
    expect(out['pad'], pad.id).toBe(index);
    expect(run.law.state.checkpoint, pad.id).toBe(index);
    expect(out['visit'], pad.id).toBe(pad.kind === 'start' || pad.kind === 'range' ? -1 : index);
  }
  const start = course.pads[0]; if (start === undefined) throw new Error('Missing original start');
  const run = guest(), edge = start.x + start.w / 2;
  expect(run.event('step', edge, start.top, start.z)['pad']).toBe(0);
  expect(run.event('step', edge + 0.001, start.top, start.z)['pad']).toBe(-1);
  expect(run.event('step', start.x, start.top + 0.349, start.z)['pad']).toBe(0);
  expect(run.event('step', start.x, start.top + 0.351, start.z)['pad']).toBe(-1);
  expect(run.event('step', start.x, start.top, start.z, false)['pad']).toBe(-1);
});

test('every checkpoint fall keeps its original native spawn, facing and pitch', () => {
  const low = Math.min(...course.pads.map(pad => pad.top)) - course.fallY - 0.001;
  for (const pad of course.pads) {
    const run = guest(); run.event('step', pad.x, pad.top, pad.z);
    const out = run.event('step', 0, low, 0, false), atStart = pad.id === course.run.from;
    const z = atStart ? pad.z + pad.d / 2 - 3 : pad.z;
    const next = pad.next === undefined ? undefined : course.pads.find(value => value.id === pad.next);
    expect(out['fell'], pad.id).toBe(1);
    expect([out['spawnX'], out['spawnY'], out['spawnZ']], pad.id).toEqual([pad.x, pad.top, z]);
    expect(out['spawnYaw'], pad.id).toBeCloseTo(next === undefined ? 0 : Math.atan2(-(next.x - pad.x), -(next.z - z)), 12);
    expect(out['spawnPitch'], pad.id).toBeCloseTo(next === undefined ? -0.1 : Math.atan2(next.top - pad.top, Math.hypot(next.x - pad.x, next.z - z)) * 0.8, 12);
  }
});

test('reset preserves the best run and emits the original start pose; finishing uses the same clock', () => {
  const run = guest(), start = course.pads.find(pad => pad.id === course.run.from), finish = course.pads.find(pad => pad.id === course.run.to);
  if (start === undefined || finish === undefined) throw new Error('Missing original run endpoints');
  run.law.set({ best: 12 });
  const reset = run.event('reset', 0, 0, 0);
  expect([reset['spawnX'], reset['spawnY'], reset['spawnZ']]).toEqual([start.x, start.top, start.z + start.d / 2 - 3]);
  run.event('step', start.x, start.top, start.z - start.d, true, 20);
  const out = run.event('step', finish.x, finish.top, finish.z, true, 30);
  expect(out['finish']).toBe(1);
  expect(run.law.state).toMatchObject({ phase: 2, started: 20, elapsed: 10, best: 10 });
});

test('the shipped eleven-pad bound stays within existing fuel and remains plain JSON', () => {
  const first = course.pads[0]; if (first === undefined) throw new Error('Missing original pad');
  const pads = course.pads, row = course, frame = practiceFrame(row), run = guest(row);
  expect(isJsonData(frame)).toBe(true);
  expect(run.event('reset', 0, 0, 0)['spawnY']).toBe(first.top);
  expect(run.event('step', 1000, 100, 1000)['pad']).toBe(-1);
  expect(() => practiceFrame({ ...row, pads: [...pads, first] })).toThrow('Invalid practice pads');
});


test('AS counts distinct eligible pads, preserves visits across falls and clears them on restart', () => {
  const run = guest(), reached = new Set<string>();
  for (const id of ['p1', 'p1', 'p2', course.run.from, 'p1', 'l1', 'l1']) {
    const pad = course.pads.find(row => row.id === id);
    if (pad === undefined) throw new Error('Missing original pad');
    if (pad.kind !== 'start' && pad.kind !== 'range') reached.add(pad.id);
    expect(run.event('step', pad.x, pad.top, pad.z)['reached']).toBe(reached.size);
  }
  const low = Math.min(...course.pads.map(pad => pad.top)) - course.fallY - 1;
  expect(run.event('step', 0, low, 0, false)).toMatchObject({ fell: 1, reached: reached.size });
  const resumed = guest(); resumed.law.set({ ...run.law.state });
  const pad = course.pads.find(row => row.id === 'p2');
  if (pad === undefined) throw new Error('Missing original checkpoint');
  expect(resumed.event('step', pad.x, pad.top, pad.z)['reached']).toBe(reached.size);
  expect(run.event('reset', 0, 0, 0)).toMatchObject({ visited: 0, reached: 0 });
  expect(run.event('step', pad.x, pad.top, pad.z)['reached']).toBe(1);
});


test('build-time visit masks preserve pad-id deduplication for repeated ids', () => {
  const first = course.pads.find(pad => pad.id === 'p1');
  if (first === undefined) throw new Error('Missing original pad');
  const pads = structuredClone(course.pads);
  // Keep next links valid after replacing the duplicate pad's id.
  for (const pad of pads) { if (pad.id === 'p2') pad.id = first.id; if (pad.next === 'p2') pad.next = first.id; }
  const row = { ...course, pads };
  const run = guest(row), repeated = row.pads.filter(pad => pad.id === first.id);
  for (const pad of repeated) expect(run.event('step', pad.x, pad.top, pad.z)['reached']).toBe(1);
});
