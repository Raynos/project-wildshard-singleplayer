import * as v from 'valibot';
import { isJsonData } from './json';

const identifier = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const unit = v.pipe(finite, v.minValue(0), v.maxValue(1));
const texture = v.strictObject({ url: identifier, srgb: v.boolean(), repeat: v.boolean() });
/** Client-only appearance rows for fixed and streamed instance fields. They
 * describe materials and numeric vertex channels, never placement or culling. */
export const CoverAppearanceSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Cover appearance requires plain JSON'),
  v.strictObject({ textures: v.optional(v.record(identifier, texture), {}),
    kinds: v.pipe(v.array(v.strictObject({ id: identifier, graph: identifier, texture: v.exactOptional(identifier), name: v.exactOptional(identifier),
      attributes: v.optional(v.pipe(v.record(v.pipe(identifier, v.regex(/^a[A-Z][a-zA-Z0-9]*$/u)), finite), v.maxEntries(32)), {}), shadow: v.optional(v.boolean(), false),
      properties: v.optional(v.strictObject({ alphaTest: v.exactOptional(unit), roughness: v.exactOptional(unit),
        polygonOffset: v.exactOptional(v.boolean()), polygonOffsetFactor: v.exactOptional(finite), polygonOffsetUnits: v.exactOptional(finite) }), {}) })), v.maxLength(64)),
    params: v.optional(v.strictObject({ viewer: v.exactOptional(identifier), shift: v.exactOptional(identifier), sunTint: v.exactOptional(identifier) }), {}) }),
  v.check(row => new Set(row.kinds.map(kind => kind.id)).size === row.kinds.length
    && row.kinds.every(kind => kind.texture === undefined || row.textures[kind.texture] !== undefined)
    && Object.keys(row.textures).length <= 64, 'Unique kinds and declared bounded textures'));
export type CoverAppearanceRow = v.InferOutput<typeof CoverAppearanceSchema>;
/** Refuse executable values and missing textures at publication and client intake. */
export function parseCoverAppearance(input: unknown): CoverAppearanceRow { return v.parse(CoverAppearanceSchema, input); }
