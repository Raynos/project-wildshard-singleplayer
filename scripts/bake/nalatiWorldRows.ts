import { WorldBakeRows, type BakedWorldRows } from '@wildshard/sdk/bake/worldRows';
import type { NativeGround } from '@wildshard/game/shardfile/nativeGround';
import { bakeNalatiGround, nalatiGroundSource, type NalatiStaticTile } from './nalatiGroundSource';

/** Compile ordinary render rows, with one combined ground/props GLB per address and the unchanged critical WSTR.
 * This is an offline assembly seam, not product admission: the caller supplies the real catalogue/textures,
 * authored static placement output and the trusted runtime's native-ground witness before publishing a product.
 */
export function bakeNalatiWorldRows(nativeTerrain: Uint8Array, staticTiles: readonly NalatiStaticTile[], family: string): BakedWorldRows & { nativeGround: NativeGround } {
  const source = nalatiGroundSource(nativeTerrain), rows = new WorldBakeRows();
  const native = rows.asset(nativeTerrain, 'binary', [], true);
  for (const entry of bakeNalatiGround(source, staticTiles)) rows.ground(entry);
  return { ...rows.finish(family), nativeGround: { version: 1, file: native.hash } };
}
