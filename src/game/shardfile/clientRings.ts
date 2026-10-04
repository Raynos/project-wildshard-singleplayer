/**
 * The prepared-tile adapter between the shardfile loader and the render rings (SHARD-PLATFORM SF18b). The rings' `fetch`
 * prepares a whole ring tile off the frame: the data side's admitted bytes (`ClientAssets.lease` + `read`, leased for the
 * tile's scope), terrain decoded in the decode workers, prop GLBs parsed, all built under a detached group in the tile's
 * own scope. The rings' synchronous `upload` only attaches that group to the instance's root; `discard` and `dispose`
 * free the scope. The catalogue charges each tile its shardfile row's decoded + GPU bytes.
 *
 * Far proxies are SF23's (the far view); until it lands a shard's coarse level is its 16 L1 tiles (the rings want all of
 * them while the cell is in the far ring).
 */
import { Group, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { RingCatalogue, RingPorts, RingTile, RingView } from '../grid/rings';
import type { TileDecoder } from '../grid/tileDecoder';
import type { ClientAssets } from './clientAssets';
import type { ResidentTile } from './clientWorld';
import type { ClientTileViews } from './clientViews';
import type { Shardfile } from './schema';

/** One placed instance: its admitted shardfile, its asset reader, its render root (already at its render origin), its views. */
export interface ClientRingInstance { readonly source: Shardfile; readonly assets: ClientAssets; readonly root: Object3D; readonly views: ClientTileViews }
/** A ring tile built and parsed but not yet in the scene. */
export interface PreparedRingTile { readonly scope: Scope; readonly group: Group; readonly tiles: readonly ResidentTile[]; readonly root: Object3D }

function lodKey(tile: { level: RingTile['level']; x: number; z: number }): string | null { return tile.level === 'far' ? null : `${tile.level === 'l0' ? 0 : 1}/${tile.x}/${tile.z}`; }

/** Resident bytes per ring tile from the shardfile rows; null where the shard has no such tile (and for far, until SF23). */
export function clientRingCatalogue(instances: ReadonlyMap<string, { readonly source: Shardfile }>): RingCatalogue {
  return (instance, level, x, z) => {
    const key = lodKey({ level, x, z }), source = instances.get(instance)?.source; if (key === null || source === undefined) return null;
    const row = source.tiles.find((tile) => `${tile.lod}/${tile.x}/${tile.z}` === key);
    return row === undefined ? null : row.decoded + row.gpu;
  };
}

/** The rings' ports for these instances; every prepared tile's scope is a child of `scope`. */
export function clientRingPorts(instances: ReadonlyMap<string, ClientRingInstance>, ports: { scope: Scope; decoder: TileDecoder }): RingPorts<PreparedRingTile> {
  const prepare = async (tile: RingTile, instance: ClientRingInstance, scope: Scope, group: Group): Promise<PreparedRingTile> => {
    const key = lodKey(tile); if (key === null) throw new Error('shardfile rings: far proxies are the far view\'s (SF23)');
    const tiles: ResidentTile[] = [], { source, assets, views } = instance;
    const admitted = async (file: string): Promise<Uint8Array> => {
      scope.onDispose(assets.lease([file]));
      const bytes = await assets.read(file); if (scope.disposed) throw new Error('shardfile rings: tile dropped while reading');
      return bytes;
    };
    const terrain = source.terrain?.tiles.find((row) => `${row.lod}/${row.x}/${row.z}` === key);
    if (terrain !== undefined) {
      const data = await ports.decoder.decode(await admitted(terrain.file)); if (scope.disposed) throw new Error('shardfile rings: tile dropped while decoding');
      tiles.push(views.terrain(data, group, scope, false));
    }
    const props = source.props, row = props?.tiles.find((candidate) => `${candidate.lod}/${candidate.x}/${candidate.z}` === key);
    if (props !== null && row !== undefined) {
      const resident = await views.props(props, key, await admitted(row.file), group, scope);
      if (resident !== null) tiles.push(resident);
    }
    return { scope, group, tiles, root: instance.root };
  };
  const run = async (tile: RingTile, report: (result: PreparedRingTile | Error) => void): Promise<void> => {
    const instance = instances.get(tile.instance); if (instance === undefined) { report(new Error(`shardfile rings: unknown instance ${tile.instance}`)); return; }
    const scope = ports.scope.child(`ring:${tile.key}`), group = new Group(); group.name = `ring:${tile.key}`;
    scope.onDispose(() => { group.removeFromParent(); });
    let result: PreparedRingTile | Error;
    try { result = await prepare(tile, instance, scope, group); }
    catch (error) { scope.dispose(); result = error instanceof Error ? error : new Error(String(error)); }
    report(result);
  };
  return {
    fetch: (tile, report) => { void run(tile, report); },
    upload: (_tile, prepared): RingView => {
      if (prepared.scope.disposed) throw new Error('shardfile rings: uploading a disposed tile');
      prepared.root.add(prepared.group);
      return {
        mask: (excluded) => { for (const tile of prepared.tiles) tile.mask(excluded); },
        shadow: (enabled) => { for (const tile of prepared.tiles) tile.shadow(enabled); },
        dispose: () => { prepared.scope.dispose(); },
      };
    },
    discard: (_tile, prepared) => { prepared.scope.dispose(); },
  };
}
