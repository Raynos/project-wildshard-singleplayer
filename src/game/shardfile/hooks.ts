import * as v from 'valibot';
import type { ShardScriptField } from './scripts';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const positive = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const finite = v.pipe(v.number(), v.finite());
/** Named conditions read stable published fields; scenes enqueue next-tick events on a host-resolved actor. */
export const HooksSchema = v.strictObject({
  conditions: v.pipe(v.array(v.strictObject({ id, scope: v.picklist(['shared', 'player']), fieldId: positive, equals: finite })), v.maxLength(256)),
  scenes: v.pipe(v.array(v.strictObject({ id, type: positive, value: finite })), v.maxLength(256)),
});
/** JSON-only named hook declarations shared by quests, input and Debug choices. */
export type ShardHooks = v.InferOutput<typeof HooksSchema>;
/** Resolve field types, bounds and privacy without allowing authored hook callbacks. */
export function hookRules(hooks: ShardHooks, state: { shared: readonly ShardScriptField[]; player: readonly ShardScriptField[] }): string[] {
  const errors: string[] = [];
  for (const list of [hooks.conditions, hooks.scenes]) if (new Set(list.map((row) => row.id)).size !== list.length) errors.push('unique named hooks');
  for (const row of hooks.conditions) {
    const field = state[row.scope].find((entry) => entry.id === row.fieldId);
    if (field === undefined || field.type === 'string' || (row.scope === 'shared' ? field.privacy !== 'public' : field.privacy === 'host')) { errors.push('published numeric hook field'); continue; }
    const min = field.min ?? (field.type === 'bool' ? 0 : field.type === 'i32' ? -2147483648 : -Number.MAX_VALUE);
    const max = field.max ?? (field.type === 'bool' ? 1 : field.type === 'i32' ? 2147483647 : Number.MAX_VALUE);
    if (row.equals < min || row.equals > max || (field.type !== 'f64' && !Number.isInteger(row.equals))) errors.push('typed hook condition value');
  }
  return [...new Set(errors)];
}
