import type * as THREE from 'three';
import { isMesh, weaponDisplay } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import rest from '../../data/crossbowDisplay.json' with { type: 'json' };

/** Pine keeps its content filter and cloned tree; the shared display owns world materials and assembly. */
export function crossbowDisplayModel(crossbow: { readonly model: THREE.Group }, sky: Sky): THREE.Group {
  const root = crossbow.model.clone(true);
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
  for (const row of rest) {
    const mesh = root.children[row.child];
    if (mesh === undefined || !isMesh(mesh) || Array.isArray(mesh.material) || mesh.material.name !== row.material) throw new Error('Crossbow display rest part changed');
    mesh.position.fromArray(row.position); mesh.quaternion.fromArray(row.quaternion); mesh.scale.fromArray(row.scale);
  }
  root.updateMatrixWorld(true);
  const parts: Parameters<typeof weaponDisplay>[0][number][] = [];
  root.traverse(mesh => {
    if (!isMesh(mesh)) return;
    const mat = mesh.material as THREE.Material;
    if (!mat.name || !mat.colorWrite || (!mesh.visible && mat.name !== 'xbow-bolt') || mesh.userData['viewmodelOnly'] === true) return;
    for (let parent = mesh.parent; parent !== null && parent !== root; parent = parent.parent) if (!parent.visible) return;
    parts.push({ geo: mesh.geometry, mat, matrix: mesh.matrixWorld });
  });
  return weaponDisplay(parts, { mode: 'merged', sky, opaque: true });
}
