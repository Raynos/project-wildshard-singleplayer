/**
 * Tile streaming T4 (G652): one entered region's per-tile content follows the player by its 62.5 m L0 tiles, until the
 * engine's tile streamer (S1) takes the job over. Each tile attaches in its own child scope (disposing it evicts the tile:
 * geometry, instance ranges, colliders); render tiles fill a ring of `radius` tiles around the player's tile, collider
 * tiles the 3 x 3 inside it (D2 B).
 *
 *   const driver = new TileDriver(scope, handles.tiled(), tileRing, () => buildYield(scope));
 *   await driver.require(order.tiles.filter(tile => order.rank(tile) === 0).map(tileKey));   // before controls
 *   ctx.system({ id, phase: 'update', run: () => { driver.step(local.x, local.z); } });       // the rest, nearest first
 *
 * One tile attaches at a time; a tile that fails stays out (it is reported once, never retried in a loop).
 * The entered ring is at most 5 x 5; the former whole-cell override is retired (G669/G747).
 */
import { tileResidencyRadius } from '@wildshard/engine/ui/tileResidency';
import type { Scope } from '@wildshard/engine/app/scope';
import { frameBudgetSpent } from '@wildshard/engine/core/framePacing';
import { buildYield, WORK_SLICE_MS } from '@wildshard/engine/core/workSlice';
import { followTile, ring, tileKey, type TileContent } from './tileContent';
import { tileOf, tileOrder, type CellTile, type TileEntryway } from './tileOrder';
import { noteEnteredTiles } from './enteredTileReadout';

type Layer = 'render' | 'colliders';
type TileFailure = { readonly error: unknown } | null;
interface Attachment { readonly scope: Scope; count: number; pending: Promise<TileFailure> | null }
interface TileRingPlan {
  readonly i: number; readonly j: number; readonly radius: number;
  readonly wanted: Record<Layer, ReadonlySet<number>>;
  readonly nearest: Record<Layer, readonly number[]>;
}

export class TileDriver {
  private readonly attached: Record<Layer, Map<number, Attachment>> = { render: new Map(), colliders: new Map() };
  private readonly failed = new Set<string>();
  private centre: CellTile | null = null;
  private renderRing: ReadonlySet<number> = new Set();
  private busy = false;
  private plan: TileRingPlan | null = null;
  private coarseScope: Scope | null = null;
  private coarseCount = 0;
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
    this.centre = followTile(null, x, z); this.renderRing = this.ringPlan(this.centre, this.radius()).wanted.render;
    const scope = this.coarseScope ??= this.scope.child('tiles:coarse');
    for (; this.coarseCount < this.contents.length; this.coarseCount++) {
      this.live();
      const content = this.contents[this.coarseCount];
      if (content === undefined) throw new Error('Missing tile content');
      await content.coarse?.(scope, tile => this.renderRing.has(tile));
      this.live();
    }
  }

  /** Once a frame with the player's cell-local position: retire the tiles outside the rings, then start the nearest wanted
   *  tile not yet attached (colliders first), one at a time. */
  step(x: number, z: number): void {
    if (this.scope.disposed || this.scope.disposing) return;
    const centre = this.centre = followTile(this.centre, x, z), plan = this.ringPlan(centre, this.radius()), wanted = plan.wanted;
    this.renderRing = wanted.render;
    for (const layer of ['render', 'colliders'] as const) for (const [key, tile] of this.attached[layer]) {
      if (wanted[layer].has(key)) continue;
      this.attached[layer].delete(key); tile.scope.dispose();
    }
    if (this.busy) return;
    for (const layer of ['colliders', 'render'] as const) {
      const next = plan.nearest[layer].find(key => {
        const tile = this.attached[layer].get(key);
        return (tile === undefined || tile.count < this.contents.length) && !this.failed.has(`${layer}:${String(key)}`);
      });
      if (next === undefined) continue;
      this.busy = true;
      void this.attach(next, layer).finally(() => { this.busy = false; });
      return;
    }
  }

  /** Ring membership and distance ordering depend only on the followed tile and radius. Reuse them while the
   * player stays in that tile; attachment, failure and late-content eligibility still read live state each step. */
  private ringPlan(centre: CellTile, radius: number): TileRingPlan {
    const known = this.plan;
    if (known !== null && known.i === centre.i && known.j === centre.j && known.radius === radius) return known;
    const wanted = { render: ring(centre, radius), colliders: ring(centre, Math.min(radius, 1)) };
    const distance = (key: number): number => Math.max(Math.abs((key % 8) - centre.i), Math.abs(Math.floor(key / 8) - centre.j));
    const ordered = (keys: ReadonlySet<number>): number[] => [...keys].sort((a, b) => distance(a) - distance(b) || a - b);
    const plan = { i: centre.i, j: centre.j, radius, wanted, nearest: { render: ordered(wanted.render), colliders: ordered(wanted.colliders) } };
    this.plan = plan;
    return plan;
  }

  private live(): void {
    if (this.scope.disposed || this.scope.disposing) throw new Error('Tile resident is disposed');
  }

  /** One tile's content of one layer, including stages registered after its first attachment. */
  private async attach(key: number, layer: Layer, required = false): Promise<void> {
    let tile = this.attached[layer].get(key);
    if (tile === undefined) {
      tile = { scope: this.scope.child(`tile:${layer}:${String(key)}`), count: 0, pending: null };
      this.attached[layer].set(key, tile);
    }
    const current = tile;
    if (current.pending === null && current.count >= this.contents.length) return;
    let pending = current.pending;
    if (pending === null) {
      let settle = (_result: TileFailure): void => { throw new Error('Missing tile preparation resolver'); };
      let refuse = (_error: unknown): void => { throw new Error('Missing tile preparation refusal'); };
      pending = new Promise<TileFailure>((resolve, reject) => { settle = resolve; refuse = reject; });
      current.pending = pending;
      void this.prepare(key, layer, current, required).then(settle, refuse);
    }
    const result = await pending;
    if (required && result !== null) throw result.error;
  }

  private async prepare(key: number, layer: Layer, tile: Attachment, required: boolean): Promise<TileFailure> {
    try {
      for (; tile.count < this.contents.length; tile.count++) {
        const content = this.contents[tile.count];
        if (content === undefined) throw new Error('Missing tile content');
        if (!content.tiles().has(key)) continue;
        // Cached stages may resolve in microtasks; share the live frame's
        // budget before admitting another stage, including background tiles.
        if (frameBudgetSpent(WORK_SLICE_MS)) await this.pause();
        if (tile.scope.disposed || tile.scope.disposing) return null;
        await (layer === 'render' ? content.attach(key, tile.scope) : content.attachColliders?.(key, tile.scope));
        if (tile.scope.disposed) return null;
      }
      return null;
    } catch (error: unknown) {
      if (this.attached[layer].get(key) === tile) this.attached[layer].delete(key);
      // Movement cancellation can be retried; every waiter sees a live content
      // failure even when the first waiter was a background streaming step.
      const cancelled = tile.scope.disposed || tile.scope.disposing || this.scope.disposed || this.scope.disposing;
      tile.scope.dispose();
      if (cancelled) return null;
      this.failed.add(`${layer}:${String(key)}`);
      if (!required && !this.scope.disposed) console.warn(`[tiles] ${layer} tile ${String(key)} failed to attach; it stays out`, error);
      return { error };
    } finally { tile.pending = null; }
  }
}

