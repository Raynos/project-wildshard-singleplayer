import { expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { TileDriver, tileKeys, residentTiles, followResidentTiles } from './tileDriver';
import type { TileContent } from './tileContent';
import { tileOrder } from './tileOrder';
import { noteFrameDrawn, setBuildHeld } from '@wildshard/engine/core/framePacing';

// Tile streaming T4: an entered region's per-tile content follows the player. A made-up content with something in every
// tile records each attach and each tile scope's end.
function content(failing?: number): TileContent & { attached: Map<string, Scope> } {
  const attached = new Map<string, Scope>(), all = new Set(Array.from({ length: 64 }, (_, k) => k));
  return { id: 'made-up', attached, tiles: () => all,
    attach: (tile, scope) => { if (tile === failing) return Promise.reject(new Error('broken tile')); attached.set(`r${String(tile)}`, scope); scope.onDispose(() => { attached.delete(`r${String(tile)}`); }); return Promise.resolve(); },
    attachColliders: (tile, scope) => { attached.set(`c${String(tile)}`, scope); scope.onDispose(() => { attached.delete(`c${String(tile)}`); }); return Promise.resolve(); } };
}
const settle = async (driver: TileDriver, x: number, z: number, frames: number): Promise<void> => {
  for (let i = 0; i < frames; i++) { driver.step(x, z); await Promise.resolve(); await Promise.resolve(); }
};

test('the rank-0 tiles attach before controls, then the 5 x 5 fills nearest first and follows the player', async () => {
  const scope = new Scope('tiles'), made = content(), radius = { value: 2 };
  const driver = new TileDriver(scope, [made], () => radius.value, () => Promise.resolve());
  try {
    const order = tileOrder({ x: 0, z: -194 }, [{ at: [0, 0, 250], width: 8 }, { at: [250, 0, 0], width: 8 }, { at: [0, 0, -250], width: 8 }, { at: [-250, 0, 0], width: 8 }]);
    const rank0 = tileKeys(order.tiles.filter(tile => order.rank(tile) === 0));
    await driver.require(rank0);
    expect([...driver.resident('render')].sort((a, b) => a - b)).toEqual([...rank0].sort((a, b) => a - b));
    // the player at the spawn (tile 4, 0): the 5 x 5 clipped to the cell is 5 x 3 = 15 render tiles, colliders the 3 x 2
    await settle(driver, 0, -194, 80);
    expect(driver.resident('render').size).toBe(15); expect(driver.resident('colliders').size).toBe(6);
    // walking three tiles north (off the column edge, past the hysteresis): row 0 leaves (its scopes end), rows 4-5 come in
    await settle(driver, 10, -30, 80);
    expect(driver.resident('render').size).toBe(25); expect(driver.resident('render').has(4)).toBe(false);
    expect(made.attached.has('r4')).toBe(false); expect(made.attached.has('c4')).toBe(false);
    // T10 retires the old whole-cell override; the current residents stay owned.
    radius.value = 8;
    expect(() => driver.step(10, -30)).toThrow('0, 1 or 2');
    expect(driver.resident('render').size).toBe(25);
  } finally { scope.dispose(); }
  expect(made.attached.size).toBe(0);
});

test('a tile that fails to attach stays out and is not retried', async () => {
  const scope = new Scope('tiles'), made = content(28);
  const driver = new TileDriver(scope, [made], () => 1, () => Promise.resolve());
  const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
  try {
    await settle(driver, -40, -40, 40);
    expect(driver.resident('render').has(28)).toBe(false); expect(driver.resident('render').size).toBe(8);
    expect(warned).toBe(1);
  } finally { console.warn = warn; scope.dispose(); }
});

test.each(['render', 'colliders'] as const)('a cancelled %s preparation can attach when the player returns', async layer => {
  const scope = new Scope('tiles'), made = content(), key = 28;
  let refuse = (_error: Error): void => { throw new Error('Preparation not started'); };
  let started = (): void => { throw new Error('Missing start witness'); };
  const waiting = new Promise<void>(resolve => { started = resolve; });
  let attempts = 0;
  const attach = layer === 'render' ? made.attach : made.attachColliders;
  if (attach === undefined) throw new Error('Missing fixture attachment');
  const prepare = (tile: number, owner: Scope): Promise<void> => {
    if (tile !== key || ++attempts > 1) return attach(tile, owner);
    started();
    return new Promise<void>((_resolve, reject) => { refuse = reject; });
  };
  const driver = new TileDriver(scope, [{ ...made, ...(layer === 'render' ? { attach: prepare } : { attachColliders: prepare }) }],
    () => 1, () => Promise.resolve());
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const pending = driver.require([key]);
    await waiting;
    // A sliced placer checks its tile owner after yielding and rejects when
    // movement has already retired it. That is cancellation, not bad content.
    driver.step(200, 200);
    refuse(new Error('Scene placement owner is disposed'));
    await pending;
    await settle(driver, -40, -40, 80);
    expect(driver.resident(layer).has(key)).toBe(true);
    expect(attempts).toBe(2);
    expect(made.attached.has(`${layer === 'render' ? 'r' : 'c'}${key}`)).toBe(true);
    expect(warning).not.toHaveBeenCalled();
  } finally { warning.mockRestore(); scope.dispose(); }
});


