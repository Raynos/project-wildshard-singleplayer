import * as THREE from 'three';

/**
 * A world's own instances in a shared BatchedMesh with two distance levels (SHARD-PLATFORM M3, the cull system): a baked
 * skin's tiles, an interior and its far hood sit in the same batch as a kit's placed models, each an instance whose level
 * is a geometry id and whose range is a visibility bit. Per instance: the camera's distance less half its radius picks
 * the near geometry (closer than `near`), the far one (closer than `far`) or none; re-chosen once the camera has moved
 * `step` metres. Nothing here knows a shard's kit.
 */

/** One instance to add: its matrix, its two levels (indices into the geometries handed to `add`), its ranges and bounds. */
export interface LodPlanRow {
  readonly matrix: THREE.Matrix4;
  readonly lod0: number;
  readonly lod1: number;
  readonly near: number;
  readonly far: number;
  /** the bounding sphere's radius and world centre */
  readonly r: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One added instance: its batch id, bounds, ranges, its two batch geometry ids and its level (0 near, 1 far, 2 hidden). */
export interface LodInstance { id: number; x: number; y: number; z: number; r: number; near: number; far: number; lod0: number; lod1: number; state: number }

/** A geometry's vertex and index counts as a batch reserves them (none: zero; non-indexed: its vertex count). */
export function geometrySize(g: THREE.BufferGeometry | undefined): { v: number; i: number } {
  return g ? { v: g.getAttribute('position').count, i: g.index ? g.index.count : g.getAttribute('position').count } : { v: 0, i: 0 };
}

/** A batch's own two-level instances (see the module comment). */
export class BatchedLodSet {
  /** the instances in the order `add` added them */
  readonly instances: LodInstance[] = [];
  private readonly batch: THREE.BatchedMesh;
  private readonly step: number;
  private readonly last = new THREE.Vector3(1e9, 0, 0);

  /** `step`: metres the camera moves before the levels are chosen again */
  constructor(batch: THREE.BatchedMesh, step = 1) {
    this.batch = batch;
    this.step = step;
  }

  /** Add `geometries` to the batch (in order), then one instance per plan row, each starting at its near level. */
  add(geometries: readonly THREE.BufferGeometry[], plan: readonly LodPlanRow[]): void {
    const bm = this.batch;
    const ids = geometries.map((g) => bm.addGeometry(g));
    for (const q of plan) {
      const g0 = ids[q.lod0], g1 = ids[q.lod1];
      if (g0 === undefined || g1 === undefined) continue;
      const id = bm.addInstance(g0);
      bm.setMatrixAt(id, q.matrix);
      this.instances.push({ id, x: q.x, y: q.y, z: q.z, r: q.r, near: q.near, far: q.far, lod0: g0, lod1: g1, state: 0 });
    }
  }

  /** Per frame: when the camera at `p` has moved `step` metres, each instance's level and visibility. */
  update(p: THREE.Vector3): void {
    if (p.distanceToSquared(this.last) <= this.step * this.step) return;
    this.last.copy(p);
    const bm = this.batch;
    for (const it of this.instances) {
      const dd = Math.hypot(it.x - p.x, it.y - p.y, it.z - p.z) - it.r * 0.5;
      const state = dd > it.far ? 2 : dd > it.near ? 1 : 0;
      if (state === it.state) continue;
      it.state = state;
      bm.setVisibleAt(it.id, state !== 2);
      if (state !== 2) bm.setGeometryIdAt(it.id, state === 0 ? it.lod0 : it.lod1);
    }
  }
}
