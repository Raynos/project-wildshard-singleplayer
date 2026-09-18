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
