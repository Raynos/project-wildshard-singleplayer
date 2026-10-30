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
import { followTile, ring, ringRadius, tileKey, type TileContent } from './tileContent';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { TILE_SIZE, TILES_PER_SIDE, tileOf, tileOrder, type CellTile, type TileEntryway } from './tileOrder';
import { noteEnteredTiles } from './enteredTileReadout';
import { residentTileEntry } from './tileEntry';
import { pageScope } from '@wildshard/engine/app/resources';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { SPAWN_VIEW_M, spawnViewBusy } from './controlRefinement';
import { streamingDistance, streamingOrder, streamingVisible, type StreamingBounds, type StreamingPoint, type StreamingView } from './streamingView';

/** MF5: the live drivers, and whether the loader is settling them (no world frames under the card since FC2). */
const liveDrivers = new Set<TileDriver>();
let loaderMode = false;
const task = (): Promise<void> => new Promise(resolve => { pageScope.timeout(0, resolve); });
/** MF5: a settling driver that is busy with no spawn-view job running for this long waits on one outside the fence. */
const SETTLE_IDLE_MS = 1000;
/** MF13: the longest a render tile in view waits to refine out of sight */
const VIEW_DEFER_MS = 3000;
/**
 * MF5 (reveal = spawn view complete): while the loader's spawn-view fence is open (prepareSpawnView), drive every live
 * driver on tasks instead of frames, nearest first, until the fence's part of its render ring is attached or it waits
 * only on content that refines after control. A refining content's attach awaits its fence job, so this is what queues
 * and runs the spawn ring's fine tiles under the card. `frame` (the loader's hidden frame) runs in loader mode already:
 * an attach its step starts takes no frame pause either. `capMs` bounds a driver that never settles.
 */
export async function settleTileDrivers(frame?: () => void, capMs = 20000): Promise<void> {
  loaderMode = true;
  try {
    frame?.();
    const until = diagnosticNow() + capMs;
    for (const driver of Array.from(liveDrivers)) await driver.settle(until);
  } finally { loaderMode = false; }
}

type Layer = 'render' | 'colliders';
type TileFailure = { readonly error: unknown } | null;
interface Attachment { readonly scope: Scope; done: Set<TileContent>; pending: Promise<TileFailure> | null }
interface TileRingPlan {
  readonly i: number; readonly j: number; readonly radius: number;
  readonly wanted: Record<Layer, ReadonlySet<number>>;
  readonly retained: Record<Layer, ReadonlySet<number>>;
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
  private readonly targets: ReadonlyMap<number, StreamingPoint>;
  private streamingView: (() => StreamingView | null) | undefined;
  constructor(private readonly scope: Scope, private readonly contents: readonly TileContent[], private readonly radius: () => number,
    private readonly pause: () => Promise<void>, bounds?: ReadonlyMap<number, StreamingBounds>) {
    this.targets = new Map(Array.from({ length: TILES_PER_SIDE * TILES_PER_SIDE }, (_, key) => {
      const box = bounds?.get(key);
      return [key, { x: -250 + (key % TILES_PER_SIDE + 0.5) * TILE_SIZE,
        y: box === undefined ? 0 : (box.min[1] + box.max[1]) / 2,
        z: -250 + (Math.floor(key / TILES_PER_SIDE) + 0.5) * TILE_SIZE, ...(box === undefined ? {} : { bounds: box }) }];
    }));
    liveDrivers.add(this); scope.onDispose(() => { liveDrivers.delete(this); });
  }
  private last: { readonly x: number; readonly z: number } | null = null;
  /** MF13: the camera's view, and when each wanted render tile was first wanted (an in-view one waits up to VIEW_DEFER_MS) */
  private view: (() => ViewCone | null) | null = null;
  private readonly wantedAt = new Map<number, number>();
  setView(view: () => ViewCone | null): void { this.view = view; }
  /** NT8: the actual eye in the content root's frame ranks work, not residency. */
  setStreamingView(view: () => StreamingView | null): void { this.streamingView = view; }
  /** MF5 (settleTileDrivers): step on tasks until nothing of the render ring inside the fence is left to start, or the
   *  one attach in flight has waited SETTLE_IDLE_MS with no spawn-view job running (one outside the fence: it runs after
   *  control). A shorter wait reads an attach in its own budget pause (a frame wait, capped) as that. */
  async settle(until: number): Promise<void> {
    let idleSince: number | null = null;
    while (this.last !== null && !this.scope.disposed && !this.scope.disposing && diagnosticNow() < until) {
      this.step(this.last.x, this.last.z);
      const view = this.streamingView?.() ?? null;
      const plan = this.plan, pending = plan !== null && plan.nearest.render.some(key => this.inView(key, view) && (this.attached.render.get(key) === undefined || !this.complete(key)));
      if (!this.busy && !pending) return;
      if (this.busy && !spawnViewBusy()) { idleSince ??= diagnosticNow(); if (diagnosticNow() - idleSince > SETTLE_IDLE_MS) return; }
      else idleSince = null;
      await task();
    }
  }

