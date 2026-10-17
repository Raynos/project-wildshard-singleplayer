import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100_000_000));
/** Existing packed-geometry codec metadata, shared by collection displays and held finish extras. */
export const PackedGeometryRowsSchema = v.strictObject({ bytes: natural,
  geometries: v.pipe(v.array(v.strictObject({
    attrs: v.pipe(v.array(v.tuple([text, natural])), v.maxLength(32)), count: natural, unique: natural,
    own: v.nullable(v.picklist(['u16', 'u32'])), indexCount: natural,
    groups: v.exactOptional(v.pipe(v.array(v.strictObject({ start: natural, count: natural, materialIndex: natural })), v.maxLength(128))),
  })), v.maxLength(128)),
});
