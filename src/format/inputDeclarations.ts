import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)*$/u), v.maxLength(128));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const coreActions = ['attack', 'reload', 'aim', 'heavy', 'hover', 'lock', 'jump', 'swap', 'swap.next', 'swap.prev', 'swap.ui', 'bolt.cycle',
  'crouch', 'crouch.hold', 'sprint', 'use', 'move', 'look', 'move.forward', 'move.back', 'move.left', 'move.right', 'dodge',
  'pause', 'map', 'journal', 'note', 'confirm', 'back', 'nav.left', 'nav.right', 'tab', 'dive', 'surface',
  'fly.up', 'fly.down', 'fly.boost', 'pane.1', 'pane.2', 'pane.3', 'skip', 'focus', 'quickNote', 'help'] as const;
/** Engine actions or namespaced author actions; namespace ownership is checked by the enclosing section. */
export const InputActionSchema: v.UnionSchema<readonly [v.GenericSchema<(typeof coreActions)[number], (typeof coreActions)[number]>, v.CustomSchema<`${string}.${string}`, v.ErrorMessage<v.CustomIssue> | undefined>], undefined> = v.union([v.picklist(coreActions), v.custom<`${string}.${string}`>(value =>
  typeof value === 'string' && value.length <= 128 && /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)+$/u.test(value), 'Namespaced action')]);
/** A context cannot capture another author's actions through an undeclared namespace. */
export function inputActionOwned(action: string, namespace: string): boolean {
  return coreActions.some(value => value === action) || action.startsWith(`${namespace}.`) || /^swap\.slot\.[1-9]$/u.test(action);
}
/** Physical bindings use the engine's existing keyboard/mouse code vocabulary. */
export const InputKeysSchema: v.SchemaWithPipe<readonly [v.ArraySchema<v.SchemaWithPipe<readonly [v.StringSchema<undefined>, v.RegexAction<string, undefined>]>, undefined>, v.MaxLengthAction<string[], 4, undefined>]> = v.pipe(v.array(v.pipe(v.string(), v.regex(/^(?:Key[A-Z]|Digit[0-9]|Mouse[0-4]|Space|Enter|Escape|Tab|Slash|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right))$/u))), v.maxLength(4));
/** A closed conjunction of host-owned observations, never an authored predicate. */
export const InputWhenSchema: v.GenericSchema<InputWhenInput, InputWhen> = v.strictObject({ mode: v.exactOptional(v.picklist(['foot', 'board', 'swim', 'wade', 'ride', 'grapple', 'glide', 'climb', 'drive'])), notMode: v.exactOptional(v.picklist(['foot', 'board', 'swim', 'wade', 'ride', 'grapple', 'glide', 'climb', 'drive'])),
  item: v.exactOptional(v.pipe(v.string(), v.regex(/^(?:weapon|tool)\.[a-zA-Z0-9.-]+$/u), v.maxLength(128))), flag: v.exactOptional(id) });
const verb = v.strictObject({ action: InputActionSchema, label: text, icon: text });
const relabel = v.strictObject({ label: text, icon: v.exactOptional(text), tone: v.exactOptional(v.picklist(['rest', 'ready', 'active'])) });
/** Extra item controls and free-input rows share the same bounded presentation and bindings. */
export const InputExtraEntries: { [Key in keyof InputExtra]-?: v.ExactOptionalSchema<v.GenericSchema<Exclude<InputExtra[Key], undefined>, Exclude<InputExtra[Key], undefined>>, undefined> } = {
  actions: v.exactOptional(v.pipe(v.array(v.strictObject({ id: InputActionSchema, keys: v.exactOptional(InputKeysSchema) })), v.maxLength(32))),
  blocks: v.exactOptional(v.union([v.literal('below'), v.pipe(v.array(InputActionSchema), v.maxLength(32))])),
  relabel: v.exactOptional(v.strictObject({ r0: v.exactOptional(relabel), r1: v.exactOptional(relabel), r2: v.exactOptional(relabel), r3: v.exactOptional(relabel), aim: v.exactOptional(relabel), up0: v.exactOptional(relabel),
    'lean-l': v.exactOptional(relabel), 'lean-r': v.exactOptional(relabel), 'edge-r': v.exactOptional(relabel), 'edge-l': v.exactOptional(relabel), lock: v.exactOptional(relabel), jump: v.exactOptional(relabel) })),
  verbs: v.exactOptional(v.strictObject({ 'verb.1': v.exactOptional(verb), 'verb.2': v.exactOptional(verb) })),
  hiddenWhen: v.exactOptional(InputWhenSchema),
  describe: v.exactOptional(v.pipe(v.array(v.strictObject({ group: id, id, label: text, actions: v.pipe(v.array(InputActionSchema), v.minLength(1), v.maxLength(32)),
    chips: v.exactOptional(v.boolean()), shares: v.exactOptional(v.pipe(v.array(id), v.maxLength(32))) })), v.maxLength(32))),
};
/** An item's declared additions to its baseline weapon context. */
export const InputExtraSchema: v.GenericSchema<InputExtraInput, InputExtra> = v.pipe(v.unknown(), v.check(isJsonData, 'Input requires plain JSON'), v.strictObject(InputExtraEntries));


