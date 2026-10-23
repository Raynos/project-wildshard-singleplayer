import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { TileDriver, tileKeys } from '../src/game/shardfile/tileDriver';
import type { TileContent } from '../src/game/shardfile/tileContent';
import { tileOrder } from '../src/game/shardfile/tileOrder';

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
