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

/**
 * A pack of float32 geometries as an offline bake stores them (the packed geometry format): each geometry's unique
 * vertices as one block per attribute, then its index (16 or 32 bit, 4-byte aligned), described by a row each. A geometry
 * the builder left indexed (`own`) comes back with its own copies of the blocks and its index; one the builder left
 * non-indexed (`own: null`) is expanded back through the index to `count` vertices, exactly as the builder had it.
 */

/** One draw group of a packed geometry: its index range and material slot, as three keeps it. */
export interface PackedGroup { readonly start: number; readonly count: number; readonly materialIndex: number }

/** One packed geometry: its attributes [name, item size], its vertex count, its unique vertices, its index. */
export interface PackedGeometryRow {
  readonly attrs: readonly (readonly [string, number])[];
  readonly count: number;
  readonly unique: number;
  /** the index the builder kept ('u16' / 'u32'), or null: expand it away */
  readonly own: 'u16' | 'u32' | null;
  readonly indexCount: number;
  /** the builder's draw groups (a primitive's side and caps, say), when it had any */
  readonly groups?: readonly PackedGroup[];
}

/** A pack's rows: its byte size and its geometries in byte order. */
export interface PackedGeometryRows {
  readonly bytes: number;
  readonly geometries: readonly PackedGeometryRow[];
}

/** A pack's rows as JSON holds them (each attribute pair an array, the index kind a string). */
export interface PackedGeometryJson {
  readonly bytes: number;
  readonly geometries: readonly { readonly attrs: readonly (readonly (string | number)[])[]; readonly count: number; readonly unique: number; readonly own: string | null; readonly indexCount: number; readonly groups?: readonly PackedGroup[] }[];
}

/** JSON rows checked into a pack's rows: every attribute pair is [name, item size], every index 'u16', 'u32' or null. */
export function packedRows(json: PackedGeometryJson): PackedGeometryRows {
  return { bytes: json.bytes, geometries: json.geometries.map((g) => {
    const attrs = g.attrs.map(([name, size]) => {
      if (typeof name !== 'string' || typeof size !== 'number') throw new Error('geometry pack: an attribute row is [name, size]');
      return [name, size] as const;
    });
    if (g.own !== null && g.own !== 'u16' && g.own !== 'u32') throw new Error(`geometry pack: index kind ${g.own}`);
    return { attrs, count: g.count, unique: g.unique, own: g.own, indexCount: g.indexCount, ...(g.groups === undefined ? {} : { groups: g.groups }) };
  }) };
}

/** Independent CPU storage for one decoded geometry. */
export interface PackedGeometryData {
  readonly attributes: readonly { readonly name: string; readonly size: number; readonly array: Float32Array }[];
  readonly index: Uint16Array | Uint32Array | null;
  readonly groups: readonly PackedGroup[];
}

/** The decoded binary: each geometry's blocks, read fresh for every geometry built from it (nothing is shared). */
export class GeometryPackData {
  private readonly at: number[] = [];
  private readonly buffer: ArrayBuffer;
  private readonly rows: PackedGeometryRows;
  private readonly label: string;

  /** `bytes` the inflated binary, `rows` its description, `label` the error messages' name. */
  constructor(bytes: Uint8Array, rows: PackedGeometryRows, label: string) {
    this.rows = rows; this.label = label;
    if (bytes.length !== rows.bytes) throw new Error(`[${label}] the bake holds ${String(bytes.length)} bytes, its rows ${String(rows.bytes)}`);
    this.buffer = new ArrayBuffer(bytes.length); new Uint8Array(this.buffer).set(bytes);
    let offset = 0;
    const pad = (n: number): number => Math.ceil(n / 4) * 4;
    for (const g of rows.geometries) {
      this.at.push(offset);
      for (const [, size] of g.attrs) offset += pad(g.unique * size * 4);
      offset += pad(g.indexCount * (g.own === 'u32' || (g.own === null && g.unique >= 65536) ? 4 : 2));
    }
    if (offset !== bytes.length) throw new Error(`[${label}] the bake does not match its rows`);
  }

  /** Decode independent mutable arrays without constructing renderer objects. */
  read(i: number): PackedGeometryData {
    const row = this.rows.geometries[i], start = this.at[i];
    if (row === undefined || start === undefined) throw new Error(`[${this.label}] no baked geometry ${String(i)}`);
    let offset = start;
    const blocks = row.attrs.map(([, size]) => { const a = new Float32Array(this.buffer, offset, row.unique * size); offset += Math.ceil(a.byteLength / 4) * 4; return a; });
    const wide = row.own === 'u32' || (row.own === null && row.unique >= 65536);
    const index = wide ? new Uint32Array(this.buffer, offset, row.indexCount) : new Uint16Array(this.buffer, offset, row.indexCount);
    const attributes: { name: string; size: number; array: Float32Array }[] = [];
    row.attrs.forEach(([name, size], k) => {
      const block = blocks[k]; if (block === undefined) return;
      if (row.own !== null) { attributes.push({ name, size, array: block.slice() }); return; }
      const array = new Float32Array(row.count * size);
      for (let j = 0; j < row.count; j++) { const src = (index[j] ?? 0) * size; for (let c = 0; c < size; c++) array[j * size + c] = block[src + c] ?? 0; }
      attributes.push({ name, size, array });
    });
    return { attributes, index: row.own === null ? null : index.slice(), groups: (row.groups ?? []).map(({ start: groupStart, count, materialIndex }) => ({ start: groupStart, count, materialIndex })) };
  }

  /** float block `i` (`GeometryPackWriter.addFloats`): a copy of its floats, exactly as written (a `-0` stays `-0`) */
  floats(i: number): Float32Array {
    const attribute = this.read(i).attributes.find(row => row.name === 'values');
    if (attribute === undefined) throw new Error(`[${this.label}] ${String(i)} is not a float block`);
    return attribute.array;
  }
}
