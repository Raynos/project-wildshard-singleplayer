import type { NearPlaceholder } from './nearPlaceholder';
import { decodeTerrainTile } from './terrainTileBytes';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF } from './contentBounds';
import { visitGlbTriangles } from './product';

/** Validate actual visual payloads: exact L1 tiles and cell-local GLBs, with no collider-only terrain. */
export function validateNearPlaceholderAssets(near: NearPlaceholder, assets: ReadonlyMap<string, Uint8Array>): void {
  const read = (ref: string): Uint8Array => {
    const bytes = assets.get(ref);
    if (bytes === undefined) throw new Error('Missing near-placeholder asset');
    return bytes;
  };
  for (const tile of near.terrain) {
    const data = decodeTerrainTile(read(tile.file));
    if (data.resolution !== 17 || data.size !== 125 || data.x !== -CHUNK_HALF + tile.x * 125 ||
      data.z !== -CHUNK_HALF + tile.z * 125 || data.colours === undefined)
      throw new Error('Near terrain must be its declared coloured L1 tile');
  }
  for (const ref of near.content) visitGlbTriangles(read(ref), triangle => {
    for (const vertex of triangle) if (Math.abs(vertex.x) > CHUNK_HALF || Math.abs(vertex.z) > CHUNK_HALF ||
      vertex.y < -CELL_BELOW || vertex.y > CELL_ABOVE) throw new Error('Near content exceeds its cell bounds');
  });
}
