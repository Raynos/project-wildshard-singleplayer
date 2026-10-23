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
import type { InstalledProps } from '@wildshard/engine/world/declaredProps';
import type { Scope } from '@wildshard/engine/app/scope';
import { TileStreamer, type TileStreamBudget, type TileRequirement, scopedTilePorts, type RingCatalogue, type RingPorts, type RingTile } from '@wildshard/engine/world/tileStreamer';
import { TileDecoder } from '../grid/tileDecoder';
import type { ClientAssets } from './clientAssets';
import { prepareClientTile, type ClientWorldViews, type ResidentTile } from './clientWorld';
import type { ClientTileViews } from './clientViews';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { tileOrder } from './tileOrder';

/** One placed instance: its admitted shardfile, its asset reader, its render root (already at its render origin), its views. */
export interface ClientRingInstance { readonly source: Shardfile; readonly assets: ClientAssets; readonly root: Object3D; readonly views: ClientTileViews }
/** A ring tile built and parsed but not yet in the scene. */
export interface PreparedRingTile { readonly scope: Scope; readonly group: Group; readonly tiles: readonly ResidentTile[]; readonly root: Object3D }

function lodKey(tile: { level: RingTile['level']; x: number; z: number }): string | null { return tile.level === 'far' ? null : `${tile.level === 'l0' ? 0 : 1}/${tile.x}/${tile.z}`; }

/** Resident bytes per ring tile from the shardfile rows; null where the shard has no such tile (and for far, until SF23). */
export function clientRingCatalogue(instances: ReadonlyMap<string, { readonly source: Shardfile }>): RingCatalogue {
  // sp-o105: the rings ask this many times every fixed step; each source's rows are indexed once by their lod key (the first
  // row of a key wins, as the linear search did) instead of formatting every row's key on every question
  const indexes = new WeakMap<Shardfile['tiles'], ReadonlyMap<string, number>>();
  const index = (tiles: Shardfile['tiles']): ReadonlyMap<string, number> => {
    let found = indexes.get(tiles);
    if (found === undefined) {
      const made = new Map<string, number>();
      for (const tile of tiles) { const key = `${tile.lod}/${tile.x}/${tile.z}`; if (!made.has(key)) made.set(key, tile.decoded + tile.gpu); }
      indexes.set(tiles, made); found = made;
    }
    return found;
  };
  return (instance, level, x, z) => {
    const key = lodKey({ level, x, z }), source = instances.get(instance)?.source; if (key === null || source === undefined) return null;
    return index(source.tiles).get(key) ?? null;
  };
}

/** The rings' ports for these instances; every prepared tile's scope is a child of `scope`. */
export function clientRingPorts(instances: ReadonlyMap<string, ClientRingInstance>, ports: { scope: Scope; decoder: TileDecoder;
  /** Prepare the detached, fully built tile before publication; rejection retires only this tile's scope. */
  prepare?: (tile: PreparedRingTile) => Promise<void> }): RingPorts<PreparedRingTile> {
  const prepare = async (tile: RingTile, instance: ClientRingInstance, scope: Scope, group: Group): Promise<PreparedRingTile> => {
    const key = lodKey(tile); if (key === null) throw new Error('shardfile rings: far proxies are the far view\'s (SF23)');
    const { source, assets, views } = instance;
    const tiles = await prepareClientTile(source, assets, key, scope, {
      terrain: async (bytes, owner) => {
        const data = await ports.decoder.decode(bytes); if (owner.disposed || owner.disposing) throw new Error('shardfile rings: tile dropped while decoding');
        return views.terrain(data, group, owner, false);
      },
      props: (props, address, bytes, owner, additional) => views.props(props, address, bytes, group, owner, additional),
    });
    return { scope, group, tiles, root: instance.root };
  };
  return scopedTilePorts(ports.scope, async (tile, scope) => {
    const instance = instances.get(tile.instance); if (instance === undefined) throw new Error(`shardfile rings: unknown instance ${tile.instance}`);
    const group = new Group(); group.name = `ring:${tile.key}`;
    scope.onDispose(() => { group.removeFromParent(); });
    const prepared = await prepare(tile, instance, scope, group);
    await ports.prepare?.(prepared);
    return prepared;
  }, (_tile, prepared) => {
    prepared.root.add(prepared.group);
    return {
      mask: excluded => { for (const tile of prepared.tiles) tile.mask(excluded); },
      shadow: enabled => { for (const tile of prepared.tiles) tile.shadow(enabled); },
    };
  });
}

/** A page's one render scheduler accepts entered roots as scoped replacements for its neighbour views. */
export interface ClientTileRegistration {
  owns: (instance: string) => boolean;
  dispose: () => void;
  offer: (instance: string, entry: ClientRingInstance) => void;
  enter: (instance: string, entry: ClientRingInstance, scope: Scope, start: { readonly x: number; readonly z: number }) => Promise<{ readonly fine: ReadonlySet<string>; refresh: () => Promise<void> }>;
}

