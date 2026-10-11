import { expect, it, vi } from 'vitest';
import { gridFloorDocumentIdentity, gridFloorPlans, selectFloorGridPlans, stageFloorGrid, gridFloorWitnessFailures, driveFloorGrid, type FloorGridState, type FloorGridWitness } from '../scripts/frame-floor-grid.mjs';

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

it('covers every milestone road entry and home re-entry without counting a missing cell as a visit', () => {
  const full = [...cells, { instance: 'nine', slug: 'nine-dragon-stack', cell: [1, -1] as const },
    { instance: 'sky', slug: 'far-reach', cell: [0, -1] as const },
    { instance: 'sun', slug: 'sunscar-dunes', cell: [-1, 0] as const }];
  const plans = gridFloorPlans({ home: 'home', cells: full }, 'milestone');
  expect(plans.slice(0, 2)).toEqual(gridFloorPlans({ home: 'home', cells: full }, 'template'));
  expect(plans.slice(2).map(plan => plan.to)).toEqual(['nine', 'sky', 'nalati', 'pine', 'sun', 'home']);
  for (const plan of plans.slice(2)) {
    expect(plan).toMatchObject({ from: null, finishOnArrival: false, requiredResidents: [plan.to] });
    expect(plan.start).toBeDefined();
    expect(plan.waypoints).toHaveLength(1);
  }
  expect(plans.at(-1)).toMatchObject({ start: { x: 0, z: 277.5 }, waypoints: [{ x: 0, z: 210 }] });
  expect(() => gridFloorPlans({ home: 'home', cells }, 'milestone')).toThrow('requires nine-dragon-stack');
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

it('stages a cold owned home on solid road and uses the real driver before accepting entered hooks', async () => {
  const plan = gridFloorPlans({ home: 'home', cells }, 'runtime-travel')[0];
  if (plan === undefined) throw new Error('Missing route fixture');
  const current = state('home', 0, 277.5);
  current.live.live.current = null; current.inside = null; current.live.live.residents = [];
  const pose = vi.fn(), clear = vi.fn();
  let finishApproach: (value: FloorGridWitness) => void = () => undefined;
  const drive = vi.fn(() => new Promise<FloorGridWitness>(resolve => { finishApproach = resolve; }));
  vi.useFakeTimers();
  vi.stubGlobal('window', { __wildshard: { world: { player: { position: { x: 0, z: 277.5 } }, game: { app: { input: { clear } } } },
    pose, shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    let complete = false;
    const staged = stageFloorGrid(plan, performance.timeOrigin, drive).then(value => { complete = true; return value; });
    await vi.advanceTimersByTimeAsync(100);
    expect(pose).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 0.55, z: 277.5, yaw: 0, pitch: -0.08 });
    expect(drive).toHaveBeenCalledExactlyOnceWith({ name: `${plan.name}-source`, from: null, to: 'home', movement: 'road-hover',
      waypoints: [{ x: 0, z: 230 }], requiredResidents: ['home'] }, performance.timeOrigin);
    expect(complete).toBe(false);
    current.live.live.current = 'home'; current.live.live.residents = ['home'];
    await vi.advanceTimersByTimeAsync(100);
    expect(complete).toBe(false);
    current.inside = 'home'; current.live.live.gameplayReady = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(complete).toBe(false);
    current.live.live.gameplayReady = true;
    finishApproach(witness());
    await vi.advanceTimersByTimeAsync(100);
    expect((await staged).live.live.residents).toEqual(['home']);
    expect(clear).toHaveBeenCalledOnce();
  } finally { restoreGlobals(); vi.useRealTimers(); }
});

it('refuses a cold-source shortcut and a driver that returns without actual entered residency', async () => {
  const plan = { name: 'cold-nalati', from: 'nalati', to: null, start: { x: 325, z: 0 }, waypoints: [], requiredResidents: [] };
  const current = state('home', 277.5, 0); current.live.live.current = null; current.inside = null; current.live.live.residents = [];
  const pose = vi.fn();
  vi.stubGlobal('window', { __wildshard: { world: { player: { position: { x: 77.5, z: 0 } }, game: { app: { input: { clear: vi.fn() } } } },
    pose, shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    await expect(stageFloorGrid(plan, performance.timeOrigin)).rejects.toThrow('cold source needs the real road driver');
    expect(pose).not.toHaveBeenCalled();
    const drive = vi.fn(() => Promise.resolve(witness()));
    await expect(stageFloorGrid(plan, performance.timeOrigin, drive)).rejects.toThrow('source nalati is not an entered ready resident');
    expect(pose).toHaveBeenCalledExactlyOnceWith({ x: 77.5, y: 0.55, z: 0, yaw: 0, pitch: -0.08 });
    expect(drive).toHaveBeenCalledExactlyOnceWith({ name: 'cold-nalati-source', from: null, to: 'nalati', movement: 'road-hover',
      waypoints: [{ x: 325, z: 0 }], requiredResidents: ['nalati'] }, performance.timeOrigin);
  } finally { restoreGlobals(); }
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

it('enters any named cell from the road at its home-side edge with one road seed (op-frame22)', () => {
  const corner = { instance: 'corner', slug: 'corner-shard', cell: [1, -1] as const };
  expect(gridFloorPlans({ home: 'home', cells: [...cells, corner] }, 'cell', { cell: 'corner-shard' })).toEqual([
    { name: 'corner-shard-road-entry', from: null, to: 'corner', movement: 'road-hover', start: { x: 555, z: -277.5 },
      waypoints: [{ x: 555, z: -345 }], requiredResidents: ['corner'], finishOnArrival: false },
  ]);
  expect(gridFloorPlans({ home: 'home', cells }, 'cell', { cell: 'nalati-grasslands' })[0]).toMatchObject({ start: { x: 277.5, z: 0 }, waypoints: [{ x: 345, z: 0 }] });
  expect(() => gridFloorPlans({ home: 'home', cells }, 'cell', { cell: 'corner-shard' })).toThrow('--devserver');
  expect(() => gridFloorPlans({ home: 'home', cells }, 'cell', { cell: 'driftwood-isle' })).toThrow('non-home');
  expect(gridFloorPlans({ home: 'home', cells: [...cells, corner] }, 'all')).toEqual(gridFloorPlans({ home: 'home', cells }, 'all'));
});


it('stages the first road seed from an entered home after standing probes and waits for the real leave', async () => {
  const plan = gridFloorPlans({ home: 'home', cells }, 'cell', { cell: 'pine-hollow' })[0];
  if (!plan) throw new Error('Missing cell route fixture');
  const current = state('home', 277.5, 0), pose = vi.fn();
  vi.useFakeTimers();
  vi.stubGlobal('window', { __wildshard: { world: { player: { position: { x: 277.5, z: 0 } },
    game: { app: { input: { clear: vi.fn() } } } }, pose,
    shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    let complete = false;
    const staged = stageFloorGrid(plan, performance.timeOrigin).then(value => { complete = true; return value; });
    await vi.advanceTimersByTimeAsync(100);
    expect(pose).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 0.55, z: 277.5, yaw: 0, pitch: -0.08 });
    expect(complete).toBe(false);
    current.live.live.current = null;
    await vi.advanceTimersByTimeAsync(100); expect(complete).toBe(false);
    current.inside = null; current.live.live.gameplayReady = false;
    await vi.advanceTimersByTimeAsync(100); expect(complete).toBe(false);
    current.live.live.gameplayReady = true;
    await vi.advanceTimersByTimeAsync(100);
    expect((await staged).inside).toBeNull();
    current.live.live.current = 'home'; current.inside = 'home';
    pose.mockClear();
    await expect(stageFloorGrid({ name: plan.name, from: plan.from, to: plan.to, waypoints: plan.waypoints, requiredResidents: plan.requiredResidents }, performance.timeOrigin)).rejects.toThrow('expected null');
    expect(pose).not.toHaveBeenCalled();
    current.live.crossing = { phase: 'save-failed', issue: 'disk full' };
    await expect(stageFloorGrid(plan, performance.timeOrigin)).rejects.toThrow('source blocked: disk full');
  } finally { restoreGlobals(); vi.useRealTimers(); }
});

it('selects a diagnostic cohort without weakening its exact plans or silently omitting requests', () => {
  const plans = gridFloorPlans({ home: 'home', cells }, 'template');
  expect(selectFloorGridPlans(plans)).toBe(plans);
  expect(selectFloorGridPlans(plans, ['template-return', 'template-interior'])).toEqual(plans);
  expect(selectFloorGridPlans(plans, ['template-return'])).toEqual([plans[1]]);
  expect(() => selectFloorGridPlans(plans, ['missing'])).toThrow('Missing requested');
  expect(() => selectFloorGridPlans(plans, ['template-return', 'template-return'])).toThrow('Duplicate requested');
});


it('observes preparation while driving from the crossroads through the actual midpoint turn-in', () => {
  const [normal] = gridFloorPlans({ home: 'home', cells }, 'cell', { cell: 'nalati-grasslands', roadApproach: true });
  expect(normal).toMatchObject({ start: { x: 277.5, z: 277.5 }, waypoints: [{ x: 277.5, z: 0 }, { x: 345, z: 0 }], observePreparation: true, hoverMaxSpeed: 30, finishOnArrival: false });
  const [edge] = gridFloorPlans({ home: 'home', cells }, 'cell', { cell: 'nalati-grasslands' });
  expect(edge?.start).toEqual({ x: 277.5, z: 0 });
  expect(edge?.observePreparation).toBeUndefined();
  expect(edge?.hoverMaxSpeed).toBeUndefined();
  expect(edge?.finishOnArrival).toBe(false);
});

it('names the socket-only metric separately and preserves the full interior itinerary', () => {
  const sky = { instance: 'sky', slug: 'far-reach', cell: [0, -1] as const };
  const full = gridFloorPlans({ home: 'home', cells: [...cells, sky] }, 'cell', { cell: 'far-reach' })[0];
  const socket = gridFloorPlans({ home: 'home', cells: [...cells, sky] }, 'cell', { cell: 'far-reach', entrySocket: true })[0];
  expect(full).toMatchObject({ name: 'far-reach-road-entry', waypoints: [{ x: 0, z: -345 }], finishOnArrival: false });
  expect(socket).toMatchObject({ name: 'far-reach-socket-entry', waypoints: [{ x: 0, z: -312.5 }],
    start: { x: 0, z: -277.5 }, requiredResidents: ['sky'], finishOnArrival: false });
  const corner = { instance: 'corner', slug: 'corner', cell: [1, -1] as const };
  expect(gridFloorPlans({ home: 'home', cells: [...cells, corner] }, 'cell', { cell: 'corner', entrySocket: true })[0])
    .toMatchObject({ name: 'corner-socket-entry', waypoints: [{ x: 555, z: -312.5 }] });
});

it('counts actual unready-edge motor blockage on every drawn frame, independently of sparse trace samples', async () => {
  const current = state('home', 277.5, 0);
  current.live.live.current = null; current.inside = null; current.live.live.residents = []; current.live.live.pending = ['nalati'];
  let now = 100, frame: (() => void) | undefined;
  const timing = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const input = { clear: vi.fn(), setHeld: vi.fn() };
  const player = { hover: false, hoverSpeedLimit: () => 30, setHover(on: boolean) { this.hover = on; },
    motor: { result: { horizontalFreedom: 0 } } };
  const plan = { name: 'cold-arrival', from: null, to: 'nalati', movement: 'road-hover' as const,
    waypoints: [{ x: 345, z: 0 }], requiredResidents: ['nalati'], observePreparation: true };
  vi.stubGlobal('window', { __wildshard: { world: { player, game: { app: { input }, rootScene: { getObjectByName: () => ({ visible: false }) },
    watchFrames: (observer: () => void) => { frame = observer; return vi.fn(); } } },
    shard: { grid: { state: () => current, residency: () => ({ claims: [] }) } } } });
  try {
    const driven = driveFloorGrid(plan, performance.timeOrigin);
    if (frame === undefined) throw new Error('Missing drawn-frame observer');
    now = 133; frame(); // Still on the boulevard: no arrival blockage.
    current.live.live.worldFeet.x = 298.3;
    now = 166; frame(); now = 200; frame();
    current.live.live.residents = ['nalati']; current.live.live.pending = [];
    player.motor.result.horizontalFreedom = 1; current.live.live.worldFeet.x = 310;
    now = 233; frame();
    current.live.live.current = 'nalati'; current.inside = 'nalati'; current.live.live.worldFeet.x = 345;
    now = 266; frame(); now = 300; frame();
    const result = await driven;
    expect(result.arrival).toEqual({ blockedFrames: 2, blockedMs: 67, visibleBeforeReadyFrames: 0 });
    expect(result.trace).toHaveLength(1); // The quarter-second trace alone would have missed both blocked frames.
  } finally { timing.mockRestore(); restoreGlobals(); }
});


it('selects an exact template instance without silently measuring the first copy', () => {
  const copies = [...cells, { instance: 'template-2', slug: '_template', cell: [1, -1] as const }];
  const [copy] = gridFloorPlans({ home: 'home', cells: copies }, 'cell', { cell: 'template-2', roadApproach: true });
  expect(copy).toMatchObject({ to: 'template-2', start: { x: 832.5, z: -277.5 },
    waypoints: [{ x: 555, z: -277.5 }, { x: 555, z: -345 }], requiredResidents: ['template-2'] });
  expect(gridFloorPlans({ home: 'home', cells: copies }, 'cell', { cell: '_template' })[0]?.to).toBe('template-1');
});


it('measures the declared lift after an independently witnessed socket entry without seeding the rider', () => {
  const sky = { instance: 'sky', slug: 'far-reach', cell: [1, 1] as const };
  const plans = gridFloorPlans({ home: 'home', cells: [...cells, sky] }, 'cell', { cell: 'sky', risingIslet: 'north', roadApproach: true });
  expect(plans).toEqual([
    { name: 'far-reach-socket-entry', from: null, to: 'sky', movement: 'road-hover', start: { x: 832.5, z: 832.5 },
      waypoints: [{ x: 555, z: 832.5 }, { x: 555, z: 797.5 }], requiredResidents: ['sky'], finishOnArrival: false,
      observePreparation: true, hoverMaxSpeed: 30 },
    { name: 'far-reach-north-lift', from: 'sky', to: 'sky', movement: 'road-hover', waypoints: [], requiredResidents: ['sky'],
      authoredLift: { probe: 'farReach', edge: 'north' } },
  ]);
  expect(plans[1]?.start).toBeUndefined();
});

it('presses the real USE once, waits for the moving deck and grounded rider, then walks the authored bridge', async () => {
  const current = state('sky', 0, -545);
  current.cells = [...cells, { instance: 'sky', slug: 'far-reach', cell: [0, -1] }];
  const input = { clear: vi.fn(), setHeld: vi.fn(), press: vi.fn() }, oldLimit = () => 30;
  const player = { hover: false, onGround: true, hoverSpeedLimit: oldLimit, yaw: 0,
    setHover: (on: boolean) => { player.hover = on; } };
  const deck = { x: 0, y: 0, z: 5 };
  const authored = { edge: 'north', board: [{ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 5 }],
    rest: { x: 0, y: 0, z: 5 }, dock: { x: 0, y: 25, z: 5 }, isle: { id: 'actual-island', x: 0, y: 30, z: -30 },
    climb: [{ x: 0, y: 25, z: 5 }, { x: 0, y: 25, z: -10 }, { x: 0, y: 30, z: -30 }] };
  let frame: (() => void) | undefined;
  const stop = vi.fn(), isletAt = vi.fn(() => deck);
  vi.stubGlobal('window', { __wildshard: { world: { player, game: { app: { input }, watchFrames: (run: () => void) => { frame = run; return stop; } } },
    shard: { grid: { state: () => current, residency: () => ({ claims: [] }) }, farReach: { islets: [authored], isletAt } } } });
  const plan = { name: 'authored-lift', from: 'sky', to: 'sky', movement: 'road-hover' as const,
    waypoints: [], requiredResidents: ['sky'], authoredLift: { probe: 'farReach', edge: 'north' as const } };
  try {
    const driven = driveFloorGrid(plan, performance.timeOrigin);
    if (!frame) throw new Error('Driver did not subscribe');
    frame(); current.live.live.worldFeet.z = -550; frame();
    expect(input.press).toHaveBeenCalledExactlyOnceWith('use');
    frame(); expect(input.setHeld).toHaveBeenLastCalledWith('move.forward', false);
    deck.y = 25; deck.z = 5;
    // A docked mover alone is insufficient: the actual rider must have reached it, standing on it.
    frame(); expect(input.press).toHaveBeenCalledOnce();
    current.live.live.worldFeet.y = 25.3; current.live.live.worldFeet.z = -550; player.onGround = false;
    frame(); expect(input.setHeld).toHaveBeenLastCalledWith('move.forward', false);
    player.onGround = true; frame(); frame();
    expect(input.setHeld).toHaveBeenLastCalledWith('move.forward', true);
    current.live.live.worldFeet.z = -565; frame(); frame();
    current.live.live.worldFeet.z = -585; current.live.live.worldFeet.y = 30.3; frame(); frame();
    const result = await driven;
    expect(result.lift).toMatchObject({ usePresses: 1, docked: true, onIsland: true, isle: 'actual-island' });
    expect(isletAt).toHaveBeenCalledWith('north');
    expect(stop).toHaveBeenCalledOnce(); expect(player.hoverSpeedLimit).toBe(oldLimit); expect(player.hover).toBe(false);
    expect(gridFloorWitnessFailures(result)).toEqual([]);
    const socketOnly = { ...result }; delete socketOnly.lift;
    expect(gridFloorWitnessFailures(socketOnly)).toContain('Authored lift was not boarded, ridden and walked onto the island');
    expect(gridFloorWitnessFailures({ ...result, lift: { edge: 'north', isle: 'actual-island', usePresses: 1, docked: false,
      onIsland: true, rideSamples: 1, maximumDeckGap: 0 } })).toContain('Authored lift was not boarded, ridden and walked onto the island');
  } finally { restoreGlobals(); }
});
