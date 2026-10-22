import * as v from 'valibot';
import { isJsonData } from './json';
import { CurveSchema } from './materials';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-10000000), v.maxValue(10000000));
const count = v.pipe(finite, v.integer(), v.minValue(0));
const positive = v.pipe(count, v.minValue(1));
const flags = v.pipe(v.array(key), v.maxLength(256));
const colour = v.pipe(v.string(), v.regex(/^#[a-fA-F0-9]{6}$/u));
const sticker = { label: text, icon: v.picklist(['talon', 'tusk', 'hat', 'necklace']), prize: v.exactOptional(v.pipe(v.array(text), v.maxLength(16))) };

/** Defining native Bag metadata, shared unchanged with economy admission. */
export const LootPresentationSchema=v.strictObject({
  quest:key,chart:key,lateKinds:flags,
  chime:v.strictObject({sound:v.picklist(['chest','locked','lever','plate','door','grate','chime','glyph','ignite']),gain:v.pipe(finite,v.minValue(0),v.maxValue(8))}),
  cosmetics:v.pipe(v.array(v.strictObject({id:key,icon:v.picklist(['hat','cape']),how:text})),v.maxLength(64)),
});
export const LootProgressionSchema = v.strictObject({ flags,
    states: v.pipe(v.array(v.strictObject({ earned: v.pipe(v.array(v.strictObject({ id: key, text })), v.maxLength(128)), displayCount: count, next: v.nullable(count) })), v.minLength(1), v.maxLength(257)),
    glow: v.strictObject({ owned: key, curve: CurveSchema }) });
export const LootFindsSchema = v.strictObject({ counters: v.pipe(v.array(v.strictObject({ label: text, flags })), v.maxLength(32)),
    sections: v.pipe(v.array(v.strictObject({ title: text, dense: v.exactOptional(v.boolean()), wide: v.exactOptional(v.boolean()),
      items: v.pipe(v.array(v.union([v.strictObject({ ...sticker, flag: key }), v.strictObject({ ...sticker, owned: key })])), v.maxLength(256)) })), v.maxLength(32)),
    glass: v.exactOptional(v.strictObject({ flags, colors: v.pipe(v.array(colour), v.minLength(1), v.maxLength(256)), fallback: colour })),
    next: v.exactOptional(v.strictObject({ counter: v.pipe(count, v.maxValue(31)), every: positive, max: count, text })) });
export const LootMarksSchema = v.pipe(v.array(v.strictObject({ flag: key, x: finite, z: finite, color: colour })), v.maxLength(256));

/** The original cross-row laws apply to both native economy and Bag data. */
export function lootBagRules(row: { readonly progression?: v.InferOutput<typeof LootProgressionSchema>; readonly finds: v.InferOutput<typeof LootFindsSchema> }): string[] {
  const errors: string[] = [], progression = row.progression;
  if (progression !== undefined && (new Set(progression.flags).size !== progression.flags.length || progression.states.length !== progression.flags.length + 1
    || progression.states.some(state => new Set(state.earned.map(reward => reward.id)).size !== state.earned.length))) errors.push('complete unique economy progression');
  if (row.finds.next !== undefined && row.finds.counters[row.finds.next.counter] === undefined) errors.push('economy finds counter');
  return errors;
}
/** Detached finite projection only; current purse, flags, health and ownership
 * remain the native services' state. No exchange or grant grammar is imported. */
export const LootBagSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only loot Bag rows'), v.strictObject({
  presentation: LootPresentationSchema, progression: LootProgressionSchema, finds: LootFindsSchema, marks: LootMarksSchema,
}), v.check(row => lootBagRules(row).length === 0, 'Valid loot Bag references'));
export type LootBagRows = v.InferOutput<typeof LootBagSchema>;
