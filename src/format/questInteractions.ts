import * as v from 'valibot';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const names = v.pipe(v.array(name), v.maxLength(64));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const propFinite = v.pipe(v.number(), v.finite());
const gateBox = v.strictObject({ x: propFinite, z: propFinite, hw: propFinite, hd: propFinite, yTop: propFinite, yBottom: propFinite });
const propCount = v.pipe(propFinite, v.integer(), v.minValue(1), v.maxValue(64));
/** Native physical quest props use the existing barrel and gate mechanics.
 * Layered floor rasters preserve captured platform sampling without callbacks. */
export const NativeQuestPropsSchema: v.GenericSchema<NativeQuestPropsRowsInput, NativeQuestPropsRows> = v.strictObject({
  drops: v.optional(v.pipe(v.array(v.strictObject({ id: name, kind: name })), v.maxLength(64)), []),
  floors: v.pipe(v.array(v.strictObject({ x: propFinite, z: propFinite, step: v.pipe(propFinite, v.minValue(0.001)),
    width: propCount, height: propCount, values: v.pipe(v.array(v.nullable(propFinite)), v.maxLength(4096)) })), v.maxLength(64)),
  /** G566: a saved quest-envelope key to the declared body (sim/bodies) whose native handle it carries; the body's decisions are
   *  the shard's own script */
  bodies: v.optional(v.pipe(v.array(v.strictObject({ owner: name, body: name })), v.maxLength(64)), []),
  gates: v.pipe(v.array(v.strictObject({ flag: name,
    box: gateBox })), v.maxLength(64)),
});
/** A gate borrows either its exact baked box or an already registered moving piece. */
export const QuestFlagGatesSchema: v.GenericSchema<QuestFlagGatesRowsInput, QuestFlagGatesRows> = v.strictObject({ quest: v.exactOptional(name),
  gates: v.pipe(v.array(v.strictObject({ id: name, name: v.exactOptional(name), opensWhen: condition,
    target: v.variant('kind', [
      v.strictObject({ kind: v.literal('box'), box: gateBox }),
      v.strictObject({ kind: v.literal('piece'), piece: name }),
    ]),
  })), v.maxLength(64), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique gate ids')),
});
/** Admitted gate identities, flag conditions and exact existing collision targets. */

const need = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names), else: v.exactOptional(name) });
const row = v.strictObject({
  id: name, act: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), at: name, crack: v.exactOptional(v.picklist(['light', 'heavy'])),
  needs: v.exactOptional(v.pipe(v.array(need), v.maxLength(16))), sets: v.pipe(names, v.minLength(1)),
});
const unique = (list: readonly (string | number)[]): boolean => new Set(list).size === list.length;
const pathKey = v.pipe(name, v.regex(/^[A-Za-z][A-Za-z0-9_-]*$/u), v.check(key => !['constructor', 'prototype', '__proto__', 'caller', 'callee', 'arguments'].includes(key), 'safe borrowed property'));
const ownerPath: v.StrictObjectSchema<{ readonly target: v.GenericSchema<QuestOwnerPathRowsInput['target'], QuestOwnerPathRows['target']>; readonly owner: v.GenericSchema<QuestOwnerPathRowsInput['owner'], QuestOwnerPathRows['owner']>; readonly path: v.GenericSchema<QuestOwnerPathRowsInput['path'], QuestOwnerPathRows['path']>; }, undefined> = v.strictObject({ target: name, owner: name,
  path: v.pipe(v.array(v.union([pathKey, v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(1024))])), v.minLength(1), v.maxLength(16)) });
const ownerPaths = v.pipe(v.array(ownerPath), v.maxLength(128), v.check(rows => unique(rows.map(entry => entry.target)), 'unique borrowed targets'));
const ownerCalls = v.pipe(v.array(v.strictObject({ ...ownerPath.entries, optional: v.exactOptional(v.boolean()),
  delay: v.exactOptional(v.pipe(v.number(),v.safeInteger(),v.minValue(0),v.maxValue(60000))),
  args: v.exactOptional(v.pipe(v.array(v.union([v.pipe(v.string(), v.maxLength(4096)), v.pipe(v.number(), v.finite()), v.boolean(), v.strictObject({owner:name,path:ownerPath.entries.path})])), v.maxLength(16))) })),
  v.maxLength(128), v.check(rows => unique(rows.map(entry => entry.target)), 'unique borrowed calls'));
