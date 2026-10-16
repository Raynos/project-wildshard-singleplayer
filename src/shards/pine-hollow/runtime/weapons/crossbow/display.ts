import type * as THREE from 'three';
import { isMesh, weaponDisplay } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { CROSSBOW_DISPLAY_REST as rest } from '../../const';

/** most rest rows the display JSON may hold (the crossbow's children; throws past it) */
const MAX_REST_ROWS = 64;
/** deepest a crossbow part sits under the display root (throws past it) */
const MAX_PART_DEPTH = 32;

/** true when an ancestor of `mesh` below `root` is hidden */
function hiddenUnder(mesh: THREE.Object3D, root: THREE.Object3D): boolean {
  let parent = mesh.parent;
  for (let depth = 0; depth < MAX_PART_DEPTH; depth++) {
    if (parent === null || parent === root) return false;
    if (!parent.visible) return true;
    parent = parent.parent;
  }
  throw new Error('Crossbow display part nests too deep');
}

/** Pine keeps its content filter and cloned tree; the shared display owns world materials and assembly. */
export function crossbowDisplayModel(crossbow: { readonly model: THREE.Group }, sky: Sky): THREE.Group {
  const root = crossbow.model.clone(true);
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
  if (rest.length > MAX_REST_ROWS) throw new Error('Crossbow display rest rows over their bound');
  for (let i = 0; i < Math.min(rest.length, MAX_REST_ROWS); i++) {
    const row = rest[i];
    if (row === undefined) continue;
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
    if (hiddenUnder(mesh, root)) return;
    parts.push({ geo: mesh.geometry, mat, matrix: mesh.matrixWorld });
  });
  return weaponDisplay(parts, { mode: 'merged', sky, opaque: true });
}
