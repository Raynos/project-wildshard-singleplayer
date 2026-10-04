import type { InstalledProps } from '@wildshard/engine/world/declaredProps';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Shardfile } from './schema';
import type { ClientAssets } from './clientAssets';
import { terrainResidency } from './residency';

/** Renderer-owned tile controls; the loader owns admission and residency, without shader or scene code. */
export interface ResidentTile { mask: (excluded: ReadonlySet<number>) => void; shadow: (enabled: boolean) => void }
/** Injected view installers consume already admitted bytes and obey the supplied tile lifetime. */
export interface ClientWorldViews {
  terrain: (bytes: Uint8Array, scope: Scope, shadow: boolean) => ResidentTile;
  library: (props: NonNullable<Shardfile['props']>, assets: ReadonlyMap<string, Uint8Array>, scope: Scope) => Promise<InstalledProps>;
  props: (props: NonNullable<Shardfile['props']>, key: string, bytes: Uint8Array, scope: Scope) => Promise<ResidentTile | null>;
}
/** One lifetime owns coarse proxies, bounded fine residency and the named prop library. */
export async function clientWorld(source: Shardfile, assets: ClientAssets, ports: { scope: Scope; views: ClientWorldViews; x: number; z: number }): Promise<{ props: InstalledProps | null; refresh: (x: number, z: number) => Promise<void>; fine: ReadonlyMap<string, Scope> }> {
  const fine = new Map<string, Scope>(), fineTiles = new Map<string, ResidentTile[]>(), coarse = new Map<string, ResidentTile>(), coarseProps = new Map<string, ResidentTile>(), terrainRows = new Map(source.terrain?.tiles.map((tile) => [`${tile.lod}/${tile.x}/${tile.z}`, tile]));
  const terrain = async (key: string, scope: Scope, shadow: boolean): Promise<ResidentTile | null> => {
    const row = terrainRows.get(key); if (row === undefined) return null;
    const bytes = await assets.read(row.file); if (scope.disposed) throw new Error('Tile unloaded while reading');
    return ports.views.terrain(bytes, scope, shadow);
  };
  const props = source.props === null ? null : await ports.views.library(source.props, assets.retained, ports.scope);
  const tileProps = async (key: string, scope: Scope): Promise<ResidentTile | null> => {
    const row = source.props?.tiles.find((tile) => `${tile.lod}/${tile.x}/${tile.z}` === key); if (row === undefined || source.props === null) return null;
    const bytes = await assets.read(row.file); if (scope.disposed) throw new Error('Prop tile unloaded while reading');
    return ports.views.props(source.props, key, bytes, scope);
  };
  for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) {
    const key = `1/${x}/${z}`, mesh = await terrain(key, ports.scope.child(key), false); if (mesh !== null) coarse.set(key, mesh);
    const propScope = ports.scope.child(`props:${key}`), proxy = await tileProps(key, propScope);
    if (proxy !== null) { proxy.shadow(false); coarseProps.set(key, proxy); }
  }
  let chain = Promise.resolve();
  const refresh = (x: number, z: number): Promise<void> => {
    const selection = terrainResidency(x, z);
    chain = chain.then(async () => {
      if (ports.scope.disposed) return undefined;
      for (const [key, scope] of fine) if (!selection.fine.has(key)) { scope.dispose(); fine.delete(key); fineTiles.delete(key); }
      for (const key of selection.fine) if (!fine.has(key)) {
        const scope = ports.scope.child(key);
        try { const tiles = [await terrain(key, scope, selection.shadows.has(key)), await tileProps(key, scope)].filter((tile): tile is ResidentTile => tile !== null); if (scope.disposed) return undefined; fineTiles.set(key, tiles); fine.set(key, scope); }
        catch (error) { scope.dispose(); throw error; }
      }
      for (const [key, tile] of coarse) tile.mask(selection.masks.get(key) ?? new Set());
      for (const [key, tile] of coarseProps) tile.mask(selection.masks.get(key) ?? new Set());
      for (const [key, tiles] of fineTiles) for (const tile of tiles) tile.shadow(selection.shadows.has(key));
      assets.releaseTiles();
      return undefined;
    });
    return chain;
  };
  await refresh(ports.x, ports.z);
  return { props, refresh, fine };
}
