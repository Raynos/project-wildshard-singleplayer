import { expect, it, vi } from 'vitest';
import { addInventory, takeInventory, type InventoryState } from '../src/game/inventoryLaw';
import { Inventory, type ItemId } from '../src/game/Inventory';
import { ITEMS } from '../src/game/bag/itemCatalog';
import { inventorySave } from '../src/game/saves';
import { saveFixture, readFixture } from './fake/saveFixture';

it('uses the same pack transitions, bytes and notifications as the page across saved shards', () => {
  for (const shard of ['pine-hollow', 'driftwood-isle', 'nalati-grasslands', 'nine-dragon-stack']) {
    const seed: InventoryState<ItemId> = { counts: { venison: 3, 'amber-resin': 2, 'warden-longbow': 1 }, order: ['amber-resin', 'venison', 'warden-longbow'] };
    saveFixture(shard, 'inventory', seed);
    const bytes = localStorage.getItem(`wildshard.save.v2.${shard}`);
    const page = new Inventory(shard);
    expect(localStorage.getItem(`wildshard.save.v2.${shard}`)).toBe(bytes);
    const state: InventoryState<ItemId> = { counts: { ...seed.counts }, order: [] };
    for (const id of seed.order) {
      if (id in ITEMS && page.keeps(id)) state.order.push(id);
      else delete state.counts[id];
    }
    const policy = { has: (id: ItemId) => id in ITEMS, keeps: (id: ItemId) => page.keeps(id), slots: () => page.slots };
    const notify = vi.fn<() => void>(); page.onChange = notify;
    let changes = 0;
    const operations: readonly (readonly ['add' | 'take', ItemId, number])[] = [
      ['add', 'venison', 2], ['add', 'amber-resin', 1], ['take', 'venison', 30],
      ['take', 'amber-resin', 0], ['take', 'amber-resin', -1], ['take', 'amber-resin', 3],
      ['add', 'bear-pelt', 0], ['add', 'deer-hide', -1], ['add', 'boar-hide', 1],
      ['take', 'venison', 5], ['add', 'venison', 1], ['add', 'warden-longbow', 1],
    ];
    for (const [action, id, n] of operations) {
      const expected = action === 'add' ? addInventory(state, policy, id, n) : takeInventory(state, id, n);
      expect(action === 'add' ? page.add(id, n) : page.take(id, n)).toBe(expected);
      if (expected && (action === 'add' || n > 0)) changes++;
      expect(notify).toHaveBeenCalledTimes(changes);
      expect(page.items.map(({ id: kind, count }) => [kind, count])).toEqual(state.order.map(kind => [kind, state.counts[kind] ?? 0]));
      expect(page.checkpoint()).toBe(true);
      expect(JSON.stringify(readFixture(shard, 'inventory'))).toBe(JSON.stringify(state));
      expect(JSON.stringify(inventorySave.read(shard))).toBe(JSON.stringify(state));
      const reloaded = new Inventory(shard);
      expect(reloaded.items).toEqual(page.items);
    }
  }
});

it('admits a stack into a full pack but refuses a new kind or unknown item without mutation', () => {
  const state: InventoryState<string> = { counts: { resin: 2 }, order: ['resin'] };
  const slots = vi.fn(() => 1);
  const policy = { has: (id: string) => id === 'resin' || id === 'hide', keeps: () => true, slots };
  expect(addInventory(state, policy, 'resin', 3)).toBe(true);
  expect(slots).not.toHaveBeenCalled();
  const bytes = JSON.stringify(state);
  expect(addInventory(state, policy, 'hide')).toBe(false);
  expect(addInventory(state, policy, 'removed')).toBe(false);
  expect(takeInventory(state, 'resin', 6)).toBe(false);
  expect(JSON.stringify(state)).toBe(bytes);
});
