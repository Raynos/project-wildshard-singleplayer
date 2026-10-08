import { expect, it, vi } from 'vitest';
import { gridFloorPlans, stageFloorGrid, gridFloorWitnessFailures, type FloorGridState, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';

const originalStorage = localStorage, originalLocation = location;
function restoreGlobals(): void {
  vi.unstubAllGlobals(); vi.stubGlobal('localStorage', originalStorage); vi.stubGlobal('location', originalLocation);
}

const cells = [{ instance: 'home', slug: 'driftwood-isle', cell: [0, 0] as const },
  { instance: 'template-1', slug: '_template', cell: [-1, -1] as const },
  { instance: 'pine', slug: 'pine-hollow', cell: [0, 1] as const },
  { instance: 'nalati', slug: 'nalati-grasslands', cell: [1, 0] as const }];
const state = (current: string, x: number, z: number): FloorGridState => ({ home: 'home', cells, inside: current, claims: [],
  live: { crossing: { phase: 'idle', issue: null }, live: { current, worldFeet: { x, y: 0.55, z }, crossings: 0,
    transitions: [], residents: [current], gameplayReady: true } } });

it('routes a corner template through midpoint entrances and returns over the same road without another pose seed', () => {
  const [out, back] = gridFloorPlans({ home: 'home', cells }, 'template');
  expect(out).toMatchObject({ start: { x: 0, z: -230 }, waypoints: [{ x: 0, z: -277.5 },
    { x: -277.5, z: -277.5 }, { x: -277.5, z: -555 }, { x: -325, z: -555 }] });
  expect(back?.waypoints).toEqual([{ x: -277.5, z: -555 }, { x: -277.5, z: -277.5 }, { x: 0, z: -277.5 }, { x: 0, z: -230 }]);
  expect(back?.start).toBeUndefined();
});

it('requires the entered runtime resident and the prior owned runtime retired under G226', () => {
  const [pine, nalati] = gridFloorPlans({ home: 'home', cells }, 'runtime-travel');
  expect(pine?.requiredResidents).toEqual(['pine']);
  expect(pine?.retiredResidents).toEqual(['home']);
  expect(nalati?.requiredResidents).toEqual(['nalati']);
  expect(nalati?.retiredResidents).toEqual(['pine']);
  expect(nalati?.waypoints).toEqual([{ x: 0, z: 277.5 }, { x: 277.5, z: 277.5 }, { x: 277.5, z: 0 }, { x: 325, z: 0 }]);
  expect(nalati?.start).toBeUndefined();
  expect(gridFloorPlans({ home: 'home', cells }, 'baseline')).toEqual([]);
  expect(() => gridFloorPlans({ home: 'home', cells: cells.slice(0, 2) }, 'runtime-travel')).toThrow('Pine and Nalati');
});

function witness(): FloorGridWitness {
  const plan = gridFloorPlans({ home: 'home', cells }, 'runtime-travel')[1];
  if (plan === undefined) throw new Error('Missing route fixture');
  const before = state('pine', 0, 325), after = state('nalati', 325, 0);
  after.live.live.crossings = 2; after.live.live.transitions = [{ from: 'pine', to: null }, { from: null, to: 'nalati' }];
  after.live.live.residents = ['nalati'];
  return { plan, before, after, elapsedSeconds: 50, trace: [{ seconds: 25, x: 277.5, y: 0.55, z: 277.5, current: null, gameplayReady: true }] };
}

it('requires frame commits, interior gameplay, residency and a finite above-ground route in addition to frame cadence', () => {
  expect(gridFloorWitnessFailures(witness())).toEqual([]);
  const changes: ((row: FloorGridWitness) => void)[] = [
    row => { row.before.live.live.current = null; },
    row => { row.before.inside = null; },
    row => { row.before.live.live.gameplayReady = false; },
    row => { row.before.live.live.residents = []; },
    row => { row.after.live.live.crossings = 0; },
    row => { row.after.live.live.transitions.reverse(); },
    row => { row.after.inside = null; },
    row => { row.after.live.live.gameplayReady = false; },
    row => { row.after.live.live.residents = []; },
    row => { row.after.live.live.residents = ['pine', 'nalati']; },
    row => { row.after.claims = [{ id: 'sim-basis:pine', category: 'sim', owner: 'pine' }]; },
    row => { delete row.after.claims; },
    row => { row.after.live.live.worldFeet.x = 805; },
    row => { row.trace = []; },
    row => { row.trace[0] = { seconds: 1, x: Number.NaN, y: 0, z: 0, current: null, gameplayReady: true }; },
    row => { row.trace[0] = { seconds: 1, x: 0, y: -1, z: 0, current: null, gameplayReady: true }; },
  ];
  for (const change of changes) { const row = witness(); change(row); expect(gridFloorWitnessFailures(row).length).toBeGreaterThan(0); }
  const prefetched = witness(); prefetched.after.claims = [{ id: 'product:pine', category: 'product', owner: 'pine' }];
  expect(gridFloorWitnessFailures(prefetched)).toEqual([]);
});

it('stages the owned home from the neutral shell and waits for resident, interior and entered hooks before motion', async () => {
  const plan = gridFloorPlans({ home: 'home', cells }, 'runtime-travel')[0];
  if (plan === undefined) throw new Error('Missing route fixture');
  const current = state('home', 0, 277.5);
  current.live.live.current = null; current.inside = null; current.live.live.residents = [];
  const pose = vi.fn(), clear = vi.fn();
  vi.useFakeTimers();
  vi.stubGlobal('window', { __wildshard: { world: { player: { position: { x: 0, z: 277.5 } }, game: { app: { input: { clear } } } },
    pose, shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    let complete = false;
    const staged = stageFloorGrid(plan).then(value => { complete = true; return value; });
    await vi.advanceTimersByTimeAsync(100);
    expect(pose).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 0.55, z: 230, yaw: 0, pitch: -0.08 });
    expect(complete).toBe(false);
    current.live.live.current = 'home'; current.live.live.residents = ['home'];
    await vi.advanceTimersByTimeAsync(100);
    expect(complete).toBe(false);
    current.inside = 'home'; current.live.live.gameplayReady = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(complete).toBe(false);
    current.live.live.gameplayReady = true;
    await vi.advanceTimersByTimeAsync(100);
    expect((await staged).live.live.residents).toEqual(['home']);
    expect(clear).toHaveBeenCalledOnce();
  } finally { restoreGlobals(); vi.useRealTimers(); }
});

it('never seeds a later leg to hide a missing source or bypasses failed durability during initial admission', async () => {
  const [first, next] = gridFloorPlans({ home: 'home', cells }, 'runtime-travel');
  if (first === undefined || next === undefined) throw new Error('Missing route fixture');
  const current = state('home', 0, 277.5); current.live.live.current = null; current.inside = null;
  const pose = vi.fn();
  vi.stubGlobal('window', { __wildshard: { world: { player: { position: { x: 0, z: 277.5 } }, game: { app: { input: { clear: vi.fn() } } } },
    pose, shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    await expect(stageFloorGrid(next)).rejects.toThrow('expected pine');
    expect(pose).not.toHaveBeenCalled();
    current.live.crossing.phase = 'save-failed'; current.live.crossing.issue = 'quota';
    await expect(stageFloorGrid(first)).rejects.toThrow('source blocked: quota');
  } finally { restoreGlobals(); }
});
