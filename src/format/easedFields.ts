import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const names = v.pipe(v.array(id), v.maxLength(64));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names),
  count: v.exactOptional(v.strictObject({ of: names, atLeast: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(64)) })) });
/** Presentation-only weather channels; targets are a first-match flag table, never executable shard policy. */
export const EasedFieldsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Weather fields require plain JSON'), v.strictObject({
  version: v.literal(1), fields: v.pipe(v.array(v.strictObject({ field: id,
    ease: v.strictObject({ rate: v.pipe(finite, v.minValue(Number.MIN_VALUE)) }),
    min: finite, max: finite, else: finite,
    steps: v.pipe(v.array(v.strictObject({ when: condition, value: finite })), v.maxLength(64)),
  })), v.maxLength(24)),
}), v.check(rows => new Set(rows.fields.map(row => row.field)).size === rows.fields.length
  && rows.fields.every(row => row.min <= row.max && [row.else, ...row.steps.map(step => step.value)].every(value => value >= row.min && value <= row.max)), 'Unique bounded weather fields'));
export type EasedFieldsRows = v.InferOutput<typeof EasedFieldsSchema>;
/** Admit the entire step table before binding a uniform or registering a frame system. */
export function parseEasedFields(input: unknown): EasedFieldsRows { return v.parse(EasedFieldsSchema, input); }
