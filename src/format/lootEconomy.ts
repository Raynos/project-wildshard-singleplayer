import { CatalogueEconomyRegistrationSchema, catalogueEconomyRules, EconomyEffectIdSchema as effectId } from './catalogueEconomy';
import { ExchangeSchema } from './exchange';
import * as v from 'valibot';
import { isJsonData } from './json';
import { LootPresentationSchema, LootProgressionSchema, LootFindsSchema, LootMarksSchema, lootBagRules } from './lootBag';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-10000000), v.maxValue(10000000));
const count = v.pipe(finite, v.integer(), v.minValue(0));
const positive = v.pipe(count, v.minValue(1));
/** Claimed drops keep their original model/grant owners; only matching, launch and retirement are authored. */
export const ClaimedPickupSchema = v.strictObject({
  options: v.strictObject({ tier: v.exactOptional(v.picklist(['common', 'rare', 'legendary'])), prompt: v.exactOptional(text),
    scale: v.exactOptional(finite), tilt: v.exactOptional(finite), glow: v.exactOptional(v.boolean()) }),
  toss: v.strictObject({ horizontal: finite, up: finite }), walkIn: v.nullable(v.strictObject({ radius: finite, height: finite })),
  takenGrace: v.pipe(finite, v.minValue(0), v.maxValue(60)), unique: v.boolean(), disposeItemOnTake: v.boolean(), retireBeforeCallback: v.boolean(),
  death: v.exactOptional(v.strictObject({ kind: key, variant: v.exactOptional(key), floor: v.picklist(['source', 'ground', 'max']),
    towardPlayer: v.exactOptional(v.strictObject({ distance: v.pipe(finite, v.minValue(0)), epsilon: v.pipe(finite, v.minValue(0)) })) })),
  toast: v.exactOptional(text),
});
const grantSchema = v.strictObject({ id: effectId, key, unless: v.exactOptional(v.pipe(v.array(key), v.maxLength(32))), stacks: v.exactOptional(v.pipe(positive, v.maxValue(1024))) });
const grants = v.pipe(v.array(grantSchema), v.maxLength(128));
/** Bounded data selectors lower to the existing weighted-table predicate and count laws. */
export const LootTablesSchema = v.pipe(v.array(v.strictObject({ id: key, domain: v.picklist(['coins', 'trophies']),
  table: v.strictObject({ mode: v.picklist(['weighted', 'each']), rows: v.pipe(v.array(v.strictObject({
    item: key, weight: v.pipe(finite, v.minValue(0)), count: v.exactOptional(v.union([count, v.tuple([count, count])])),
    match: v.strictObject({ kind: key, variant: v.exactOptional(key), unowned: v.exactOptional(v.boolean()) }),
  })), v.maxLength(256)) }) })), v.maxLength(16));
/** Ordered count ranges and unique registration identities are checked before any table is installed. */
function lootTableRules(rows: v.InferOutput<typeof LootTablesSchema>): string[] {
  const errors: string[] = [];
  if (new Set(rows.map(row => row.id)).size !== rows.length) errors.push('unique loot table ids');
  if (rows.some(row => row.table.rows.some(entry => entry.count !== undefined && typeof entry.count !== 'number' && entry.count[0] > entry.count[1]))) errors.push('ordered loot count ranges');
  return errors;
}
/** Detached data admission; predicates, getters, unknown fields and invalid ranges never become callbacks. */
export function parseLootTables(input: unknown): v.InferOutput<typeof LootTablesSchema> {
  if (!isJsonData(input)) throw new TypeError('JSON-only loot tables');
  const rows = v.parse(LootTablesSchema, input);
  if (lootTableRules(rows).length > 0) throw new TypeError('Invalid loot table references or ranges');
  return rows;
}
/** Inert economy content; ownership, transactions, attributes and menu lifetimes stay with their existing services. */
export const LootEconomySchema = v.strictObject({
  presentation:v.exactOptional(LootPresentationSchema),
  exchange: v.exactOptional(ExchangeSchema),
  pickups: v.exactOptional(v.pipe(v.record(key, ClaimedPickupSchema), v.maxEntries(128))),
  tables: v.exactOptional(LootTablesSchema),
  progression: v.exactOptional(LootProgressionSchema),
  effects: CatalogueEconomyRegistrationSchema.entries.effects, goods: CatalogueEconomyRegistrationSchema.entries.goods,
  grants: v.strictObject({ player: grants, worn: grants, weapons: grants }),
  finds: LootFindsSchema,
  marks: LootMarksSchema,
});
export type LootEconomy = v.InferOutput<typeof LootEconomySchema>;
/** Cross-row references are also part of the defining RowsSchema admission. */
export function lootEconomyRules(row: LootEconomy): string[] {
  const errors: string[] = [], effects = new Set(row.effects.map(effect => effect.id));
  if (row.tables !== undefined) errors.push(...lootTableRules(row.tables));
  errors.push(...lootBagRules(row));
  errors.push(...catalogueEconomyRules(row));
  if ([...row.grants.player, ...row.grants.worn, ...row.grants.weapons].some(grant => !effects.has(grant.id)) && !errors.includes('economy effect reference')) errors.push('economy effect reference');
  return errors;
}
/** Re-admit a detached payload before reading live ownership, so malformed data cannot partly install effects. */
export function parseLootEconomy(input: unknown): LootEconomy {
  if (!isJsonData(input)) throw new TypeError('JSON-only economy rows');
  const row = v.parse(LootEconomySchema, input);
  if (lootEconomyRules(row).length > 0) throw new TypeError('Invalid economy row references');
  return row;
}

/** Barter admission keeps cards and transactions in one order, without coin-only ownership fields. */
export const BarterEconomySchema = v.pipe(v.strictObject({ kind: v.literal('barter'),
  goods: v.pipe(v.array(v.strictObject({ id: key, name: text, does: text,
    icon: v.picklist(['bolt', 'rifle', 'longbow', 'crossbow']), price: count, tile: text })), v.minLength(1), v.maxLength(64)),
  exchange: ExchangeSchema, tables: LootTablesSchema,
}), v.check(row => new Set(row.goods.map(good => good.id)).size === row.goods.length
  && row.goods.length === row.exchange.goods.length && row.goods.every((good, index) => good.id === row.exchange.goods[index]?.id)
  && lootTableRules(row.tables).length === 0, 'Aligned unique barter cards, transactions and drop tables'));
export type BarterEconomy = v.InferOutput<typeof BarterEconomySchema>;
/** Admit detached barter data before inventory, finish or ammunition owners are borrowed. */
export function parseBarterEconomy(input: unknown): BarterEconomy {
  if (!isJsonData(input)) throw new TypeError('JSON-only economy rows');
  return v.parse(BarterEconomySchema, input);
}
