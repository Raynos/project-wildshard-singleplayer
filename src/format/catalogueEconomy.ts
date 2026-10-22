import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-10000000), v.maxValue(10000000));
const count = v.pipe(finite, v.integer(), v.minValue(0));
const positive = v.pipe(count, v.minValue(1));
const effectText = v.pipe(v.string(), v.maxLength(512));
export const EconomyEffectIdSchema = v.pipe(effectText, v.regex(/^effect\./u)) as v.GenericSchema<`effect.${string}`>;
const tag = v.pipe(effectText, v.regex(/\./u)) as v.GenericSchema<`${string}.${string}`>;
const modifier = v.strictObject({ attr: key, op: v.picklist(['add', 'mul', 'override']), value: finite });
const effectSchema = v.strictObject({ id: EconomyEffectIdSchema, kind: v.literal('permanent'), tags: v.pipe(v.array(tag), v.maxLength(32)),
  modifiers: v.pipe(v.array(modifier), v.maxLength(32)), grants: v.exactOptional(v.pipe(v.array(tag), v.maxLength(32))),
  stacking: v.union([v.literal('none'), v.strictObject({ max: v.pipe(positive, v.maxValue(1024)) })]),
  group: v.exactOptional(key), removes: v.exactOptional(v.pipe(v.array(EconomyEffectIdSchema), v.maxLength(32))) });
const goodSchema = v.strictObject({ id: key, name: text, does: text, icon: v.picklist(['whetstone', 'heart', 'chart', 'cape']), price: count, needs: v.exactOptional(key) });

/** The unchanged effects/goods entries used by both loot and catalogue admission. */
export const CatalogueEconomyRegistrationSchema = v.strictObject({
  effects: v.pipe(v.array(effectSchema), v.maxLength(128)), goods: v.pipe(v.array(goodSchema), v.maxLength(64)),
});
/** Shared identity/reference law; projection never changes the authored order. */
export function catalogueEconomyRules(row: v.InferOutput<typeof CatalogueEconomyRegistrationSchema>): string[] {
  const errors: string[] = [], effects = new Set(row.effects.map(effect => effect.id)), goods = new Set(row.goods.map(good => good.id));
  if (effects.size !== row.effects.length || goods.size !== row.goods.length) errors.push('unique economy effects and goods');
  if (row.goods.some(good => good.needs !== undefined && (!goods.has(good.needs) || good.needs === good.id))) errors.push('economy good prerequisite');
  if (row.effects.some(effect => effect.removes?.some(id => !effects.has(id)) === true)) errors.push('economy effect reference');
  return errors;
}
/** Bounded catalogue-only projection; the defining loot grammar stays shared. */
export const CatalogueEconomySchema = v.pipe(CatalogueEconomyRegistrationSchema,
  v.check(row => catalogueEconomyRules(row).length === 0, 'Valid catalogue economy references'));
export type CatalogueEconomy = v.InferOutput<typeof CatalogueEconomySchema>;
