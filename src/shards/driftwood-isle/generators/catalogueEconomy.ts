import { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';

import { DRIFTWOOD_LOOT as loot } from './loot';

type CatalogueEconomy = ReturnType<typeof authorFormatRows<'catalogueEconomy.CatalogueEconomySchema'>>;

/** Exact catalogue metadata projected before the product is published. */
export function driftwoodCatalogueEconomy(): CatalogueEconomy {
  return authorFormatRows('catalogueEconomy.CatalogueEconomySchema', { effects: loot.economy.effects, goods: loot.economy.goods });
}
/** Fill the authored catalogue at build time, retaining feature and row order. */
export function driftwoodCatalogueFeatures(features: readonly { kind: string }[]): unknown[] {
  const rows: unknown[] = [];
  for (const row of features) rows.push(row.kind === 'content.catalogue' ? { ...row, economy: driftwoodCatalogueEconomy() } : row);
  return rows;
}
