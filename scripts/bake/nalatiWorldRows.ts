import { WorldBakeRows, type BakedWorldRows } from '@wildshard/sdk/bake/worldRows';
import { staticMaterialNames, type StaticMaterialCatalogue } from '@wildshard/sdk/bake/staticMaterials';
import type { NativeGround } from '@wildshard/game/shardfile/nativeGround';
import { bakeNalatiGround, nalatiGroundSource, type NalatiStaticTile } from './nalatiGroundSource';

/** Compile ordinary render rows, with one combined ground/props GLB per address and the unchanged critical WSTR.
 * This is an offline assembly seam, not product admission: the caller supplies the real catalogue/textures,
 * authored static placement output and the trusted runtime's native-ground witness before publishing a product.
 * Named packing retains the catalogue's already encoded texture bytes and charges each tile's own dependencies.
 * An omitted catalogue is the geometry-only witness path, not a material-complete production product.
 */
export function bakeNalatiWorldRows(nativeTerrain: Uint8Array, staticTiles: readonly NalatiStaticTile[], family: string, catalogue?: Pick<StaticMaterialCatalogue, 'snapshot' | 'dependencies'>): BakedWorldRows & { nativeGround: NativeGround } {
  const source = nalatiGroundSource(nativeTerrain), rows = new WorldBakeRows();
  const native = rows.asset(nativeTerrain, 'binary', [], true);
  const snapshot = catalogue?.snapshot(), packedTextures = new Set<string>();
  for (const entry of bakeNalatiGround(source, staticTiles)) {
    const dependencies = catalogue?.dependencies(staticMaterialNames(entry.bytes)) ?? [];
    for (const hash of dependencies) {
      if (packedTextures.has(hash)) continue;
      const bytes = snapshot?.textures.get(hash);
      if (bytes === undefined) throw new Error(`Nalati catalogue texture ${hash} is missing its encoded source bytes`);
      const file = rows.asset(bytes, 'ktx2');
      if (file.hash !== hash) throw new Error(`Nalati catalogue texture ${hash} differs from its encoded source bytes`);
      packedTextures.add(hash);
    }
    rows.ground(entry, dependencies);
  }
  return { ...rows.finish(family, snapshot), nativeGround: { version: 1, file: native.hash } };
}
