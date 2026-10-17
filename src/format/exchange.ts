import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const number = v.pipe(v.number(), v.finite(), v.safeInteger(), v.minValue(0));
const method = v.strictObject({ owner: text, path: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)) });
const call = v.strictObject({ ...method.entries,
  args: v.pipe(v.array(v.union([text, number, v.boolean()])), v.maxLength(8)),
  required: v.exactOptional(v.boolean()) });
/** Bounded exchange decisions and ordered calls into lent inventory, purse and grant owners. */
export const ExchangeSchema = v.strictObject({
  count: method, owns: method, room: v.exactOptional(method),
  goods: v.pipe(v.array(v.strictObject({ id: text, owns: v.exactOptional(text), needs: v.exactOptional(text),
    capacity: v.exactOptional(v.strictObject({ item: text, n: number })),
    costs: v.pipe(v.array(v.strictObject({ item: text, n: number, text: v.exactOptional(text) })), v.maxLength(3)),
    payments: v.pipe(v.array(call), v.maxLength(3)), grants: v.pipe(v.array(call), v.minLength(1), v.maxLength(3)),
  })), v.minLength(1), v.maxLength(64)),
});
/** Detached data; no executable affordability or payout policy enters a product. */
export type ExchangeRows = v.InferOutput<typeof ExchangeSchema>;
