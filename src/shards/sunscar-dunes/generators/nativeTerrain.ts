import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { CHUNK_SIZE } from '@wildshard/format/contentBounds';
import { SEED } from '../data/layout';
import { signalHeightAt } from './landscape';

/** Cold WSTR product in the original byte order. Signal has no forest log or
 * custom splat rule. The height recipe, not a retained grid, owns every sample. */
export function signalNativeTerrain(): { bytes: Uint8Array; landscapeHash: number; heightRange: [number, number] } {
  return withPortableMath(() => {
  const heightAt = signalHeightAt(), resolution = 256, count = resolution ** 2;
  let hash = 0x811c9dc5;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const value = Math.round(heightAt(-CHUNK_SIZE / 2 + x * CHUNK_SIZE / 15, -CHUNK_SIZE / 2 + z * CHUNK_SIZE / 15) * 1000) | 0;
    for (let byte = 0; byte < 4; byte++) { hash ^= (value >>> (byte * 8)) & 0xff; hash = Math.imul(hash, 0x01000193) >>> 0; }
  }
  const bytes = new Uint8Array(24 + count * 8), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x52545357, true); view.setUint32(4, 1, true);
  view.setUint32(8, resolution, true); view.setFloat32(12, CHUNK_SIZE, true);
  view.setUint32(16, SEED, true); view.setUint32(20, hash, true);
  let min = Infinity, max = -Infinity;
  const step = CHUNK_SIZE / (resolution - 1);
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
    const i = z * resolution + x, height = heightAt(-CHUNK_SIZE / 2 + x * step, -CHUNK_SIZE / 2 + z * step);
    view.setFloat32(24 + i * 4, height, true);
    bytes[24 + count * 4 + i * 4] = 255;
    min = Math.min(min, height); max = Math.max(max, height);
  }
  return { bytes, landscapeHash: hash, heightRange: [min, max] };
  });
}
