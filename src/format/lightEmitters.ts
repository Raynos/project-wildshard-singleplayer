import * as v from 'valibot';
import { isJsonData } from './json';
import { SceneDrawsSchema } from './sceneDraws';
import { HandleIdSchema, ScenePointRefSchema } from './sceneRefs';

const id = HandleIdSchema;
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const gain = v.pipe(finite, v.minValue(0));
const xyz = v.tuple([finite, finite, finite]);
/** Numeric light rows feed both a bounded live uniform and baked irradiance volumes. Colours are linear. */
export const LightPoolRowSchema: v.GenericSchema<LightPoolRowInput, LightPoolRow> = v.strictObject({ id, at: xyz, colour: xyz, gain, radius: positive, cut: positive, initially: v.optional(v.boolean(), true) });

const waves = v.pipe(v.array(xyz), v.maxLength(8));
/** Client-only emitters use published scene parts, compiled looks and GPU motion; no shard callbacks. */
export const LightEmittersSchema: v.GenericSchema<LightEmittersRowsInput, LightEmittersRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Emitters require plain JSON'), v.strictObject({
  version: v.literal(1), input: id, clock: id,
  rows: v.pipe(v.array(v.strictObject({ id, parent: id, at: v.exactOptional(ScenePointRefSchema),
    pool: v.exactOptional(v.strictObject({ slot: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(3)), gain })),
    initially: v.optional(v.boolean(), true), draws: SceneDrawsSchema,
    emissive: v.exactOptional(v.strictObject({ collection: id, gain })),
    light: v.exactOptional(v.strictObject({ at: ScenePointRefSchema, part: v.exactOptional(id), colour: finite, gain, distance: positive, decay: gain,
      shared: v.optional(v.boolean(), true), waves: v.optional(waves, []) })),
  })), v.maxLength(128)),
}), v.check(row => new Set(row.rows.map(entry => entry.id)).size === row.rows.length
  && new Set(row.rows.flatMap(entry => entry.pool === undefined ? [] : [entry.pool.slot])).size === row.rows.filter(entry => entry.pool !== undefined).length
  && row.rows.every(entry => entry.light?.shared !== true || entry.light.decay === 2)
  && row.rows.every(entry => (entry.pool === undefined || entry.at !== undefined) && !(entry.light?.shared === true && entry.light.part !== undefined)), 'Unique emitter ids and valid pool/light references'));

/** Admit every emitter before allocating scene resources. */
export function parseLightEmitters(input: unknown): LightEmittersRows { return v.parse(LightEmittersSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
interface LightPoolRowInputFields {
    id: v.InferInput<typeof HandleIdSchema>;
    at: [
        number,
        number,
        number
    ];
    colour: [
        number,
        number,
        number
    ];
    gain: number;
    radius: number;
    cut: number;
    initially?: boolean | undefined;
}
export type LightPoolRowInput = { [Key in keyof LightPoolRowInputFields]: LightPoolRowInputFields[Key] };
interface LightPoolRowFields {
    id: v.InferOutput<typeof HandleIdSchema>;
    at: [
        number,
        number,
        number
    ];
    colour: [
        number,
        number,
        number
    ];
    gain: number;
    radius: number;
    cut: number;
    initially: boolean;
}
export type LightPoolRow = { [Key in keyof LightPoolRowFields]: LightPoolRowFields[Key] };
export type LightEmittersRowsInput = unknown;
interface LightEmittersRowsFields {
    version: 1;
    input: v.InferOutput<typeof HandleIdSchema>;
    clock: v.InferOutput<typeof HandleIdSchema>;
    rows: ({
        id: v.InferOutput<typeof HandleIdSchema>;
        parent: v.InferOutput<typeof HandleIdSchema>;
        at?: v.InferOutput<typeof ScenePointRefSchema>;
        pool?: {
            slot: number;
            gain: number;
        };
        initially: boolean;
        draws: v.InferOutput<typeof SceneDrawsSchema>;
        emissive?: {
            collection: v.InferOutput<typeof HandleIdSchema>;
            gain: number;
        };
        light?: {
            at: v.InferOutput<typeof ScenePointRefSchema>;
            part?: v.InferOutput<typeof HandleIdSchema>;
            colour: number;
            gain: number;
            distance: number;
            decay: number;
            shared: boolean;
            waves: ([
                number,
                number,
                number
            ])[];
        };
    })[];
}
export type LightEmittersRows = { [Key in keyof LightEmittersRowsFields]: LightEmittersRowsFields[Key] };
