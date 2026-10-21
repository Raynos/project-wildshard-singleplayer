import { expect, it } from 'vitest';
import { LoadingTimeline } from '../src/engine/boot/timeline';
import { crossingLoadingRows, loadingPath } from '../src/game/boot/loadingPaths';

it('partitions nested stages and gaps into the exact loading wall time', () => {
  let clock = 10;
  const timeline = new LoadingTimeline({ id: 'test', steps: [
    { key: 'modules', label: 'Modules', weight: 1 }, { key: 'world', label: 'World', weight: 1 },
    { key: 'shaders', label: 'Shaders', weight: 1 },
  ] }, 0, () => clock);
  const modules = timeline.begin('modules');
  clock = 20; const world = timeline.begin('world');
  clock = 30; const shaders = timeline.begin('shaders');
  clock = 50; shaders.end();
  clock = 70; world.end();
  clock = 80; modules.end();
  clock = 100;
  const snapshot = timeline.snapshot();
  expect(snapshot.rows.map(row => [row.label, row.ms])).toEqual([['Modules', 30], ['World', 30], ['Shaders', 20]]);
  expect(snapshot.gaps.reduce((sum, row) => sum + row.ms, 0)).toBe(20);
  expect(snapshot.rows.reduce((sum, row) => sum + row.ms, 0) + snapshot.gaps.reduce((sum, row) => sum + row.ms, 0)).toBe(clock);
});

it('uses actual path rows and keeps unnamed work visible', () => {
  const path = loadingPath('grid');
  expect(path.steps.map(row => row.key)).toContain('home');
  expect(path.steps.map(row => row.key)).not.toEqual(expect.arrayContaining(['terrain', 'forest', 'physics']));
  let clock = 0;
  const timeline = new LoadingTimeline(path, 0, () => clock);
  const world = timeline.begin('level.world');
  const ignored = timeline.begin('forest');
  clock = 100; ignored.end(); world.end();
  const unknown = timeline.begin('Unexpected preparation');
  clock = 300; unknown.end();
  expect(timeline.snapshot().rows.find(row => row.key === 'world')?.ms).toBe(100);
  expect(timeline.snapshot().rows.find(row => row.key === 'Unexpected preparation')?.ms).toBe(200);
  expect(loadingPath('legacy').steps.map(row => row.key)).toContain('terrain');
  expect(loadingPath('shardfile', undefined, true).id).toBe('shardfile');
  expect(loadingPath('shardfile', undefined, true).steps.map(row => row.key)).toContain('props');
  expect(loadingPath('crossing').steps.map(row => row.key)).toContain('checkpoint');
});

it('accounts for destination preparation, boundary wait, save, commit and activation separately', () => {
  const rows = crossingLoadingRows({ from: null, to: 'home', requestedAt: 10, readyAt: 30,
    start: 40, checkpointEnd: 42, commitEnd: 44, end: 50 });
  expect(rows.map(row => row.ms)).toEqual([20, 10, 2, 2, 6]);
  expect(rows.reduce((sum, row) => sum + row.ms, 0)).toBe(40);
});

it('carries real unit progress through aliases without granting stage completion', () => {
  const timeline = new LoadingTimeline(loadingPath('grid'), 0, () => 100);
  const stage = timeline.begin('level.world');
  timeline.report('level.world', 'Models 2 / 4', 2, 4);
  expect(timeline.snapshot().rows.find(row => row.key === 'world')).toMatchObject({ fraction: 0.4, state: 'on' });
  timeline.report('level.world', 'Models 1 / 4', 1, 4);
  expect(timeline.snapshot().rows.find(row => row.key === 'world')?.fraction).toBe(0.4);
  stage.end();
  expect(timeline.snapshot().rows.find(row => row.key === 'world')?.state).toBe('ok');
});

it('keeps parallel work counts visible without charging its time twice', () => {
  let clock = 0;
  const timeline = new LoadingTimeline(loadingPath('grid'), clock, () => clock);
  const admission = timeline.begin('admission'), assembly = timeline.begin('assembly');
  clock = 200;
  timeline.report('admission', 'Product schemas 1 / 4', 1, 4);
  const snapshot = timeline.snapshot();
  expect(snapshot.current).toBe('assembly');
  expect(snapshot.rows.find(row => row.key === 'admission')).toMatchObject({ detail: 'Product schemas 1 / 4', fraction: 0.2, ms: 0, state: 'on' });
  expect(snapshot.rows.find(row => row.key === 'assembly')?.ms).toBe(200);
  admission.end(); assembly.end();
  expect(timeline.snapshot().rows.reduce((sum, row) => sum + row.ms, 0)).toBe(200);
});

it('numbers actual starts and gives re-entered admission its own labelled row', () => {
  let clock = 0;
  const timeline = new LoadingTimeline(loadingPath('grid'), 0, () => clock);
  const admission = timeline.begin('admission'); clock = 10; admission.end();
  const home = timeline.begin('home'); clock = 20;
  const resumed = timeline.begin('admission'); clock = 30;
  timeline.report('admission', 'Neighbour schemas 2 / 4', 2, 4);
  const current = timeline.snapshot();
  expect(current.rows.filter(row => row.state !== 'todo').map(row => [row.number, row.key])).toEqual([
    [1, 'modules'], [2, 'admission'], [3, 'home'], [4, 'admission#2'],
  ]);
  expect(current.current).toBe('admission#2');
  expect(current.rows.find(row => row.key === current.current)).toMatchObject({ label: 'Product admission · pass 2', detail: 'Neighbour schemas 2 / 4', ms: 10 });
  expect(current.rows.find(row => row.key === 'admission')).toMatchObject({ state: 'ok', ms: 10 });
  const parallel = timeline.begin('product'); clock = 40; parallel.end();
  expect(timeline.snapshot().current).toBe('admission#2');
  resumed.end(); clock = 50; home.end();
  expect(timeline.snapshot().rows.reduce((sum, row) => sum + row.ms, 0)).toBe(50);
});
