/**
 * The shardfile loader's render side (SHARD-PLATFORM SF15a): the `ClientWorldViews` the loader's data side
 * (`clientWorld`) injects. The loader admits bytes, owns residency and hands each tile its scope; these views turn the
 * admitted bytes into scene objects under one root and obey that scope. Terrain tiles share the terrain family's one
 * material; props take the family material catalogue (`clientMaterials`).
 */
import { Mesh, type Material, type Object3D, type Texture } from 'three';
import { installTerrainTile, maskTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { coarseTileMask } from '@wildshard/engine/world/coarseTileMask';
import { installDeclaredProps } from '@wildshard/engine/world/declaredProps';
import type { ClientWorldViews, ResidentTile } from './clientWorld';

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
/** a fine tile has nothing under it to hide */
function noMask(excluded: ReadonlySet<number>): void { if (excluded.size > 0) throw new Error('shardfile views: only a coarse tile masks quadrants'); }

/**
 * The views for one shardfile scene: terrain tiles in `terrain` (the terrain family's material id, null when the shard has
 * no terrain), props from the resolved family `materials` and admitted `textures`, all under `root`.
 */
export function clientViews(ports: { root: Object3D; terrain: string | null; materials: ReadonlyMap<string, Material>; textures: ReadonlyMap<string, Texture> }): ClientWorldViews {
  const material = ports.terrain === null ? null : ports.materials.get(ports.terrain);
  if (material === undefined) throw new Error('shardfile views: the terrain family has no resolved material');
  return {
    terrain: (bytes, scope, shadow) => {
      if (material === null) throw new Error('shardfile views: a terrain tile in a shard without terrain');
      const mesh = installTerrainTile(bytes, { root: ports.root, scope, material, shadow });
      return { mask: (excluded) => { maskTerrainTile(mesh, excluded); }, shadow: (enabled) => { mesh.castShadow = enabled; } };
    },
    library: (props, assets, scope) => installDeclaredProps(props, { scene: ports.root, scope, assets, materials: ports.materials, textures: ports.textures, lod: 0, selectedTiles: new Set() }),
    props: async (props, key, bytes, scope): Promise<ResidentTile | null> => {
      const row = props.tiles.find((tile) => `${tile.lod}/${tile.x}/${tile.z}` === key);
      if (row === undefined) throw new Error(`shardfile views: no props tile ${key}`);
      const installed = await installDeclaredProps(props, { scene: ports.root, scope, assets: new Map([[row.file, bytes]]), materials: ports.materials, textures: ports.textures,
        lod: row.lod, selectedTiles: new Set([key]), includeLibrary: false });
      const root = installed.tiles.get(key); if (root === undefined) return null;
      // what each mesh was baked to do (a GLB node's castShadow flag); the shadow disc only ever turns it off
      const casters: Mesh[] = []; root.traverse((object) => { if (isMesh(object) && object.castShadow) casters.push(object); });
      const shadow = (enabled: boolean): void => { for (const mesh of casters) mesh.castShadow = enabled; };
      if (row.lod === 1) { const mask = coarseTileMask(root, row.x, row.z, scope); shadow(false); return { mask, shadow: () => undefined }; }
      return { mask: noMask, shadow };
    },
  };
}
