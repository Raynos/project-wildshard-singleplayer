import * as v from 'valibot';

export type DataArrayKind = 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'i32' | 'f32' | 'f64';
export interface DataArrayHeader {
  readonly name: string;
  readonly type: DataArrayKind;
  readonly offset: number;
  readonly length: number;
  /** Components per row; 16 describes an instance-matrix table. */
  readonly width: number;
}
export interface TypedDataBankHeader {
  readonly schema: 'typed-data/1';
  readonly file: string;
  readonly byteOrder: 'little';
  readonly bytes: number;
  readonly sha256: string;
  readonly arrays: readonly DataArrayHeader[];
}

/** Scalar storage width; the header, encoder and reader share this owner. */
export function dataArrayBytes(kind: DataArrayKind): number {
  switch (kind) {
    case 'u8': case 'i8': return 1;
    case 'u16': case 'i16': return 2;
    case 'u32': case 'i32': case 'f32': return 4;
    case 'f64': return 8;
    default: throw new Error('Unknown data bank scalar kind');
  }
}
const size = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(256_000_000));
const arrayHeader = v.strictObject({ name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  type: v.picklist(['u8', 'i8', 'u16', 'i16', 'u32', 'i32', 'f32', 'f64']), offset: size, length: size,
  width: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_536)) });
function canonicalLayout(header: TypedDataBankHeader): boolean {
  let end = 0;
  const names = new Set<string>();
  for (const row of header.arrays) {
    const width = dataArrayBytes(row.type), offset = Math.ceil(end / width) * width;
    if (names.has(row.name) || row.offset !== offset || row.length % row.width !== 0) return false;
    names.add(row.name); end = offset + row.length * width;
    if (!Number.isSafeInteger(end) || end > header.bytes) return false;
  }
  return end === header.bytes;
}
/** Small runtime-parsed metadata, never a TypeScript import of the numeric payload.
 * Ranges are aligned, disjoint and complete; the one payload is a sibling .bin. */
export const TypedDataBankHeaderSchema: v.GenericSchema<unknown, TypedDataBankHeader> = v.pipe(v.strictObject({
  schema: v.literal('typed-data/1'), file: v.pipe(v.string(), v.regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.bin$/u)),
  byteOrder: v.literal('little'), bytes: size, sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  arrays: v.pipe(v.array(arrayHeader), v.maxLength(1024)),
}), v.check(value => canonicalLayout(value), 'Typed data bank ranges, rows or names are invalid'));
