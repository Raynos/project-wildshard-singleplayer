import type { Scope } from '@wildshard/engine/app/scope';
import type { TerrainField } from '@wildshard/engine/level/data';
import type { ResidencyAllocator } from '../grid/allocator';
import type { ClientAssets } from './clientAssets';
import { clientGround } from './clientGround';
import { runtimeBinds } from './hybridRows';
import type { Shardfile } from './schema';
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
  /** The runtime's tile view: decode `bytes` (a terrain tile) under `scope`, in the runtime's own material. */
  readonly terrain: ClientWorldViews['terrain'];
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
  const world = await clientWorld({ ...source, props: null }, ports.assets, { scope: ctx.scope, x: ports.x, z: ports.z,
    views: { terrain: ports.terrain, ...noProps }, ...(ports.residency === undefined ? {} : { residency: ports.residency }) });
  return { ground, refresh: world.refresh, get fine() { return world.fine; } };
}
