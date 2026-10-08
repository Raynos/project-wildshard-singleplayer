import { expect, it, vi } from 'vitest';
import { gridFloorDocumentIdentity, gridFloorPlans, stageFloorGrid, gridFloorWitnessFailures, driveFloorGrid, type FloorGridState, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';

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

it('drives the Sun entry, authored spawn, road return and reentry with one road seed and terrain walking', () => {
  const sun = { instance: 'sun', slug: 'sunscar-dunes', cell: [-2, 1] as const };
  const plans = gridFloorPlans({ home: 'home', cells: [...cells, sun] }, 'sun-entry');
  expect(plans).toEqual([
    { name: 'sun-road-entry', from: null, to: 'sun', movement: 'road-hover', start: { x: -1110, z: 832.5 },
      waypoints: [{ x: -1110, z: 765 }], requiredResidents: ['sun'] },
    { name: 'sun-authored-spawn', from: 'sun', to: 'sun', movement: 'road-hover',
      waypoints: [{ x: -1110, z: 625 }], requiredResidents: ['sun'] },
    { name: 'sun-road-return', from: 'sun', to: null, movement: 'road-hover',
      waypoints: [{ x: -1110, z: 765 }, { x: -1110, z: 832.5 }], requiredResidents: [] },
    { name: 'sun-reentry', from: null, to: 'sun', movement: 'road-hover',
      waypoints: [{ x: -1110, z: 765 }], requiredResidents: ['sun'] },
  ]);
  expect(() => gridFloorPlans({ home: 'home', cells }, 'sun-entry')).toThrow('requires Signal Dunes');
  expect(gridFloorPlans({ home: 'home', cells: [...cells, sun] }, 'all')).toEqual(gridFloorPlans({ home: 'home', cells }, 'all'));
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
    const staged = stageFloorGrid(plan, performance.timeOrigin).then(value => { complete = true; return value; });
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
    await expect(stageFloorGrid(next, performance.timeOrigin)).rejects.toThrow('expected pine');
    expect(pose).not.toHaveBeenCalled();
    current.live.crossing.phase = 'save-failed'; current.live.crossing.issue = 'quota';
    await expect(stageFloorGrid(first, performance.timeOrigin)).rejects.toThrow('source blocked: quota');
  } finally { restoreGlobals(); }
});

it('waits for a late Safari API in the original document and refuses a changed document before touching its world', async () => {
  const plan = gridFloorPlans({ home: 'home', cells }, 'runtime-travel')[0];
  if (!plan) throw new Error('Missing route fixture');
  const pose = vi.fn(), current = state('home', 0, 230);
  const window: { __wildshard?: object } = {};
  vi.useFakeTimers(); vi.stubGlobal('window', window);
  try {
    let complete = false;
    const staged = stageFloorGrid(plan, performance.timeOrigin).then(value => { complete = true; return value; });
    await vi.advanceTimersByTimeAsync(300);
    expect(complete).toBe(false);
    window.__wildshard = { world: { player: { position: { x: 0, z: 230 } }, game: { app: { input: { clear: vi.fn() } } } },
      pose, shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } };
    await vi.advanceTimersByTimeAsync(100);
    expect((await staged).inside).toBe('home');
    expect(pose).toHaveBeenCalledOnce(); pose.mockClear();
    await expect(stageFloorGrid(plan, performance.timeOrigin - 1)).rejects.toThrow('document changed');
    expect(pose).not.toHaveBeenCalled();
  } finally { restoreGlobals(); vi.useRealTimers(); }
});


it('records Safari origin drift while requiring the original random document token', async () => {
  const plan = gridFloorPlans({ home: 'home', cells }, 'runtime-travel')[0];
  if (!plan) throw new Error('Missing route fixture');
  const current = state('home', 0, 230), pose = vi.fn();
  const page = { __frameFloorGridDocumentToken: undefined as string | undefined,
    __wildshard: { world: { player: { position: { x: 0, z: 230 } }, game: { app: { input: { clear: vi.fn() } } } },
      pose, shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } };
  vi.stubGlobal('window', page);
  try {
    const identity = gridFloorDocumentIdentity();
    expect(identity.token.length).toBeGreaterThan(20);
    expect(gridFloorDocumentIdentity().token).toBe(identity.token);
    for (const drift of [-1000, -2, -1, 0, 1, 2, 1000]) await expect(stageFloorGrid(plan, { ...identity, timeOrigin: performance.timeOrigin + drift })).resolves.toMatchObject({ inside: 'home' });
    expect(Reflect.get(page, '__frameFloorGridOriginDrift')).toMatchObject({ deltaMs: -1000, maximumAbsoluteMs: 1000 });
    page.__frameFloorGridDocumentToken = crypto.randomUUID();
    await expect(stageFloorGrid(plan, identity)).rejects.toThrow('document changed');
    page.__frameFloorGridDocumentToken = undefined;
    await expect(stageFloorGrid(plan, identity)).rejects.toThrow('document changed');
  } finally { restoreGlobals(); }
});


