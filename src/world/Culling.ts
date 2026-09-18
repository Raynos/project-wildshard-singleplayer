import * as THREE from 'three';

/**
 * Per-instance culling for an InstancedMesh: one draw call, but only the instances inside a padded
 * view frustum and within range are written into the live buffer each time the view changes.
 * (three culls an InstancedMesh as a whole; a chunk-wide one is always "visible".)
 *
 *   const c = new CulledInstances(mesh, matrices, bounds, maxDist);
 *   forest.onViewChange((frustum, viewer) => c.cull(frustum, viewer));
 *
 * `bounds` holds x, y, z, radius per instance (world space). `keepNear` instances are never culled
 * so their shadows still fall into view from outside the frustum.
 */
export class CulledInstances {
  private sphere = new THREE.Sphere();
  constructor(
    public mesh: THREE.InstancedMesh,
    private matrices: Float32Array,
    private bounds: Float32Array,
    private maxDist: number,
    private keepNear = 40,
    /** cull instances that would be smaller than this (radius / distance, ≈ radians) */
    private minAngular = 0,
  ) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }

  cull(frustum: THREE.Frustum, viewer: THREE.Vector3) {
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const b = this.bounds, n = b.length >> 2;
    const keep2 = this.keepNear * this.keepNear, max2 = this.maxDist * this.maxDist;
    let out = 0;
    for (let i = 0; i < n; i++) {
      const x = b[i * 4], y = b[i * 4 + 1], z = b[i * 4 + 2], r = b[i * 4 + 3];
      const dx = x - viewer.x, dy = y - viewer.y, dz = z - viewer.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > max2) continue;
      if (d2 > keep2) {
        if (this.minAngular > 0 && r * r < this.minAngular * this.minAngular * d2) continue;
        this.sphere.center.set(x, y, z); this.sphere.radius = r;
        if (!frustum.intersectsSphere(this.sphere)) continue;
      }
      arr.set(this.matrices.subarray(i * 16, i * 16 + 16), out * 16);
      out++;
    }
    this.mesh.count = out;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Same idea for thousands of small static instances (ferns, litter …): instances are bucketed into
 * `cell` m squares once; a view change tests ~250 cell spheres, then copies the instances of the cells
 * that pass (plus a per-instance range check). Per-instance colour rides along.
 */
export class CelledInstances {
  private cells: { cx: number; cy: number; cz: number; r: number; idx: Int32Array }[] = [];
  private sphere = new THREE.Sphere();
  constructor(
    public mesh: THREE.InstancedMesh,
    private matrices: Float32Array,
    private colors: Float32Array | null,
    /** x, y, z per instance */
    private positions: Float32Array,
    private maxDist: number,
    cell = 32,
    instanceRadius = 2,
  ) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const buckets = new Map<string, number[]>();
    const n = positions.length / 3;
    for (let i = 0; i < n; i++) {
      const k = `${Math.floor(positions[i * 3] / cell)},${Math.floor(positions[i * 3 + 2] / cell)}`;
      let b = buckets.get(k); if (!b) buckets.set(k, (b = []));
      b.push(i);
    }
    for (const [k, idx] of buckets) {
      const [ix, iz] = k.split(',').map(Number);
      let ymin = Infinity, ymax = -Infinity;
      for (const i of idx) { const y = positions[i * 3 + 1]; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      const cx = (ix + 0.5) * cell, cz = (iz + 0.5) * cell;
      const r = Math.hypot(cell * 0.5, (ymax - ymin) * 0.5, cell * 0.5) + instanceRadius;
      this.cells.push({ cx, cy: (ymin + ymax) * 0.5, cz, r, idx: Int32Array.from(idx) });
    }
  }

  cull(frustum: THREE.Frustum, viewer: THREE.Vector3) {
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const col = this.mesh.instanceColor ? (this.mesh.instanceColor.array as Float32Array) : null;
    const p = this.positions, max2 = this.maxDist * this.maxDist;
    let out = 0;
    for (const c of this.cells) {
      const dx = c.cx - viewer.x, dz = c.cz - viewer.z;
      if (dx * dx + dz * dz > (this.maxDist + c.r) * (this.maxDist + c.r)) continue;
      this.sphere.center.set(c.cx, c.cy, c.cz); this.sphere.radius = c.r;
      if (!frustum.intersectsSphere(this.sphere)) continue;
      for (let j = 0; j < c.idx.length; j++) {
        const i = c.idx[j];
        const ex = p[i * 3] - viewer.x, ez = p[i * 3 + 2] - viewer.z;
        if (ex * ex + ez * ez > max2) continue;
        arr.set(this.matrices.subarray(i * 16, i * 16 + 16), out * 16);
        if (col && this.colors) col.set(this.colors.subarray(i * 3, i * 3 + 3), out * 3);
        out++;
      }
    }
    this.mesh.count = out;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
