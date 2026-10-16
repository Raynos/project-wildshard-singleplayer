import { BufferAttribute, BufferGeometry } from 'three';

/** The most attribute channels a foliage batch carries (palms and reef 3, hibiscus 4). */
const MAX_CHANNELS = 8;

/** Authored channel widths for one bounded native foliage batch. */
export interface FoliageLayout { magic: number; channels: readonly (readonly [string, number])[] }

/** Validate and transfer one compacted world batch into independently owned attributes.
 * The transport and parser keep no template. Separate buffers let GPU-only channels release independently. */
export function decodeFoliageWorld(input: Uint8Array, copies: number, layout: FoliageLayout): { geometry: BufferGeometry; boxes: Float32Array } {
  if (layout.channels.length > MAX_CHANNELS) throw new Error('Foliage layout has too many channels');
  if (input.byteOffset % 4 !== 0 || input.byteLength < 16 || input.byteLength > 32_000_000) throw new Error('Invalid foliage geometry transport');
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const vertices = view.getUint32(8, true), count = view.getUint32(12, true);
  if (view.getUint32(0, true) !== layout.magic || view.getUint32(4, true) !== 1 || count !== copies || count > 512 || vertices === 0 || vertices > 400_000 || vertices % 3 !== 0 || input.byteLength !== 16 + (count * 6 + vertices * layout.channels.reduce((n, row) => n + row[1], 0)) * 4) throw new Error('Foliage world topology differs from its authored batch');
  const values = new Float32Array(input.buffer, input.byteOffset + 16, (input.byteLength - 16) / 4);
  if (values.some(value => !Number.isFinite(value))) throw new Error('Nonfinite foliage geometry');
  const boxes = values.slice(0, count * 6), geometry = new BufferGeometry(); let offset = count * 6;
  for (let i = 0; i < Math.min(layout.channels.length, MAX_CHANNELS); i++) {
    const row = layout.channels[i];
    if (row === undefined) break;
    const [name, width] = row;
    const end = offset + vertices * width; geometry.setAttribute(name, new BufferAttribute(values.slice(offset, end), width)); offset = end;
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, boxes };
}
