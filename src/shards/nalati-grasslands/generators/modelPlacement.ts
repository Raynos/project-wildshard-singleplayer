import * as THREE from 'three';
import type { ModelPlacement } from '../data/modelTypes';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function placementMatrix(p: ModelPlacement, out = new THREE.Matrix4()): THREE.Matrix4 {
  const k = p.scale ?? 1;
  _e.set(p.pitch ?? 0, p.rot ?? 0, p.roll ?? 0, 'YXZ');
  return out.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(p.sx ?? k, p.sy ?? k, p.sz ?? k));
}

