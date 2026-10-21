import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const natural = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0));
const finite = v.pipe(v.number(), v.finite());

/**
 * G571: per-vertex attributes baked into one product file and worn by geometries the world already built (Driftwood's
 * island cover over its faceted ground and baked island tiles). The file holds an optional RGBA half-float texture at its
 * start (`texture`, sampled through `rect`), then, for each part in order at its byte offset, each attribute's
 * `count * size` normalized bytes in turn.
 */
export const VertexWearSchema = v.strictObject({
  file: text,
  texture: v.nullable(v.strictObject({ width: natural, height: natural })),
  rect: v.tuple([finite, finite, finite, finite]),
  parts: v.pipe(v.array(v.tuple([natural, natural])), v.minLength(1), v.maxLength(64)),
  attributes: v.pipe(v.array(v.strictObject({ name: text, size: v.picklist([1, 2, 3, 4]) })), v.minLength(1), v.maxLength(4)),
});
export type VertexWearRow = v.InferOutput<typeof VertexWearSchema>;
