import { beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import type { LevelDriver } from '../src/engine/level/load';
import { SaveStore } from '../src/engine/saves/store';
import { shardContext, type GameServices } from '../src/game/shard/context';
import { toLevelSpec } from '../src/game/shard/spec';
import manifest from '../src/shards/nine-dragon-stack/manifest';
import { Inventory } from '../src/game/Inventory';
import { ITEMS } from '../src/game/bag/itemCatalog';
import { normalizeItemRow } from '../src/game/bag/items';
import { applyTravelCarry, travelService, travelSlot, type TravelSource } from '../src/game/travel/travel';

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}


beforeEach(() => { vi.stubGlobal('sessionStorage', new MemoryStorage()); });
function fixture() {
  const slot = travelSlot(new SaveStore({ local: new MemoryStorage(), session: new MemoryStorage() }));
  const inventory = new Inventory('driftwood-isle');
  inventory.add('coconut', 3); inventory.add('crab-claw', 2);
  const source: TravelSource = { shard: 'driftwood-isle', inventory, rows: new Map([['coconut', normalizeItemRow({ id: 'coconut', travels: true })]]) };
  let at = 100_000;
  const navigate = vi.fn<() => void>();
  const service = travelService({ source: () => source, slot, now: () => at, navigate });
  return { slot, inventory, service, navigate, clock: (value: number) => { at = value; } };
}
it('normalizes registered rows without mutating the authored row; every shipped item stays local', () => {
  const row = { id: 'coconut' };
  expect(normalizeItemRow(row)).toEqual({ id: 'coconut', travels: false });
  expect(row).toEqual({ id: 'coconut' });
  expect(normalizeItemRow({ id: 'coconut', travels: true }).travels).toBe(true);
  expect(Object.values(ITEMS).every((value) => !value.travels)).toBe(true);
});
it('writes a handoff, removes only travelling lines, and consumes it once on the target boot', () => {
  const f = fixture();
  f.service.travel({ to: 'pine-hollow', mode: 'enter', arrive: { x: 1, z: 2, yaw: 3, y: 4 } });
  expect(f.inventory.items.map(({ id, count }) => ({ id, count }))).toEqual([{ id: 'crab-claw', count: 2 }]);
  expect(f.navigate).toHaveBeenCalledOnce();
  const arrival = f.service.consume('pine-hollow');
  expect(arrival).toEqual({ v: 1, from: 'driftwood-isle', to: 'pine-hollow', mode: 'enter', arrive: { x: 1, z: 2, yaw: 3, y: 4 }, carry: [{ id: 'coconut', count: 3 }], at: 100_000 });
  expect(f.slot.read()).toBeNull();
  expect(f.service.consume('pine-hollow')).toBeNull();
});
it.each(['enter', 'explore', 'arena'] as const)('keeps the %s mode in a cold-title handoff', (mode) => {
  const slot = travelSlot(new SaveStore({ local: null, session: new MemoryStorage() }));
  const service = travelService({ slot, source: () => null, now: () => 12, navigate: vi.fn<() => void>() });
  service.travel({ to: 'nine-dragon-stack', mode });
  expect(service.consume('nine-dragon-stack')).toMatchObject({ from: null, mode, arrive: null, carry: [] });
});
it.each([60_001, -1])('drops expired or future handoffs and deletes them (age %s)', (age) => {
  const f = fixture(); f.service.travel({ to: 'pine-hollow', mode: 'arena' }); f.clock(100_000 + age);
  expect(f.service.consume('pine-hollow')).toBeNull(); expect(f.slot.read()).toBeNull();
});
it('drops and deletes a wrong-shard handoff', () => {
  const f = fixture(); f.service.travel({ to: 'pine-hollow', mode: 'explore' });
  expect(f.service.consume('driftwood-isle')).toBeNull(); expect(f.service.consume('pine-hollow')).toBeNull();
});
it('adds carry through the arriving Bag and ignores a wrong target', () => {
  const f = fixture(); f.service.travel({ to: 'driftwood-isle', mode: 'enter' });
  const handoff = f.service.consume('driftwood-isle');
  const wrong = new Inventory('nine-dragon-stack'); applyTravelCarry(handoff, wrong); expect(wrong.total).toBe(0);
  const target = new Inventory('driftwood-isle'); applyTravelCarry(handoff, target); expect(target.count('coconut')).toBe(3);
});
it('keeps inventory intact if the per-tab handoff cannot be persisted', () => {
  const f = fixture(); vi.spyOn(f.slot, 'write').mockReturnValue(false);
  f.service.travel({ to: 'pine-hollow', mode: 'enter' }); expect(f.inventory.count('coconut')).toBe(3);
});

it('stores travel defaults through the real shard registration and releases rows on unload', async () => {
  const app = new App();
  const noop = (): void => undefined;
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop };
  app.levelDriver = driver;
  const game: GameServices = { shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } };
  await app.loadLevel(toLevelSpec(manifest), { kit: (ctx) => {
    const shard = shardContext(ctx, manifest, game);
    shard.rows.item([{ id: 'local' }, { id: 'portable', travels: true }]);
  } });
  expect([...game.rows.get('item')?.values() ?? []]).toEqual([{ id: 'local', travels: false }, { id: 'portable', travels: true }]);
  await app.unloadLevel(); expect(game.rows.size).toBe(0);
});
