import * as v from 'valibot';
import { isJsonData } from './json';

/** Little-endian IEEE scalars in a zlib stream. Count bounds the decoder's
 * allocation independently of compression ratio; neither caller resamples. */
export interface ScalarChannelRows { type:'f32'|'f64';count:number;data:string|{file:string} }
export const ScalarChannelSchema:v.GenericSchema<unknown,ScalarChannelRows> = v.pipe(v.unknown(),v.check(isJsonData,'Scalar channel requires plain JSON'),v.strictObject({
  type: v.picklist(['f32','f64']),count: v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(4194304)),
  data: v.union([v.pipe(v.string(),v.minLength(8),v.maxLength(44761088),v.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)),
    v.strictObject({file:v.pipe(v.string(),v.maxLength(240),v.regex(/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.bin$/u))})]),
}));

/** An original square f32 raster; sampling policy remains the existing baked-terrain law. */
export interface ScalarLatticeRows {res:number;size:number;values:ScalarChannelRows}
export const ScalarLatticeSchema:v.GenericSchema<unknown,ScalarLatticeRows> = v.pipe(v.unknown(),v.check(isJsonData,'Scalar lattice requires plain JSON'),v.strictObject({
  res: v.pipe(v.number(),v.integer(),v.minValue(2),v.maxValue(2048)),
  size: v.pipe(v.number(),v.finite(),v.minValue(Number.MIN_VALUE)),values: ScalarChannelSchema,
}),v.check(row => row.values.type === 'f32' && row.values.count === row.res*row.res,'Lattice requires one f32 per sample'));

/** Three explicitly ordered native rasters, with no runtime channel-name resolution. */
export type ScalarTripletRows = [ScalarLatticeRows,ScalarLatticeRows,ScalarLatticeRows];
export const ScalarTripletSchema:v.GenericSchema<unknown,ScalarTripletRows> = v.pipe(v.unknown(),v.check(isJsonData,'Scalar triplet requires plain JSON'),v.strictTuple([ScalarLatticeSchema,ScalarLatticeSchema,ScalarLatticeSchema]));

/** Interpret one bounded native channel after the caller admits its metadata and resolves its compressed block.
 * The injected codec performs one bounded inflate. No conversion, IO, cache or interpolation runs here. */
export function decodeScalarStorage(row: Pick<ScalarChannelRows, 'type' | 'count'>, source: Uint8Array,
  inflate: (source: Uint8Array, out: Uint8Array) => Uint8Array): Float32Array | Float64Array {
  if ((row.type !== 'f32' && row.type !== 'f64') || !Number.isInteger(row.count) || row.count < 0 || row.count > 4194304)
    throw new Error('Invalid scalar storage bounds');
  const length = row.count * (row.type === 'f32' ? 4 : 8);
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) throw new Error('Scalar channel requires little-endian storage');
  const bytes = inflate(source, new Uint8Array(length + 1));
  if (bytes.length !== length) throw new Error('Scalar channel length mismatch');
  const values = row.type === 'f32' ? new Float32Array(bytes.buffer, bytes.byteOffset, row.count)
    : new Float64Array(bytes.buffer, bytes.byteOffset, row.count);
  if (!values.every(Number.isFinite)) throw new Error('Non-finite scalar channel');
  return values;
}
