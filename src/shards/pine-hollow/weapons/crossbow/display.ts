import * as THREE from 'three';
import { fixIBL, isMesh, VIEWMODEL_GROUP } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

/** A world-space copy of the crossbow for a floor drop: the viewmodel's meshes with plain render flags, no depth
 *  clearer, no hands, no pose / 1.35× scale, unit materials shared (a skin clones what it changes). ~0.85 m long, bow forward (−Z).
 *  Any crossbow model will do: the Model Explorer's card passes a fresh `buildCrossbow` (src/shards/pine-hollow/models/gear.ts). */
export function crossbowDisplayModel(crossbow: { readonly model: THREE.Group }, sky: Sky): THREE.Group {
  const g = crossbow.model.clone(true); // children keep their local poses (the string legs as they sit at rest); geometry is shared
  g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.setScalar(1); // the viewmodel's 1.35× and camera pose stay behind
  const drop: THREE.Object3D[] = [];
  g.traverse((m) => {
    if (!isMesh(m)) return;
    const mat = m.material as THREE.Material;
    if (!mat.name || !mat.colorWrite || (!m.visible && mat.name !== 'xbow-bolt') || m.userData['viewmodelOnly'] === true) { drop.push(m); return; } // the depth clearer, hidden effects, the hands (hunterHands.ts)
    const copy = mat.clone(); copy.name = mat.name; copy.transparent = false; copy.depthWrite = true; // the viewmodel draws in the transparent queue; the drop must not
    fixIBL(copy, VIEWMODEL_GROUP); sky.setupMaterial(copy);
    m.material = copy; m.visible = true;
    m.castShadow = true; m.receiveShadow = true; m.renderOrder = 0; m.frustumCulled = true;
    m.onBeforeRender = () => { /* a world copy needs no depth clear */ };
  });
  for (const d of drop) d.removeFromParent();
  // the string legs are posed per frame by the viewmodel (Crossbow.updateString); a copy taken before the first frame has
  // them unit-length at the origin — pose them at rest here: tip → nock, the serving at the nock
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205), nock = new THREE.Vector3(0, 0.012, -0.07);
  const legs: THREE.Mesh[] = []; let serving: THREE.Mesh | undefined;
  g.traverse((m) => {
    if (!isMesh(m) || (m.material as THREE.Material).name !== 'xbow-cord') return;
    if (m.geometry.boundingBox === null) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox; if (bb === null) return;
    const sz = bb.max.clone().sub(bb.min);
    if (Math.abs(sz.y - 1) < 0.01) legs.push(m); else if (sz.x < 0.07 && sz.x > 0.04 && sz.y < 0.01) serving = m;
  });
  legs.forEach((leg, i) => {
    const from = i === 0 ? tipL : tipR, dir = nock.clone().sub(from), len = dir.length();
    leg.position.copy(from); leg.scale.set(1, len, 1); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
  });
  if (serving) { serving.position.copy(nock); serving.quaternion.identity(); }
  return g;
}

