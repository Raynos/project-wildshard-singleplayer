import { WeightedTable } from '@wildshard/engine/ai/weighted';
import type { Scope } from '@wildshard/engine/app/scope';
import { registerLootTable, type LootContext, type LootTableRow } from '@wildshard/game/loot/tables';

export const DRIFTWOOD_COIN_VALUES: Readonly<Record<string, number>> = {
  crab: 1, monkey: 1, boar: 2, sailor: 5, bear: 10, captain: 25,
};
export const DRIFTWOOD_COINS: LootTableRow = {
  id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
    rows: Object.entries(DRIFTWOOD_COIN_VALUES).map(([kind, count]) => ({
      item: 'coin', weight: 1, count, when: (ctx: LootContext) => ctx.kind === kind,
    })),
  },
};
export const DRIFTWOOD_TROPHIES: LootTableRow = {
  id: 'loot.driftwood.trophies', domain: 'trophies', table: { mode: 'each', rows: [
    { item: 'bear-claw', weight: 1, when: (ctx) => ctx.kind === 'bear' && ctx.variant === 'brown' && ctx.owned?.('bear-claw') !== true },
    { item: 'boar-tusk', weight: 1, when: (ctx) => ctx.kind === 'boar' && ctx.owned?.('boar-tusk') !== true },
    { item: 'captain-hat', weight: 1, when: (ctx) => ctx.kind === 'captain' && ctx.owned?.('captain-hat') !== true },
  ] },
};
export function installDriftwoodLootTables(scope?: Scope): void {
  registerLootTable(DRIFTWOOD_COINS, scope); registerLootTable(DRIFTWOOD_TROPHIES, scope);
}
export function islandTrophies(ctx: LootContext): string[] {
  return new WeightedTable(DRIFTWOOD_TROPHIES.table).roll(ctx, () => 0).map((drop) => drop.item);
}
