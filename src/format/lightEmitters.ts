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
export const LightPoolRowSchema = v.strictObject({ id, at: xyz, colour: xyz, gain, radius: positive, cut: positive, initially: v.optional(v.boolean(), true) });
export type LightPoolRow = v.InferOutput<typeof LightPoolRowSchema>;
const waves = v.pipe(v.array(xyz), v.maxLength(8));
/** Client-only emitters use published scene parts, compiled looks and GPU motion; no shard callbacks. */
export const LightEmittersSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Emitters require plain JSON'), v.strictObject({
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
export type LightEmittersRows = v.InferOutput<typeof LightEmittersSchema>;
/** Admit every emitter before allocating scene resources. */
export function parseLightEmitters(input: unknown): LightEmittersRows { return v.parse(LightEmittersSchema, input); }