/** The tile keys of `tiles` (a tile order's rank-0 list, say). */
export const tileKeys = (tiles: readonly CellTile[]): number[] => tiles.map(tileKey);

/** The render ring's radius in tiles (G669 DR11: the 5 x 5 around the player's tile; its colliders the 3 x 3 inside). */
export const TILE_RING = 2;
/** T5/T10: Developer picks 3 x 3 or the shipped 5 x 5. Creatures sleep beyond the 5 x 5 (`followRing`'s default). */
export function tileRing(): number { return tileResidencyRadius(); }

/**
 * T6: the render ring as a viewer-following test (a creature manager's residency, `AnimalManager.setResidency`): given the
 * viewer's cell-local position, whether (x, z) lies in the ring of `radius` tiles around the viewer's tile, the tile followed
 * with the same hysteresis as the tile driver's.
 */
export function followRing(radius: number = TILE_RING): (viewer: { readonly x: number; readonly z: number }) => (x: number, z: number) => boolean {
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

const drivers = new WeakMap<Scope, TileDriver>();
const started = new WeakMap<Scope, { readonly pending: Promise<void>; readonly state: { complete: boolean } }>();
const tileBytes = new WeakMap<Scope, ReadonlyMap<number, number>>();
/** A resident's L0 tile rows (key j * 8 + i), their declared decoded + GPU bytes: what the overlay labels each tile with. */
export function noteTileBytes(resident: Scope, rows: readonly { readonly lod: number; readonly x: number; readonly z: number; readonly decoded: number; readonly gpu: number }[]): void {
  tileBytes.set(resident, new Map(rows.filter(row => row.lod === 0).map(row => [row.z * 8 + row.x, row.decoded + row.gpu] as const)));
}
/**
 * T4: a resident world's tiled content attached before its player has controls: the spawn's and the entries' tiles
 * (rank 0, `tileOrder`), the coarse stand-ins (T11), and a driver kept on the resident for its entries to follow the player
 * with (`followResidentTiles`). Concurrent entries await the same preparation; a failed preparation stays refused for
 * that resident. Each later entry restores required tiles and attaches newly registered content without rebuilding
 * surviving tiles or coarse stand-ins. Nothing tiled: nothing to do.
 */
export function residentTiles(resident: Scope, contents: readonly TileContent[], spawn: { readonly x: number; readonly z: number },
  entryways: readonly TileEntryway[]): Promise<void> {
  if (contents.length === 0) return Promise.resolve();
  const existing = started.get(resident);
  if (existing !== undefined && !existing.state.complete) return existing.pending;
  // Reserve before any content callback can re-enter this boot path.
  const preparation = { complete: false };
  const pending = Promise.resolve().then(async () => {
    const live = (): void => { if (resident.disposed || resident.disposing) throw new Error('Tile resident is disposed'); };
    live();
    const driver = drivers.get(resident) ?? new TileDriver(resident, contents, tileRing, () => buildYield(resident)), order = tileOrder(spawn, entryways);
    await driver.require(tileKeys(order.tiles.filter(tile => order.rank(tile) === 0))); live();
    await driver.coarse(spawn.x, spawn.z); live();
    drivers.set(resident, driver);
    noteEnteredTiles(resident, () => ({ render: driver.resident('render'), colliders: driver.resident('colliders'), bytes: tileBytes.get(resident) ?? new Map() }));
    preparation.complete = true;
    return undefined;
  });
  started.set(resident, { pending, state: preparation });
  return pending;
}
/** T4: once a frame while a world is entered, its resident's tiles follow the player's cell-local position. */
export function followResidentTiles(resident: Scope, position: () => { readonly x: number; readonly z: number }): (() => void) | null {
  const driver = drivers.get(resident);
  if (driver === undefined) return null;
  return () => { const at = position(); driver.step(at.x, at.z); };
}
