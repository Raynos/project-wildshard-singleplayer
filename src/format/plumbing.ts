import * as v from 'valibot';
import { isJsonData } from './json';
import { InputActionSchema, InputExtraEntries, InputKeysSchema, InputWhenSchema, inputActionOwned, inputExtraRules } from './inputDeclarations';

const name: v.SchemaWithPipe<readonly [v.StringSchema<undefined>, v.RegexAction<string, undefined>, v.MaxLengthAction<string, 64, undefined>]> = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/u), v.maxLength(64));
const id: v.GenericSchema<`${string}.${string}`> = v.custom<`${string}.${string}`>((value) => typeof value === 'string' && value.length <= 128 && /^[a-z][a-z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/u.test(value), 'namespaced id');
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const inputSchema: v.GenericSchema<PlumbingInputRowsInput, PlumbingInputRows> & { readonly entries: { readonly id: typeof id } } = v.strictObject({ ...InputExtraEntries, id, keysFrom: v.exactOptional(id), priority: v.pipe(v.number(), v.integer(), v.minValue(-100), v.maxValue(100)),
  actions: v.pipe(v.array(v.strictObject({ id: InputActionSchema, keys: v.exactOptional(InputKeysSchema), scene: v.exactOptional(id) })), v.minLength(1), v.maxLength(32)),
  when: v.exactOptional(InputWhenSchema), touch: v.exactOptional(v.strictObject({ slot: v.picklist(['verb.1', 'verb.2']), action: InputActionSchema, label: text, icon: v.pipe(v.string(), v.maxLength(512)) })) });
const knob = v.pipe(v.strictObject({ id, phone: v.union([finite, v.boolean()]), desktop: v.union([finite, v.boolean()]) }),
  v.check(row => typeof row.phone === typeof row.desktop, 'Tier knob kinds must agree'));
const choice = v.strictObject({ value: name, text, scene: v.exactOptional(id) });
/** Shared request identity for declared Debug rows and score pins. */
export const PlumbingAskSchema: v.GenericSchema<PlumbingAskIdInput, PlumbingAskId> = v.custom<`E${number}`>((value) => typeof value === 'string' && /^E[1-9][0-9]*$/u.test(value), 'ask id');
const debug: v.StrictObjectSchema<{ readonly id: v.GenericSchema<PlumbingDebugRowsInput['id'], PlumbingDebugRows['id']>; readonly group: v.GenericSchema<PlumbingDebugRowsInput['group'], PlumbingDebugRows['group']>; readonly label: v.GenericSchema<PlumbingDebugRowsInput['label'], PlumbingDebugRows['label']>; readonly choices: v.GenericSchema<PlumbingDebugRowsInput['choices'], PlumbingDebugRows['choices']>; readonly initial: v.GenericSchema<PlumbingDebugRowsInput['initial'], PlumbingDebugRows['initial']>; readonly note: v.GenericSchema<PlumbingDebugRowsInput['note'], PlumbingDebugRows['note']>; readonly ask: v.GenericSchema<PlumbingDebugRowsInput['ask'], PlumbingDebugRows['ask']>; readonly reviewBy: v.SchemaWithPipe<readonly [v.StringSchema<undefined>, v.RegexAction<string, undefined>]>; }, undefined> = v.strictObject({ id, group: v.picklist(['look', 'cover', 'sky', 'audio', 'combat', 'creatures', 'perf', 'loading', 'tools']), label: text, choices: v.pipe(v.array(choice), v.minLength(2), v.maxLength(16)), initial: name, note: text, ask: PlumbingAskSchema, reviewBy: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/u)) });
const raw: v.StrictObjectSchema<{ readonly namespace: typeof name; readonly input: v.SchemaWithPipe<readonly [v.ArraySchema<typeof inputSchema, undefined>, v.MaxLengthAction<PlumbingData['input'], 16, undefined>]>; readonly knobs: v.GenericSchema<PlumbingDataInput['knobs'], PlumbingData['knobs']>; readonly debug: v.SchemaWithPipe<readonly [v.ArraySchema<typeof debug, undefined>, v.MaxLengthAction<PlumbingData['debug'], 32, undefined>]>; }, undefined> = v.strictObject({ namespace: name, input: v.pipe(v.array(inputSchema), v.maxLength(16)), knobs: v.pipe(v.array(knob), v.maxLength(32)), debug: v.pipe(v.array(debug), v.maxLength(32)) });
/** Serialisable scoped input actions, tier values and Debug choices with named admitted script hooks. */

