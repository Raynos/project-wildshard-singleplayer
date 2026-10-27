/** S3 handoff: archive each detached material before its first GPU upload, then
 * retire whole-road native buffers only after the admitted road ring is ready. */
import { BufferGeometry, type Mesh } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import type { RingCamera, TileRequirement, TileStreamBudget, TileStreamer } from '@wildshard/engine/world/tileStreamer';
import type { CullPlan, RoadCuller } from './roadCull';
import { coarseRoadTileSteps } from './roadTileCoarse';
import { compactRoadTileSteps, type RoadTileGeometry } from './roadTileGeometry';
import { persistRoadTile, type RoadTileReference, type RoadTileStore } from './roadTileArchive';
import { RoadTilePool } from './roadTilePool';
import { roadCellKey, roadTileStream, type PreparedRoadTile, type RoadTileSource } from './roadTileStream';
import type { RoadLayout } from './roadLayout';

interface Source {
  readonly mesh: Mesh; readonly scope: Scope; readonly references: RoadTileReference[]; readonly coarseReferences: RoadTileReference[];
  retire: (() => void) | null; pool: RoadTilePool | null;
}
export class RoadTileBacking {
  private readonly sources = new Map<Mesh, Source>();
  private pending: Promise<void> | null = null;
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
      this.initialFine = []; this.initialCoarse = []; this.sources.clear(); this.stream = null; this.pending = null;
    });
  }
  /** Yield after starting exactly one durable write. The async construction
   * runner must flush before advancing this generator; no full-road byte queue. */
  *capture(mesh: Mesh, plan: CullPlan): Generator<void, void> {
    if (this.stream !== null || this.sources.has(mesh) || this.scope.disposed || this.scope.disposing) throw new Error('Road backing is not accepting sources');
    const source: Source = { mesh, scope: this.scope.child(`source:${String(this.sources.size)}`), references: [], coarseReferences: [], retire: null, pool: null };
    this.sources.set(mesh, source); let completed = false;
    try {
      const parents = new Map<string, { x: number; z: number }>();
      for (const bin of plan.bins) {
        const tile = bin.tile; if (tile === undefined) throw new Error('Road backing requires the tile lattice');
        const data = yield* compactRoadTileSteps(mesh.geometry, plan, tile.x, tile.z);
        yield* this.write(source, data, source.references);
        const x = Math.floor(tile.x / 2), z = Math.floor(tile.z / 2); parents.set([x, z].join(','), { x, z });
      }
      for (const { x, z } of parents.values()) {
        const data = yield* coarseRoadTileSteps(mesh.geometry, plan, x, z);
        if (data.plan.source.length === 0) { data.geometry.dispose(); continue; }
        yield* this.write(source, data, source.coarseReferences);
      }
      completed = true;
    } finally { if (!completed) { this.sources.delete(mesh); source.scope.dispose(); } }
  }
  private *write(source: Source, data: RoadTileGeometry, references: RoadTileReference[]): Generator<void, void> {
    if (this.pending !== null) { data.geometry.dispose(); throw new Error('Road construction must await its backing write'); }
    this.pending = (async (): Promise<void> => {
      try { references.push(await persistRoadTile(source.scope, this.store, data)); }
      finally { data.geometry.dispose(); }
    })();
    yield;
    if (source.scope.disposed || source.scope.disposing) throw new Error('Road backing owner retired');
  }
  /** Called at every yielded construction step, before any original mesh attaches. */
  flush(): Promise<void> | null { const pending = this.pending; this.pending = null; return pending; }
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
    if (this.stream !== null || this.pending !== null || this.scope.disposed || this.scope.disposing) throw new Error('Road backing is not ready to seal');
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
