import { BufferAttribute, type BufferGeometry } from 'three';
import type { ClipRuns } from './islandDressing';
/** Compact the retained native triangles and carry each original full-copy picking box. */
export function hibiscusTransport(geometry: BufferGeometry, originals: readonly BufferGeometry[], plan: ClipRuns): Uint8Array {
  const indices = new Uint32Array(plan.output); let offset = 0;
  for (const row of plan.runs) { for (let i = 0; i < row.count; i++) indices[offset++] = row.start + i; }
  const source = geometry.clone(); source.setIndex(new BufferAttribute(indices, 1));
  const compact = source.toNonIndexed(), vertices = compact.getAttribute('position').count;
  try {
    const buffer = new ArrayBuffer(16 + (originals.length * 6 + vertices * 11) * 4), header = new DataView(buffer);
    header.setUint32(0, 0x31424948, true); header.setUint32(4, 1, true); header.setUint32(8, vertices, true); header.setUint32(12, originals.length, true);
    const values = new Float32Array(buffer, 16); offset = 0;
    for (const original of originals) { original.computeBoundingBox(); const box = original.boundingBox; if (box === null) throw new Error('Hibiscus original has no bounds'); values.set([...box.min, ...box.max], offset); offset += 6; }
    for (const name of ['position', 'normal', 'color', 'aSway']) { const attribute = compact.getAttribute(name); values.set(attribute.array, offset); offset += attribute.array.length; }
    return new Uint8Array(buffer);
  } finally { source.dispose(); compact.dispose(); }
}