test.each(['render', 'colliders'] as const)('a required %s failure refuses boot before later tiles', async layer => {
  const scope = new Scope('required-tiles'), made = content(), failure = new Error('required tile failed');
  const visited: number[] = [];
  const fail = (key: number): Promise<void> => { visited.push(key); return Promise.reject(failure); };
  const driver = new TileDriver(scope, [{ ...made, ...(layer === 'render' ? { attach: fail } : { attachColliders: fail }) }],
    () => 1, () => Promise.resolve());
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    await expect(driver.require([28, 29])).rejects.toBe(failure);
    expect(visited).toEqual([28]);
    expect(driver.resident(layer).size).toBe(0);
  } finally { warning.mockRestore(); scope.dispose(); }
});

function gate(): { promise: Promise<void>; release: () => void } {
  let release = (): void => { throw new Error('Gate not initialized'); };
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('resident boot callers share pending tiles and coarse readiness before publication', async () => {
  const scope = new Scope('resident-tiles'), made = content(), started = gate(), tile = gate(), coarse = gate(), coarseStarted = gate();
  let prepares = 0;
  const source: TileContent = { ...made, attach: async (key, owner) => {
    prepares++;
    if (prepares === 1) { started.release(); await tile.promise; }
    await made.attach(key, owner);
  }, coarse: () => { coarseStarted.release(); return coarse.promise; } };
  const first = residentTiles(scope, [source], { x: 0, z: 0 }, []);
  try {
    await started.promise;
    const second = residentTiles(scope, [source], { x: 0, z: 0 }, []);
    let ready = false;
    void second.then(() => { ready = true; return undefined; });
    await Promise.resolve();
    expect(ready).toBe(false);
    expect(followResidentTiles(scope, () => ({ x: 0, z: 0 }))).toBeNull();
    tile.release(); await coarseStarted.promise;
    expect(ready).toBe(false);
    expect(followResidentTiles(scope, () => ({ x: 0, z: 0 }))).toBeNull();
    coarse.release(); await Promise.all([first, second]);
    expect(followResidentTiles(scope, () => ({ x: 0, z: 0 }))).not.toBeNull();
    const count = prepares;
    await residentTiles(scope, [source], { x: 0, z: 0 }, []);
    expect(prepares).toBe(count);
  } finally { tile.release(); coarse.release(); await Promise.allSettled([first]); scope.dispose(); }
});

test('a failed resident boot remains refused without publishing or retrying its driver', async () => {
  const scope = new Scope('failed-resident'), failure = new Error('resident tile failed');
  const attach = vi.fn(() => Promise.reject(failure)), coarse = vi.fn(() => Promise.resolve());
  const source: TileContent = { id: 'failed', tiles: () => new Set([36]), attach, coarse };
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    await expect(residentTiles(scope, [source], { x: 0, z: 0 }, [])).rejects.toBe(failure);
    await expect(residentTiles(scope, [source], { x: 0, z: 0 }, [])).rejects.toBe(failure);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(coarse).not.toHaveBeenCalled();
    expect(followResidentTiles(scope, () => ({ x: 0, z: 0 }))).toBeNull();
  } finally { warning.mockRestore(); scope.dispose(); }
});

test('retiring a resident during coarse preparation refuses publication', async () => {
  const scope = new Scope('retired-resident'), started = gate(), coarse = gate();
  const source: TileContent = { id: 'retired', tiles: () => new Set(), attach: () => Promise.resolve(),
    coarse: () => { started.release(); return coarse.promise; } };
  const pending = residentTiles(scope, [source], { x: 0, z: 0 }, []);
  try {
    await started.promise; scope.dispose(); coarse.release();
    await expect(pending).rejects.toThrow('Tile resident is disposed');
    expect(followResidentTiles(scope, () => ({ x: 0, z: 0 }))).toBeNull();
  } finally { coarse.release(); scope.dispose(); }
});


