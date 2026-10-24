import * as v from 'valibot';
import { CHUNK_HALF, CHUNK_SIZE, CONTENT_CAPS } from '@wildshard/format/contentBounds';
import { TilesSchema } from '@wildshard/format/shardSections';
import type { Shardfile } from '@wildshard/format/shardSchema';

/** A full-world emitter declares vacant L0 squares explicitly, without fake
 * assets or model rows. Existing tiles retain their order and exact metadata;
 * sparse library/partial packers do not call this completion step. */
export function completeL0Tiles(input: readonly Shardfile['tiles'][number][]): Shardfile['tiles'] {
  const tiles = v.parse(TilesSchema, input), seen = new Set<string>();
  for (const tile of tiles) {
    const size = tile.lod === 0 ? CONTENT_CAPS.l0.size : CONTENT_CAPS.l1.size, count = CHUNK_SIZE / size;
    const key = `${tile.lod}/${tile.x}/${tile.z}`;
    if (seen.has(key) || tile.x >= count || tile.z >= count
      || tile.bounds.min[0] !== -CHUNK_HALF + tile.x * size || tile.bounds.max[0] !== -CHUNK_HALF + (tile.x + 1) * size
      || tile.bounds.min[2] !== -CHUNK_HALF + tile.z * size || tile.bounds.max[2] !== -CHUNK_HALF + (tile.z + 1) * size)
      throw new Error(`Invalid tile grid address or bounds: ${key}`);
    seen.add(key);
  }
  const size = CONTENT_CAPS.l0.size, count = CHUNK_SIZE / size;
  for (let z = 0; z < count; z++) for (let x = 0; x < count; x++) {
    if (seen.has(`0/${x}/${z}`)) continue;
    tiles.push({ lod: 0, x, z, bounds: { min: [-CHUNK_HALF + x * size, 0, -CHUNK_HALF + z * size],
      max: [-CHUNK_HALF + (x + 1) * size, 0, -CHUNK_HALF + (z + 1) * size] },
    geometricError: 0, files: [], compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0 });
  }
  return tiles;
}
