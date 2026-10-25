import { expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { TileDriver, tileKeys, residentTiles, followResidentTiles } from './tileDriver';
import type { TileContent } from './tileContent';
import { tileOrder } from './tileOrder';

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
    // T5's whole cell: every tile
    radius.value = 8; await settle(driver, 10, -30, 140);
    expect(driver.resident('render').size).toBe(64);
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