test.each(['render', 'colliders'] as const)('cached %s stages share the drawn-frame budget', async layer => {
  const owner = new Scope('paced-tile-stages'), key = 36, visited: number[] = [], turns: number[] = [];
  let now = 1000, spent = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  setBuildHeld(false); noteFrameDrawn(now, now, 30);
  const sources: TileContent[] = Array.from({ length: 24 }, (_, index) => {
    const attach = (): Promise<void> => { visited.push(index); now++; spent++; return Promise.resolve(); };
    return { id: `stage.${index}`, tiles: () => new Set([key]),
      attach: layer === 'render' ? attach : () => Promise.resolve(),
      ...(layer === 'colliders' ? { attachColliders: attach } : {}) };
  });
  const driver = new TileDriver(owner, sources, () => 1, () => {
    turns.push(spent); spent = 0; noteFrameDrawn(now, now, 30); return Promise.resolve();
  });
  try {
    await driver.require([key]);
    turns.push(spent);
    expect(visited).toEqual(Array.from({ length: 24 }, (_, index) => index));
    // A cached promise is only a microtask: all 24 used to spend one drawn frame.
    expect(Math.max(...turns)).toBeLessThanOrEqual(8);
    expect(driver.resident(layer).has(key)).toBe(true);
  } finally { owner.dispose(); noteFrameDrawn(Number.NEGATIVE_INFINITY); clock.mockRestore(); }
});

test('a background tile cancelled at its budget fence runs no later content', async () => {
  const owner = new Scope('cancel-paced-tile'), key = 36, paused = gate(), resume = gate();
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  setBuildHeld(false); noteFrameDrawn(now, now, 30);
  const later = vi.fn(() => Promise.resolve());
  const driver = new TileDriver(owner, [
    { id: 'first', tiles: () => new Set([key]), attach: () => { now += 9; return Promise.resolve(); } },
    { id: 'later', tiles: () => new Set([key]), attach: later },
  ], () => 1, () => { paused.release(); return resume.promise; });
  try {
    // No collider work: step through the empty collider ring before render.
    for (let frame = 0; frame < 80; frame++) { driver.step(0, 0); await Promise.resolve(); await Promise.resolve(); }
    await paused.promise;
    driver.step(-240, -240); resume.release();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(later).not.toHaveBeenCalled();
    expect(driver.resident('render').has(key)).toBe(false);
  } finally { resume.release(); owner.dispose(); noteFrameDrawn(Number.NEGATIVE_INFINITY); clock.mockRestore(); }
});


test('loading tile stages retain their original synchronous admission', async () => {
  const owner = new Scope('loading-tile-stages'), visited: number[] = [];
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  noteFrameDrawn(Number.NEGATIVE_INFINITY); setBuildHeld(false);
  const sources: TileContent[] = Array.from({ length: 24 }, (_, index) => ({
    id: `stage.${index}`, tiles: () => new Set([36]),
    attach: () => { visited.push(index); now += 10; return Promise.resolve(); },
  }));
  const pause = vi.fn(() => Promise.resolve()), driver = new TileDriver(owner, sources, () => 1, pause);
  try {
    await driver.require([36]);
    expect(visited).toEqual(Array.from({ length: 24 }, (_, index) => index));
    expect(pause).toHaveBeenCalledTimes(1); // the existing end-of-required-tile pause only
  } finally { owner.dispose(); noteFrameDrawn(Number.NEGATIVE_INFINITY); clock.mockRestore(); }
});

test('stationary priority plans still admit late content in exact collider-first distance order', async () => {
  const scope = new Scope('tile-plan-live'), events: string[] = [], all = new Set(Array.from({ length: 64 }, (_, key) => key));
  const make = (id: string): TileContent => ({ id, tiles: () => all,
    attach: key => { events.push(`${id}:r${String(key)}`); return Promise.resolve(); },
    attachColliders: key => { events.push(`${id}:c${String(key)}`); return Promise.resolve(); } });
  const contents = [make('first')], driver = new TileDriver(scope, contents, () => 1, () => Promise.resolve());
  const order = [27, 18, 19, 20, 26, 28, 34, 35, 36];
  const expected = (id: string): string[] => ['c', 'r'].flatMap(layer => order.map(key => `${id}:${layer}${String(key)}`));
  try {
    await driver.coarse(-40, -40);
    await settle(driver, -40, -40, 100);
    expect(events).toEqual(expected('first'));
    events.length = 0; contents.push(make('late'));
    await settle(driver, -30, -40, 100);
    expect(events).toEqual(expected('late'));
    expect([...driver.resident('render')].sort((a, b) => a - b)).toEqual([...order].sort((a, b) => a - b));
  } finally { scope.dispose(); }
});

test('radius and hysteresis changes invalidate membership without delaying scope retirement', async () => {
  const scope = new Scope('tile-plan-edges'), made = content(), radius = { value: 1 };
  const driver = new TileDriver(scope, [made], () => radius.value, () => Promise.resolve());
  try {
    await settle(driver, -40, -40, 100);
    const old = made.attached.get('r18');
    if (old === undefined) throw new Error('Missing first ring');
    radius.value = 0; driver.step(1, -40);
    expect(old.disposed).toBe(true);
    expect([...driver.resident('render')]).toEqual([27]);
    await settle(driver, 4, -40, 30);
    expect([...driver.resident('render')]).toEqual([28]);
    radius.value = 2;
    await settle(driver, 4, -40, 160);
    expect(driver.resident('render').size).toBe(25);
    expect(driver.resident('colliders').size).toBe(9);
  } finally { scope.dispose(); }
});
