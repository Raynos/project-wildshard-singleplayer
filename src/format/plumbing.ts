import * as v from 'valibot';

const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/u), v.maxLength(64));
const id = v.custom<`${string}.${string}`>((value) => typeof value === 'string' && value.length <= 128 && /^[a-z][a-z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/u.test(value), 'namespaced id');
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10000));
const inputSchema = v.strictObject({ id, priority: v.pipe(v.number(), v.integer(), v.minValue(-100), v.maxValue(100)), actions: v.pipe(v.array(v.strictObject({ id, keys: v.pipe(v.array(v.pipe(v.string(), v.regex(/^(?:Key[A-Z]|Digit[0-9]|Space|Enter|Escape|Arrow(?:Up|Down|Left|Right)|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right))$/u))), v.maxLength(4)), scene: id })), v.minLength(1), v.maxLength(32)), touch: v.exactOptional(v.strictObject({ slot: v.picklist(['verb.1', 'verb.2']), action: id, label: text, icon: v.pipe(v.string(), v.maxLength(64)) })) });
const knob = v.strictObject({ id, phone: natural, desktop: natural });
const choice = v.strictObject({ value: name, text, scene: v.exactOptional(id) });
const debug = v.strictObject({ id, group: v.picklist(['look', 'cover', 'sky', 'audio', 'combat', 'creatures', 'perf', 'loading', 'tools']), label: text, choices: v.pipe(v.array(choice), v.minLength(2), v.maxLength(16)), initial: name, note: text, ask: v.custom<`E${number}`>((value) => typeof value === 'string' && /^E[1-9][0-9]*$/u.test(value), 'ask id'), reviewBy: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/u)) });
const raw = v.strictObject({ namespace: name, input: v.pipe(v.array(inputSchema), v.maxLength(16)), knobs: v.pipe(v.array(knob), v.maxLength(32)), debug: v.pipe(v.array(debug), v.maxLength(32)) });
/** Serialisable scoped input actions, tier values and Debug choices with named admitted script hooks. */
export type PlumbingData = v.InferOutput<typeof raw>;
/** Semantic identities stay in the owning namespace; Debug defaults and touch actions must exist. */
export function plumbingRules(data: PlumbingData): string[] {
  const errors: string[] = [], own = (key: string): boolean => key.startsWith(`${data.namespace}.`);
  const unique = (ids: readonly string[]): void => { if (new Set(ids).size !== ids.length) errors.push('unique plumbing ids'); };
  unique(data.input.map((row) => row.id)); unique(data.input.flatMap((row) => row.actions.map((action) => action.id))); unique(data.knobs.map((row) => row.id)); unique(data.debug.map((row) => row.id));
  for (const row of data.input) {
    if (!own(row.id) || row.actions.some((action) => !own(action.id) || !own(action.scene))) errors.push('owned input namespace');
    if (row.touch !== undefined && !row.actions.some((action) => action.id === row.touch?.action)) errors.push('declared touch action');
  }
  for (const row of data.knobs) if (!own(row.id)) errors.push('owned knob namespace');
  for (const row of data.debug) {
    if (!own(row.id) || row.choices.some((entry) => entry.scene !== undefined && !own(entry.scene))) errors.push('owned debug namespace');
    unique(row.choices.map((entry) => entry.value)); if (!row.choices.some((entry) => entry.value === row.initial)) errors.push('declared debug default');
  }
  return [...new Set(errors)];
}
/** Bound the declarations and reject non-owned, duplicate or dangling settings at admission. */
export const PlumbingSchema = v.pipe(raw, v.check((data) => plumbingRules(data).length === 0, 'valid scoped plumbing declarations'));
/** Compile TypeScript author plumbing into validated data with no callback closures. */
export function parsePlumbing(input: unknown): PlumbingData { return v.parse(PlumbingSchema, input); }
