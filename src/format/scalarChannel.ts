import * as v from 'valibot';
import { isJsonData } from './json';

/** Little-endian IEEE scalars in a zlib stream. Count bounds the decoder's
 * allocation independently of compression ratio; neither caller resamples. */
export const ScalarChannelSchema = v.pipe(v.unknown(),v.check(isJsonData,'Scalar channel requires plain JSON'),v.strictObject({
  type: v.picklist(['f32','f64']),count: v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(4194304)),
  data: v.pipe(v.string(),v.minLength(8),v.maxLength(44761088),v.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)),
}));
export type ScalarChannelRows = v.InferOutput<typeof ScalarChannelSchema>;

/** An original square f32 raster; sampling policy remains the existing baked-terrain law. */
export const ScalarLatticeSchema = v.pipe(v.unknown(),v.check(isJsonData,'Scalar lattice requires plain JSON'),v.strictObject({
  res: v.pipe(v.number(),v.integer(),v.minValue(2),v.maxValue(2048)),
  size: v.pipe(v.number(),v.finite(),v.minValue(Number.MIN_VALUE)),values: ScalarChannelSchema,
}),v.check(row => row.values.type === 'f32' && row.values.count === row.res*row.res,'Lattice requires one f32 per sample'));
export type ScalarLatticeRows = v.InferOutput<typeof ScalarLatticeSchema>;

/** Three explicitly ordered native rasters, with no runtime channel-name resolution. */
export const ScalarTripletSchema = v.pipe(v.unknown(),v.check(isJsonData,'Scalar triplet requires plain JSON'),v.strictTuple([ScalarLatticeSchema,ScalarLatticeSchema,ScalarLatticeSchema]));
export type ScalarTripletRows = v.InferOutput<typeof ScalarTripletSchema>;
