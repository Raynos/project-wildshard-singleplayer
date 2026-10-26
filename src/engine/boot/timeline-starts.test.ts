import { expect, test } from 'vitest';
import { LoadingTimeline, repeatedStep } from './timeline';

test('the initial row accepts only a real setup fact tied to its original clock', () => {
  const path = {id: 'fixture', steps: [{key: 'modules', label: 'Modules', weight: 1}]};
  let shown = 80;
  const timeline = new LoadingTimeline(path, 100, () => 200, () => shown, {at: 100, setup: 0});
  timeline.begin('modules').end(); shown = 99;
  expect(timeline.snapshot().rows[0]).toMatchObject({startedAt: 100, setupAtStart: 0});
  for (const initial of [undefined, {at: 99, setup: 0}, {at: 100, setup: -1}, {at: 100, setup: 101},
    {at: 100, setup: Number.NaN}, {at: 100, setup: 2.5}]) {
    expect(new LoadingTimeline(path, 100, () => 200, () => shown, initial).snapshot().rows[0])
      .not.toHaveProperty('setupAtStart');
  }
});

test('timeline retains the displayed setup fact at first entry without reconstructing it later', () => {
  let now = 100, shown: number | undefined = 4, reads = 0;
  const timeline = new LoadingTimeline({id: 'fixture', steps: ['modules', 'world', 'nested', 'future']
    .map(key => ({key, label: key, weight: 1}))}, now, () => now, () => { reads++; return shown; });
  const modules = timeline.begin('modules'); modules.end();
  now = 120; const world = timeline.begin('world');
  shown = 9; now = 130; const nested = timeline.begin('nested'); nested.end(); world.end();
  shown = 99; now = 150; const again = timeline.begin('world'); again.end();
  expect(timeline.snapshot().rows.map(row => [row.key, row.startedAt, row.setupAtStart])).toEqual([
    ['modules', 100, undefined], ['world', 120, 4], ['nested', 130, 9], ['future', undefined, undefined],
  ]);
  expect(reads).toBe(2);
  expect(timeline.snapshot().rows[1]?.setupAtStart).toBe(4);
  expect(reads).toBe(2);
  shown = undefined;
  const future = timeline.begin('future'); future.end();
  expect(timeline.snapshot().rows[3]).not.toHaveProperty('setupAtStart');
});

test('timeline retains first start clocks through nesting, aliases and repeated passes', () => {
  let now = 150;
  const world = {key: 'world', label: 'World', weight: 1, aliases: ['render']};
  const timeline = new LoadingTimeline({id: 'fixture', steps: [
    {key: 'modules', label: 'Modules', weight: 1}, world,
    {key: 'shaders', label: 'Shaders', weight: 1}, repeatedStep(world, 2),
  ]}, 100, () => now);
  const modules = timeline.begin('modules'); now = 200; modules.end();
  now = 250; const first = timeline.begin('render');
  now = 300; const nested = timeline.begin('shaders');
  now = 350; nested.end(); now = 400; first.end();
  now = 450; const second = timeline.begin('world'); now = 470; second.end();
  now = 480; const third = timeline.begin('render'); now = 500; third.end();
  const snapshot = timeline.snapshot();
  expect(snapshot.rows.map(row => [row.key, row.startedAt])).toEqual([
    ['modules', 100], ['world', 250], ['shaders', 300], ['world#2', 450],
  ]);
  expect(snapshot.rows.reduce((sum, row) => sum + row.ms, 0)
    + snapshot.gaps.reduce((sum, gap) => sum + gap.ms, 0)).toBe(400);
});

test('zero-duration steps retain actual equal clocks while future steps stay unknown', () => {
  let now = 10;
  const timeline = new LoadingTimeline({id: 'fixture', steps: ['modules', 'first', 'second', 'future']
    .map(key => ({key, label: key, weight: 1}))}, now, () => now);
  const modules = timeline.begin('modules'); modules.end();
  now = 20;
  const first = timeline.begin('first'); first.end();
  const second = timeline.begin('second'); second.end();
  const rows = timeline.snapshot().rows;
  expect(rows.slice(1, 3).map(row => [row.startedAt, row.ms])).toEqual([[20, 0], [20, 0]]);
  expect(rows[3]).not.toHaveProperty('startedAt');
  const row = rows[1]; if (row === undefined) throw new Error('Missing started row');
  row.startedAt = 999;
  expect(timeline.snapshot().rows[1]?.startedAt).toBe(20);
});