/** Read-only observation supplied by the platform's input owner. */
export interface InputObservation { readonly mode: string; readonly item: string | null; readonly flags: readonly string[] }
/** Verify bindings, touch verbs and descriptions against the context's actual admitted action set. */
export function inputExtraRules(extra: InputExtra | undefined, baseline: readonly string[], namespace: string): string[] {
  if (extra === undefined) return [];
  const actions = [...baseline, ...(extra.actions ?? []).map(row => row.id)], errors: string[] = [];
  if (new Set(actions).size !== actions.length) errors.push('unique context actions');
  if (actions.some(action => !inputActionOwned(action, namespace)) || Array.isArray(extra.blocks) && extra.blocks.some(action => !inputActionOwned(action, namespace))) errors.push('owned context actions');
  if (Object.values(extra.verbs ?? {}).some(control => !actions.includes(control.action)) || (extra.describe ?? []).some(row => row.actions.some(action => !actions.includes(action)))) errors.push('declared context actions');
  if (extra.hiddenWhen?.mode !== undefined && extra.hiddenWhen.mode === extra.hiddenWhen.notMode) errors.push('possible input condition');
  return errors;
}
/** Every present condition must hold; an absent condition always holds. */
export function inputWhenMatches(when: InputWhen | undefined, state: InputObservation): boolean {
  return when === undefined || (when.mode === undefined || state.mode === when.mode) && (when.notMode === undefined || state.mode !== when.notMode)
    && (when.item === undefined || state.item === when.item) && (when.flag === undefined || state.flags.includes(when.flag));
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type InputActionRowsInput = InputActionRows;
export type InputActionRows = ((typeof coreActions)[number]) | (`${string}.${string}`);
export type InputKeyRowsInput = InputKeyRows;
export type InputKeyRows = (string)[];
export type InputWhenInput = InputWhen;
interface InputWhenFields {
    mode?: 'foot' | 'board' | 'swim' | 'wade' | 'ride' | 'grapple' | 'glide' | 'climb' | 'drive';
    notMode?: 'foot' | 'board' | 'swim' | 'wade' | 'ride' | 'grapple' | 'glide' | 'climb' | 'drive';
    item?: string;
    flag?: string;
}
export type InputWhen = { [Key in keyof InputWhenFields]: InputWhenFields[Key] };
export type InputExtraInput = unknown;
interface InputExtraFields {
    actions?: ({
        id: InputActionRows;
        keys?: InputKeyRows;
    })[];
    blocks?: ('below') | ((InputActionRows)[]);
    relabel?: {
        r0?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        r1?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        r2?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        r3?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        aim?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        up0?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        'lean-l'?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        'lean-r'?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        'edge-r'?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        'edge-l'?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        lock?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
        jump?: {
            label: string;
            icon?: string;
            tone?: 'rest' | 'ready' | 'active';
        };
    };
    verbs?: {
        'verb.1'?: {
            action: InputActionRows;
            label: string;
            icon: string;
        };
        'verb.2'?: {
            action: InputActionRows;
            label: string;
            icon: string;
        };
    };
    hiddenWhen?: InputWhen;
    describe?: ({
        group: string;
        id: string;
        label: string;
        actions: (InputActionRows)[];
        chips?: boolean;
        shares?: (string)[];
    })[];
}
export type InputExtra = { [Key in keyof InputExtraFields]: InputExtraFields[Key] };
