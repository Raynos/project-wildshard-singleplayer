import { Matrix4, type BufferGeometry, type Camera, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BatchedCull } from '@wildshard/engine/models/cull';
import { InstancedBatch } from '@wildshard/engine/models/instancedBatch';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { withOwner } from '@wildshard/engine/app/ownership';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import type { WorldSceneBatchRow } from '@wildshard/format/worldSceneBatch';

/**
 * Client-only fixed LOD instances of one material, drawn instanced (an InstancedBatch: one InstancedMesh per geometry
 * slot), each copy choosing its authored near / far geometry by distance. Never a BatchedMesh (E271 / E272: no multi-draw
 * anywhere; a graph look on a multi-draw batch did not even compile on the grid). Named placements that name the batch
 * draw instanced on their own. Finishing registers it (the registry draws it), as a BatchedMesh once arrived through them.
 * Copies marked `merge` become one static geometry at their near level, drawn as one copy (G639: Pine's 18 crag skin
 * tiles were 18 draws in each of the main and shadow passes).
 */
const IDENTITY = new Matrix4();

export class WorldSceneBatch {
  private value: InstancedBatch | undefined;
  private fixed: BatchedCull[] | undefined;
  constructor(private readonly row: WorldSceneBatchRow, private readonly material: Material,
    private readonly geometry: readonly BufferGeometry[], private readonly owner: Scope, private readonly registry: Pick<WorldRegistry, 'add'>) {}

  /** Allocate lazily: unused profile rows retain no instance buffers. */
  object(): InstancedBatch {
    if (this.owner.disposed) throw new Error('World scene batch owner is disposed');
    if (this.value !== undefined) return this.value;
    const row = this.row, batch = withOwner(this.owner, () => new InstancedBatch(this.material, { name: row.name, castShadow: row.castShadow, receiveShadow: row.receiveShadow }));
    this.value = batch;
    // its meshes are sized and owned (`ownSceneResource`) when it finishes; the owner frees them once
    this.owner.onDispose(() => { batch.removeFromParent(); });
    return batch;
  }

  /** Idempotent: its fixed copies, hidden until the first view chooses each one's level. */
  finish(): InstancedBatch {
    const batch = this.object();
    if (this.fixed !== undefined) return batch;
    const ids = this.geometry.map(geometry => batch.addGeometry(geometry)), uses = new Map<number, number>();
    const merged = this.row.fixed.filter(row => row.merge === true), culled = this.row.fixed.filter(row => row.merge !== true);
    for (const row of culled) for (const slot of new Set([row.lod0, row.lod1])) uses.set(slot, (uses.get(slot) ?? 0) + 1);
    for (const [slot, count] of uses) { const id = ids[slot]; if (id !== undefined) batch.reserve(id, count); }
    if (merged.length > 0) batch.addInstance(batch.addGeometry(this.merged(merged)));
    this.fixed = culled.map(row => {
      const near = ids[row.lod0], far = ids[row.lod1];
      if (near === undefined || far === undefined) throw new Error('Missing fixed scene batch geometry');
      const instance = batch.addInstance(near);
      batch.setMatrixAt(instance, new Matrix4().fromArray(row.matrix)); batch.setVisibleAt(instance, false);
      return new BatchedCull([{ mesh: batch, instance, geometry: Int32Array.of(near, far), until2: null }],
        Uint32Array.of(0, 1), Float64Array.from(row.sphere), [0, row.near], { ...this.row.cull, far: row.far });
    });
    for (const mesh of batch.children) ownSceneResource(mesh, this.owner);
    withOwner(this.owner, () => { this.registry.add({ id: this.row.id, name: this.row.name, category: 'nature', file: 'src/game/shardfile/worldSceneBatch.ts', object: batch }); });
    return batch;
  }

  /** The merge copies' near geometries in the batch's frame, one geometry the batch's owner frees. */
  private merged(rows: WorldSceneBatchRow['fixed']): BufferGeometry {
    const moved = new Set<BufferGeometry>();
    const parts = rows.map(row => {
      const geometry = this.geometry[row.lod0];
      if (geometry === undefined) throw new Error('Missing merged scene batch geometry');
      const matrix = new Matrix4().fromArray(row.matrix);
      if (matrix.equals(IDENTITY)) return geometry;
      const copy = geometry.clone().applyMatrix4(matrix); moved.add(copy); return copy;
    });
    const layout = (part: BufferGeometry): string => `${String(part.index !== null)}:${Object.keys(part.attributes).sort().join(',')}`;
    if (new Set(parts.map(layout)).size > 1) throw new Error('Merged scene batch copies need one attribute layout');
    const geometry = mergeGeometries(parts, false);
    for (const copy of moved) copy.dispose();
    geometry.computeBoundingSphere();
    ownSceneResource(geometry, this.owner);
    return geometry;
  }

  /** The resident's existing view camera drives fixed instances alongside ordinary placed-model culling. */
  update(camera: Camera): void {
    if (this.fixed === undefined) return;
    for (const part of this.fixed) part.update(camera);
  }
}
