/** S3 handoff: archive each detached material before its first GPU upload, then
 * retire whole-road native buffers only after the admitted road ring is ready. */
import { BufferAttribute, BufferGeometry, type Mesh } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { presenting } from '@wildshard/engine/core/framePacing';
import type { RingCamera, TileRequirement, TileStreamBudget, TileStreamer } from '@wildshard/engine/world/tileStreamer';
import type { CullPlan, RoadCuller } from './roadCull';
import { coarseRoadTileSteps } from './roadTileCoarse';
import { compactRoadTileSteps, type RoadTileGeometry } from './roadTileGeometry';
import { persistRoadTile, ROAD_TILE_ARCHIVE_BYTES, ROAD_TILE_HEADER_BYTES, type RoadTileReference, type RoadTileStore } from './roadTileArchive';
import { RoadTilePool } from './roadTilePool';
import { roadCellKey, roadTileStream, type PreparedRoadTile, type RoadTileSource } from './roadTileStream';
import type { RoadLayout } from './roadLayout';

interface Source {
  readonly mesh: Mesh; readonly scope: Scope; readonly references: RoadTileReference[]; readonly coarseReferences: RoadTileReference[];
  retire: (() => void) | null; pool: RoadTilePool | null;
}
type ArchiveResult = { readonly ok: true; readonly reference: RoadTileReference } | { readonly ok: false; readonly error: unknown };
interface PendingArchive {
  readonly owner: Scope; readonly references: RoadTileReference[]; readonly ready: Promise<ArchiveResult>; readonly budget: number;
  readonly settled: { result: ArchiveResult | undefined };
}
// Limit native jobs as well as retained scratch. The unchanged byte bound
// remains authoritative and drains earlier for larger/unknown archives.
const ARCHIVE_WINDOW = 32;
// Keep the original six-job policy beside live draws. Only loading fills the
// wider byte window; no additional callback burst is introduced in play.
const archiveWindow = (): number => presenting() ? 6 : ARCHIVE_WINDOW;

/** Conservative scratch bound: compacted attributes/indices, number tables,
 * coarse child/merge copies, encoded bodies and native read/hash/write copies.
 * Unsupported or large sources retain the original single-operation path. */