const worldFinite = v.pipe(v.number(), v.finite());
const worldPoint = v.variant('kind', [
  v.strictObject({ kind: v.literal('point'), x: worldFinite, y: worldFinite, z: worldFinite }),
  v.strictObject({ kind: v.literal('owner'), owner: name, path: ownerPath.entries.path }),
]);
const worldReactions: v.GenericSchema<QuestWorldReactionsDataInput, QuestWorldReactionsData> = v.pipe(v.array(v.strictObject({ id: name, at: worldPoint,
  radius: v.pipe(worldFinite, v.minValue(0), v.maxValue(100)), needs: v.exactOptional(condition),
  action: v.exactOptional(name), sets: v.exactOptional(names), toast: v.exactOptional(v.pipe(v.string(), v.maxLength(4096))),
  heavy: v.exactOptional(v.boolean()), second: v.exactOptional(v.boolean()), lightHint: v.exactOptional(v.pipe(v.string(), v.maxLength(4096))),
  cone: v.exactOptional(v.strictObject({ reach: v.pipe(worldFinite, v.minValue(0), v.maxValue(100)), halfAngle: v.pipe(worldFinite, v.minValue(0), v.maxValue(Math.PI)) })),
})), v.maxLength(64), v.check(rows => unique(rows.map(entry => entry.id)) && rows.every(entry => entry.action !== undefined || (entry.sets?.length ?? 0) > 0), 'unique world reactions with an accepted effect'));
/** Bounded world hits: borrowed or authored points, existing contact shapes, flag gates and named page actions. */

/** Named schema boundary for optional world reactions. */
export const QuestWorldReactionsSchema: v.GenericSchema<unknown, QuestWorldReactionsData> = worldReactions;
/** Refuse malformed positions, unsafe borrowed paths and unbounded or effect-free reactions. */
export function parseQuestWorldReactions(input: unknown): QuestWorldReactionsData { return v.parse(QuestWorldReactionsSchema, input); }

/**
 * Declared interaction rows (SF72): the transient `marks` an interaction keeps outside the durable flags (a raised well
 * bucket, an oiled bowl), each optionally starting set when its `initial` condition holds on the flags at install; the
 * `rows`, each a prompt or a crack (`crack: 'light' | 'heavy'`) at a named spot (`at`), answering a `script` command whose
 * value is its `act`: its `needs` are checked in order and the first unmet one refuses with its `else` reason, otherwise
 * its `sets` are raised (marks first, then durable flags); and `never`, the mark combinations a restore refuses.
 */
export const InteractionRowsSchema: v.GenericSchema<InteractionRowsDataInput, InteractionRowsData> = v.pipe(
  v.strictObject({ marks: v.pipe(v.array(v.strictObject({ id: name, initial: v.exactOptional(condition) })), v.maxLength(256)),
    rows: v.pipe(v.array(row), v.maxLength(256)), never: v.exactOptional(v.pipe(v.array(condition), v.maxLength(64))) }),
  v.check(data => unique(data.marks.map(mark => mark.id)) && unique(data.rows.map(entry => entry.id)) && unique(data.rows.map(entry => entry.act)), 'unique mark ids, row ids and acts'),
);
/** Validated interaction rows (`InteractionRowsSchema`). */

/** One declared row. */
export type InteractionRow = InteractionRowsData['rows'][number];
/** Compile authored interaction rows; an unknown field, a duplicate id or act, or an empty `sets` refuses. */
export function parseInteractionRows(input: unknown): InteractionRowsData { return v.parse(InteractionRowsSchema, input); }

const pageText=v.pipe(v.string(),v.maxLength(4096));
const pageEffect=v.variant('kind',[
  v.strictObject({kind:v.literal('emitter'),target:name,value:v.boolean()}),
  v.strictObject({kind:v.literal('label'),target:name,text:pageText}),
  v.strictObject({kind:v.literal('visible'),target:name,value:v.boolean()}),
  v.strictObject({kind:v.literal('call'),target:name}),
  v.strictObject({kind:v.literal('toast'),text:pageText,progress:v.exactOptional(v.strictObject({flags:names,complete:pageText}))}),
  v.strictObject({kind:v.literal('mark'),target:name,value:v.boolean()}),
]);
const pageEffects=v.pipe(v.array(pageEffect),v.maxLength(64));
/** Bounded page presentation over admitted native interaction rules, with borrowed view/command identities. */
const pageRaw: v.GenericSchema<QuestPageInteractionsDataInput, QuestPageInteractionsData>=v.pipe(v.strictObject({
  actions:v.pipe(v.array(v.strictObject({id:name,interaction:v.exactOptional(name),
    needs:v.exactOptional(v.pipe(v.array(need),v.maxLength(16))),
    denied:v.exactOptional(v.record(name,pageText)),refused:v.exactOptional(v.pipe(v.record(name,pageEffects),v.check(value=>Object.keys(value).length<=16,'bounded refusal effects'))),before:v.exactOptional(pageEffects),after:v.exactOptional(pageEffects)})),v.maxLength(128)),
  world:v.exactOptional(QuestWorldReactionsSchema),
  prompts:v.exactOptional(v.pipe(v.array(v.strictObject({id:name,label:pageText,at:v.strictObject({owner:name,path:ownerPath.entries.path}),
    radius:v.pipe(worldFinite,v.minValue(0),v.maxValue(100)),when:v.exactOptional(condition),
    labels:v.exactOptional(v.pipe(v.array(v.strictObject({when:condition,text:pageText})),v.maxLength(16)))})),v.maxLength(128),v.check(rows=>unique(rows.map(entry=>entry.id)),'unique page prompts'))),
  bindings:v.exactOptional(v.strictObject({ labels:v.exactOptional(ownerPaths), visible:v.exactOptional(ownerPaths),
    observations:v.exactOptional(ownerPaths), calls:v.exactOptional(ownerCalls), prompts:v.exactOptional(ownerPaths) })),
  initial:v.exactOptional(v.pipe(v.array(v.strictObject({when:condition,effects:pageEffects})),v.maxLength(64))),
}),v.check(data=>unique(data.actions.map(action=>action.id)),'unique page interaction ids'));
/** Validated page action and restore-view rows; no new durable state is introduced. */

