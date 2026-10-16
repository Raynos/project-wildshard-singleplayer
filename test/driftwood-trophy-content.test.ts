import { expect, test, vi } from 'vitest';
import { WeightedTable } from '../src/engine/ai/weighted';
import { DRIFTWOOD_TROPHIES, islandTrophies } from '../src/shards/driftwood-isle/loot/tables';

test('authored trophies keep variant eligibility and suppress owned rewards without RNG', () => {
  expect(islandTrophies({ kind: 'bear', variant: 'brown' })).toEqual(['bear-claw']);
  expect(islandTrophies({ kind: 'bear', variant: 'black' })).toEqual([]);
  expect(islandTrophies({ kind: 'bear' })).toEqual([]);
  expect(islandTrophies({ kind: 'boar', variant: 'brown' })).toEqual(['boar-tusk']);
  expect(islandTrophies({ kind: 'captain' })).toEqual(['captain-hat']);
  expect(islandTrophies({ kind: 'sailor' })).toEqual([]);
  const next = vi.fn<() => number>(() => 0.5), table = new WeightedTable(DRIFTWOOD_TROPHIES.table);
  expect(table.roll({ kind: 'bear', variant: 'brown', owned: id => id === 'bear-claw' }, next)).toEqual([]);
  expect(table.roll({ kind: 'boar', owned: id => id === 'bear-claw' }, next)).toEqual([{ item: 'boar-tusk', count: 1 }]);
  expect(next).not.toHaveBeenCalled();
});
