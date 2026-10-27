// oxlint-disable-next-line import/no-nodejs-modules -- Author programs read a validated sibling bank, never a runtime URL.
import { dirname, resolve } from 'node:path';
import * as v from 'valibot';
import { TypedDataBankHeaderSchema, dataArrayBytes, type DataArrayKind, type TypedDataBankHeader, type DataArrayHeader } from '@wildshard/format/typedDataBank';
import { readBoundedFile } from '../sourceReader';
import { hashImmutableBytes } from '../immutable';

export type NumericDataArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;
export interface NumericDataColumn { readonly name: string; readonly values: NumericDataArray; readonly width?: number }
export interface EncodedTypedDataBank { readonly header: TypedDataBankHeader; readonly bytes: Uint8Array }
export interface TypedDataBank { readonly header: TypedDataBankHeader; readonly columns: ReadonlyMap<string, NumericDataArray> }
const stores = { u8: Uint8Array, i8: Int8Array, u16: Uint16Array, i16: Int16Array, u32: Uint32Array, i32: Int32Array, f32: Float32Array, f64: Float64Array } as const;
const littleEndian = new Uint8Array(Uint16Array.of(1).buffer)[0] === 1;
const decoder = new TextDecoder('utf-8', { fatal: true });
function kindOf(values: NumericDataArray): DataArrayKind {
  if (values instanceof Uint8Array) return 'u8';
  if (values instanceof Int8Array) return 'i8';
  if (values instanceof Uint16Array) return 'u16';
  if (values instanceof Int16Array) return 'i16';
  if (values instanceof Uint32Array) return 'u32';
  if (values instanceof Int32Array) return 'i32';
  if (values instanceof Float32Array) return 'f32';
  if (values instanceof Float64Array) return 'f64';
  throw new Error('Data bank needs a numeric typed array');
}
function finite(values: NumericDataArray): void {
  if (!(values.buffer instanceof ArrayBuffer)) throw new Error('Data bank refuses shared numeric storage');
  if (values instanceof Float32Array || values instanceof Float64Array) {
    for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) throw new Error('Data bank needs finite numeric values');
  }
}
function copyOrder(to: Uint8Array, from: Uint8Array, width: number): void {
  if (littleEndian || width === 1) { to.set(from); return; }
  for (let at = 0; at < from.length; at += width) for (let byte = 0; byte < width; byte++) {
    const value = from[at + width - byte - 1]; if (value === undefined) throw new Error('Truncated data bank scalar');
    to[at + byte] = value;
  }
}

/** Encode arrays/instance tables into owned little-endian bytes and a small JSON header.
 * No file is written here; author programs publish the returned .bin and header normally. */
export function encodeTypedDataBank(file: string, columns: readonly NumericDataColumn[]): EncodedTypedDataBank {
  if (columns.length > 1024) throw new Error('Data bank has too many columns');
  let end = 0;
  const arrays: DataArrayHeader[] = [];
  for (const column of columns) {
    finite(column.values);
    const type = kindOf(column.values), width = dataArrayBytes(type), offset = Math.ceil(end / width) * width;
    end = offset + column.values.byteLength;
    if (!Number.isSafeInteger(end) || end > 256_000_000) throw new Error('Data bank exceeds its byte bound');
    arrays.push({ name: column.name, type, offset, length: column.values.length, width: column.width ?? 1 });
  }
  const checked = v.parse(TypedDataBankHeaderSchema, { schema: 'typed-data/1', file, byteOrder: 'little', bytes: end, sha256: '0'.repeat(64), arrays });
  const bytes = new Uint8Array(end);
  for (const [index, column] of columns.entries()) {
    const row = checked.arrays[index]; if (row === undefined) throw new Error('Missing data bank column');
    const source = new Uint8Array(column.values.buffer, column.values.byteOffset, column.values.byteLength);
    copyOrder(bytes.subarray(row.offset, row.offset + source.length), source, dataArrayBytes(row.type));
  }
  return { header: { ...checked, sha256: hashImmutableBytes(bytes) }, bytes };
}
function decodeChecked(header: TypedDataBankHeader, bytes: Uint8Array): TypedDataBank {
  if (!(bytes.buffer instanceof ArrayBuffer) || bytes.length !== header.bytes || hashImmutableBytes(bytes) !== header.sha256) throw new Error('Data bank size or hash mismatch');
  const columns = new Map<string, NumericDataArray>();
  let end = 0;
  for (const row of header.arrays) {
    for (let at = end; at < row.offset; at++) if (bytes[at] !== 0) throw new Error('Data bank padding is not canonical');
    const values = new stores[row.type](row.length), wire = bytes.subarray(row.offset, row.offset + values.byteLength);
    copyOrder(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), wire, dataArrayBytes(row.type));
    finite(values); columns.set(row.name, values); end = row.offset + values.byteLength;
  }
  return { header, columns };
}
/** Validate a runtime JSON header and exact binary before creating detached numeric views. */
export function decodeTypedDataBank(input: unknown, bytes: Uint8Array): TypedDataBank {
  return decodeChecked(v.parse(TypedDataBankHeaderSchema, input), bytes);
}
/** Node author reader: bounded file IO, runtime valibot header parse, then sibling size/hash admission.
 * Call with the header pathname; never import the generated JSON into the TS program. */
export function readTypedDataBank(headerPath: string): TypedDataBank {
  const input: unknown = JSON.parse(decoder.decode(readBoundedFile(headerPath, 1_000_000)));
  const header = v.parse(TypedDataBankHeaderSchema, input);
  return decodeChecked(header, readBoundedFile(resolve(dirname(headerPath), header.file), header.bytes));
}
