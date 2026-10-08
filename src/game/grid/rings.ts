/**
 * Render streaming rings for the grid (SHARD-PLATFORM SF18b). From the camera's world position and velocity, every
 * fixed step picks the tiles the view wants: L0 (62.5 m) to 150 m plus a lookahead of speed × readiness time along the
 * heading, L1 (125 m) to 400 m, and one far proxy per shard in a bounded ring (at most `CONTENT_CAPS.farCount`).
 *
 * - **Parent-first**: a tile is requested only once its parent is uploaded (far proxy → L1 → L0), and the request holds
 *   the parent's residency lease, so a parent is never evicted under a child. A shard without a far proxy has its 16 L1
 *   tiles as its coarse level: all of them are wanted while the cell is in the far ring, whatever the distance.
 * - **No holes**: a parent hides a region (an L1 quadrant, a far proxy's 4 × 4 L1 regions) only while the child drawing
 *   that region is uploaded; every upload and every eviction re-masks the parent in the same call, so each patch of a
 *   visible cell is drawn by exactly one level at every moment the renderer can see it.
 * - **One allocator**: every tile is charged through `ResidencyAllocator` (the SF22a cost model) before its bytes are
 *   fetched, so decode and refinement never push the session past the envelope; a refused tile simply leaves the parent
 *   showing. Tiles the rings no longer want stay as an evictable cache (needed = false) until hysteresis drops them or
 *   the allocator evicts them, farthest first.
 * - **Budgeted uploads**: fetch + decode run off the main thread (the `fetch` port: a worker in the browser); results
 *   queue and at most `uploadsPerFrame` tiles (and `uploadBytesPerFrame`) upload per step, so the frame floor holds.
 *
 * Node-safe and deterministic: the same camera path and the same completion order give the same residency trace.
 */
import { CHUNK_HALF, CONTENT_CAPS as C } from '@wildshard/engine/core/config';
import type { ResidencyAllocator, ResidencyLease } from './allocator';

/** A placed shard instance; `origin` is its cell centre in world metres (GridAssembly's GridCell fits). */
export interface RingCell { readonly instance: string; readonly origin: { readonly x: number; readonly z: number } }
/** far = the whole shard; l1 = 4 × 4 per cell; l0 = 8 × 8 per cell. */
export type RingLevel = 'far' | 'l1' | 'l0';
/** One streamable tile; x / z are cell-local tile indices from the cell's −x −z corner (0 for far). */
export interface RingTile { readonly key: string; readonly instance: string; readonly level: RingLevel; readonly x: number; readonly z: number }
/** What a cell's tiles cost resident (decoded + GPU bytes); null = the shard has no such tile (its parent keeps drawing). */
export type RingCatalogue = (instance: string, level: RingLevel, x: number, z: number) => number | null;
/** The renderer's handle on an uploaded tile. Quadrants 0..3 for an L1 tile, regions 0..15 (x + 4z) for a far proxy. */
export interface RingView { mask: (excluded: ReadonlySet<number>) => void; shadow: (enabled: boolean) => void; dispose: () => void }
/**
 * Off-thread work and the main-thread upload. `fetch` prepares everything asynchronously (worker decode, GLTF parse) and
 * reports once; `upload` only attaches what was prepared, synchronously. A prepared result that will never upload (its tile
 * was dropped meanwhile, or the rings were disposed) goes to `discard`, which frees it.
 */
export interface RingPorts<D> {
  fetch: (tile: RingTile, done: (result: D | Error) => void) => void;
  upload: (tile: RingTile, data: D) => RingView;
  discard?: (tile: RingTile, data: D) => void;
  /** Cancel the tile's construction scope before releasing its claim. Idempotent; late results still go to discard. */
  cancel?: (tile: RingTile) => void;
}
/** Camera pose in world metres and its velocity in m/s. */
export interface RingCamera { readonly x: number; readonly z: number; readonly vx: number; readonly vz: number }
export interface RingOptions {
  /** seconds from request to an uploaded L0 tile; lookahead = speed × this (default 4 s: request, 0.3 MB at 5 Mbit/s, decode, queue) */
  readinessSeconds?: number;
  /** cells farther than this (m, to their square) are out of view (default 1.5 pitches) */
  viewDistance?: number;
  /** far proxies prefetch this much beyond the view (default 435 m, SF18d's readiness distance at 30 m/s) */
  farPrefetch?: number;
  /** the bounded far ring: at most this many far proxies are wanted (default `CONTENT_CAPS.farCount`, 9) */
  farCount?: number;
  /** uploaded tiles per level, wanted or cached, beyond which unwanted cache drops farthest-first (memory is bounded by count, not only distance) */
  residentCaps?: Partial<Record<RingLevel, number>>;
  uploadsPerFrame?: number; uploadBytesPerFrame?: number; maxInFlight?: number;
}
/** One step's readout for the drive tests and the HUD. */
export interface RingStats { frame: number; resident: Record<RingLevel, number>; inFlight: number; queued: number; refused: number; uploads: number; evictions: number }

