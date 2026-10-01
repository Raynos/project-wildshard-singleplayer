import { InstancedMesh, Mesh, type Object3D } from 'three';
import type { Scope } from '#engine';

/** Everything a builder creates is owned by the level scope; the root leaves its parent on dispose. */
export function ownPrimitives(root: Object3D, scope: Scope): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (node instanceof InstancedMesh) scope.own(node);
    scope.own(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) scope.own(material);
  });
  scope.onDispose(() => { root.removeFromParent(); });
}
