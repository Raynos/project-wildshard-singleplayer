import type * as THREE from 'three';

/** Exact Nalati attribute layout, including native index deltas and expansion. */
export interface PlaceGeometryRow {
  readonly attrs: readonly (readonly [string, 'f32', number, boolean])[];
  readonly count: number; readonly index: 'u16' | 'u32' | null;
  readonly indexCount: number; readonly box: boolean; readonly expand: boolean;
}

const pad = (bytes: Uint8Array): Uint8Array => { if (bytes.length % 4 === 0) return bytes; const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4); out.set(bytes); return out; };
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, what: string): Float32Array => {
  const array: unknown = 'array' in a ? a.array : null;
  if (!(array instanceof Float32Array) || a.normalized || array.length !== a.count * a.itemSize) throw new Error(`[nalati places] ${what} is not plain float32`);
  return array;
};

/** a geometry's row and blocks: float32 attributes in their order; a non-indexed one welded (each distinct vertex once) */
export function writeGeometry(g: THREE.BufferGeometry, blocks: Uint8Array[], what: string): PlaceGeometryRow {
  if (Object.keys(g.morphAttributes).length > 0 || g.groups.length > 0) throw new Error(`[nalati places] ${what} has morphs / groups`);
  const names = Object.keys(g.attributes), arrays = names.map((n) => f32(g.getAttribute(n), `${what}.${n}`));
  const sizes = names.map((n) => g.getAttribute(n).itemSize), n = g.getAttribute('position').count, box = g.boundingBox !== null;
  const attrs = names.map((name, i): readonly [string, 'f32', number, boolean] => [name, 'f32', sizes[i] ?? 0, false]);
  const index = g.index;
  if (index !== null) {
    for (const a of arrays) blocks.push(pad(new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice()));
    const deltas = new Int32Array(index.count);
    let last = 0;
    for (let i = 0; i < index.count; i++) { const x = index.getX(i); deltas[i] = x - last; last = x; }
    blocks.push(new Uint8Array(deltas.buffer));
    return { attrs, count: n, index: index.array instanceof Uint16Array ? 'u16' : 'u32', indexCount: index.count, box, expand: false };
  }
  // weld: a vertex is its attributes' exact bits
  const words = arrays.map((a) => new Uint32Array(a.buffer, a.byteOffset, a.length));
  const seen = new Map<string, number>(), order: number[] = [], idx = new Int32Array(n);
  for (let v = 0; v < n; v++) {
    let key = '';
    for (const [k, w] of words.entries()) { const s = sizes[k] ?? 0; for (let c = 0; c < s; c++) key += `${String(w[v * s + c] ?? 0)},`; }
    let at = seen.get(key);
    if (at === undefined) { at = order.length; seen.set(key, at); order.push(v); }
    idx[v] = at;
  }
  for (const [k, a] of arrays.entries()) {
    const s = sizes[k] ?? 0, out = new Float32Array(order.length * s);
    for (const [j, v] of order.entries()) for (let c = 0; c < s; c++) out[j * s + c] = a[v * s + c] ?? 0;
    blocks.push(new Uint8Array(out.buffer));
  }
  const deltas = new Int32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) { const x = idx[i] ?? 0; deltas[i] = x - last; last = x; }
  blocks.push(new Uint8Array(deltas.buffer));
  return { attrs, count: order.length, index: 'u32', indexCount: n, box, expand: true };
}

/** Join attribute blocks without changing their order. */
export const join = (blocks: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(blocks.reduce((s, b) => s + b.length, 0));
  let at = 0;
  for (const b of blocks) { out.set(b, at); at += b.length; }
  return out;
};

