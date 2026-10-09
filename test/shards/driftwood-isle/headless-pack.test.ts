import { expect, it } from 'vitest';
import { Inventory } from '../../../src/game/Inventory';
import { DEFAULT_PACK_SLOTS } from '../../../src/game/inventoryLaw';
import { DRIFTWOOD_INTERACT } from '../../../src/shards/driftwood-isle/quest/interactables';
import { DriftwoodPack } from '../../../src/shards/driftwood-isle/runtime/pack';
import { saveFixture } from '../../fake/saveFixture';

it('stacks every authored chest item exactly as the shipping pack, in first-pickup order', () => {
  saveFixture('driftwood-isle', 'inventory', { counts: {}, order: [] });
  const page = new Inventory('driftwood-isle'), native = new DriftwoodPack();
  expect(page.slots).toBe(DEFAULT_PACK_SLOTS);
  for (const row of DRIFTWOOD_INTERACT.rows) {
    if (row.kind !== 'chest') continue;
    for (const loot of row.contents) {
      if (!('item' in loot) || loot.item !== 'doubloon') continue;
      expect(native.add(loot.item, loot.n ?? 1)).toBe(page.add(loot.item, loot.n ?? 1));
      expect(native.snapshot()).toEqual({ counts: Object.fromEntries(page.items.map(item => [item.id, item.count])), order: page.items.map(item => item.id) });
    }
  }
  expect(native.count('doubloon')).toBe(13);
});

it('restores exact pack order without pickups and refuses malformed continuations atomically', () => {
  const pack = new DriftwoodPack();
  expect(pack.add('doubloon', 2)).toBe(true);
  expect(pack.add('crab-claw', 1)).toBe(true);
  const saved = pack.snapshot(), restored = new DriftwoodPack();
  restored.restore(saved);
  expect(restored.snapshot()).toEqual(saved);
  saved.order.reverse(); saved.counts['doubloon'] = 30;
  expect(restored.snapshot()).toEqual({ counts: { doubloon: 2, 'crab-claw': 1 }, order: ['doubloon', 'crab-claw'] });
  const before = restored.snapshot();
  expect(restored.add('not-a-driftwood-item', 1)).toBe(false);
  expect(restored.snapshot()).toEqual(before);
  for (const invalid of [
    { counts: { doubloon: 2 }, order: ['doubloon', 'doubloon'] },
    { counts: { doubloon: 0 }, order: ['doubloon'] },
    { counts: { doubloon: 0.5 }, order: ['doubloon'] },
    { counts: { doubloon: 2, coconut: 1 }, order: ['doubloon'] },
    { counts: {}, order: ['doubloon'] },
    { counts: { removed: 1 }, order: ['removed'] },
    { counts: { doubloon: Number.MAX_SAFE_INTEGER + 1 }, order: ['doubloon'] },
  ]) {
    expect(() => restored.restore(invalid)).toThrow();
    expect(restored.snapshot()).toEqual(before);
  }
  expect(() => restored.add('doubloon', -1)).toThrow();
  expect(restored.snapshot()).toEqual(before);
});
