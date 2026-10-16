import { expect, test, vi } from 'vitest';
import { WeightedTable } from '../src/engine/ai/weighted';
import { readLootTables, type LootContext } from '../src/game/loot/tables';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };

const trophy = readLootTables(LOOT.economy.tables).find(row => row.domain === 'trophies');
if (trophy === undefined) throw new Error('Missing authored trophies');
const table = new WeightedTable(trophy.table);
const islandTrophies = (ctx: LootContext) => table.roll(ctx, () => 0).map(drop => drop.item);

test('authored trophies keep variant eligibility and suppress owned rewards without RNG', () => {
  expect(islandTrophies({ kind: 'bear', variant: 'brown' })).toEqual(['bear-claw']);
  expect(islandTrophies({ kind: 'bear', variant: 'black' })).toEqual([]);
  expect(islandTrophies({ kind: 'bear' })).toEqual([]);
  expect(islandTrophies({ kind: 'boar', variant: 'brown' })).toEqual(['boar-tusk']);
  expect(islandTrophies({ kind: 'captain' })).toEqual(['captain-hat']);
  expect(islandTrophies({ kind: 'sailor' })).toEqual([]);
  const next = vi.fn<() => number>(() => 0.5);
  expect(table.roll({ kind: 'bear', variant: 'brown', owned: id => id === 'bear-claw' }, next)).toEqual([]);
  expect(table.roll({ kind: 'boar', owned: id => id === 'bear-claw' }, next)).toEqual([{ item: 'boar-tusk', count: 1 }]);
  expect(next).not.toHaveBeenCalled();
});
