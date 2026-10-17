import { BufferAttribute } from 'three';
import type { BakedGeometryRow } from '@wildshard/sdk/kit/bakedGeometry';
import { buildSheepGeometry, SHEEP_PIVOTS, SHEEP_PART_NAMES } from './sheep';

/** Exact static fallback geometry; no loft or wool paint runs while a flock loads. */
export function bakeSheepBody(): { bytes: Uint8Array; row: BakedGeometryRow; pivots: typeof SHEEP_PIVOTS; parts: typeof SHEEP_PART_NAMES; radius: number } {
  const geometry = buildSheepGeometry(), index = geometry.index;
  const attrs = Object.keys(geometry.attributes).map(name => {
    const attribute = geometry.getAttribute(name);
    if (!(attribute instanceof BufferAttribute) || !(attribute.array instanceof Float32Array)) throw new Error('Sheep geometry requires plain float attributes');
    return [name, 'f32', attribute.itemSize, attribute.normalized] as const;
  });
  const row: BakedGeometryRow = { attrs, count: geometry.getAttribute('position').count,
    index: index === null ? null : index.array instanceof Uint32Array ? 'u32' : 'u16', indexCount: index?.count ?? 0, box: geometry.boundingBox !== null };
  const bytes = new Uint8Array(attrs.reduce((sum, [name]) => sum + Math.ceil(geometry.getAttribute(name).array.byteLength / 4) * 4, 0) + row.indexCount * 4); let offset = 0;
  for (const [name] of attrs) {
    const attribute = geometry.getAttribute(name), source = attribute.array;
    bytes.set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength), offset); offset += Math.ceil(source.byteLength / 4) * 4;
  }
  if (index !== null) {
    const delta = new Int32Array(index.count); let previous = 0;
    for (let i = 0; i < index.count; i++) { const value = index.getX(i); delta[i] = value - previous; previous = value; }
    bytes.set(new Uint8Array(delta.buffer), offset);
  }
  const radius = geometry.boundingSphere?.radius;
  if (radius === undefined) throw new Error('Sheep geometry requires its padded animation sphere');
  geometry.dispose(); return { bytes, row, pivots: SHEEP_PIVOTS, parts: SHEEP_PART_NAMES, radius };
}
