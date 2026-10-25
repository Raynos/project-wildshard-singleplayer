import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const natural = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(1_000_000));
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const groups = v.pipe(v.array(v.strictObject({ id: text, todo: v.picklist(['count', 'individual']), label: text,
  spots: v.pipe(v.array(v.strictObject({ flag: text, label: text, short: text, anchor: v.exactOptional(text), x: coordinate, z: coordinate })), v.maxLength(256)) })), v.maxLength(16));
const metric = v.variant('kind', [v.strictObject({ kind: v.literal('time') }), v.strictObject({ kind: v.literal('achievements') }),
  v.strictObject({ kind: v.literal('flags'), flags: v.pipe(v.array(text), v.minLength(1), v.maxLength(256)) }),
  v.strictObject({ kind: v.literal('group'), group: text, total: natural }),
  v.strictObject({ kind: v.literal('title'), fallback: text })]);
/** One product's completion card and bounded live-stat policy; positions are resolved by its generator. */
export const CompletionSchema: v.GenericSchema<CompletionRowsInput, CompletionRows> = v.pipe(v.strictObject({
  doneFlag: text, seenFlag: text, trigger: v.picklist(['reward', 'quest']), system: text,
  before: v.pipe(v.array(text), v.maxLength(32)), after: v.pipe(v.array(text), v.maxLength(32)),
  title: text, card: v.strictObject({ kicker: text, flavour: v.pipe(v.array(text), v.maxLength(16)) }),
  menuSubtitle: text, toastSuffix: text,
  safeRadius: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1e6)),
  pollSeconds: v.pipe(v.number(), v.finite(), v.minValue(0.001), v.maxValue(3600)),
  maximumTodo: v.pipe(natural, v.minValue(1), v.maxValue(256)), more: text,
  coveredEvents: v.pipe(v.array(text), v.maxLength(32)), groups,
  stats: v.pipe(v.array(v.strictObject({ label: text, value: metric })), v.maxLength(16)),
}), v.check(row => new Set(row.groups.map(group => group.id)).size === row.groups.length
  && row.stats.every(stat => { const value = stat.value; return value.kind !== 'group' || row.groups.some(group => group.id === value.group); }), 'Declared completion groups'));
/** Admitted completion policy, independent of rendering, live flags and progress ownership. */

/** Strict author and disk validation; admission never accepts functions or per-shard event callbacks. */
export function parseCompletion(input: unknown): CompletionRows { return v.parse(CompletionSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type CompletionRowsInput = CompletionRows;
interface CompletionRowsFields {
    doneFlag: string;
    seenFlag: string;
    trigger: 'reward' | 'quest';
    system: string;
    before: (string)[];
    after: (string)[];
    title: string;
    card: {
        kicker: string;
        flavour: (string)[];
    };
    menuSubtitle: string;
    toastSuffix: string;
    safeRadius: number;
    pollSeconds: number;
    maximumTodo: number;
    more: string;
    coveredEvents: (string)[];
    groups: ({
        id: string;
        todo: 'count' | 'individual';
        label: string;
        spots: ({
            flag: string;
            label: string;
            short: string;
            anchor?: string;
            x: number;
            z: number;
        })[];
    })[];
    stats: ({
        label: string;
        value: ({
            kind: 'time';
        }) | ({
            kind: 'achievements';
        }) | ({
            kind: 'flags';
            flags: (string)[];
        }) | ({
            kind: 'group';
            group: string;
            total: number;
        }) | ({
            kind: 'title';
            fallback: string;
        });
    })[];
}
export type CompletionRows = { [Key in keyof CompletionRowsFields]: CompletionRowsFields[Key] };
