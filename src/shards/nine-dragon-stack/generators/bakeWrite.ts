/**
 * Built geometry written as Nine Dragon's bakes store it (G285): each attribute's typed array exactly as the builder made
 * it (float, half, normalized bytes), 4-byte aligned, then the index as int32 deltas; the rows the page reads them by
 * (../world/bakedGeometry.ts `readBakedGeometry`). Shared by the layout bake (./layout.ts) and the specimens bake
 * (./specimens.ts).
 */
import { BufferAttribute, type BufferGeometry, Float16BufferAttribute } from 'three';
import { BAKED_BYTES, type BakedType, pad4 } from '../world/bakedGeometry';

/** one written geometry's row (../world/bakedGeometry.ts `BakedGeometryRow`) */
export interface WrittenRow { attrs: [string, BakedType, number, boolean][]; count: number; index: 'u16' | 'u32' | null; indexCount: number; box: boolean }

function bakedType(attr: BufferAttribute, what: string): BakedType {
  if (attr instanceof Float16BufferAttribute) return 'f16';
  const a = attr.array;
  if (a instanceof Float32Array) return 'f32';
  if (a instanceof Uint16Array) return 'u16';
  if (a instanceof Int8Array) return 'i8';
  if (a instanceof Uint8Array) return 'u8';
  throw new Error(`${what}: an attribute type the bake does not store`);
}

/** a geometry writer: `add` appends a geometry's blocks and returns its row; `blocks` are the bytes in order */
export function geometryWriter(what: string): { add: (g: BufferGeometry) => WrittenRow; readonly blocks: Uint8Array[] } {
  const blocks: Uint8Array[] = [];
  const add = (g: BufferGeometry): WrittenRow => {
    const attrs: [string, BakedType, number, boolean][] = [];
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (!(attr instanceof BufferAttribute)) throw new Error(`${what}: '${name}' is interleaved`);
      const type = bakedType(attr, what);
      attrs.push([name, type, attr.itemSize, attr.normalized]);
      const bytes = new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.count * attr.itemSize * BAKED_BYTES[type]);
      const block = new Uint8Array(pad4(bytes.length));
      block.set(bytes);
      blocks.push(block);
    }
    const index = g.index;
    if (index !== null) {
      const deltas = new Int32Array(index.count);
      let last = 0;
      for (let i = 0; i < index.count; i++) { const x = index.getX(i); deltas[i] = x - last; last = x; }
      blocks.push(new Uint8Array(deltas.buffer));
    }
    return { attrs, count: g.getAttribute('position').count, index: index === null ? null : index.array instanceof Uint16Array ? 'u16' : 'u32', indexCount: index?.count ?? 0, box: g.boundingBox !== null };
  };
  return { add, blocks };
}
