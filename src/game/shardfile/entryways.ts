import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { clipEntryPolygon, entryFootprints } from './entryGeometry';
import type { ShardEntryways } from '@wildshard/format/entryways';

/** Verify every native collision triangle across the full 8×15 m approach before platform floors exist. */
export function validateEntrywayTerrain(source: { entryways: ShardEntryways; terrain: { collider: string } | null }, assets: ReadonlyMap<string, Uint8Array>): void {
  // The ordinary non-terrain loader supplies its full-cell implicit y=0 ground, independently of entry sockets.
  if (source.terrain === null) return;
  const bytes = assets.get(source.terrain.collider); if (bytes === undefined) throw new Error('Missing entryway terrain');
  const terrain = decodeTerrainTile(bytes);
  validateEntrywayGrid(source.entryways, terrain);
}
/** Inspect the original collision lattice, including fractional footprint boundaries; no resampling or socket floor is credited. */
export function validateEntrywayGrid(entryways: ShardEntryways, terrain: { resolution: number; x: number; z: number; size: number; heights: Float32Array }): void {
  const n = terrain.resolution - 1, stride = terrain.size / n;
  for (const [index, rect] of entryFootprints(entryways).entries()) {
    const kind = entryways[index]?.kind, socket = kind === 'socketOverWater' || kind === 'socketLift' || kind === 'portalLink';
    if (rect.minX < terrain.x || rect.maxX > terrain.x + terrain.size || rect.minZ < terrain.z || rect.maxZ > terrain.z + terrain.size) throw new Error('illegal shard: missing entryway ground footprint');
    const vertex = (x: number, z: number) => {
      const y = terrain.heights[z * terrain.resolution + x]; if (y === undefined) throw new Error('Missing terrain sample');
      return { x: terrain.x + x * stride, y, z: terrain.z + z * stride };
    };
    const x0 = Math.max(0, Math.floor((rect.minX - terrain.x) / stride)), x1 = Math.min(n - 1, Math.floor((rect.maxX - terrain.x) / stride));
    const z0 = Math.max(0, Math.floor((rect.minZ - terrain.z) / stride)), z1 = Math.min(n - 1, Math.floor((rect.maxZ - terrain.z) / stride));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const a = vertex(x, z), b = vertex(x + 1, z), c = vertex(x, z + 1), d = vertex(x + 1, z + 1);
      // Same diagonal as the baked Rapier heightfield, including fractional rectangle boundaries.
      for (const triangle of [[a, b, c], [d, c, b]]) if (clipEntryPolygon(triangle, rect).some((p) => socket ? p.y > 0 : p.y !== 0)) throw new Error(socket
        ? 'illegal shard: socket entryway terrain cannot rise above road height'
        : 'illegal shard: baked entryway footprint must be flat at road height y=0');
    }
  }
}
