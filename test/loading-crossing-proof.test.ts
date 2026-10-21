import { afterEach, expect, it, vi } from 'vitest';
import { installCrossingProbe, crossingReport } from '../scripts/loading-benchmark/crossing.mjs';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  vi.restoreAllMocks();
  if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
  else Object.defineProperty(globalThis, 'window', originalWindow);
});

it('requires both transfers and complete phase sums', () => {
  const timing = { requestedAt: 0, readyAt: 100, start: 200, checkpointEnd: 210, commitEnd: 220, end: 230 };
  const rows = ['prepare', 'boundary', 'checkpoint', 'commit', 'activate'].map((key, i) => ({
    key, label: key, ms: [100, 100, 10, 10, 10][i] ?? 0,
  }));
  const good = { done: true, errors: [], timings: [{ ...timing, from: 'home', to: null },
    { ...timing, from: null, to: 'home' }], rows: [rows, rows] };
  expect(crossingReport(good).failures).toEqual([]);
  expect(crossingReport({ ...good, timings: good.timings.slice(0, 1) }).failures.length).toBeGreaterThan(0);
  expect(crossingReport({ ...good, rows: [rows.slice(1), rows] }).failures).toContain('Missing labelled crossing phase');
  expect(crossingReport({ ...good, rows: [rows.map(row => ({ ...row, ms: row.ms + 10 })), rows] }).failures).toContain('Crossing phase sum differs from wall time');
});

it('keeps normal hover on both legs until an actual home re-entry', () => {
  let frame: (() => void) | undefined, now = 0, cleared = false;
  const hover: boolean[] = [], held: boolean[] = [];
  const live = { live: { current: 'home' as string | null, gameplayReady: true,
    worldFeet: { x: 0, y: 1, z: -194 }, issues: {} }, crossing: {}, crossingTiming: [], crossingLoading: [] };
  const grid = { home: 'home', cells: [{ instance: 'home', cell: [0, 0] }], live, inside: 'home' as string | null };
  const api = { shard: { grid: { state: () => grid } }, world: {
    game: { watchFrames: (observe: () => void) => { frame = observe; return () => { frame = undefined; }; },
      app: { input: { setHeld: (_key: string, down: boolean) => { held.push(down); }, clear: () => { cleared = true; } } } },
    player: { yaw: 0, setHover: (on: boolean) => { hover.push(on); } },
  } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __wildshard: api } });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  installCrossingProbe();
  const tick = (): void => { if (frame === undefined) throw new Error('Missing frame observer'); frame(); };
  tick();
  live.live.current = null; grid.inside = null; now = 100;
  tick();
  expect(hover).toEqual([true, true]);
  expect(cleared).toBe(false);
  live.live.current = 'home'; grid.inside = 'home'; now = 200;
  tick();
  expect(hover).toEqual([true, true, false]);
  expect(held).toEqual([true, true]);
  expect(cleared).toBe(true);
  expect(frame).toBeUndefined();
});
