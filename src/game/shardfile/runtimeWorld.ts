import type { Scope } from '@wildshard/engine/app/scope';
import { Mesh, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TerrainField } from '@wildshard/engine/level/data';
import { decodeTerrainTile, type TerrainTileData } from '@wildshard/format/terrainTileBytes';
import type { ResidencyAllocator } from '../grid/allocator';
import type { ClientAssets } from './clientAssets';
import { clientGround } from './clientGround';
import { runtimeBinds } from "../plugin/headless";
import type { Shardfile } from '@wildshard/format/shardSchema';
import { clientWorld, type ClientWorldViews } from './clientWorld';

/**
 * The runtime-bound world (SHARD-PLATFORM M3, G227 "the shardfile is the bake", E435). A hybrid shard whose shardfile
 * declares `runtime.binds: ['terrain']` ships its world as compiled 62.5 m tiles (the template's format: 64 L0 + 16 L1 and a
 * 257² critical collider), but its trusted runtime keeps the material and the scene: the data client installs none of the
 * section (`withoutRuntimeRows`), and the runtime binds it here. The tiles stream through the shardfile's own residency
 * (`clientWorld`: the 16 coarse tiles stay resident, fine tiles refine inside the shared 150 m disc, each tile leased and
 * freed with its scope), drawn by the runtime's `terrain` view in its own material; the queries read the admitted collider.
 */
export interface RuntimeTerrainPorts {
  /** The admitted product's reader (the same `ClientAssets` the data client streams from). */
  readonly assets: ClientAssets;
  /**
   * The runtime's tile view: decode `bytes` (a terrain tile) under `scope`, in the runtime's own material. `lattice` is the
   * decoded collider every tile was cut from: hand it to `installTerrainTile` so tiles light their shared edges alike.
   */
  readonly terrain: (bytes: Uint8Array, scope: Scope, shadow: boolean, lattice: TerrainTileData) => ReturnType<ClientWorldViews['terrain']>;
  /** Where residency starts (shard-local metres). */
  readonly x: number;
  readonly z: number;
  /** The page's residency allocator, when the runtime's tiles are charged per tile rather than by its whole-runtime claim. */
  readonly residency?: { allocator: ResidencyAllocator; owner: string };
}
/** The bound terrain: queries over the admitted collider and the streamed render tiles. */
export interface RuntimeTerrain {
  /** Height / normal queries from the compiled collider (the same field the tiles draw). */
  readonly ground: TerrainField;
  /** Move the residency disc (shard-local metres); resolves when the fine tiles there are resident. */
  readonly refresh: (x: number, z: number) => Promise<void>;
  /** The resident fine tiles (`0/<x>/<z>`). */
  readonly fine: ReadonlySet<string>;
}

const noProps: Pick<ClientWorldViews, 'library' | 'props'> = {
  library: () => Promise.reject(new Error('Runtime-bound terrain has no props library')),
  props: () => Promise.reject(new Error('Runtime-bound terrain has no props tiles')),
};

/** Bind a runtime's declared terrain tiles under `scope` (its level or entered scope); throws unless the section is bound. */
export async function bindRuntimeTerrain(ctx: { readonly scope: Scope }, source: Shardfile, ports: RuntimeTerrainPorts): Promise<RuntimeTerrain> {
  if (source.runtime === null) throw new Error('Runtime-bound terrain needs a trusted runtime declaration');
  if (!runtimeBinds(source).has('terrain')) throw new Error('Shardfile terrain is not bound by its runtime (runtime.binds)');
  const terrain = source.terrain; if (terrain === null) throw new Error('Runtime-bound terrain declares no terrain tiles');
  const collider = await ports.assets.read(terrain.collider);
  if (ctx.scope.disposed) throw new Error('Runtime left while reading its terrain collider');
  const ground = clientGround({ ...source, meshCollision: null }, new Map([[terrain.collider, collider]]));
  // the shared lattice (E435 tiles-shade): each tile's normals from it, so a tile edge across a sharp ridge lights as one surface
  const lattice = decodeTerrainTile(collider);
  const world = await clientWorld({ ...source, props: null }, ports.assets, { scope: ctx.scope, x: ports.x, z: ports.z,
    views: { terrain: (bytes, scope, shadow) => ports.terrain(bytes, scope, shadow, lattice), ...noProps }, ...(ports.residency === undefined ? {} : { residency: ports.residency }) });
  return { ground, refresh: world.refresh, get fine() { return world.fine; } };
}

/**
 * The runtime-bound props (G227): a hybrid whose shardfile declares `runtime.binds: ['props']` ships its static props as the
 * compiled props tiles, and its trusted runtime draws them in its own materials. Each tile's GLB is parsed here and handed to
 * the runtime's `props` view, which puts its own materials on the meshes; the parsed geometry (and any GLB material the view
 * kept) is freed with the tile. The tiles are fine tiles of whole shapes (`bakeProps` `whole`, which no coarse tile stands
 * in for), every one kept resident: a small world seen whole.
 */
export interface RuntimePropsPorts {
  readonly assets: ClientAssets;
  /** The runtime's view of one parsed tile (`key` `<lod>/<x>/<z>`): put `tile` under `scope` in its own materials. */
  readonly props: (tile: Object3D, key: string, scope: Scope) => void;
}

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;
/** Bind a runtime's declared props tiles under `scope`, every tile drawn once resolved; throws unless the section is bound. Library models and panels are not runtime-bound yet. */
export async function bindRuntimeProps(ctx: { readonly scope: Scope }, source: Shardfile, ports: RuntimePropsPorts): Promise<void> {
  if (source.runtime === null) throw new Error('Runtime-bound props need a trusted runtime declaration');
  if (!runtimeBinds(source).has('props')) throw new Error('Shardfile props are not bound by its runtime (runtime.binds)');
  const props = source.props; if (props === null || props.tiles.length === 0) throw new Error('Runtime-bound props declare no props tiles');
  if (props.panels.length + props.models.length + props.textures.length > 0) throw new Error('Runtime-bound props carry tiles only');
  if (props.tiles.some((tile) => tile.lod !== 0)) throw new Error('Runtime-bound props are fine tiles of whole shapes');
  const lifetime = ctx.scope.child('runtime-props');
  try {
    for (const row of props.tiles) {
      const key = `${row.lod}/${row.x}/${row.z}`, scope = lifetime.child(key);
      scope.onDispose(ports.assets.lease([row.file]));
      const bytes = await ports.assets.read(row.file), gltf = await new GLTFLoader().parseAsync(bytes.slice().buffer, ''), meshes: Mesh[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
      // a GLB material the runtime's view replaced is freed at once; one it kept lives with the tile
      const materials = (): Set<Material> => new Set(meshes.flatMap((mesh): Material[] => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
      const originals = materials(), free = (kept: ReadonlySet<Material>): void => { for (const mesh of meshes) mesh.geometry.dispose(); for (const m of kept) m.dispose(); };
      if (scope.disposed) { free(originals); throw new Error('Runtime props unloaded while loading'); }
      ports.props(gltf.scene, key, scope);
      const used = materials(), kept = new Set([...originals].filter((m) => used.has(m)));
      for (const m of originals) if (!kept.has(m)) m.dispose();
      scope.onDispose(() => { gltf.scene.removeFromParent(); free(kept); });
    }
    ports.assets.releaseTiles();
  } catch (error) { lifetime.dispose(); throw error; }
}
