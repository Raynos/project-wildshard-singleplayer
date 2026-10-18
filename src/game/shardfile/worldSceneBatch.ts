import { BatchedMesh, Matrix4, type BufferGeometry, type Camera, type Material } from 'three';
import { BatchedCull } from '@wildshard/engine/models/cull';
import type { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import type { WorldSceneBatchRow } from '@wildshard/format/worldSceneBatch';

/** Client-only reserved batch. Named model calls fill it first; finish appends fixed geometry in authored order. */
export class WorldSceneBatch {
  private value: BatchedMesh | undefined;
  private fixed: BatchedCull[] | undefined;
  constructor(private readonly row: WorldSceneBatchRow, private readonly material: Material,
    private readonly geometry: readonly BufferGeometry[], private readonly owner: Scope) {}

  /** Allocate lazily: unused profile rows retain no matrix textures or vertex buffers. */
  mesh(): BatchedMesh {
    if (this.owner.disposed) throw new Error('World scene batch owner is disposed');
    if (this.value !== undefined) return this.value;
    const row = this.row, capacity = row.capacity;
    const mesh = withOwner(this.owner, () => new BatchedMesh(capacity.instances, capacity.vertices, capacity.indices, this.material));
    mesh.name = row.name; mesh.sortObjects = row.sortObjects; mesh.perObjectFrustumCulled = row.perObjectFrustumCulled;
    mesh.castShadow = row.castShadow; mesh.receiveShadow = row.receiveShadow;
    this.value = mesh;
    ownSceneResource(mesh, this.owner);
    this.owner.onDispose(() => { mesh.removeFromParent(); });
    return mesh;
  }

  /** Named placements reserve before publication finalizes the ordered fixed tail. */
  reserve(): BatchedMesh {
    if (this.fixed !== undefined) throw new Error('World scene batch is finalized');
    return this.mesh();
  }

  /** Idempotent finalization preserves model-first geometry ids and draw order. */
  finish(): BatchedMesh {
    const mesh = this.mesh();
    if (this.fixed !== undefined) return mesh;
    const ids = this.geometry.map(geometry => mesh.addGeometry(geometry));
    this.fixed = this.row.fixed.map(row => {
      const near = ids[row.lod0], far = ids[row.lod1];
      if (near === undefined || far === undefined) throw new Error('Missing fixed scene batch geometry');
      const instance = mesh.addInstance(near);
      mesh.setMatrixAt(instance, new Matrix4().fromArray(row.matrix));
      return new BatchedCull([{ mesh, instance, geometry: Int32Array.of(near, far), until2: null }],
        Uint32Array.of(0, 1), Float64Array.from(row.sphere), [0, row.near],
        { ...this.row.cull, far: row.far });
    });
    return mesh;
  }

  /** The resident's existing view camera drives fixed instances alongside ordinary placed-model culling. */
  update(camera: Camera): void {
    if (this.fixed === undefined) return;
    for (const part of this.fixed) part.update(camera);
  }
}