/** A prepared result tagged by the ports that made it (see `levelPorts`). */
export type LevelPrepared<F, T> = { readonly far: F; readonly tile?: undefined } | { readonly tile: T; readonly far?: undefined };
/** Route far proxies to their own ports (the far view, SF23) and L1 / L0 tiles to the tile ports, behind one `RingPorts`. */
export function levelPorts<F, T>(far: RingPorts<F>, tiles: RingPorts<T>): RingPorts<LevelPrepared<F, T>> {
  return {
    fetch: (tile, done) => {
      if (tile.level === 'far') far.fetch(tile, (result) => { done(result instanceof Error ? result : { far: result }); });
      else tiles.fetch(tile, (result) => { done(result instanceof Error ? result : { tile: result }); });
    },
    upload: (tile, data) => {
      if (data.far !== undefined) return far.upload(tile, data.far);
      if (data.tile !== undefined) return tiles.upload(tile, data.tile);
      throw new Error('ring ports: an untagged prepared tile');
    },
    discard: (tile, data) => { if (data.far !== undefined) far.discard?.(tile, data.far); else if (data.tile !== undefined) tiles.discard?.(tile, data.tile); },
    cancel: (tile) => { if (tile.level === 'far') far.cancel?.(tile); else tiles.cancel?.(tile); },
  };
}

const LEVEL_RANK = { far: 0, l1: 1, l0: 2 } as const;
const SIZE = { far: CHUNK_HALF * 2, l1: C.l1.size, l0: C.l0.size } as const;
const L0_RADIUS = C.nearRadius, L1_RADIUS = 400, LOOKAHEAD_SLOTS = C.l0Count - 32;
type State = 'fetching' | 'queued' | 'uploaded';
interface Slot<D> { tile: RingTile; state: State; lease: ResidencyLease; unholdParent: () => void; view: RingView | null; data: D | null; bytes: number; distance: number; masked: string; shadow: boolean }

function key(instance: string, level: RingLevel, x: number, z: number): string { return level === 'far' ? `${instance}:far` : `${instance}:${level}/${x}/${z}`; }
/** Distance from a cell-local point to a tile's square (0 inside). */
function rectDistance(lx: number, lz: number, level: RingLevel, x: number, z: number): number {
  const size = SIZE[level], minX = -CHUNK_HALF + x * size, minZ = -CHUNK_HALF + z * size;
  return Math.hypot(Math.max(minX - lx, 0, lx - minX - size), Math.max(minZ - lz, 0, lz - minZ - size));
}
function parentOf(tile: { instance: string; level: RingLevel; x: number; z: number }): string | null {
  if (tile.level === 'far') return null;
  return tile.level === 'l1' ? key(tile.instance, 'far', 0, 0) : key(tile.instance, 'l1', Math.floor(tile.x / 2), Math.floor(tile.z / 2));
}

/** The render rings of one grid session. Call `step` once per fixed step with the camera; `dispose` at session end. */
export class RenderRings<D> {
  private readonly slots = new Map<string, Slot<D>>();
  private readonly completed: { tile: RingTile; lease: ResidencyLease; result: D | Error }[] = [];
  private readonly retryAt = new Map<string, number>();
  private readonly cells: readonly RingCell[];
  private readonly allocator: ResidencyAllocator;
  private readonly catalogue: RingCatalogue;
  private readonly ports: RingPorts<D>;
  private readonly options: Required<RingOptions>;
  private frame = 0;
  private refused = 0;
  private evictions = 0;
  private uploads = 0;
  private visibleCells: readonly RingCell[] = [];
  private disposed = false;

