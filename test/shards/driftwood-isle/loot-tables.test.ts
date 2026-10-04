import { describe, expect, it } from 'vitest';
import { WeightedTable } from '../../../src/engine/ai/weighted';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { getLootTable, registerLootTable, rollLoot, type LootTableRow } from '../../../src/game/loot/tables';
import { DRIFTWOOD_COINS, DRIFTWOOD_TROPHIES } from '../../../src/shards/driftwood-isle/loot/tables';

describe('authored Driftwood rewards', () => {
  it('pays the original six purses and never consumes a random selection draw', () => {
    const coins = new WeightedTable(DRIFTWOOD_COINS.table), next = (): number => { throw new Error('Fixed rewards need no random draw'); };
    const kinds = ['crab', 'monkey', 'boar', 'sailor', 'bear', 'captain', 'deer'];
    expect(kinds.map((kind) => coins.roll({ kind }, next).reduce((sum, drop) => sum + drop.count, 0))).toEqual([1, 1, 2, 5, 10, 25, 0]);
  });
  it('drops only the brown bear claw, any boar tusk and captain hat, once owned', () => {
    const table = new WeightedTable(DRIFTWOOD_TROPHIES.table);
    const drop = (kind: string, variant?: string, owned = false): string[] => table.roll({ kind, variant, owned: () => owned }, () => 0).map((row) => row.item);
    expect(drop('bear', 'brown')).toEqual(['bear-claw']); expect(drop('bear', 'black')).toEqual([]);
    expect(drop('boar', 'sow')).toEqual(['boar-tusk']); expect(drop('captain')).toEqual(['captain-hat']);
    for (const [kind, variant] of [['bear', 'brown'], ['boar', 'big'], ['captain', 'captain']]) {
      if (kind !== undefined) expect(drop(kind, variant, true)).toEqual([]);
    }
  });
  it('reads the active resident before tool fixtures and unregisters on disposal', () => {
    const previous = app.levelScope, first = new Scope('loot-first'), second = new Scope('loot-second');
    const row = (item: string): LootTableRow => ({ id: 'loot.fixture.priority', domain: 'coins', table: { mode: 'each', rows: [{ item, weight: 1 }] } });
    try {
      registerLootTable(row('first'), first); registerLootTable(row('second'), second);
      registerLootTable(row('tool')); // tools registering later cannot shadow the active resident
      app.levelScope = first; expect(rollLoot('loot.fixture.priority', { kind: 'crab' }, () => 0)[0]?.item).toBe('first');
      app.levelScope = second; expect(rollLoot('loot.fixture.priority', { kind: 'crab' }, () => 0)[0]?.item).toBe('second');
      expect(() => registerLootTable(row('duplicate'), second)).toThrow('Duplicate loot table');
      second.dispose(); expect(getLootTable('loot.fixture.priority')?.table.rows[0]?.item).toBe('tool');
    } finally { first.dispose(); second.dispose(); app.levelScope = previous; }
  });
});