it('fences road departure, same-cell motion and road return without inventing two cell commits', () => {
  const original = witness(), road = state('home', 277.5, 0);
  road.inside = null; road.live.live.current = null; road.live.live.residents = [];
  const incoming: FloorGridWitness = { ...original, plan: { ...original.plan, from: null }, before: road };
  incoming.after.live.live.crossings = 1; incoming.after.live.live.transitions = [{ from: null, to: 'nalati' }];
  expect(gridFloorWitnessFailures(incoming)).toEqual([]);
  const outgoing: FloorGridWitness = { ...original, plan: { ...original.plan, to: null, requiredResidents: [], retiredResidents: ['pine'] }, after: road };
  road.live.live.crossings = 1; road.live.live.transitions = [{ from: 'pine', to: null }];
  expect(gridFloorWitnessFailures(outgoing)).toEqual([]);
  outgoing.after.live.live.current = 'pine';
  expect(gridFloorWitnessFailures(outgoing)).toContain('Destination interior gameplay is not ready');
  const centre = witness(); centre.plan = { ...centre.plan, from: 'nalati' }; centre.before = state('nalati', 325, 0);
  centre.after.live.live.crossings = 0; centre.after.live.live.transitions = [];
  centre.plan.retiredResidents = [];
  expect(gridFloorWitnessFailures(centre)).toEqual([]);
});

it('walks the interior and hovers the road through the same held-input driver, restoring controls on exit', async () => {
  const current = state('pine', 0, 325), input = { clear: vi.fn(), setHeld: vi.fn() };
  let frame: (() => void) | undefined;
  const originalLimit = () => 30;
  const player = { hover: false, hoverSpeedLimit: originalLimit, yaw: 0, setHover: vi.fn((value: boolean) => { player.hover = value; }) };
  const plan = { name: 'walking-soak', from: 'pine', to: null, movement: 'road-hover' as const,
    waypoints: [{ x: 0, z: 277.5 }], requiredResidents: [] };
  vi.stubGlobal('window', { __wildshard: { world: { player, game: { app: { input }, watchFrames: (observer: () => void) => { frame = observer; return vi.fn(); } } },
    shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    const driven = driveFloorGrid(plan, performance.timeOrigin);
    if (!frame) throw new Error('Driver did not subscribe');
    frame(); expect(player.hover).toBe(false); expect(input.setHeld).toHaveBeenCalledWith('move.forward', true);
    current.live.live.current = null; current.inside = null; current.live.live.residents = [];
    current.live.live.worldFeet.z = 277.5;
    frame(); expect(player.hover).toBe(true); frame();
    const drivenResult = await driven;
    expect(drivenResult.after.live.live.current).toBeNull();
    expect(drivenResult.trace[0]?.hover).toBe(false);
    expect(player.hover).toBe(false); expect(player.hoverSpeedLimit).toBe(originalLimit);
  } finally { restoreGlobals(); }
});


it('accepts a borrowed page home only with the matching native level and positive admitted claim', async () => {
  const current = state('home', 0, 230), pose = vi.fn();
  current.live.live.residents = [];
  const page = { __wildshard: { world: { player: { position: { x: 0, z: 230 } }, game: { level: { id: 'driftwood-isle' }, app: { input: { clear: vi.fn() } } } },
    pose, shard: { grid: { state: () => current, residency: () => ({ claims: [], home: { instance: 'home', bytes: 1000 } }) } } } };
  const plan = { name: 'borrowed-road', from: 'home', to: null, borrowedHome: 'home', start: { x: 0, z: 230 }, waypoints: [{ x: 0, z: 277.5 }], requiredResidents: [] };
  vi.stubGlobal('window', page);
  try {
    const staged = await stageFloorGrid(plan, performance.timeOrigin);
    expect(staged.borrowedHome).toEqual({ instance: 'home', bytes: 1000, level: 'driftwood-isle' });
    expect(staged.live.live.residents).toEqual([]);
    current.live.crossing.phase = 'blocked'; current.live.crossing.issue = 'source not proved';
    await expect(stageFloorGrid({ ...plan, borrowedHome: 'pine' }, performance.timeOrigin)).rejects.toThrow('source not proved');
    page.__wildshard.world.game.level.id = 'grid';
    await expect(stageFloorGrid(plan, performance.timeOrigin)).rejects.toThrow('source not proved');
  } finally { restoreGlobals(); }
});

it('grades borrowed source claims without relaxing destination runtime residency', () => {
  const original = witness(), before = state('home', 0, 230);
  before.live.live.residents = [];
  before.borrowedHome = { instance: 'home', bytes: 1000, level: 'driftwood-isle' };
  const row = { ...original, plan: { ...original.plan, from: 'home', borrowedHome: 'home' }, before };
  row.after.live.live.transitions = [{ from: 'home', to: null }, { from: null, to: 'nalati' }];
  expect(gridFloorWitnessFailures(row)).toEqual([]);
  const changes: ((state: FloorGridState) => void)[] = [s => { delete s.borrowedHome; },
    s => { s.borrowedHome = { instance: 'home', bytes: 0, level: 'driftwood-isle' }; },
    s => { s.borrowedHome = { instance: 'pine', bytes: 1000, level: 'driftwood-isle' }; },
    s => { s.borrowedHome = { instance: 'home', bytes: 1000, level: 'grid' }; }];
  for (const change of changes) {
    const changed = { ...before }; change(changed);
    expect(gridFloorWitnessFailures({ ...row, before: changed })).toContain('Source interior gameplay or runtime residency was not ready');
  }
  row.after.live.live.residents = [];
  expect(gridFloorWitnessFailures(row)).toContain('Required runtime residents are missing');
});
