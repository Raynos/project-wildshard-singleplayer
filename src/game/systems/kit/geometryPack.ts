import * as THREE from 'three';

/**
 * A pack of float32 geometries as an offline bake stores them (SHARD-PLATFORM M3, the kit system): each geometry's unique
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

/** The decoded binary: each geometry's blocks, read fresh for every geometry built from it (nothing is shared). */
export class GeometryPack {
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

  /** geometry `i` as the builder made it: a copy its caller owns */
  geometry(i: number): THREE.BufferGeometry {
    const row = this.rows.geometries[i], start = this.at[i];
    if (row === undefined || start === undefined) throw new Error(`[${this.label}] no baked geometry ${String(i)}`);
    let offset = start;
    const blocks = row.attrs.map(([, size]) => { const a = new Float32Array(this.buffer, offset, row.unique * size); offset += Math.ceil(a.byteLength / 4) * 4; return a; });
    const wide = row.own === 'u32' || (row.own === null && row.unique >= 65536);
    const index = wide ? new Uint32Array(this.buffer, offset, row.indexCount) : new Uint16Array(this.buffer, offset, row.indexCount);
    const g = new THREE.BufferGeometry();
    row.attrs.forEach(([name, size], k) => {
      const block = blocks[k];
      if (block === undefined) return;
      if (row.own !== null) { g.setAttribute(name, new THREE.BufferAttribute(block.slice(), size)); return; }
      const out = new Float32Array(row.count * size);
      for (let j = 0; j < row.count; j++) { const src = (index[j] ?? 0) * size; for (let c = 0; c < size; c++) out[j * size + c] = block[src + c] ?? 0; }
      g.setAttribute(name, new THREE.BufferAttribute(out, size));
    });
    if (row.own !== null) g.setIndex(new THREE.BufferAttribute(index.slice(), 1));
    for (const group of row.groups ?? []) g.addGroup(group.start, group.count, group.materialIndex);
    return g;
  }

  /** float block `i` (`GeometryPackWriter.addFloats`): a copy of its floats, exactly as written (a `-0` stays `-0`) */
  floats(i: number): Float32Array {
    const a = this.geometry(i).getAttribute('values');
    if (!(a instanceof THREE.BufferAttribute) || !(a.array instanceof Float32Array)) throw new Error(`[${this.label}] ${String(i)} is not a float block`);
    return a.array;
  }
}

/**
 * The writer of a pack (build-time): geometries added in order, each attribute's floats then an index, every block padded
 * to 4 bytes. A geometry built without an index stores its distinct vertices once (bit-equal floats in every attribute)
 * and the index that expands them back, in order; one built with an index keeps its own (16 or 32 bit, as built).
 * `GeometryPack` reads the bytes back to the builder's exact arrays.
 */
export class GeometryPackWriter {
  private readonly packed: PackedGeometryRow[] = [];
  private readonly chunks: Uint8Array[] = [];
  private size = 0;
  private readonly label: string;

  /** `label` the error messages' name. */
  constructor(label: string) { this.label = label; }

  /** Append geometry `g` (plain float32 attributes only); returns its index in the pack. */
  add(g: THREE.BufferGeometry): number {
    const names = Object.keys(g.attributes), attrs = names.map((name): [string, number] => [name, g.getAttribute(name).itemSize]);
    const count = g.getAttribute(names[0] ?? 'position').count, own = g.getIndex();
    const groups = g.groups.length === 0 ? {} : { groups: g.groups.map((group) => ({ start: group.start, count: group.count, materialIndex: group.materialIndex ?? 0 })) };
    const floats = (name: string): Float32Array => {
      const a = g.getAttribute(name);
      if (a instanceof THREE.InterleavedBufferAttribute || !(a.array instanceof Float32Array) || a.normalized) throw new Error(`[${this.label}] ${name}: plain float32 only`);
      return a.array.subarray(0, a.count * a.itemSize);
    };
    if (own !== null) {
      for (const name of names) this.push(new Uint8Array(floats(name).slice().buffer));
      const u32 = own.array instanceof Uint32Array;
      this.push(new Uint8Array((u32 ? Uint32Array.from(own.array) : Uint16Array.from(own.array)).buffer));
      this.packed.push({ attrs, count, unique: count, own: u32 ? 'u32' : 'u16', indexCount: own.count, ...groups });
      return this.packed.length - 1;
    }
    const arrays = names.map(floats), keys = new Map<string, number>(), index = new Uint32Array(count), firsts: number[] = [];
    const bits = new Uint32Array(1), view = new Float32Array(bits.buffer);
    for (let i = 0; i < count; i++) {
      let key = '';
      arrays.forEach((a, k) => { const w = attrs[k]?.[1] ?? 0; for (let c = 0; c < w; c++) { view[0] = a[i * w + c] ?? 0; key += `${String(bits[0])},`; } });
      let at = keys.get(key);
      if (at === undefined) { at = firsts.length; keys.set(key, at); firsts.push(i); }
      index[i] = at;
    }
    arrays.forEach((a, k) => {
      const w = attrs[k]?.[1] ?? 0, out = new Float32Array(firsts.length * w);
      firsts.forEach((i, j) => { for (let c = 0; c < w; c++) out[j * w + c] = a[i * w + c] ?? 0; });
      this.push(new Uint8Array(out.buffer));
    });
    this.push(new Uint8Array((firsts.length < 65536 ? Uint16Array.from(index) : index).buffer));
    this.packed.push({ attrs, count, unique: firsts.length, own: null, indexCount: count, ...groups });
    return this.packed.length - 1;
  }

  /**
   * Append a block of floats (instance matrices, say: anything a page reads back bit for bit, which JSON cannot carry: it
   * drops a `-0`'s sign), `size` floats to an item; returns its index (`GeometryPack.floats`).
   */
  addFloats(values: Float32Array, size: number): number {
    const g = new THREE.BufferGeometry(); g.setAttribute('values', new THREE.BufferAttribute(values, size));
    return this.add(g);
  }

  /** The pack's rows so far (its byte size and every geometry's row). */
  rows(): PackedGeometryRows { return { bytes: this.size, geometries: this.packed.map((row) => ({ ...row, attrs: row.attrs.map(([name, w]) => [name, w] as const) })) }; }

  /** The pack's bytes so far (uncompressed). */
  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const c of this.chunks) { out.set(c, at); at += c.length; }
    return out;
  }

  private push(bytes: Uint8Array): void {
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4); padded.set(bytes);
    this.chunks.push(padded); this.size += padded.length;
  }
}

/** Fetch a zlib-deflated bake and inflate it (a failed fetch throws). */
export async function fetchDeflated(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}