  /** The tiles attached now, by layer (the overlay and tests read them). */
  resident(layer: Layer): ReadonlySet<number> {
    return new Set([...this.attached[layer].keys()].filter(key => layer === 'colliders' || this.complete(key)));
  }

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
    // the loader settles from here (MF5): no world frame has stepped the driver under the card
    this.last ??= { x, z };
    this.centre = followTile(null, x, z); this.renderRing = this.ringPlan(this.centre, this.radius()).retained.render;
    const scope = this.coarseScope ??= this.scope.child('tiles:coarse');
    for (; this.coarseCount < this.contents.length; this.coarseCount++) {
      this.live();
      const content = this.contents[this.coarseCount];
      if (content === undefined) throw new Error('Missing tile content');
      await content.coarse?.(scope, tile => this.rendered(tile));
      this.live();
    }
  }

  /** Once a frame with the player's cell-local position: retire the tiles outside the rings, then start the nearest wanted
   *  tile not yet attached (colliders first), one at a time. Render owners retire one tile beyond the attach ring;
   *  collider owners retain the exact 3 x 3 physical ring (D2 B). */
  step(x: number, z: number): void {
    if (this.scope.disposed || this.scope.disposing) return;
    this.last = { x, z };
    const centre = this.centre = followTile(this.centre, x, z), plan = this.ringPlan(centre, this.radius()), wanted = plan.wanted;
    this.renderRing = plan.retained.render;
    for (const layer of ['render', 'colliders'] as const) for (const [key, tile] of this.attached[layer]) {
      if (plan.retained[layer].has(key)) continue;
      this.attached[layer].delete(key); tile.scope.dispose();
    }
    if (this.busy) return;
    const now = diagnosticNow(), cone = loaderMode || this.view === null ? null : this.view(), streamView = this.streamingView?.() ?? null;
    for (const key of this.wantedAt.keys()) if (!wanted.render.has(key)) this.wantedAt.delete(key);
    for (const layer of ['colliders', 'render'] as const) {
      // a tile with every content done (done.size >= contents.length, as everywhere here) skips the content scan
      let next: number | undefined;
      for (const key of plan.nearest[layer]) {
        const tile = this.attached[layer].get(key);
        if (!this.inView(key, streamView) || (layer === 'render' && this.deferred(key, cone, now))
          || !(tile === undefined || tile.done.size < this.contents.length && this.contents.some(content => !tile.done.has(content) && (layer === 'colliders' || content.ready?.() !== false)))
          || this.failed.has(`${layer}:${String(key)}`)) continue;
        if (next === undefined) next = key;
        else if (streamView !== null) {
          const candidate = this.targets.get(key), prior = this.targets.get(next);
          if (candidate === undefined || prior === undefined) throw new Error('Missing streaming tile');
          if (streamingOrder(candidate, prior, streamView) < 0) next = key;
        }
        if (streamView === null) break;
      }
      if (next === undefined) continue;
      // MF13: in play, each render tile's attach and whether the camera sees it then (the walk probes read these)
      if (layer === 'render' && cone !== null) performance.mark('wildshard.tile.render', { detail: { key: next, seen: this.seen(next, cone), waited: Math.round(now - (this.wantedAt.get(next) ?? now)) } });
      this.busy = true;
      void this.attach(next, layer).finally(() => { this.busy = false; });
      return;
    }
  }

  /** Membership and fallback ordering depend only on the player's tile/radius.
   * Camera ranking, attachment, failure and readiness still read live each step. */
  private ringPlan(centre: CellTile, radius: number): TileRingPlan {
    const known = this.plan;
    if (known !== null && known.i === centre.i && known.j === centre.j && known.radius === radius) return known;
    const colliderRadius = Math.min(radius, 1);
    const wanted = { render: ring(centre, radius), colliders: ring(centre, colliderRadius) };
    // NF6: only existing visual owners use the extra tile. D2 B keeps collider ownership exact.
    const retained = { render: ring(centre, Math.min(radius + 1, TILES_PER_SIDE - 1)),
      colliders: wanted.colliders };
    const distance = (key: number): number => Math.max(Math.abs((key % 8) - centre.i), Math.abs(Math.floor(key / 8) - centre.j));
    const ordered = (keys: ReadonlySet<number>): number[] => [...keys].sort((a, b) => distance(a) - distance(b) || a - b);
    const plan = { i: centre.i, j: centre.j, radius, wanted, retained, nearest: { render: ordered(wanted.render), colliders: ordered(wanted.colliders) } };
    this.plan = plan;
    return plan;
  }

  /** The loader and refinement queue use the same camera/bounds fence, so a
   * tile cannot block on an out-of-view job ahead of visible work. */
  private inView(key: number, view: StreamingView | null): boolean {
    if (!loaderMode || this.last === null) return true;
    if (view !== null) {
      const target = this.targets.get(key); if (target === undefined) throw new Error('Missing streaming tile');
      return streamingDistance(target, view) <= SPAWN_VIEW_M ** 2 && (target.bounds === undefined || streamingVisible(target, view));
    }
    const half = TILES_PER_SIDE * TILE_SIZE / 2;
    return Math.hypot(-half + (key % TILES_PER_SIDE + 0.5) * TILE_SIZE - this.last.x, -half + (Math.floor(key / TILES_PER_SIDE) + 0.5) * TILE_SIZE - this.last.z) <= SPAWN_VIEW_M;
  }

  /** MF13: a render tile the camera sees refines only once it leaves the view, or VIEW_DEFER_MS after it was first wanted
   *  (the refinement swap happens out of sight; the coarse cover keeps the view until then) */
  private deferred(key: number, cone: ViewCone | null, now: number): boolean {
    if (cone === null || this.last === null) return false;
    const first = this.wantedAt.get(key) ?? now; if (!this.wantedAt.has(key)) this.wantedAt.set(key, now);
    return now - first < VIEW_DEFER_MS && this.seen(key, cone);
  }
  /** Whether the camera's horizontal view meets tile `key` (the player's own tile and its touching ones: never) */
  private seen(key: number, cone: ViewCone): boolean {
    if (this.last === null) return false;
    const half = TILES_PER_SIDE * TILE_SIZE / 2;
    const dx = -half + (key % TILES_PER_SIDE + 0.5) * TILE_SIZE - this.last.x, dz = -half + (Math.floor(key / TILES_PER_SIDE) + 0.5) * TILE_SIZE - this.last.z;
    const distance = Math.hypot(dx, dz); if (distance < TILE_SIZE) return false;
    const angle = Math.acos(Math.max(-1, Math.min(1, (dx * cone.x + dz * cone.z) / distance)));
    return angle <= cone.half + Math.atan(TILE_SIZE * Math.SQRT1_2 / distance);
  }

  /** Coarse coverage stays until every declared fine visual actually publishes. */
  private rendered(key: number): boolean {
    return this.renderRing.has(key) && this.complete(key);
  }
  private complete(key: number): boolean {
    const tile = this.attached.render.get(key);
    // prepare records irrelevant stages too; a hot coarse mask needs only
    // the publication count, never every content's allocated tile set.
    return tile !== undefined && tile.done.size >= this.contents.length;
  }

  private live(): void {
    if (this.scope.disposed || this.scope.disposing) throw new Error('Tile resident is disposed');
  }

  /** One tile's content of one layer, including stages registered after its first attachment. */
  private async attach(key: number, layer: Layer, required = false): Promise<void> {
    let tile = this.attached[layer].get(key);
    if (tile === undefined) {
      tile = { scope: this.scope.child(`tile:${layer}:${String(key)}`), done: new Set(), pending: null };
      this.attached[layer].set(key, tile);
    }
    const current = tile;
    if (current.pending === null && current.done.size >= this.contents.length) return;
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
      for (const content of this.contents) {
        if (tile.done.has(content)) continue;
        if (!content.tiles().has(key)) { tile.done.add(content); continue; }
        if (layer === 'render' && content.ready?.() === false) continue;
        // Cached stages may resolve in microtasks; share the live frame's
        // budget before admitting another stage, including background tiles.
        if (frameBudgetSpent(WORK_SLICE_MS)) await (loaderMode ? task() : this.pause()); // MF5: no frames under the card
        if (tile.scope.disposed || tile.scope.disposing) return null;
        await (layer === 'render' ? content.attach(key, tile.scope) : content.attachColliders?.(key, tile.scope));
        if (tile.scope.disposed || tile.scope.disposing) return null;
        tile.done.add(content);
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
/** FR2: a product's ring radius as a driver's `radius`: its whole cell where it declares `ring: 'cell'`, else `tileRing`. */
export function productTileRing(source: Pick<Shardfile, 'ring'>): () => number { return () => ringRadius(source, tileRing); }

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
const tileBounds = new WeakMap<Scope, ReadonlyMap<number, StreamingBounds>>();
/** A resident's L0 tile rows (key j * 8 + i), their declared decoded + GPU bytes: what the overlay labels each tile with. */
export function noteTileBytes(resident: Scope, rows: readonly { readonly lod: number; readonly x: number; readonly z: number; readonly decoded: number; readonly gpu: number; readonly bounds?: StreamingBounds; readonly drawBounds?: StreamingBounds }[]): void {
  tileBytes.set(resident, new Map(rows.filter(row => row.lod === 0).map(row => [row.z * 8 + row.x, row.decoded + row.gpu] as const)));
  const bounds = new Map<number, StreamingBounds>();
  for (const row of rows) if (row.lod === 0 && row.bounds !== undefined) bounds.set(row.z * 8 + row.x, row.drawBounds ?? row.bounds);
  tileBounds.set(resident, bounds);
}
/**
 * T4: a resident world's tiled content attached before its player has controls: the actual crossing's entry ring,
 * or the authored spawn for a standalone construction without a bound arrival point
 * (rank 0, `tileOrder` with no distant-exit pins), the coarse stand-ins (T11), and a driver kept on the resident for its entries to follow the player
 * with (`followResidentTiles`). Concurrent entries await the same preparation; a failed preparation stays refused for
 * that resident. Each later entry restores required tiles and attaches newly registered content without rebuilding
 * surviving tiles or coarse stand-ins. Nothing tiled: nothing to do.
 */
export function residentTiles(resident: Scope, contents: readonly TileContent[], spawn: { readonly x: number; readonly z: number },
  _entryways: readonly TileEntryway[], radius: () => number): Promise<void> {
  if (contents.length === 0) return Promise.resolve();
  const existing = started.get(resident);
  if (existing !== undefined && !existing.state.complete) return existing.pending;
  // Reserve before any content callback can re-enter this boot path.
  const preparation = { complete: false };
  const pending = Promise.resolve().then(async () => {
    const live = (): void => { if (resident.disposed || resident.disposing) throw new Error('Tile resident is disposed'); };
    live();
    const entry = residentTileEntry(resident), at = entry ?? spawn;
    const driver = drivers.get(resident) ?? new TileDriver(resident, contents, radius, () => buildYield(resident), tileBounds.get(resident)), order = tileOrder(at);
    await driver.require(tileKeys(order.tiles.filter(tile => order.rank(tile) === 0))); live();
    await driver.coarse(at.x, at.z); live();
    drivers.set(resident, driver);
    noteEnteredTiles(resident, () => ({ render: driver.resident('render'), colliders: driver.resident('colliders'), bytes: tileBytes.get(resident) ?? new Map() }));
    preparation.complete = true;
    return undefined;
  });
  started.set(resident, { pending, state: preparation });
  return pending;
}
/** T4: membership follows the player. MF13's horizontal view retains its
 * defer guard; NT8's cell-local streaming view orders the eligible jobs. */
export function followResidentTiles(resident: Scope, position: () => { readonly x: number; readonly z: number }, view?: () => ViewCone | null, streaming?: () => StreamingView | null): (() => void) | null {
  const driver = drivers.get(resident);
  if (driver === undefined) return null;
  if (view !== undefined) driver.setView(view);
  if (streaming !== undefined) driver.setStreamingView(streaming);
  return () => { const at = position(); driver.step(at.x, at.z); };
}

/** MF13: a camera's horizontal view: its forward on the ground (unit x, z) and half its horizontal field (radians). */
export interface ViewCone { readonly x: number; readonly z: number; readonly half: number }
/** The view cone of a perspective camera (null when it looks straight up or down). */
export function cameraCone(camera: { readonly fov: number; readonly aspect: number; readonly matrixWorld: { readonly elements: ArrayLike<number> } }): ViewCone | null {
  const e = camera.matrixWorld.elements, x = -(e[8] ?? 0), z = -(e[10] ?? 0), length = Math.hypot(x, z);
  if (length < 1e-3) return null;
  return { x: x / length, z: z / length, half: Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) };
}
