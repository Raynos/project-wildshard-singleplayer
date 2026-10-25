/**
 * Tile streaming T4 (G652): one entered region's per-tile content follows the player by its 62.5 m L0 tiles, until the
 * engine's tile streamer (S1) takes the job over. Each tile attaches in its own child scope (disposing it evicts the tile:
 * geometry, instance ranges, colliders); render tiles fill a ring of `radius` tiles around the player's tile, collider
 * tiles the 3 x 3 inside it (D2 B).
 *
 *   const driver = new TileDriver(scope, handles.tiled(), () => TILE_RING, () => buildYield(scope));
 *   await driver.require(order.tiles.filter(tile => order.rank(tile) === 0).map(tileKey));   // before controls
 *   ctx.system({ id, phase: 'update', run: () => { driver.step(local.x, local.z); } });       // the rest, nearest first
 *
 * One tile attaches at a time; a tile that fails stays out (it is reported once, never retried in a loop). A radius of
 * 8 or more is the whole cell: every tile attached.
 */
import type { Scope } from '@wildshard/engine/app/scope';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { followTile, ring, tileKey, type TileContent } from './tileContent';
import { tileOf, tileOrder, type CellTile, type TileEntryway } from './tileOrder';

type Layer = 'render' | 'colliders';

export class TileDriver {
  private readonly attached: Record<Layer, Map<number, Scope>> = { render: new Map(), colliders: new Map() };
  private readonly failed = new Set<string>();
  private centre: CellTile | null = null;
  private renderRing: ReadonlySet<number> = new Set();
  private busy = false;
  constructor(private readonly scope: Scope, private readonly contents: readonly TileContent[], private readonly radius: () => number,
    private readonly pause: () => Promise<void>) {}

  /** The tiles attached now, by layer (the overlay and tests read them). */
  resident(layer: Layer): ReadonlySet<number> { return new Set(this.attached[layer].keys()); }

  /** Attach `keys` in order, render and colliders, before the player has controls (the rank-0 tiles); rejects a live content failure. */
  async require(keys: Iterable<number>): Promise<void> {
    for (const key of keys) {
      this.live();
      await this.attach(key, 'render', true); this.live();
      await this.attach(key, 'colliders', true); this.live();
      await this.pause(); this.live();
    }
  }

  /** T11: centre the rings on (`x`, `z`) before the first step, then build every content's coarse stand-in (the skyline
   *  beyond the render ring), each leaving out the tiles the render ring draws as it moves. */
  async coarse(x: number, z: number): Promise<void> {
    this.centre = followTile(null, x, z); this.renderRing = ring(this.centre, this.radius());
    const scope = this.scope.child('tiles:coarse');
    for (const content of this.contents) await content.coarse?.(scope, tile => this.renderRing.has(tile));
  }

  /** Once a frame with the player's cell-local position: retire the tiles outside the rings, then start the nearest wanted
   *  tile not yet attached (colliders first), one at a time. */
  step(x: number, z: number): void {
    if (this.scope.disposed || this.scope.disposing) return;
    const centre = this.centre = followTile(this.centre, x, z), radius = this.radius();
    const wanted: Record<Layer, Set<number>> = { render: ring(centre, radius), colliders: ring(centre, Math.min(radius, 1)) };
    this.renderRing = wanted.render;
    for (const layer of ['render', 'colliders'] as const) for (const [key, tile] of this.attached[layer]) {
      if (wanted[layer].has(key)) continue;
      this.attached[layer].delete(key); tile.dispose();
    }
    if (this.busy) return;
    const distance = (key: number): number => Math.max(Math.abs((key % 8) - centre.i), Math.abs(Math.floor(key / 8) - centre.j));
    for (const layer of ['colliders', 'render'] as const) {
      const next = [...wanted[layer]].filter(key => !this.attached[layer].has(key) && !this.failed.has(`${layer}:${String(key)}`))
        .sort((a, b) => distance(a) - distance(b) || a - b)[0];
      if (next === undefined) continue;
      this.busy = true;
      void this.attach(next, layer).finally(() => { this.busy = false; });
      return;
    }
  }

  private live(): void {
    if (this.scope.disposed || this.scope.disposing) throw new Error('Tile resident is disposed');
  }

