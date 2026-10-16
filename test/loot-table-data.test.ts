import { expect, test, vi } from 'vitest';
import { WeightedTable, type TableSpec } from '../src/engine/ai/weighted';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { parseLootEconomy, parseLootTables } from '../src/format/lootEconomy';
import { getLootTable, readLootTables, registerLootTable, rollLoot, type LootContext } from '../src/game/loot/tables';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };

test('emitted coin and trophy selectors preserve old order, ownership and RNG continuation', () => {
  const coins = [['crab', 1], ['monkey', 1], ['boar', 2], ['sailor', 5], ['bear', 10], ['captain', 25]] as const;
  const trophies = [['bear-claw', 'bear', 'brown'], ['boar-tusk', 'boar', null], ['captain-hat', 'captain', null]] as const;
  const before: TableSpec<string, LootContext>[] = [
    { mode: 'each', rows: coins.map(([kind, count]) => ({ item: 'coin', count, weight: 1, when: ctx => ctx.kind === kind })) },
    { mode: 'each', rows: trophies.map(([item, kind, variant]) => ({ item, weight: 1, when: ctx => ctx.kind === kind && (variant === null || ctx.variant === variant) && ctx.owned?.(item) !== true })) },
  ];
  const after = readLootTables(LOOT.economy.tables);
  expect(after.map(row => [row.id, row.domain])).toEqual([['loot.driftwood.coins', 'coins'], ['loot.driftwood.trophies', 'trophies']]);
  expect(after.map(row => row.table.rows.map(entry => entry.item))).toEqual([coins.map(() => 'coin'), trophies.map(([item]) => item)]);
  for (let seed = 0; seed < 16; seed++) for (const kind of [...coins.map(([entryKind]) => entryKind), 'unknown']) for (const variant of [undefined, 'brown', 'black']) {
    const ctx: LootContext = { kind, variant, owned: id => seed % 2 === 0 && id !== 'boar-tusk' };
    for (let i = 0; i < before.length; i++) {
      const old = before[i], row = after[i];
      if (old === undefined || row === undefined) throw new Error('Missing parity table');
      const oldNext = vi.fn(() => seed / 16), next = vi.fn(() => seed / 16);
      expect(new WeightedTable(row.table).roll(ctx, next)).toEqual(new WeightedTable(old).roll(ctx, oldNext));
      expect(next.mock.calls).toEqual(oldNext.mock.calls); expect(next).not.toHaveBeenCalled();
    }
  }
});

test('weighted selection and ranged counts still consume the original stream in order', () => {
  const [row] = readLootTables([{ id: 'test.ranges', domain: 'coins', table: { mode: 'weighted', rows: [
    { item: 'one', weight: 1, count: [2, 5], match: { kind: 'crab' } },
    { item: 'two', weight: 3, count: [7, 9], match: { kind: 'crab' } },
  ] } }]);
  if (row === undefined) throw new Error('Missing range table');
  const before = new WeightedTable<string, LootContext>({ mode: 'weighted', rows: [
    { item: 'one', weight: 1, count: [2, 5], when: ctx => ctx.kind === 'crab' },
    { item: 'two', weight: 3, count: [7, 9], when: ctx => ctx.kind === 'crab' },
  ] });
  for (const seed of [0, 0.1, 0.25, 0.5, 0.99]) {
    const old = vi.fn(() => seed), next = vi.fn(() => seed);
    expect(new WeightedTable(row.table).roll({ kind: 'crab' }, next)).toEqual(before.roll({ kind: 'crab' }, old));
    expect(next).toHaveBeenCalledTimes(2); expect(next.mock.calls).toEqual(old.mock.calls);
  }
});

test('matching short circuits ownership and respects resident registration lifetime', () => {
  const rows = readLootTables(LOOT.economy.tables), previous = app.levelScope, scope = new Scope('loot-test');
  const owned = vi.fn(() => true);
  try {
    app.levelScope = scope;
    for (const row of rows) registerLootTable(row, scope);
    expect(rollLoot('trophies', { kind: 'boar' })).toEqual([{ item: 'boar-tusk', count: 1 }]);
    expect(rollLoot('trophies', { kind: 'sailor', owned }, () => 0)).toEqual([]); expect(owned).not.toHaveBeenCalled();
    expect(rollLoot('trophies', { kind: 'bear', variant: 'black', owned }, () => 0)).toEqual([]); expect(owned).not.toHaveBeenCalled();
    expect(rollLoot('trophies', { kind: 'bear', variant: 'brown', owned }, () => 0)).toEqual([]); expect(owned).toHaveBeenCalledExactlyOnceWith('bear-claw');
    const row = rows[0]; if (row === undefined) throw new Error('Missing scoped row');
    expect(() => registerLootTable(row, scope)).toThrow('Duplicate'); expect(getLootTable(row.id)).toBe(row);
    scope.dispose(); expect(getLootTable(row.id)).not.toBe(row);
    expect(() => registerLootTable(row, scope)).toThrow('disposed');
  } finally { scope.dispose(); app.levelScope = previous; }
});

test('strict data admission refuses executable selectors and malformed ranges before registration', () => {
  const good = { id: 'test.coins', domain: 'coins', table: { mode: 'each', rows: [{ item: 'coin', weight: 1, match: { kind: 'crab' } }] } };
  let reads = 0; const getter = { ...good };
  Object.defineProperty(getter, 'table', { enumerable: true, get: () => { reads++; return good.table; } });
  expect(() => readLootTables([getter])).toThrow('JSON-only'); expect(reads).toBe(0);
  for (const input of [undefined, [good, good], [{ ...good, extra: true }], [{ ...good, table: { ...good.table, rows: [{ ...good.table.rows[0], when: () => true }] } }],
    [{ ...good, table: { ...good.table, rows: [{ item: 'coin', weight: -1, match: { kind: 'crab' } }] } }],
    [{ ...good, table: { ...good.table, rows: [{ item: 'coin', weight: 1, count: [5, 2], match: { kind: 'crab' } }] } }],
    Array.from({ length: 17 }, (_, i) => ({ ...good, id: `test.${i}` })),
  ]) expect(() => parseLootTables(input)).toThrow();
  expect(() => parseLootEconomy({ ...LOOT.economy, tables: [good, good] })).toThrow();
  const admitted = readLootTables([good]); good.table.rows[0] = { item: 'coin', weight: 1, match: { kind: 'bear' } };
  const row = admitted[0]; if (row === undefined) throw new Error('Missing detached row');
  expect(new WeightedTable(row.table).roll({ kind: 'crab' }, () => 0)).toEqual([{ item: 'coin', count: 1 }]);
});
