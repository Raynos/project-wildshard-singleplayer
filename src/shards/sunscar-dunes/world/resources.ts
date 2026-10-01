import { InstancedMesh, Mesh, type Object3D } from 'three';
import type { Scope } from '#engine';

/** Code-built meshes own their buffers and materials in the level scope (ENGINE §4, the template's helper). */
export function ownPrimitives(root: Object3D, scope: Scope): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    scope.own(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) scope.own(material);
    if (node instanceof InstancedMesh) scope.own(node);
  });
  scope.onDispose(() => { root.removeFromParent(); });
}
