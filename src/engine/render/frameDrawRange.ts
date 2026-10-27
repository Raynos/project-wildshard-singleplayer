import { BufferGeometry, InstancedMesh, Mesh, Object3D, SkinnedMesh, Sphere, Vector3, type Camera } from 'three';
import type { Scope } from '../app/scope';

/** Temporary live-frame presentation only. Preparation renders do not use it. */
export interface FrameDrawRange { enabled: boolean; readonly distance: number }
interface RangeLease { readonly range: FrameDrawRange; readonly owner: Scope }

/** Scope-owned draw ranges, independent of world construction and readiness.
 * Existing native bounds conservatively retain nearby static draws, skies,
 * dynamic/custom objects and any object without a trustworthy bound. */
export class FrameDrawRanges {
  private readonly ranges = new Set<RangeLease>();
  private readonly hidden: Object3D[] = [];
  private readonly eye = new Vector3();
  private readonly sphere = new Sphere();
  bind(owner: Scope, distance: number): FrameDrawRange {
    if (owner.disposed || owner.disposing || !Number.isFinite(distance) || distance <= 0) throw new Error('Frame draw range requires a live owner and positive distance');
    const range: FrameDrawRange = { enabled: false, distance }, lease = { range, owner }; this.ranges.add(lease);
    owner.onDispose(() => { this.ranges.delete(lease); });
    return range;
  }
  /** Only the ordinary synchronous live draw is masked. Always restore before
   * a yielded builder, offscreen warm-up or another view can inspect the scene. */
  draw(root: Object3D, camera: Camera, renderer: { render: (delta: number) => void }, delta: number): void {
    let distance = Infinity;
    for (const { range, owner } of this.ranges) if (range.enabled && !owner.disposed && !owner.disposing) distance = Math.min(distance, range.distance);
    if (!Number.isFinite(distance)) { renderer.render(delta); return; }
    if (this.hidden.length > 0) throw new Error('Frame draw range is already drawing');
    try {
      root.updateMatrixWorld(); camera.getWorldPosition(this.eye);
      root.traverseVisible(node => {
        // Keep sky/backdrop draws and moving/custom pipelines unchanged. A
        // mesh with children cannot be hidden by its own geometry's bound.
        if (!(node instanceof Mesh) || node instanceof SkinnedMesh || !node.frustumCulled || node.children.length > 0
          || node.onBeforeRender !== Object3D.prototype.onBeforeRender || node.onAfterRender !== Object3D.prototype.onAfterRender) return;
        const geometry: unknown = node.geometry;
        if (!(geometry instanceof BufferGeometry)) return;
        for (const key in geometry.morphAttributes) if (Object.hasOwn(geometry.morphAttributes, key)) return;
        const bound: unknown = node instanceof InstancedMesh ? node.boundingSphere : geometry.boundingSphere;
        if (!(bound instanceof Sphere)) return;
        const sphere = this.sphere.copy(bound).applyMatrix4(node.matrixWorld);
        if (!Number.isFinite(sphere.radius) || sphere.radius < 0 || !Number.isFinite(sphere.center.lengthSq())) return;
        if (sphere.distanceToPoint(this.eye) <= distance) return;
        node.visible = false; this.hidden.push(node);
      });
      renderer.render(delta);
    } finally {
      for (const node of this.hidden) node.visible = true;
      this.hidden.length = 0;
    }
  }
}
