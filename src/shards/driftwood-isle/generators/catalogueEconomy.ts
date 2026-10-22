import * as v from 'valibot';
import { CatalogueEconomySchema, type CatalogueEconomy } from '@wildshard/format/catalogueEconomy';
import loot from '../data/loot.generated.json' with { type: 'json' };

/** Exact catalogue metadata projected before the product is published. */
export function driftwoodCatalogueEconomy(): CatalogueEconomy {
  return v.parse(CatalogueEconomySchema, { effects: loot.economy.effects, goods: loot.economy.goods });
}
/** Fill the authored catalogue at build time, retaining feature and row order. */
export function driftwoodCatalogueFeatures(features: readonly { kind: string }[]): unknown[] {
  const rows: unknown[] = [];
  for (const row of features) rows.push(row.kind === 'content.catalogue' ? { ...row, economy: driftwoodCatalogueEconomy() } : row);
  return rows;
}
