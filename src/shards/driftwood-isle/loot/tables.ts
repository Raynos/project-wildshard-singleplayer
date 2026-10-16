import { DRIFTWOOD_COIN_VALUES } from '../data/economy';
import KEEPSAKE_CONTENT from '../data/keepsakes.json' with { type: 'json' };
import { WeightedTable } from '@wildshard/engine/ai/weighted';
import type { Scope } from '@wildshard/engine/app/scope';
import { registerLootTable, type LootContext, type LootTableRow } from '@wildshard/game/loot/tables';

export const DRIFTWOOD_COINS: LootTableRow = {
  id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
    rows: Object.entries(DRIFTWOOD_COIN_VALUES).map(([kind, count]) => ({
      item: 'coin', weight: 1, count, when: (ctx: LootContext) => ctx.kind === kind,
    })),
  },
};
export type TrophyDropId = keyof typeof KEEPSAKE_CONTENT.trophies;
export const DRIFTWOOD_TROPHIES: LootTableRow = {
  id: 'loot.driftwood.trophies', domain: 'trophies', table: { mode: 'each', rows: Object.entries(KEEPSAKE_CONTENT.trophies).map(([item, row]) => ({
    item, weight: 1, when: (ctx: LootContext) => ctx.kind === row.kind && (row.variant === null || ctx.variant === row.variant) && ctx.owned?.(item) !== true,
  })) },
};
export function installDriftwoodLootTables(scope?: Scope): void {
  registerLootTable(DRIFTWOOD_COINS, scope); registerLootTable(DRIFTWOOD_TROPHIES, scope);
}
export function islandTrophies(ctx: LootContext): TrophyDropId[] {
  return new WeightedTable(DRIFTWOOD_TROPHIES.table).roll(ctx, () => 0).map((drop) => drop.item).filter((id): id is TrophyDropId => Object.hasOwn(KEEPSAKE_CONTENT.trophies, id));
}
