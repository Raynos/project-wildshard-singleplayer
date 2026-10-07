/**
 * The shardfile loader's render side (SHARD-PLATFORM SF15a): the `ClientWorldViews` the loader's data side
 * (`clientWorld`) injects. The loader admits bytes, owns residency and hands each tile its scope; these views turn the
 * admitted bytes into scene objects under one root and obey that scope. Terrain tiles share the terrain family's one
 * material; props take the family material catalogue (`clientMaterials`). Where a view binds a catalogue material it calls
 * the optional `outline` hook (`clientMaterials().outline`): a graph that declares `stages.outline` draws its hull as each
 * mesh's second draw (terrain tiles, fine prop tiles, library panels and models; the coarse L1 proxy keeps one draw).
 */
import { Mesh, type Material, type Object3D, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { TerrainTileData } from '@wildshard/engine/world/terrainTileData';
import { installTerrainTile, maskTerrainTile } from '@wildshard/engine/world/terrainTileView';
import { coarseTileMask } from '@wildshard/engine/world/coarseTileMask';
import { installDeclaredProps } from '@wildshard/engine/world/declaredProps';
import type { ClientWorldViews, ResidentTile } from './clientWorld';
import type { GraphOutlineHook } from './clientGraphs';
import type { Shardfile } from './schema';

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
/** a fine tile has nothing under it to hide */
function noMask(excluded: ReadonlySet<number>): void { if (excluded.size > 0) throw new Error('shardfile views: only a coarse tile masks quadrants'); }

/**
 * The ring-tile views (SHARD-PLATFORM SF18b): the same installers, but into a caller's (detached) `root`, so the render
 * rings' fetch can prepare a tile completely (worker-decoded terrain, parsed prop GLBs) before the synchronous upload
 * only attaches it. Terrain takes wire bytes or `TerrainTileData` already decoded off the main thread.
 */
export interface ClientTileViews {
  terrain: (input: Uint8Array | TerrainTileData, root: Object3D, scope: Scope, shadow: boolean) => ResidentTile;
  props: (props: NonNullable<Shardfile['props']>, key: string, bytes: Uint8Array, root: Object3D, scope: Scope) => Promise<ResidentTile | null>;
}

/** The view ports: the terrain family's material id, the family `materials`, admitted `textures` and the graph outline hook. */
interface ViewPorts { terrain: string | null; materials: ReadonlyMap<string, Material>; textures: ReadonlyMap<string, Texture>; outline?: GraphOutlineHook }

/** Ring-tile views over the terrain family's material id (null: no terrain), the family `materials` and admitted `textures`. */
export function clientTileViews(ports: ViewPorts): ClientTileViews {
  const material = ports.terrain === null ? null : ports.materials.get(ports.terrain);
  if (material === undefined) throw new Error('shardfile views: the terrain family has no resolved material');
  return {
    terrain: (input, root, scope, shadow) => {
      if (material === null) throw new Error('shardfile views: a terrain tile in a shard without terrain');
      const mesh = installTerrainTile(input, { root, scope, material, shadow });
      const hulls = ports.outline?.(mesh, material, scope) ?? [];
      // a coarse tile's mask moves its draw range; its hull (a shallow geometry copy) follows
      const mask = (excluded: ReadonlySet<number>): void => { maskTerrainTile(mesh, excluded); for (const hull of hulls) hull.geometry.setDrawRange(mesh.geometry.drawRange.start, mesh.geometry.drawRange.count); };
      return { mask, shadow: (enabled) => { mesh.castShadow = enabled; } };
    },
    props: async (props, key, bytes, scene, scope): Promise<ResidentTile | null> => {
      const row = props.tiles.find((tile) => `${tile.lod}/${tile.x}/${tile.z}` === key);
      if (row === undefined) throw new Error(`shardfile views: no props tile ${key}`);
      const installed = await installDeclaredProps(props, { scene, scope, assets: new Map([[row.file, bytes]]), materials: ports.materials, textures: ports.textures,
        lod: row.lod, selectedTiles: new Set([key]), includeLibrary: false });
      const root = installed.tiles.get(key); if (root === undefined) return null;
      const family = ports.materials.get(props.family);
      if (row.lod !== 1 && family !== undefined) ports.outline?.(root, family, scope);
      // what each mesh was baked to do (a GLB node's castShadow flag); the shadow disc only ever turns it off
      const casters: Mesh[] = []; root.traverse((object) => { if (isMesh(object) && object.castShadow) casters.push(object); });
      const shadow = (enabled: boolean): void => { for (const mesh of casters) mesh.castShadow = enabled; };
      if (row.lod === 1) { const mask = coarseTileMask(root, row.x, row.z, scope); shadow(false); return { mask, shadow: () => undefined }; }
      return { mask: noMask, shadow };
    },
  };
}

/**
 * The views for one shardfile scene: terrain tiles in `terrain` (the terrain family's material id, null when the shard has
 * no terrain), props from the resolved family `materials` and admitted `textures`, all under `root`.
 */
export function clientViews(ports: ViewPorts & { root: Object3D }): ClientWorldViews {
  const tiles = clientTileViews(ports);
  return {
    terrain: (bytes, scope, shadow) => tiles.terrain(bytes, ports.root, scope, shadow),
    library: async (props, assets, scope) => {
      const installed = await installDeclaredProps(props, { scene: ports.root, scope, assets, materials: ports.materials, textures: ports.textures, lod: 0, selectedTiles: new Set() });
      const family = ports.materials.get(props.family), outline = ports.outline;
      if (family !== undefined && outline !== undefined) for (const root of [...installed.panels.values(), ...installed.models.values()]) outline(root, family, scope);
      return installed;
    },
    props: (props, key, bytes, scope) => tiles.props(props, key, bytes, ports.root, scope),
  };
}
