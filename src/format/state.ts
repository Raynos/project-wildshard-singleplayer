import * as v from 'valibot';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';

const positive = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER));
const finite: v.GenericSchema<number, number> & { readonly pipe: readonly [unknown, v.FiniteAction<number, undefined>] } = v.pipe(v.number(), v.finite());
const field: v.StrictObjectSchema<{ readonly id: v.GenericSchema<StateFieldRowsInput['id'], StateFieldRows['id']>; readonly name: v.GenericSchema<string, string> & { readonly pipe: readonly [unknown, v.RegexAction<string, undefined>, unknown] }; readonly type: v.GenericSchema<StateFieldRowsInput['type'], StateFieldRows['type']>; readonly privacy: v.GenericSchema<StateFieldRowsInput['privacy'], StateFieldRows['privacy']>; readonly default: v.GenericSchema<StateFieldRowsInput['default'], StateFieldRows['default']> & { readonly options: readonly [unknown, typeof finite, unknown] }; readonly min: v.OptionalSchema<v.GenericSchema<Exclude<StateFieldRowsInput['min'], undefined>, Exclude<StateFieldRows['min'], undefined>>, undefined>; readonly max: v.OptionalSchema<v.GenericSchema<Exclude<StateFieldRowsInput['max'], undefined>, Exclude<StateFieldRows['max'], undefined>>, undefined>; }, undefined> = v.strictObject({ id: v.pipe(positive, v.maxValue(0x7fffffff)), name: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(limits.idCharacters)),
  type: v.picklist(['bool', 'i32', 'f64', 'string']), privacy: v.picklist(['public', 'owner', 'host']),
  default: v.union([v.boolean(), finite, v.pipe(v.string(), v.maxLength(limits.textCharacters))]), min: v.optional(finite), max: v.optional(finite) });
const fieldList: v.GenericSchema<StateInput['shared'], State['shared']> & { readonly pipe: readonly [v.ArraySchema<typeof field, undefined>, unknown] } = v.pipe(v.array(field), v.maxLength(limits.stateFields));
const declaration: v.StrictObjectSchema<{ readonly version: v.GenericSchema<StateInput['version'], State['version']>; readonly sharedOwner: v.GenericSchema<StateInput['sharedOwner'], State['sharedOwner']>; readonly playerKey: v.GenericSchema<StateInput['playerKey'], State['playerKey']>; readonly shared: typeof fieldList; readonly player: typeof fieldList; }, undefined> = v.strictObject({ version: positive, sharedOwner: v.literal('host'), playerKey: v.literal('actorId'), shared: fieldList, player: fieldList });

/** Portable state declarations have the same typed defaults, bounds, identity and capacity rules as current full-format admission. */
export function stateRules(state: State): string[] {
  const errors: string[] = [], fields = [...state.shared, ...state.player];
  for (const list of [state.shared, state.player]) {
    if (new Set(list.map((item) => item.name)).size !== list.length) errors.push('unique state fields');
    for (const item of list) if (item.type === 'bool' ? typeof item.default !== 'boolean' : item.type === 'string' ? typeof item.default !== 'string'
      : typeof item.default !== 'number' || (item.type === 'i32' && (!Number.isInteger(item.default) || item.default < -2147483648 || item.default > 2147483647))) errors.push('typed state default');
  }
  if (new Set(fields.map((item) => item.id)).size !== fields.length) errors.push('unique stable state ids');
  if (fields.filter((item) => item.type !== 'string').length > 24) errors.push('numeric script state capacity');
  for (const item of fields) {
    if (item.type === 'string') { if (item.min !== undefined || item.max !== undefined) errors.push('numeric state bounds only'); continue; }
    const low = item.type === 'bool' ? 0 : item.type === 'i32' ? -2147483648 : -Number.MAX_VALUE;
    const high = item.type === 'bool' ? 1 : item.type === 'i32' ? 2147483647 : Number.MAX_VALUE;
    const min = item.min ?? low, max = item.max ?? high, value = typeof item.default === 'boolean' ? Number(item.default) : item.default;
    if (min < low || max > high || min > max || (item.type !== 'f64' && (!Number.isInteger(min) || !Number.isInteger(max))) || typeof value !== 'number' || value < min || value > max) errors.push('typed state bounds');
  }
  return [...new Set(errors)];
}
/** Strict renderer-neutral state projection; validating it never admits a cached product's geometry or scripts. */
export const StateSchema: v.SchemaWithPipe<readonly [typeof declaration, v.CheckAction<State, 'state declaration semantic rules'>]> = v.pipe(declaration, v.check((state) => stateRules(state).length === 0, 'state declaration semantic rules'));

/** Admitted data contracts, independent of validator implementation metadata. */
export type StateFieldRowsInput = StateFieldRows;
interface StateFieldRowsFields {
    id: number;
    name: string;
    type: 'bool' | 'i32' | 'f64' | 'string';
    privacy: 'public' | 'owner' | 'host';
    default: (boolean) | (number) | (string);
    min?: number | undefined;
    max?: number | undefined;
}
export type StateFieldRows = { [Key in keyof StateFieldRowsFields]: StateFieldRowsFields[Key] };
interface StateInputFields {
    version: number;
    sharedOwner: 'host';
    playerKey: 'actorId';
    shared: (StateFieldRowsInput)[];
    player: (StateFieldRowsInput)[];
}
export type StateInput = { [Key in keyof StateInputFields]: StateInputFields[Key] };
interface StateFields {
    version: number;
    sharedOwner: 'host';
    playerKey: 'actorId';
    shared: (StateFieldRows)[];
    player: (StateFieldRows)[];
}
export type State = { [Key in keyof StateFields]: StateFields[Key] };
export type StateRowsInput = StateInput;
export type StateRows = State;