  constructor(cells: readonly RingCell[], allocator: ResidencyAllocator, catalogue: RingCatalogue, ports: RingPorts<D>, options: RingOptions = {}) {
    if (new Set(cells.map((c) => c.instance)).size !== cells.length || cells.some((c) => c.instance.length === 0 || !Number.isFinite(c.origin.x) || !Number.isFinite(c.origin.z))) throw new RangeError('Invalid ring cells');
    this.cells = [...cells].sort((a, b) => a.instance.localeCompare(b.instance)); this.allocator = allocator; this.catalogue = catalogue; this.ports = ports;
    this.options = { readinessSeconds: 4, viewDistance: 1.5 * C.pitch, farPrefetch: 435, farCount: C.farCount, uploadsPerFrame: 2, uploadBytesPerFrame: 8 * 1_000_000, maxInFlight: 8, ...options,
      residentCaps: { far: options.farCount ?? C.farCount, l1: C.l1Count, l0: C.l0Count, ...options.residentCaps } };
    if (!Number.isInteger(this.options.farCount) || this.options.farCount < 1) throw new RangeError('Invalid far ring count');
  }

  /** Cells currently in view (each must show its far proxy, or finer, everywhere). */
  visible(): readonly RingCell[] { return this.visibleCells; }
  /**
   * True once every patch of every visible cell is drawn by an uploaded level (L0, its L1, or the far proxy), or has no
   * tile at any level to draw: the loader may uncover the view (until then the loading screen covers it).
   */
  ready(): boolean {
    const up = (instance: string, level: RingLevel, x: number, z: number): boolean | null => this.catalogue(instance, level, x, z) === null ? null : this.slots.get(key(instance, level, x, z))?.state === 'uploaded';
    for (const cell of this.visibleCells) {
      const far = up(cell.instance, 'far', 0, 0); if (far === true) continue;
      for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
        const levels = [up(cell.instance, 'l1', Math.floor(x / 2), Math.floor(z / 2)), up(cell.instance, 'l0', x, z), far];
        if (levels.includes(true) || levels.every((level) => level === null)) continue;
        return false;
      }
    }
    return true;
  }
  /** Uploaded keys in key order (deterministic traces). */
  resident(): readonly string[] { return [...this.slots.values()].filter((s) => s.state === 'uploaded').map((s) => s.tile.key).sort(); }
  stats(): RingStats {
    const resident = { far: 0, l1: 0, l0: 0 }; let inFlight = 0, queued = 0;
    for (const slot of this.slots.values()) { if (slot.state === 'uploaded') resident[slot.tile.level]++; else if (slot.state === 'fetching') inFlight++; else queued++; }
    return { frame: this.frame, resident, inFlight, queued, refused: this.refused, uploads: this.uploads, evictions: this.evictions };
  }

  /** One fixed step: choose, release, request, upload, re-mask. */
  step(camera: RingCamera): void {
    if (this.disposed) throw new Error('Render rings are disposed');
    if (![camera.x, camera.z, camera.vx, camera.vz].every(Number.isFinite)) throw new RangeError('Invalid ring camera');
    this.frame++;
    const want = this.desired(camera);
    // refresh eviction inputs; anything not wanted is cache
    for (const [id, slot] of this.slots) { const d = want.get(id); slot.distance = d?.distance ?? this.distance(slot.tile, camera); slot.lease.update({ distance: slot.distance, needed: d !== undefined }); }
    this.release(want, camera);
    this.request(want);
    this.drain();
    this.release(want, camera); // this step's uploads may have pushed a level over its resident cap
    this.remaskAll(camera);
  }

  /** Dispose every view and release every lease. */
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    const order = [...this.slots.values()].sort((a, b) => LEVEL_RANK[b.tile.level] - LEVEL_RANK[a.tile.level]);
    for (const slot of order) this.drop(slot);
    for (const done of this.completed.splice(0)) if (!(done.result instanceof Error)) this.ports.discard?.(done.tile, done.result);
  }

  private distance(tile: RingTile, camera: RingCamera): number {
    const cell = this.cell(tile.instance);
    return rectDistance(camera.x - cell.origin.x, camera.z - cell.origin.z, tile.level, tile.x, tile.z);
  }
  private cell(instance: string): RingCell { const cell = this.cells.find((c) => c.instance === instance); if (cell === undefined) throw new Error(`Unknown ring cell ${instance}`); return cell; }
  private tile(instance: string, level: RingLevel, x: number, z: number): RingTile { return { key: key(instance, level, x, z), instance, level, x, z }; }

  /** The wanted tiles with their distances, parents included. */
  private desired(camera: RingCamera): Map<string, { tile: RingTile; distance: number }> {
    const want = new Map<string, { tile: RingTile; distance: number }>();
    const add = (tile: RingTile, distance: number): void => { if (this.catalogue(tile.instance, tile.level, tile.x, tile.z) !== null && !want.has(tile.key)) want.set(tile.key, { tile, distance }); };
    const cellDistance = (cell: RingCell): number => rectDistance(camera.x - cell.origin.x, camera.z - cell.origin.z, 'far', 0, 0);
    const ranked = this.cells.map((cell) => ({ cell, d: cellDistance(cell) })).sort((a, b) => a.d - b.d || a.cell.instance.localeCompare(b.cell.instance));
    this.visibleCells = ranked.filter((r) => r.d <= this.options.viewDistance).map((r) => r.cell);
    for (const { cell, d } of ranked.filter((r) => r.d <= this.options.viewDistance + this.options.farPrefetch).slice(0, this.options.farCount)) {
      if (this.catalogue(cell.instance, 'far', 0, 0) !== null) { add(this.tile(cell.instance, 'far', 0, 0), d); continue; }
      // no far proxy: its 16 L1 tiles are its coarse level
      for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) add(this.tile(cell.instance, 'l1', x, z), rectDistance(camera.x - cell.origin.x, camera.z - cell.origin.z, 'l1', x, z));
    }
    const l1: { tile: RingTile; d: number }[] = [], l0: { tile: RingTile; d: number }[] = [];
    for (const { cell, d } of ranked) {
      if (d > L1_RADIUS) continue;
      const lx = camera.x - cell.origin.x, lz = camera.z - cell.origin.z;
      for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) { const td = rectDistance(lx, lz, 'l1', x, z); if (td <= L1_RADIUS) l1.push({ tile: this.tile(cell.instance, 'l1', x, z), d: td }); }
      for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) { const td = rectDistance(lx, lz, 'l0', x, z); if (td <= L0_RADIUS) l0.push({ tile: this.tile(cell.instance, 'l0', x, z), d: td }); }
    }
    const order = (a: { tile: RingTile; d: number }, b: { tile: RingTile; d: number }): number => a.d - b.d || a.tile.key.localeCompare(b.tile.key);
    l0.sort(order); l1.sort(order);
    const fine = l0.slice(0, C.l0Count);
    // lookahead along the heading, beyond the disc, until the L0 count cap
    const speed = Math.hypot(camera.vx, camera.vz), reach = speed * this.options.readinessSeconds;
    if (reach > 0) {
      const seen = new Set(fine.map((f) => f.tile.key)); let slots = Math.min(LOOKAHEAD_SLOTS, C.l0Count - fine.length);
      for (let s = L0_RADIUS; s <= L0_RADIUS + reach && slots > 0; s += C.l0.size / 4) {
        const px = camera.x + camera.vx / speed * s, pz = camera.z + camera.vz / speed * s;
        for (const { cell } of ranked) {
          const lx = px - cell.origin.x, lz = pz - cell.origin.z;
          if (Math.abs(lx) >= CHUNK_HALF || Math.abs(lz) >= CHUNK_HALF) continue;
          const tile = this.tile(cell.instance, 'l0', Math.floor((lx + CHUNK_HALF) / C.l0.size), Math.floor((lz + CHUNK_HALF) / C.l0.size));
          if (!seen.has(tile.key) && slots > 0) { seen.add(tile.key); slots--; fine.push({ tile, d: this.distance(tile, camera) }); }
        }
      }
    }
    for (const { tile, d } of l1.slice(0, C.l1Count)) add(tile, d);
    // a wanted child always wants its parents (the cap never strands an L0 tile without its L1)
    for (const { tile, d } of fine) {
      const cell = this.cell(tile.instance), x = Math.floor(tile.x / 2), z = Math.floor(tile.z / 2);
      if (this.catalogue(tile.instance, 'far', 0, 0) !== null && !want.has(key(tile.instance, 'far', 0, 0))) add(this.tile(tile.instance, 'far', 0, 0), cellDistance(cell));
      add(this.tile(tile.instance, 'l1', x, z), rectDistance(camera.x - cell.origin.x, camera.z - cell.origin.z, 'l1', x, z));
      add(tile, d);
    }
    return want;
  }

  /**
   * Hysteresis: drop unwanted tiles a tile-size beyond their ring, and unwanted cache beyond each level's resident cap
   * (farthest first). A dropped tile takes its cached children with it: the wanted set is closed under parents, so an
   * unwanted tile has no wanted descendant, and the children go first so a parent never leaves under one.
   */
  private release(want: ReadonlyMap<string, unknown>, camera: RingCamera): void {
    const keep = { far: this.options.viewDistance + this.options.farPrefetch + C.pitch / 2, l1: L1_RADIUS + C.l1.size, l0: L0_RADIUS + C.l0.size } as const;
    const order = [...this.slots.values()].sort((a, b) => LEVEL_RANK[b.tile.level] - LEVEL_RANK[a.tile.level] || this.distance(b.tile, camera) - this.distance(a.tile, camera) || a.tile.key.localeCompare(b.tile.key));
    const count = { far: 0, l1: 0, l0: 0 };
    for (const slot of this.slots.values()) if (slot.state === 'uploaded') count[slot.tile.level]++;
    const dropTree = (slot: Slot<D>): void => {
      for (const child of this.slots.values()) if (parentOf(child.tile) === slot.tile.key) dropTree(child);
      if (this.slots.get(slot.tile.key) !== slot) return;
      if (slot.state === 'uploaded') count[slot.tile.level]--;
      this.drop(slot);
    };
    for (const slot of order) {
      if (want.has(slot.tile.key) || this.slots.get(slot.tile.key) !== slot) continue;
      const level = slot.tile.level, cap = this.options.residentCaps[level] ?? Infinity;
      if (slot.state !== 'uploaded' ? !this.hasChildren(slot.tile) : this.distance(slot.tile, camera) > keep[level] || count[level] > cap) dropTree(slot);
    }
  }

  /** Whether the catalogue has the parent tile at all (a shard without a far proxy starts at L1). */
  private exists(child: RingTile): boolean {
    return child.level === 'l1' ? this.catalogue(child.instance, 'far', 0, 0) !== null : this.catalogue(child.instance, 'l1', Math.floor(child.x / 2), Math.floor(child.z / 2)) !== null;
  }

  private hasChildren(tile: RingTile): boolean {
    if (tile.level === 'l0') return false;
    for (const slot of this.slots.values()) if (parentOf(slot.tile) === tile.key) return true;
    return false;
  }

  /** Request wanted tiles parent-first, nearest first, within the in-flight cap; each is charged before it is fetched. */
  private request(want: ReadonlyMap<string, { tile: RingTile; distance: number }>): void {
    const pending = [...want.values()].filter(({ tile }) => !this.slots.has(tile.key) && (this.retryAt.get(tile.key) ?? 0) <= this.frame)
      .sort((a, b) => LEVEL_RANK[a.tile.level] - LEVEL_RANK[b.tile.level] || a.distance - b.distance || a.tile.key.localeCompare(b.tile.key));
    let inFlight = [...this.slots.values()].filter((s) => s.state === 'fetching').length;
    for (const { tile, distance } of pending) {
      if (inFlight >= this.options.maxInFlight) break;
      const parentKey = parentOf(tile), parent = parentKey === null ? undefined : this.slots.get(parentKey);
      if (parentKey !== null && this.exists(tile) && parent?.state !== 'uploaded') continue;
      const bytes = this.catalogue(tile.instance, tile.level, tile.x, tile.z); if (bytes === null) continue;
      const lease = this.allocator.reserve({ id: `render:${tile.key}`, category: tile.level, bytes, owner: tile.instance, distance, needed: true, evictSync: () => { this.evicted(tile.key); } });
      if (lease === null) { this.refused++; this.retryAt.set(tile.key, this.frame + 15); continue; }
      const slot: Slot<D> = { tile, state: 'fetching', lease, unholdParent: parent?.lease.hold() ?? ((): void => undefined), view: null, data: null, bytes, distance, masked: '', shadow: false };
      this.slots.set(tile.key, slot); inFlight++;
      try {
        this.ports.fetch(tile, (result) => {
          if (this.disposed) { if (!(result instanceof Error)) this.ports.discard?.(tile, result); return; }
          this.completed.push({ tile, lease, result });
        });
      } catch (error) { this.drop(slot); throw error; }
    }
  }

  /** Move finished fetches into the queue, then upload within this step's budget, coarse levels first. */
  private drain(): void {
    for (const done of this.completed.splice(0)) {
      const slot = this.slots.get(done.tile.key);
      if (slot === undefined || slot.lease !== done.lease || slot.state !== 'fetching') { if (!(done.result instanceof Error)) this.ports.discard?.(done.tile, done.result); continue; } // dropped meanwhile
      if (done.result instanceof Error) { this.drop(slot); this.retryAt.set(done.tile.key, this.frame + 30); continue; }
      slot.data = done.result; slot.state = 'queued';
    }
    const queue = [...this.slots.values()].filter((s) => s.state === 'queued').sort((a, b) => LEVEL_RANK[a.tile.level] - LEVEL_RANK[b.tile.level] || a.distance - b.distance || a.tile.key.localeCompare(b.tile.key));
    let count = 0, bytes = 0;
    for (const slot of queue) {
      if (count >= this.options.uploadsPerFrame || (count > 0 && bytes + slot.bytes > this.options.uploadBytesPerFrame)) break;
      const data = slot.data; if (data === null) continue;
      try { slot.view = this.ports.upload(slot.tile, data); }
      catch (error) { this.drop(slot); throw error; }
      slot.data = null; slot.state = 'uploaded';
      count++; bytes += slot.bytes; this.uploads++;
      const parent = parentOf(slot.tile); if (parent !== null) this.remask(parent);
    }
  }

  /** The allocator evicted a cache tile (only unheld ones, so never a parent with children): dispose and re-mask now. */
  private evicted(id: string): void { const slot = this.slots.get(id); if (slot !== undefined) { this.evictions++; this.drop(slot); } }

  /** Dispose, unhold the parent, release the lease (a no-op once the allocator evicted it) and re-mask the parent. */
  private drop(slot: Slot<D>): void {
    if (this.slots.get(slot.tile.key) !== slot) return;
    this.slots.delete(slot.tile.key);
    const errors: unknown[] = [];
    const clean = (run: () => void): void => { try { run(); } catch (error) { errors.push(error); } };
    const view = slot.view, data = slot.data; slot.view = null; slot.data = null;
    if (view !== null) clean(() => view.dispose());
    if (data !== null) clean(() => this.ports.discard?.(slot.tile, data));
    clean(() => this.ports.cancel?.(slot.tile));
    clean(slot.unholdParent);
    clean(() => slot.lease.release());
    // tearing down re-masks nothing: the session's scope may already have uninstalled the parent's mesh
    if (!this.disposed) { const parent = parentOf(slot.tile); if (parent !== null) clean(() => this.remask(parent)); }
    if (errors.length > 0) throw new AggregateError(errors, 'Ring tile cleanup failed');
  }

  /** A parent hides exactly the regions whose child is uploaded. */
  private remask(parentKey: string): void {
    const parent = this.slots.get(parentKey); if (parent?.view === null || parent?.view === undefined) return;
    const excluded = new Set<number>();
    for (const slot of this.slots.values()) {
      if (slot.state !== 'uploaded' || parentOf(slot.tile) !== parentKey) continue;
      excluded.add(parent.tile.level === 'far' ? slot.tile.x + slot.tile.z * 4 : slot.tile.x % 2 + (slot.tile.z % 2) * 2);
    }
    const signature = [...excluded].sort((a, b) => a - b).join(',');
    if (signature !== parent.masked) { parent.masked = signature; parent.view.mask(excluded); }
  }

  private remaskAll(camera: RingCamera): void {
    for (const slot of this.slots.values()) {
      if (slot.view === null) continue;
      if (slot.tile.level !== 'l0') this.remask(slot.tile.key);
      else { const shadow = this.distance(slot.tile, camera) <= C.shadowRadius; if (shadow !== slot.shadow) { slot.shadow = shadow; slot.view.shadow(shadow); } }
    }
  }
}
