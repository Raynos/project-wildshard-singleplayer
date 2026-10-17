import * as v from 'valibot';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const names = v.pipe(v.array(name), v.maxLength(256));
const value = v.union([v.strictObject({ flag: name }), v.strictObject({ flags: names }),
  v.strictObject({ prefix: name }), v.strictObject({ constant: v.literal(0) })]);
/** Bounded existing achievement counter policy, independent of its page/native storage and fact ports. */
export const AchievementCounterDataSchema = v.strictObject({
  feats: v.pipe(v.array(v.strictObject({ id: name, count: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(4096)),
    kind: v.exactOptional(name), event: v.exactOptional(name), variant: v.exactOptional(name) })), v.maxLength(256)),
  flags: v.pipe(v.array(v.strictObject({ id: name, method: v.picklist(['event', 'count']), value, onlyWhenSet: v.exactOptional(v.boolean()) })), v.maxLength(256)),
  prefix: v.pipe(v.string(), v.maxLength(96)), floorTotals: v.boolean(), validateTotals: v.boolean(), write: v.picklist(['before', 'after', 'each']),
});
/** Numeric counter and ordered flag rows; live progress remains in the existing achievement owner. */
export type AchievementCounterData = v.InferOutput<typeof AchievementCounterDataSchema>;
/** Strict product admission before existing owners see a policy or restore saved counters. */
export function parseAchievementCounterData(input: unknown): AchievementCounterData { return v.parse(AchievementCounterDataSchema, input); }
