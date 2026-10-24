import { test, expect } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- execute the real serialized reader without a browser or app fixture
import { runInNewContext } from 'node:vm';
import type { FloorGridState } from '../scripts/frame-floor-grid.mjs';
import { gradeTileRetirement, tileRetirementRoute, tileRetirementTracker, readRetirementBoundary, seedTileRetirementHome, type RetirementBoundary } from '../scripts/tile-retirement-proof.mjs';

const state: Pick<FloorGridState, 'home' | 'pitch' | 'cells'> = { home: 'dw', pitch: 562.5, cells: [
  { instance: 'dw', slug: 'driftwood-isle', cell: [0, 0] },
  { instance: 'sky', slug: 'far-reach', cell: [0, -1] },
  { instance: 'pine', slug: 'pine-hollow', cell: [0, 1] },
] };

test('T1 restricts the original road circuit to DW/Sky and preserves its served pitch', () => {
  const route = tileRetirementRoute(state);
  expect(route.plans.map(plan => [plan.from, plan.to])).toEqual([['dw', 'sky'], ['sky', 'dw']]);
  expect(route.reference).toEqual({ x: 0, z: 230 });
  expect(route.plans[0]?.waypoints[0]?.z).toBe(281.25);
  expect(() => tileRetirementRoute({ ...state, home: 'pine' })).toThrow(/owned Driftwood/u);
  expect(() => tileRetirementRoute({ ...state, cells: state.cells.slice(0, 1) })).toThrow(/owned Driftwood/u);
});

test('T1 counts observed claim removals and repeated lifetimes without inventing missed cycles', () => {
  const tracker = tileRetirementTracker();
  tracker.observe(['render:dw:l0/0/0']); tracker.observe(['render:dw:l0/0/0']);
  expect(tracker.result().cycles).toBe(0);
  tracker.observe([]); tracker.observe([]);
  tracker.observe(['render:dw:l0/0/0', 'render:sky:far']); tracker.observe([]);
  expect(tracker.result()).toEqual({ cycles: 3, byKey: { 'render:dw:l0/0/0': 2, 'render:sky:far': 1 } });
  expect(() => tracker.observe(['render:sky:far', 'render:sky:far'])).toThrow(/Invalid/u);
  expect(() => tracker.observe(['sim:dw'])).toThrow(/Invalid/u);
});

function boundary(): RetirementBoundary {
  return { document: 'one-document', current: 'dw', ready: true, controls: true, pending: 0, retiring: 0, tileGhosts: 0, regionGhosts: 0,
    inFlight: 0, queued: 0, x: 0, z: 230, process: { renderer: 400_000_000, gpu: 100_000_000, browser: 60_000_000 } };
}
const proof = () => {
  const errors: string[] = [];
  return { baseline: boundary(), returns: Array.from({ length: 5 }, boundary), cycles: 20, errors };
};

test('T1 grades every round trip against the warm baseline with a strict 20 MB bound', () => {
  const valid = proof(), first = valid.returns[0], second = valid.returns[1], last = valid.returns[4];
  if (first === undefined || second === undefined || last === undefined) throw new Error('Missing fixture boundaries');
  first.process.renderer += 20_000_000;
  second.process.renderer -= 20_000_000;
  expect(gradeTileRetirement(valid).pass).toBe(true);
  last.process.gpu++;
  last.process.renderer += 20_000_000;
  expect(gradeTileRetirement(valid).pass).toBe(false);
});

test('T1 refuses missing trips, ghosts, unfinished work, navigation and incomplete process readings', () => {
  const changes: ((row: ReturnType<typeof mutableBoundary>) => void)[] = [
    row => { row.document = 'other'; }, row => { row.pending = 1; }, row => { row.retiring = 1; }, row => { row.inFlight = 1; },
    row => { row.tileGhosts = 1; }, row => { row.regionGhosts = 1; }, row => { row.ready = false; },
    row => { row.controls = false; }, row => { row.x = 10; }, row => { row.process.gpu = 0; },
  ];
  for (const change of changes) {
    const invalid = proof(), changed = mutableBoundary(); change(changed); invalid.returns[2] = changed;
    expect(gradeTileRetirement(invalid).pass).toBe(false);
  }
  const missing = proof(); missing.returns.pop(); expect(gradeTileRetirement(missing).pass).toBe(false);
  const cycles = proof(); cycles.cycles = 19; expect(gradeTileRetirement(cycles).pass).toBe(false);
  const errored = proof(); errored.errors.push('Runtime fault'); expect(gradeTileRetirement(errored).pass).toBe(false);
});

function mutableBoundary() { return { ...boundary() }; }

test('T1 serialized reader keeps normal crossing pauses separate from settled acceptance', () => {
  const hud = { entered: true, paused: false };
  const live = { current: 'dw', gameplayReady: true, pending: [], retiring: [], ghosts: { count: 0 }, worldFeet: { x: 0, z: 230 } };
  const gridState = { inside: 'dw', live: { live, crossing: { phase: 'idle', issue: null } },
    rings: { ghosts: { count: 0 }, inFlight: 0, queued: 0 } };
  const grid = { state: () => gridState, residency: () => ({ claims: [
    { id: 'render:dw:l0/0/0', category: 'l0' }, { id: 'sim:dw', category: 'sim' },
    { id: 'near:dw', category: 'near' },
  ] }) };
  const context = { performance: { timeOrigin: 1 }, document: { hidden: false },
    window: { __wildshard: { shard: { grid }, world: { hud, game: {
      frameGate: () => !hud.paused, renderer: { getContext: () => ({ isContextLost: () => false }) },
    } } } } };
  const expression = `(${readRetirementBoundary.toString()})({token:'original',timeOrigin:1},()=>({token:'original',timeOrigin:1}))`;
  const read = () => readRetirementBoundaryResult(runInNewContext(expression, context));
  expect(read().keys).toEqual(['render:dw:l0/0/0']); expect(read().controls).toBe(true);
  hud.paused = true; expect(read().controls).toBe(false);
  context.performance.timeOrigin = 2; expect(read).toThrow(/navigated/u);
});

function readRetirementBoundaryResult(value: unknown): { keys: unknown; controls: unknown } {
  if (value === null || typeof value !== 'object' || !('keys' in value) || !('controls' in value))
    throw new Error('Missing serialized boundary');
  return { keys: value.keys, controls: value.controls };
}

test('T1 home seed preserves original ground resolution and applies the existing world origin', async () => {
  const poses: { x: number; z: number; y?: number; yaw: number; pitch: number }[] = [];
  const live = { current: 'dw', gameplayReady: true, worldFeet: { x: 100, z: 500 } };
  const context = { performance: { timeOrigin: 1 }, window: { __wildshard: {
    shard: { grid: { state: () => ({ home: 'dw', inside: 'dw', live: { live } }) } },
    world: { player: { position: { x: 10, z: 20 } } },
    pose: (value: (typeof poses)[number]) => { poses.push(value); return Promise.resolve(); },
  } } };
  const expression = `(${seedTileRetirementHome.toString()})({x:120,z:710},{token:'original',timeOrigin:1},()=>({token:'original',timeOrigin:1}))`;
  await runInNewContext(expression, context);
  expect(poses).toEqual([{ x: 30, z: 230, yaw: 0, pitch: -0.08 }]);
  expect(poses.every(pose => !Object.hasOwn(pose, 'y'))).toBe(true);
  live.current = 'other'; await expect(runInNewContext(expression, context)).rejects.toThrow(/original ready home/u);
});
