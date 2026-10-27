import type * as THREE from 'three';

/** Exact Nalati attribute layout, including native index deltas and expansion. */
export interface PlaceGeometryRow {
  readonly attrs: readonly (readonly [string, 'f32' | 'i8' | 'u8', number, boolean])[];
  readonly count: number; readonly index: 'u16' | 'u32' | null;
  readonly indexCount: number; readonly box: boolean; readonly expand: boolean;
}

const pad = (bytes: Uint8Array): Uint8Array => { if (bytes.length % 4 === 0) return bytes; const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4); out.set(bytes); return out; };
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, what: string): Float32Array => {
  const array: unknown = 'array' in a ? a.array : null;
  if (!(array instanceof Float32Array) || a.normalized || array.length !== a.count * a.itemSize) throw new Error(`[nalati places] ${what} is not plain float32`);
  return array;
};

/** iPhone downloads I3 (`compact`): a vec3 normal as normalized Int8 (within 1/254) and a colour whose values all lie in
 *  [0, 1] as normalized Uint8 (within 1/510), each block padded to whole words; positions, uvs and every other channel stay
 *  float32. The weld still keys on the float bits, so the vertex set and order are the exact writer's. */
const compactBlock = (name: string, size: number, a: Float32Array): { type: 'i8' | 'u8'; bytes: Uint8Array } | null => {
  if (name === 'normal' && size === 3) return { type: 'i8', bytes: pad(new Uint8Array(Int8Array.from(a, value => Math.round(Math.max(-1, Math.min(1, value)) * 127)).buffer)) };
  if (name === 'color' && a.every(value => value >= 0 && value <= 1)) return { type: 'u8', bytes: pad(Uint8Array.from(a, value => Math.round(value * 255))) };
  return null;
};

/** a geometry's row and blocks: float32 attributes in their order (`compact`: normals and in-range colours as bytes); a
 *  non-indexed one welded (each distinct vertex once) */
export function writeGeometry(g: THREE.BufferGeometry, blocks: Uint8Array[], what: string, compact = false): PlaceGeometryRow {
  if (Object.keys(g.morphAttributes).length > 0 || g.groups.length > 0) throw new Error(`[nalati places] ${what} has morphs / groups`);
  const names = Object.keys(g.attributes), arrays = names.map((n) => f32(g.getAttribute(n), `${what}.${n}`));
  const sizes = names.map((n) => g.getAttribute(n).itemSize), n = g.getAttribute('position').count, box = g.boundingBox !== null;
  const types: ('f32' | 'i8' | 'u8')[] = names.map(() => 'f32');
  const push = (k: number, a: Float32Array): void => {
    const packed = compact ? compactBlock(names[k] ?? '', sizes[k] ?? 0, a) : null;
    if (packed === null) blocks.push(pad(new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice()));
    else { blocks.push(packed.bytes); types[k] = packed.type; }
  };
  const attrs = (): (readonly [string, 'f32' | 'i8' | 'u8', number, boolean])[] => names.map((name, i) => [name, types[i] ?? 'f32', sizes[i] ?? 0, types[i] !== 'f32']);
  const index = g.index;
  if (index !== null) {
    for (const [k, a] of arrays.entries()) push(k, a);
    const deltas = new Int32Array(index.count);
    let last = 0;
    for (let i = 0; i < index.count; i++) { const x = index.getX(i); deltas[i] = x - last; last = x; }
    blocks.push(new Uint8Array(deltas.buffer));
    return { attrs: attrs(), count: n, index: index.array instanceof Uint16Array ? 'u16' : 'u32', indexCount: index.count, box, expand: false };
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
    push(k, out);
  }
  const deltas = new Int32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) { const x = idx[i] ?? 0; deltas[i] = x - last; last = x; }
  blocks.push(new Uint8Array(deltas.buffer));
  return { attrs: attrs(), count: order.length, index: 'u32', indexCount: n, box, expand: true };
}

/** Join attribute blocks without changing their order. */
export const join = (blocks: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(blocks.reduce((s, b) => s + b.length, 0));
  let at = 0;
  for (const b of blocks) { out.set(b, at); at += b.length; }
  return out;
};

