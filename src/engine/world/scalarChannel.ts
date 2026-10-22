import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { ScalarChannelSchema,ScalarLatticeSchema,type ScalarChannelRows } from '@wildshard/format/scalarChannel';

export function readScalarChannel(input: ScalarChannelRows & { readonly type: 'f32' }): Float32Array;
export function readScalarChannel(input: ScalarChannelRows & { readonly type: 'f64' }): Float64Array;
export function readScalarChannel(input: unknown): Float32Array | Float64Array;
/** One bounded inflate and one typed view, with no conversion, interpolation,
 * owner/cache or second intake. Reject short, oversized and non-finite rows. */
export function readScalarChannel(input: unknown): Float32Array | Float64Array {
  const row = v.parse(ScalarChannelSchema,input), length = row.count*(row.type === 'f32' ? 4 : 8);
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) throw new Error('Scalar channel requires little-endian storage');
  const bytes = unzlibSync(Uint8Array.from(atob(row.data),value => value.codePointAt(0) ?? 0),{ out: new Uint8Array(length+1) });
  if (bytes.length !== length) throw new Error('Scalar channel length mismatch');
  const values = row.type === 'f32' ? new Float32Array(bytes.buffer,bytes.byteOffset,row.count) : new Float64Array(bytes.buffer,bytes.byteOffset,row.count);
  if (!values.every(Number.isFinite)) throw new Error('Non-finite scalar channel');return values;
}

/** Decode once and borrow that same native typed storage for the defining bilinear sampler. */
export function readScalarLattice(input: unknown): (x: number,z: number) => number {
  const row = v.parse(ScalarLatticeSchema,input),values = readScalarChannel(row.values);
  if (!(values instanceof Float32Array)) throw new Error('Scalar lattice requires f32 storage');
  return bakedSamplers({ res: row.res,size: row.size,heights: values,seed: 0,landscapeHash: 0,splat: new Uint8Array(0),undergrowth: null }).heightAt;
}