/** Named schema boundary keeps the optional page rows out of recursive shardfile inference. */
export const QuestPageInteractionsSchema:v.GenericSchema<unknown,QuestPageInteractionsData>=pageRaw;
/** Refuse malformed/unknown presentation fields and duplicate actions before any borrowed view is changed. */
export function parseQuestPageInteractions(input:unknown):QuestPageInteractionsData{return v.parse(QuestPageInteractionsSchema,input);}

/** Admitted data contracts, independent of validator implementation metadata. */
export type QuestOwnerPathRowsInput = QuestOwnerPathRows;
interface QuestOwnerPathRowsFields {
    target: string;
    owner: string;
    path: ((string) | (number))[];
}
export type QuestOwnerPathRows = { [Key in keyof QuestOwnerPathRowsFields]: QuestOwnerPathRowsFields[Key] };
interface NativeQuestPropsRowsInputFields {
    drops?: ({
        id: string;
        kind: string;
    })[] | undefined;
    floors: ({
        x: number;
        z: number;
        step: number;
        width: number;
        height: number;
        values: ((number) | null)[];
    })[];
    bodies?: ({
        owner: string;
        body: string;
    })[] | undefined;
    gates: ({
        flag: string;
        box: {
            x: number;
            z: number;
            hw: number;
            hd: number;
            yTop: number;
            yBottom: number;
        };
    })[];
}
export type NativeQuestPropsRowsInput = { [Key in keyof NativeQuestPropsRowsInputFields]: NativeQuestPropsRowsInputFields[Key] };
interface NativeQuestPropsRowsFields {
    drops: ({
        id: string;
        kind: string;
    })[];
    floors: ({
        x: number;
        z: number;
        step: number;
        width: number;
        height: number;
        values: ((number) | null)[];
    })[];
    bodies: ({
        owner: string;
        body: string;
    })[];
    gates: ({
        flag: string;
        box: {
            x: number;
            z: number;
            hw: number;
            hd: number;
            yTop: number;
            yBottom: number;
        };
    })[];
}
export type NativeQuestPropsRows = { [Key in keyof NativeQuestPropsRowsFields]: NativeQuestPropsRowsFields[Key] };
export type QuestFlagGatesRowsInput = QuestFlagGatesRows;
interface QuestFlagGatesRowsFields {
    quest?: string;
    gates: ({
        id: string;
        name?: string;
        opensWhen: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        target: ({
            kind: 'box';
            box: {
                x: number;
                z: number;
                hw: number;
                hd: number;
                yTop: number;
                yBottom: number;
            };
        }) | ({
            kind: 'piece';
            piece: string;
        });
    })[];
}
export type QuestFlagGatesRows = { [Key in keyof QuestFlagGatesRowsFields]: QuestFlagGatesRowsFields[Key] };
export type QuestWorldReactionsDataInput = ({
    id: string;
    at: ({
        kind: 'point';
        x: number;
        y: number;
        z: number;
    }) | ({
        kind: 'owner';
        owner: string;
        path: v.InferInput<(typeof ownerPath)['entries']['path']>;
    });
    radius: number;
    needs?: {
        all?: (string)[];
        any?: (string)[];
        none?: (string)[];
    };
    action?: string;
    sets?: (string)[];
    toast?: string;
    heavy?: boolean;
    second?: boolean;
    lightHint?: string;
    cone?: {
        reach: number;
        halfAngle: number;
    };
})[];
export type QuestWorldReactionsData = ({
    id: string;
    at: ({
        kind: 'point';
        x: number;
        y: number;
        z: number;
    }) | ({
        kind: 'owner';
        owner: string;
        path: v.InferOutput<(typeof ownerPath)['entries']['path']>;
    });
    radius: number;
    needs?: {
        all?: (string)[];
        any?: (string)[];
        none?: (string)[];
    };
    action?: string;
    sets?: (string)[];
    toast?: string;
    heavy?: boolean;
    second?: boolean;
    lightHint?: string;
    cone?: {
        reach: number;
        halfAngle: number;
    };
})[];
export type InteractionRowsDataInput = InteractionRowsData;
interface InteractionRowsDataFields {
    marks: ({
        id: string;
        initial?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    })[];
    rows: ({
        id: string;
        act: number;
        at: string;
        crack?: 'light' | 'heavy';
        needs?: ({
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
            else?: string;
        })[];
        sets: (string)[];
    })[];
    never?: ({
        all?: (string)[];
        any?: (string)[];
        none?: (string)[];
    })[];
}
export type InteractionRowsData = { [Key in keyof InteractionRowsDataFields]: InteractionRowsDataFields[Key] };
interface QuestPageInteractionsDataInputFields {
    actions: ({
        id: string;
        interaction?: string;
        needs?: ({
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
            else?: string;
        })[];
        denied?: Record<string, string>;
        refused?: Record<string, (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[]>;
        before?: (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[];
        after?: (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[];
    })[];
    world?: v.InferInput<typeof QuestWorldReactionsSchema>;
    prompts?: ({
        id: string;
        label: string;
        at: {
            owner: string;
            path: v.InferInput<(typeof ownerPath)['entries']['path']>;
        };
        radius: number;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        labels?: ({
            when: {
                all?: (string)[];
                any?: (string)[];
                none?: (string)[];
            };
            text: string;
        })[];
    })[];
    bindings?: {
        labels?: (QuestOwnerPathRowsInput)[];
        visible?: (QuestOwnerPathRowsInput)[];
        observations?: (QuestOwnerPathRowsInput)[];
        calls?: (Omit<QuestOwnerPathRowsInput, keyof ({
            optional?: boolean;
            delay?: number;
            args?: ((string) | (number) | (boolean) | ({
                owner: string;
                path: v.InferInput<(typeof ownerPath)['entries']['path']>;
            }))[];
        })> & {
            optional?: boolean;
            delay?: number;
            args?: ((string) | (number) | (boolean) | ({
                owner: string;
                path: v.InferInput<(typeof ownerPath)['entries']['path']>;
            }))[];
        })[];
        prompts?: (QuestOwnerPathRowsInput)[];
    };
    initial?: ({
        when: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        effects: (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[];
    })[];
}
export type QuestPageInteractionsDataInput = { [Key in keyof QuestPageInteractionsDataInputFields]: QuestPageInteractionsDataInputFields[Key] };
interface QuestPageInteractionsDataFields {
    actions: ({
        id: string;
        interaction?: string;
        needs?: ({
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
            else?: string;
        })[];
        denied?: Record<string, string>;
        refused?: Record<string, (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[]>;
        before?: (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[];
        after?: (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[];
    })[];
    world?: v.InferOutput<typeof QuestWorldReactionsSchema>;
    prompts?: ({
        id: string;
        label: string;
        at: {
            owner: string;
            path: v.InferOutput<(typeof ownerPath)['entries']['path']>;
        };
        radius: number;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        labels?: ({
            when: {
                all?: (string)[];
                any?: (string)[];
                none?: (string)[];
            };
            text: string;
        })[];
    })[];
    bindings?: {
        labels?: (QuestOwnerPathRows)[];
        visible?: (QuestOwnerPathRows)[];
        observations?: (QuestOwnerPathRows)[];
        calls?: (Omit<QuestOwnerPathRows, keyof ({
            optional?: boolean;
            delay?: number;
            args?: ((string) | (number) | (boolean) | ({
                owner: string;
                path: v.InferOutput<(typeof ownerPath)['entries']['path']>;
            }))[];
        })> & {
            optional?: boolean;
            delay?: number;
            args?: ((string) | (number) | (boolean) | ({
                owner: string;
                path: v.InferOutput<(typeof ownerPath)['entries']['path']>;
            }))[];
        })[];
        prompts?: (QuestOwnerPathRows)[];
    };
    initial?: ({
        when: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        effects: (({
            kind: 'emitter';
            target: string;
            value: boolean;
        }) | ({
            kind: 'label';
            target: string;
            text: string;
        }) | ({
            kind: 'visible';
            target: string;
            value: boolean;
        }) | ({
            kind: 'call';
            target: string;
        }) | ({
            kind: 'toast';
            text: string;
            progress?: {
                flags: (string)[];
                complete: string;
            };
        }) | ({
            kind: 'mark';
            target: string;
            value: boolean;
        }))[];
    })[];
}
export type QuestPageInteractionsData = { [Key in keyof QuestPageInteractionsDataFields]: QuestPageInteractionsDataFields[Key] };
