import * as THREE from 'three';

/**
 * A pack of float32 geometries as an offline bake stores them (SHARD-PLATFORM M3, the kit system): each geometry's unique
 * vertices as one block per attribute, then its index (16 or 32 bit, 4-byte aligned), described by a row each. A geometry
 * the builder left indexed (`own`) comes back with its own copies of the blocks and its index; one the builder left
 * non-indexed (`own: null`) is expanded back through the index to `count` vertices, exactly as the builder had it.
 */

/** One packed geometry: its attributes [name, item size], its vertex count, its unique vertices, its index. */
export interface PackedGeometryRow {
  readonly attrs: readonly (readonly [string, number])[];
  readonly count: number;
  readonly unique: number;
  /** the index the builder kept ('u16' / 'u32'), or null: expand it away */
  readonly own: 'u16' | 'u32' | null;
  readonly indexCount: number;
}

/** A pack's rows: its byte size and its geometries in byte order. */
export interface PackedGeometryRows {
  readonly bytes: number;
  readonly geometries: readonly PackedGeometryRow[];
}

/** The decoded binary: each geometry's blocks, read fresh for every geometry built from it (nothing is shared). */
export class GeometryPack {
  private readonly at: number[] = [];
  private readonly buffer: ArrayBuffer;

  /** `bytes` the inflated binary, `rows` its description, `label` the error messages' name. */
  constructor(bytes: Uint8Array, private readonly rows: PackedGeometryRows, private readonly label: string) {
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
    return g;
  }
}

/** Fetch a zlib-deflated bake and inflate it (a failed fetch throws). */
export async function fetchDeflated(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}