  /** One tile's content of one layer, in a fresh child scope (kept only if it is still wanted when it finishes). */
  private async attach(key: number, layer: Layer, required = false): Promise<void> {
    if (this.attached[layer].has(key)) return;
    const tile = this.scope.child(`tile:${layer}:${String(key)}`);
    this.attached[layer].set(key, tile);
    try {
      for (const content of this.contents) {
        if (!content.tiles().has(key)) continue;
        await (layer === 'render' ? content.attach(key, tile) : content.attachColliders?.(key, tile));
        if (tile.disposed) return;
      }
    } catch (error: unknown) {
      if (this.attached[layer].get(key) === tile) this.attached[layer].delete(key);
      // A sliced preparation may reject after movement has already retired its
      // tile. Only a live owner's failure blacklists content, not cancellation.
      const cancelled = tile.disposed || tile.disposing || this.scope.disposed || this.scope.disposing;
      tile.dispose();
      if (cancelled) return;
      this.failed.add(`${layer}:${String(key)}`);
      if (required) throw error;
      if (!this.scope.disposed) console.warn(`[tiles] ${layer} tile ${String(key)} failed to attach; it stays out`, error);
    }
  }
}

/** The tile keys of `tiles` (a tile order's rank-0 list, say). */
export const tileKeys = (tiles: readonly CellTile[]): number[] => tiles.map(tileKey);

/** The render ring's radius in tiles (G669 DR11: the 5 x 5 around the player's tile; its colliders the 3 x 3 inside). */
export const TILE_RING = 2;

/**
 * T6: the render ring as a viewer-following test (a creature manager's residency, `AnimalManager.setResidency`): given the
 * viewer's cell-local position, whether (x, z) lies in the ring of `radius` tiles around the viewer's tile, the tile followed
 * with the same hysteresis as the tile driver's.
 */
export function followRing(radius = TILE_RING): (viewer: { readonly x: number; readonly z: number }) => (x: number, z: number) => boolean {
  let centre: CellTile | null = null, resident = (_x: number, _z: number): boolean => true;
  return viewer => {
    const next = followTile(centre, viewer.x, viewer.z);
    if (centre === null || next.i !== centre.i || next.j !== centre.j) {
      centre = next; const keys = ring(next, radius);
      resident = (x, z) => keys.has(tileKey(tileOf(x, z)));
    }
    return resident;
  };
}

const drivers = new WeakMap<Scope, TileDriver>(), started = new WeakMap<Scope, Promise<void>>();
/**
 * T4: a resident world's tiled content attached before its player has controls: the spawn's and the entries' tiles
 * (rank 0, `tileOrder`), the coarse stand-ins (T11), and a driver kept on the resident for its entries to follow the player
 * with (`followResidentTiles`). Concurrent entries await the same preparation; a failed preparation stays refused for
 * that resident. A re-entry keeps its tiles; nothing tiled: nothing to do.
 */
export function residentTiles(resident: Scope, contents: readonly TileContent[], spawn: { readonly x: number; readonly z: number },
  entryways: readonly TileEntryway[]): Promise<void> {
  if (contents.length === 0) return Promise.resolve();
  const existing = started.get(resident);
  if (existing !== undefined) return existing;
  // Reserve before any content callback can re-enter this boot path.
  const pending = Promise.resolve().then(async () => {
    const live = (): void => { if (resident.disposed || resident.disposing) throw new Error('Tile resident is disposed'); };
    live();
    const driver = new TileDriver(resident, contents, () => TILE_RING, () => buildYield(resident)), order = tileOrder(spawn, entryways);
    await driver.require(tileKeys(order.tiles.filter(tile => order.rank(tile) === 0))); live();
    await driver.coarse(spawn.x, spawn.z); live();
    drivers.set(resident, driver);
    return undefined;
  });
  started.set(resident, pending);
  return pending;
}
/** T4: once a frame while a world is entered, its resident's tiles follow the player's cell-local position. */
export function followResidentTiles(resident: Scope, position: () => { readonly x: number; readonly z: number }): (() => void) | null {
  const driver = drivers.get(resident);
  if (driver === undefined) return null;
  return () => { const at = position(); driver.step(at.x, at.z); };
}