/** Borrow the existing scheduler; late neighbour admissions update its fallback without replacing an entered root. */
export function clientTileRegistration(instances: Map<string, ClientRingInstance>,
  streamer: Pick<TileStreamer<unknown>, 'require' | 'resident' | 'setFullRing' | 'retireRefinement'>, radius: () => number): ClientTileRegistration {
  const entered = new Map<string, () => void>(), fallback = new Map(instances);
  let disposed = false;
  return {
    owns: instance => entered.has(instance),
    dispose: () => { if (disposed) return; disposed = true; for (const release of entered.values()) release(); },
    offer: (instance, entry) => { if (disposed) throw new Error('Tile registration disposed'); fallback.set(instance, entry); if (!entered.has(instance)) instances.set(instance, entry); },
    enter: async (instance, entry, scope, start) => {
      const ownerLeft = (): boolean => disposed || scope.disposed || scope.disposing;
      if (ownerLeft()) throw new Error('Entered tile owner left');
      if (entered.has(instance)) throw new Error('Tile instance already entered');
      const renderRows = [...entry.source.terrain?.tiles ?? [], ...entry.source.props?.tiles ?? []];
      const keys = new Set(renderRows.map(tile => `${tile.lod}/${tile.x}/${tile.z}`));
      const requirements: TileRequirement[] = [];
      let closed = false, registered = false;
      const release = (): void => {
        if (closed) return; closed = true;
        if (!registered) return;
        for (const requirement of requirements) requirement.release();
        streamer.retireRefinement(instance); streamer.setFullRing(instance, null);
        entered.delete(instance);
        const prior = fallback.get(instance); if (prior === undefined) instances.delete(instance); else instances.set(instance, prior);
      };
      try {
        streamer.setFullRing(instance, radius()); registered = true; streamer.retireRefinement(instance);
        instances.set(instance, { ...entry, source: { ...entry.source, tiles: entry.source.tiles.filter(tile => keys.has(`${tile.lod}/${tile.x}/${tile.z}`)) } });
        entered.set(instance, release); scope.onDispose(release);
        // Entered scenes hide the neighbour root: keep every coarse quadrant there until this region leaves.
        const coarse = streamer.require(instance, Array.from({ length: 16 }, (_, key) => key), 'l1');
        requirements.push(coarse);
        // A cell without an L1 for a patch needs that patch's L0 as its permanent coverage.
        const uncovered = renderRows.filter(tile => tile.lod === 0 && !keys.has(`1/${Math.floor(tile.x / 2)}/${Math.floor(tile.z / 2)}`));
        const coverage = streamer.require(instance, uncovered.map(tile => tile.z * 8 + tile.x)); requirements.push(coverage);
        const order = tileOrder(start, entry.source.entryways);
        const initial = streamer.require(instance, order.tiles.filter(tile => order.rank(tile) === 0).map(tile => tile.j * 8 + tile.i)); requirements.push(initial);
        await Promise.all(requirements.map(requirement => requirement.ready));
        initial.release(); entry.assets.releaseTiles();
        if (ownerLeft()) throw new Error('Entered tile owner left');
        return {
          get fine() { return new Set(streamer.resident().filter(key => key.startsWith(`${instance}:l0/`)).map(key => key.slice(instance.length + 1).replace('l0/', '0/'))); },
          refresh: () => { if (!closed) streamer.setFullRing(instance, radius()); return Promise.resolve(); },
        };
      } catch (error) { release(); throw error; }
    },
  };
}

/** A loaded tile view borrows the one scheduler; refresh changes its selection, never starts another queue. */
export interface ClientTileWorld { readonly props: InstalledProps | null; readonly fine: ReadonlySet<string>; refresh: (x: number, z: number) => Promise<void> }

/** SHARD SELECT uses the same tile ports/registration and one page-owned scheduler. Initial publication advances
 * through the caller's cooperative loading yield; after readiness the caller's late phase alone steps the scheduler. */
export async function standaloneClientTiles(entry: ClientRingInstance, parent: Scope, ports: {
  readonly instance: string; readonly budget: TileStreamBudget; readonly start: { readonly x: number; readonly z: number };
  readonly radius: () => number; readonly library: (scope: Scope) => Promise<Awaited<ReturnType<ClientWorldViews['library']>> | null>;
  readonly viewer: () => { readonly x: number; readonly z: number }; readonly pause: () => Promise<void>;
  readonly frame: (step: () => void) => void;
}): Promise<ClientTileWorld> {
  if (parent.disposed || parent.disposing) throw new Error('Standalone tile owner left');
  const scope = parent.child('standalone-tiles'), instances = new Map<string, ClientRingInstance>(), decoder = new TileDecoder();
  scope.onDispose(() => { decoder.dispose(); });
  try {
    const streamer = new TileStreamer([{ instance: ports.instance, origin: { x: 0, z: 0 } }], ports.budget,
      clientRingCatalogue(instances), clientRingPorts(instances, { scope, decoder }));
    // Separate cleanups still run if construction or an earlier disposal reports an error.
    scope.onDispose(() => { streamer.dispose(); });
    const registration = clientTileRegistration(instances, streamer, ports.radius);
    scope.onDispose(() => { registration.dispose(); });
    const props = await ports.library(scope), loading = registration.enter(ports.instance, entry, scope, ports.start);
    let settled = false;
    const pending = (): boolean => !settled;
    void loading.then(() => { settled = true; return undefined; }, () => { settled = true; return undefined; });
    while (pending()) {
      await ports.pause();
      if (scope.disposed || scope.disposing) throw new Error('Standalone tile owner left');
      streamer.step({ ...ports.start, vx: 0, vz: 0 });
      if (streamer.stats().refused > 0) throw new Error('Home tile residency admission deferred');
    }
    const world = await loading;
    ports.frame(() => { if (!scope.disposed && !scope.disposing) { const at = ports.viewer(); streamer.step({ x: at.x, z: at.z, vx: 0, vz: 0 }); } });
    return { props, refresh: world.refresh, get fine() { return world.fine; } };
  } catch (error) {
    try { scope.dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Standalone tile work and cleanup failed', { cause: cleanup }); }
    throw error;
  }
}
