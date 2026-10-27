/** S3 handoff: archive each detached material before its first GPU upload, then
 * retire whole-road native buffers only after the admitted road ring is ready. */
import { BufferGeometry, type Mesh } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { RingCamera, TileStreamBudget, TileStreamer } from '@wildshard/engine/world/tileStreamer';
import type { CullPlan, RoadCuller } from './roadCull';
import { compactRoadTileSteps } from './roadTileGeometry';
import { persistRoadTile, type RoadTileReference, type RoadTileStore } from './roadTileArchive';
import { RoadTilePool } from './roadTilePool';
import { roadTileStream, type PreparedRoadTile, type RoadTileSource } from './roadTileStream';
import type { RoadLayout } from './roadLayout';

interface Source {
  readonly mesh: Mesh; readonly scope: Scope; readonly references: RoadTileReference[];
  retire: (() => void) | null; pool: RoadTilePool | null;
}
export class RoadTileBacking {
  private readonly sources = new Map<Mesh, Source>();
  private pending: Promise<void> | null = null;
  private stream: TileStreamer<PreparedRoadTile> | null = null;
  private committed = false;
  constructor(private readonly scope: Scope, private readonly store: RoadTileStore, private readonly culler: RoadCuller) {
    if (scope.disposed || scope.disposing) throw new Error('Road backing owner retired');
    scope.onDispose(() => { this.sources.clear(); this.stream = null; this.pending = null; });
  }
  /** Yield after starting exactly one durable write. The async construction
   * runner must flush before advancing this generator; no full-road byte queue. */
  *capture(mesh: Mesh, plan: CullPlan): Generator<void, void> {
    if (this.stream !== null || this.sources.has(mesh) || this.scope.disposed || this.scope.disposing) throw new Error('Road backing is not accepting sources');
    const source: Source = { mesh, scope: this.scope.child(`source:${String(this.sources.size)}`), references: [], retire: null, pool: null };
    this.sources.set(mesh, source); let completed = false;
    try {
      for (const bin of plan.bins) {
        if (this.pending !== null) throw new Error('Road construction must await its backing write');
        const tile = bin.tile; if (tile === undefined) throw new Error('Road backing requires the tile lattice');
        const data = yield* compactRoadTileSteps(mesh.geometry, plan, tile.x, tile.z);
        this.pending = (async (): Promise<void> => {
          try { source.references.push(await persistRoadTile(source.scope, this.store, data)); }
          finally { data.geometry.dispose(); }
        })();
        yield;
        if (source.scope.disposed || source.scope.disposing) throw new Error('Road backing owner retired');
      }
      completed = true;
    } finally { if (!completed) { this.sources.delete(mesh); source.scope.dispose(); } }
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
      sources.push({ pool, references: source.references });
    }
    this.stream = roadTileStream(this.scope, sources, origin, layout, budget, this.store, id);
  }
  step(camera: RingCamera): void {
    const stream = this.stream; if (stream === null) return;
    stream.step(camera);
    if (!this.committed && stream.ready()) {
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
    }
  }
  ready(): boolean { return this.committed && this.stream?.ready() === true; }
  state(): { started: boolean; ready: boolean; materials: number; backedTiles: number } {
    return { started: this.started(), ready: this.ready(), materials: this.sources.size,
      backedTiles: [...this.sources.values()].reduce((sum, source) => sum + source.references.length, 0) };
  }
}
