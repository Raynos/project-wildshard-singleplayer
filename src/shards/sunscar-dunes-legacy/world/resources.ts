import { Mesh, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';

/** Code-built meshes own their buffers and materials in the level scope (ENGINE §4). */
export function ownPrimitives(root: Object3D, scope: Scope): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    scope.own(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) scope.own(material);
  });
  scope.onDispose(() => { root.removeFromParent(); });
}
