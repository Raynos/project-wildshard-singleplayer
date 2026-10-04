import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';
import type { TerrainField } from '@wildshard/engine/level/data';
import type { Shardfile } from './schema';

/** Baked collider samples supply the existing player's terrain queries; they never allocate an analytic collider. */
export function clientGround(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>): TerrainField {
  const bytes = source.terrain === null ? undefined : assets.get(source.terrain.collider);
  if (source.terrain !== null && bytes === undefined) throw new Error('Missing admitted terrain queries');
  const data = bytes === undefined ? null : decodeTerrainTile(bytes);
  const heightAt = (x: number, z: number): number => data === null || x < -250 || x > 250 || z < -250 || z > 250 ? 0 : terrainTileHeight(data, x, z);
  return { heightAt, normalAt: (x, z, eps = 0.25) => {
    const dx = heightAt(x - eps, z) - heightAt(x + eps, z), dz = heightAt(x, z - eps) - heightAt(x, z + eps), length = Math.hypot(dx, 2 * eps, dz);
    return [dx / length, 2 * eps / length, dz / length];
  }, splatAt: () => [1, 0, 0, 0], trailDistance: () => Infinity, cabinMask: () => 0, pondMask: () => 0,
    waterLevel: () => source.water.find((row) => row.kind === 'sea')?.level ?? -250, trails: [], cabinSites: [], pond: null };
}
