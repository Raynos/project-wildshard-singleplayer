import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { ScalarChannelSchema,type ScalarChannelRows } from '@wildshard/format/scalarChannel';

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