function archiveScratch(mesh: Mesh, indices: number): number {
  if (!Number.isSafeInteger(indices) || indices < 0) return Infinity;
  let stride = 0;
  for (const attribute of Object.values(mesh.geometry.attributes)) {
    if (!(attribute instanceof BufferAttribute)) return Infinity;
    const size: unknown = Object.getOwnPropertyDescriptor(attribute, 'itemSize')?.value;
    const array: unknown = Object.getOwnPropertyDescriptor(attribute, 'array')?.value;
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) return Infinity;
    const bytes = array instanceof Float64Array ? 8
      : array instanceof Float32Array || array instanceof Uint32Array || array instanceof Int32Array ? 4
        : array instanceof Uint16Array || array instanceof Int16Array ? 2
          : array instanceof Uint8Array || array instanceof Uint8ClampedArray || array instanceof Int8Array ? 1 : 0;
    if (bytes === 0) return Infinity;
    stride += size * bytes;
  }
  const header = ROAD_TILE_HEADER_BYTES + 4;
  const bytes = 4 * (indices * (stride + 8) + header) + 2 * (indices * (stride + 64) + header);
  return Number.isSafeInteger(bytes) ? bytes : Infinity;
}
export class RoadTileBacking {
  private readonly sources = new Map<Mesh, Source>();
  private readonly pending: PendingArchive[] = [];
  private pendingBytes = 0;
  private activeArchives = 0;
  private flushRequested = false;
  private failureSeen = false;
  private flushing: Promise<void> | null = null;
  private settling: Promise<void> | null = null;
  private capturing = false;
  private stream: TileStreamer<PreparedRoadTile> | null = null;
  private committed = false;
  private primed = false;
  private priming = false;
  private primeFailure: Error | null = null;
  private initialPins: TileRequirement[] = [];
  private initialFine: { instance: string; key: number; x: number; z: number }[] = [];
  private initialCoarse: { instance: string; x: number; z: number }[] = [];
  constructor(private readonly scope: Scope, private readonly store: RoadTileStore, private readonly culler: RoadCuller) {
    if (scope.disposed || scope.disposing) throw new Error('Road backing owner retired');
    scope.onDispose(() => {
      for (const pin of this.initialPins) pin.release(); this.initialPins = [];
      this.initialFine = []; this.initialCoarse = []; this.sources.clear(); this.stream = null;
      void this.settlePending();
    });
  }
  /** Independent archives overlap in a byte-bounded window of at most 32 jobs. Every
   * source still drains in authored order before its mesh can be published. */
  *capture(mesh: Mesh, plan: CullPlan): Generator<void, void> {
    if (this.stream !== null || this.capturing || this.flushing !== null || this.settling !== null || this.pending.length > 0
      || this.sources.has(mesh) || this.scope.disposed || this.scope.disposing) throw new Error('Road backing is not accepting sources');
    const source: Source = { mesh, scope: this.scope.child(`source:${String(this.sources.size)}`), references: [], coarseReferences: [], retire: null, pool: null };
    this.sources.set(mesh, source); this.capturing = true; let completed = false;
    try {
      const parents = new Map<string, { x: number; z: number }>();
      for (const bin of plan.bins) {
        const tile = bin.tile; if (tile === undefined) throw new Error('Road backing requires the tile lattice');
        const budget = archiveScratch(mesh, bin.count + bin.levels.reduce((sum, run) => sum + run.count, 0));
        yield* this.room(source, budget);
        const data = yield* compactRoadTileSteps(mesh.geometry, plan, tile.x, tile.z);
        yield* this.write(source, data, source.references, budget);
        const x = Math.floor(tile.x / 2), z = Math.floor(tile.z / 2); parents.set([x, z].join(','), { x, z });
      }
      for (const { x, z } of parents.values()) {
        const count = plan.bins.reduce((sum, bin) => bin.tile !== undefined && Math.floor(bin.tile.x / 2) === x
          && Math.floor(bin.tile.z / 2) === z ? sum + (bin.levels[0] ?? bin).count : sum, 0);
        const budget = archiveScratch(mesh, count);
        yield* this.room(source, budget);
        const data = yield* coarseRoadTileSteps(mesh.geometry, plan, x, z);
        if (data.plan.source.length === 0) { data.geometry.dispose(); continue; }
        yield* this.write(source, data, source.coarseReferences, budget);
      }
      if (this.pending.length > 0) { this.flushRequested = true; yield; }
      if (source.scope.disposed || source.scope.disposing) throw new Error('Road backing owner retired');
      if (this.pending.length > 0 || this.flushing !== null) throw new Error('Road construction must await its backing writes');
      completed = true;
    } finally { this.capturing = false; if (!completed) { this.sources.delete(mesh); source.scope.dispose(); } }
  }
  private *room(source: Source, budget: number): Generator<void, void> {
    if (this.pending.length > 0 && (this.failureSeen || this.pendingBytes + budget > ROAD_TILE_ARCHIVE_BYTES)) {
      this.flushRequested = true; yield;
    }
    if (source.scope.disposed || source.scope.disposing) throw new Error('Road backing owner retired');
    if (this.flushing !== null || this.settling !== null || this.activeArchives >= archiveWindow()) throw new Error('Road construction must await its backing writes');
  }
  private *write(source: Source, data: RoadTileGeometry, references: RoadTileReference[], budget: number): Generator<void, void> {
    try {
      const settled: PendingArchive['settled'] = { result: undefined };
      const ready = this.archiveResult(persistRoadTile(source.scope, this.store, data)).then(result => {
        settled.result = result; this.activeArchives--; return result;
      });
      this.activeArchives++;
      this.pending.push({ owner: source.scope, references, ready, budget, settled }); this.pendingBytes += budget;
    } finally { data.geometry.dispose(); }
    yield;
    if (source.scope.disposed || source.scope.disposing) throw new Error('Road backing owner retired');
  }
  private async archiveResult(pending: Promise<RoadTileReference>): Promise<ArchiveResult> {
    try { return { ok: true, reference: await pending }; }
    catch (error) { this.failureSeen = true; return { ok: false, error }; }
  }
  /** Refill any completed slot while committing only the ready authored prefix.
   * Even completed out-of-order entries retain their full scratch charge until
   * committed. Byte boundaries, failures and publication drain the full set. */
  flush(): Promise<void> | null {
    if (this.flushing !== null) return this.flushing;
    if (this.pending.length === 0) { this.flushRequested = false; this.failureSeen = false; return null; }
    if (!this.flushRequested && !this.failureSeen && this.activeArchives < archiveWindow() && this.pendingBytes < ROAD_TILE_ARCHIVE_BYTES) return null;
    const all = this.flushRequested || this.failureSeen || this.pendingBytes >= ROAD_TILE_ARCHIVE_BYTES;
    this.flushRequested = false;
    const takeRemaining = (): PendingArchive[] => {
      const remaining = this.pending.splice(0); this.pendingBytes = 0; return remaining;
    };
    const pending = (async (): Promise<void> => {
      try {
        const waiting = this.pending.filter(job => job.settled.result === undefined).map(job => job.ready);
        await (all ? Promise.all(waiting) : Promise.race(waiting));
        if (this.failureSeen) await Promise.all(this.pending.map(job => job.ready));
        for (;;) {
          const job = this.pending[0], result = job?.settled.result;
          if (job === undefined || result === undefined) break;
          if (!result.ok) throw result.error;
          if (job.owner.disposed || job.owner.disposing) throw new Error('Road backing owner retired');
          job.references.push(result.reference);
          this.pending.shift(); this.pendingBytes -= job.budget;
        }
        // Infinity is the unsupported-size serial fallback, not a retained NaN.
        if (this.pending.length === 0) this.pendingBytes = 0;
      } catch (error) {
        await Promise.all(takeRemaining().map(job => job.ready)); throw error;
      } finally { if (this.pending.length === 0) this.failureSeen = false; }
    })();
    this.flushing = pending;
    return pending.finally(() => { if (this.flushing === pending) this.flushing = null; });
  }
  /** Cancellation still joins every started immutable operation; retired owners
   * cannot publish references or write after their original live fence. */
  settlePending(): Promise<void> {
    if (this.settling !== null) return this.settling;
    if (this.capturing && !this.scope.disposed && !this.scope.disposing) return Promise.reject(new Error('Road capture must close before cancellation drain'));
    const pending = (async (): Promise<void> => {
      if (this.flushing !== null) await this.flushing.catch(() => undefined);
      const jobs = this.pending.splice(0); this.pendingBytes = 0; this.flushRequested = false;
      await Promise.all(jobs.map(job => job.ready)); this.failureSeen = false;
    })();
    this.settling = pending;
    return pending.finally(() => { if (this.settling === pending) this.settling = null; });
  }
  /** Bind the original allocation's shrink-only callback, never a new allowance. */
  retirement(mesh: Mesh, retire: () => void): void {
    const source = this.sources.get(mesh);
    if (source === undefined || source.retire !== null) throw new Error('Missing or duplicate road retirement');
    source.retire = retire;
  }
  started(): boolean { return this.stream !== null; }
  /** Seal after both initially needed and outer road construction finish. All
   * material roots stay hidden until publication covers the initial road ring. */
  start(origin: { readonly x: number; readonly z: number }, layout: Pick<RoadLayout, 'junctions'>, budget: TileStreamBudget, id: string): void {
    if (this.stream !== null || this.capturing || this.pending.length > 0 || this.flushing !== null || this.settling !== null
      || this.scope.disposed || this.scope.disposing) throw new Error('Road backing is not ready to seal');
    const sources: RoadTileSource[] = [];
    for (const source of this.sources.values()) {
      if (source.retire === null || Array.isArray(source.mesh.material)) throw new Error('Road backing lacks an admitted material');
      const pool = new RoadTilePool(this.scope.child(`material:${String(sources.length)}`), source.mesh.material, this.culler, source.mesh.name, source.mesh.receiveShadow, source.mesh.renderOrder);
      pool.root.visible = false; source.mesh.add(pool.root); source.pool = pool;
      sources.push({ pool, references: source.references, coarseReferences: source.coarseReferences });
    }
    this.stream = roadTileStream(this.scope, sources, origin, layout, budget, this.store, id);
    const fine = new Map<string, { instance: string; key: number; x: number; z: number }>();
    const coarse = new Map<string, { instance: string; x: number; z: number }>();
    for (const source of sources) {
      for (const reference of source.references) {
        const px = Math.floor(reference.x / 2), pz = Math.floor(reference.z / 2), instance = roadCellKey(id, px, pz);
        const key = reference.x - px * 2 + 8 * (reference.z - pz * 2);
        fine.set([instance, key].join(':'), { instance, key, x: origin.x + reference.x * CONTENT_CAPS.l0.size, z: origin.z + reference.z * CONTENT_CAPS.l0.size });
      }
      for (const reference of source.coarseReferences) {
        const instance = roadCellKey(id, reference.x, reference.z);
        coarse.set(instance, { instance, x: origin.x + reference.x * CONTENT_CAPS.l1.size, z: origin.z + reference.z * CONTENT_CAPS.l1.size });
      }
    }
    this.initialFine = [...fine.values()]; this.initialCoarse = [...coarse.values()];
  }
  step(camera: RingCamera): void {
    const stream = this.stream; if (stream === null) return;
    if (this.primeFailure !== null) throw this.primeFailure;
    if (!this.priming) this.prime(camera, stream);
    stream.step(camera);
    if (!this.committed && this.primed && stream.ready()) {
      // Reveal first, so retiring a whole mesh cannot leave its ready children
      // hidden. Geometry disposal precedes each corresponding lease shrink.
      for (const source of this.sources.values()) if (source.pool !== null) source.pool.root.visible = true;
      for (const source of this.sources.values()) {
        const previous = source.mesh.geometry;
        source.mesh.geometry = new BufferGeometry(); source.mesh.geometry.setDrawRange(0, 0);
        source.mesh.onBeforeRender = () => { /* Original cull buffers are retired. */ };
        this.culler.plans.delete(source.mesh); previous.dispose(); source.retire?.();
      }
      this.committed = true;
      for (const pin of this.initialPins) pin.release(); this.initialPins = [];
    }
  }
  /** Bound the first handoff to the existing fine/coarse counts. Coarse
   * publication alone must not retire nearby full-detail roads. */
  private prime(camera: RingCamera, stream: TileStreamer<PreparedRoadTile>): void {
    this.priming = true;
    const distance = (at: { x: number; z: number }, size: number): number => Math.hypot(
      Math.max(at.x - camera.x, 0, camera.x - at.x - size), Math.max(at.z - camera.z, 0, camera.z - at.z - size));
    const fine = this.initialFine.filter(at => distance(at, CONTENT_CAPS.l0.size) <= CONTENT_CAPS.nearRadius)
      .sort((a, b) => distance(a, CONTENT_CAPS.l0.size) - distance(b, CONTENT_CAPS.l0.size)).slice(0, CONTENT_CAPS.l0Count);
    const keys = new Map<string, number[]>();
    for (const row of fine) { const values = keys.get(row.instance) ?? []; values.push(row.key); keys.set(row.instance, values); }
    const near = this.initialCoarse.filter(at => distance(at, CONTENT_CAPS.l1.size) <= 400)
      .sort((a, b) => Number(keys.has(b.instance)) - Number(keys.has(a.instance)) || distance(a, CONTENT_CAPS.l1.size) - distance(b, CONTENT_CAPS.l1.size))
      .slice(0, CONTENT_CAPS.l1Count);
    for (const row of near) this.initialPins.push(stream.require(row.instance, [0], 'l1'));
    for (const [instance, values] of keys) this.initialPins.push(stream.require(instance, values));
    this.initialFine = []; this.initialCoarse = [];
    const finish = async (): Promise<void> => {
      try {
        await Promise.all(this.initialPins.map(pin => pin.ready));
        if (!this.scope.disposed && !this.scope.disposing) this.primed = true;
      } catch (error) {
        if (!this.scope.disposed && !this.scope.disposing) this.primeFailure = error instanceof Error ? error : new Error('Road tile priming failed', { cause: error });
      }
    };
    void finish();
  }
  ready(): boolean { return this.committed && this.stream?.ready() === true; }
  state(): { started: boolean; primed: boolean; ready: boolean; materials: number; backedTiles: number } {
    return { started: this.started(), primed: this.primed, ready: this.ready(), materials: this.sources.size,
      backedTiles: [...this.sources.values()].reduce((sum, source) => sum + source.references.length + source.coarseReferences.length, 0) };
  }
}