/** Semantic identities stay in the owning namespace; Debug defaults and touch actions must exist. */
export function plumbingRules(data: PlumbingData): string[] {
  const errors: string[] = [], own = (key: string): boolean => key.startsWith(`${data.namespace}.`);
  const unique = (ids: readonly string[]): void => { if (new Set(ids).size !== ids.length) errors.push('unique plumbing ids'); };
  unique(data.input.map((row) => row.id)); unique(data.knobs.map((row) => row.id)); unique(data.debug.map((row) => row.id));
  for (const row of data.input) {
    if (!own(row.id) || row.actions.some((action) => !inputActionOwned(action.id, data.namespace) || action.scene !== undefined && !own(action.scene))) errors.push('owned input namespace');
    if (row.touch !== undefined && !row.actions.some((action) => action.id === row.touch?.action)) errors.push('declared touch action');
    if (row.touch !== undefined && row.verbs?.[row.touch.slot] !== undefined) errors.push('one declaration per touch slot');
    errors.push(...inputExtraRules({ ...row, actions: [] }, row.actions.map(action => action.id), data.namespace));
    if (row.when?.mode !== undefined && row.when.mode === row.when.notMode) errors.push('possible input condition');
  }
  for (const row of data.knobs) if (!own(row.id)) errors.push('owned knob namespace');
  for (const row of data.debug) {
    if (!own(row.id) || row.choices.some((entry) => entry.scene !== undefined && !own(entry.scene))) errors.push('owned debug namespace');
    unique(row.choices.map((entry) => entry.value)); if (!row.choices.some((entry) => entry.value === row.initial)) errors.push('declared debug default');
  }
  return [...new Set(errors)];
}
/** Bound the declarations and reject non-owned, duplicate or dangling settings at admission. */
export const PlumbingSchema: v.SchemaWithPipe<readonly [v.UnknownSchema, v.CheckAction<unknown, 'Plumbing requires plain JSON'>, typeof raw, v.CheckAction<PlumbingData, 'valid scoped plumbing declarations'>]> = v.pipe(v.unknown(), v.check(isJsonData, 'Plumbing requires plain JSON'), raw, v.check((data) => plumbingRules(data).length === 0, 'valid scoped plumbing declarations'));
/** Compile TypeScript author plumbing into validated data with no callback closures. */
export function parsePlumbing(input: unknown): PlumbingData { return v.parse(PlumbingSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type PlumbingInputRowsInput = Omit<v.InferInput<v.ObjectSchema<typeof InputExtraEntries, undefined>>, keyof ({
    id: `${string}.${string}`;
    keysFrom?: `${string}.${string}`;
    priority: number;
    actions: ({
        id: v.InferInput<typeof InputActionSchema>;
        keys?: v.InferInput<typeof InputKeysSchema>;
        scene?: `${string}.${string}`;
    })[];
    when?: v.InferInput<typeof InputWhenSchema>;
    touch?: {
        slot: 'verb.1' | 'verb.2';
        action: v.InferInput<typeof InputActionSchema>;
        label: string;
        icon: string;
    };
})> & {
    id: `${string}.${string}`;
    keysFrom?: `${string}.${string}`;
    priority: number;
    actions: ({
        id: v.InferInput<typeof InputActionSchema>;
        keys?: v.InferInput<typeof InputKeysSchema>;
        scene?: `${string}.${string}`;
    })[];
    when?: v.InferInput<typeof InputWhenSchema>;
    touch?: {
        slot: 'verb.1' | 'verb.2';
        action: v.InferInput<typeof InputActionSchema>;
        label: string;
        icon: string;
    };
};
export type PlumbingInputRows = Omit<v.InferOutput<v.ObjectSchema<typeof InputExtraEntries, undefined>>, keyof ({
    id: `${string}.${string}`;
    keysFrom?: `${string}.${string}`;
    priority: number;
    actions: ({
        id: v.InferOutput<typeof InputActionSchema>;
        keys?: v.InferOutput<typeof InputKeysSchema>;
        scene?: `${string}.${string}`;
    })[];
    when?: v.InferOutput<typeof InputWhenSchema>;
    touch?: {
        slot: 'verb.1' | 'verb.2';
        action: v.InferOutput<typeof InputActionSchema>;
        label: string;
        icon: string;
    };
})> & {
    id: `${string}.${string}`;
    keysFrom?: `${string}.${string}`;
    priority: number;
    actions: ({
        id: v.InferOutput<typeof InputActionSchema>;
        keys?: v.InferOutput<typeof InputKeysSchema>;
        scene?: `${string}.${string}`;
    })[];
    when?: v.InferOutput<typeof InputWhenSchema>;
    touch?: {
        slot: 'verb.1' | 'verb.2';
        action: v.InferOutput<typeof InputActionSchema>;
        label: string;
        icon: string;
    };
};
interface PlumbingDebugRowsInputFields {
    id: `${string}.${string}`;
    group: 'look' | 'cover' | 'sky' | 'audio' | 'combat' | 'creatures' | 'perf' | 'loading' | 'tools';
    label: string;
    choices: ({
        value: string;
        text: string;
        scene?: `${string}.${string}`;
    })[];
    initial: string;
    note: string;
    ask: PlumbingAskIdInput;
    reviewBy: string;
}
export type PlumbingDebugRowsInput = { [Key in keyof PlumbingDebugRowsInputFields]: PlumbingDebugRowsInputFields[Key] };
interface PlumbingDebugRowsFields {
    id: `${string}.${string}`;
    group: 'look' | 'cover' | 'sky' | 'audio' | 'combat' | 'creatures' | 'perf' | 'loading' | 'tools';
    label: string;
    choices: ({
        value: string;
        text: string;
        scene?: `${string}.${string}`;
    })[];
    initial: string;
    note: string;
    ask: PlumbingAskId;
    reviewBy: string;
}
export type PlumbingDebugRows = { [Key in keyof PlumbingDebugRowsFields]: PlumbingDebugRowsFields[Key] };
export type PlumbingAskIdInput = PlumbingAskId;
export type PlumbingAskId = `E${number}`;
interface PlumbingDataInputFields {
    namespace: string;
    input: (PlumbingInputRowsInput)[];
    knobs: ({
        id: `${string}.${string}`;
        phone: (number) | (boolean);
        desktop: (number) | (boolean);
    })[];
    debug: (PlumbingDebugRowsInput)[];
}
export type PlumbingDataInput = { [Key in keyof PlumbingDataInputFields]: PlumbingDataInputFields[Key] };
interface PlumbingDataFields {
    namespace: string;
    input: (PlumbingInputRows)[];
    knobs: ({
        id: `${string}.${string}`;
        phone: (number) | (boolean);
        desktop: (number) | (boolean);
    })[];
    debug: (PlumbingDebugRows)[];
}
export type PlumbingData = { [Key in keyof PlumbingDataFields]: PlumbingDataFields[Key] };
export type PlumbingRowsInput = unknown;
export type PlumbingRows = PlumbingData;
