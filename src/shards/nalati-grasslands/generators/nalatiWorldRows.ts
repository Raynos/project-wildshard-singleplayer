import { WorldBakeRows, type BakedWorldRows } from '@wildshard/sdk/bake/worldRows';
import { staticMaterialNames, type StaticMaterialCatalogue } from '@wildshard/sdk/bake/staticMaterials';
import type { NativeGround } from '@wildshard/format/nativeGround';
import { bakeNalatiGround, bakeNalatiGroundLod, nalatiGroundSource, type NalatiGroundTile, type NalatiStaticTile } from './nalatiGroundSource';
import { compactClearGlb } from '@wildshard/sdk/bake/compactGlb';
import { parseGlb } from '@wildshard/sdk/assets';
import { emptyShardfile } from '@wildshard/sdk/author';

/** Compile ordinary render rows, with one combined ground/props GLB per address and the unchanged critical WSTR.
 * This is an offline assembly seam, not product admission: the caller supplies the real catalogue/textures,
 * authored static placement output and the trusted runtime's native-ground witness before publishing a product.
 * Named packing retains the catalogue's already encoded texture bytes and charges each tile's own dependencies.
 * An omitted catalogue is the geometry-only witness path, not a material-complete production product.
 * `lods` keeps only those levels' tiles (the live ground draws the L0 tiles: the painter mesh, cut at the tile seams).
 */
export function bakeNalatiWorldRows(nativeTerrain: Uint8Array, staticTiles: readonly NalatiStaticTile[], family: string, catalogue?: Pick<StaticMaterialCatalogue, 'snapshot' | 'dependencies'>, lods: readonly (0 | 1)[] = [0, 1]): BakedWorldRows & { nativeGround: NativeGround } {
  return packNalatiWorldRows(nativeTerrain, bakeNalatiGround(nalatiGroundSource(nativeTerrain), staticTiles).filter(entry => lods.includes(entry.tile.lod)), family, catalogue);
}

/** Explicit offline L1 candidate; records actual shared-tool error rather than claiming a zero-error simplified mesh.
 * The source WSTR remains critical and unchanged. This does not select a live look or grant a retirement discount.
 * `phase` 'exact' is the pre-I3 construction (every tile as baked): only the I3 predecessor oracle builds it.
 */
export async function bakeNalatiWorldRowsLod(nativeTerrain: Uint8Array, staticTiles: readonly NalatiStaticTile[], family: string, policy: { targetRatio: number; maxErrorMetres: number }, catalogue?: Pick<StaticMaterialCatalogue, 'snapshot' | 'dependencies'>, phase: 'i3' | 'exact' = 'i3'): Promise<BakedWorldRows & { nativeGround: NativeGround }> {
  // iPhone downloads I3: the L0 tiles (the painter mesh, read by the owned-geometry intake) ship in phone geometry; a tile
  // by an entryway keeps its exact bytes if rounding would lift it into the entry's clearance (compactClearGlb)
  const entryways = emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati Grasslands', author: 'Wildshard', revision: 1, seed: 1 }).entryways, tiles: NalatiGroundTile[] = [];
  for (const entry of await bakeNalatiGroundLod(nalatiGroundSource(nativeTerrain), policy, staticTiles)) {
    const bytes = entry.tile.lod === 0 && phase === 'i3' ? await compactClearGlb(entry.bytes, entryways) : entry.bytes;
    tiles.push(bytes === entry.bytes ? entry : { ...entry, bytes, cost: parseGlb(bytes) });
  }
  return packNalatiWorldRows(nativeTerrain, tiles, family, catalogue);
}

function packNalatiWorldRows(nativeTerrain: Uint8Array, entries: readonly NalatiGroundTile[], family: string, catalogue?: Pick<StaticMaterialCatalogue, 'snapshot' | 'dependencies'>): BakedWorldRows & { nativeGround: NativeGround } {
  const rows = new WorldBakeRows();
  const native = rows.asset(nativeTerrain, 'binary', [], true);
  const snapshot = catalogue?.snapshot(), packedTextures = new Set<string>();
  for (const entry of entries) {
    const dependencies = catalogue?.dependencies(staticMaterialNames(entry.bytes)) ?? [];
    for (const hash of dependencies) {
      if (packedTextures.has(hash)) continue;
      const bytes = snapshot?.textures.get(hash);
      if (bytes === undefined) throw new Error(`Nalati catalogue texture ${hash} is missing its encoded source bytes`);
      const file = rows.asset(bytes, 'ktx2');
      if (file.hash !== hash) throw new Error(`Nalati catalogue texture ${hash} differs from its encoded source bytes`);
      packedTextures.add(hash);
    }
    rows.tile({ ...entry.tile, bytes: entry.bytes, geometricError: entry.geometricError, dependencies });
  }
  return { ...rows.finish(family, snapshot), nativeGround: { version: 1, file: native.hash } };
}
