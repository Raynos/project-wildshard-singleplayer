import * as THREE from 'three';

/** Original fitted-rock float operations, executed before shipping. */
export function fitRock(m: { readonly geometry: THREE.BufferGeometry; readonly box: THREE.Box3 }, half: readonly [number, number, number]): THREE.BufferGeometry {
  const g = m.geometry.clone();
  const b = m.box, ctr = new THREE.Vector3(), sz = new THREE.Vector3();
  b.getCenter(ctr); b.getSize(sz);
  g.translate(-ctr.x, -ctr.y, -ctr.z);
  g.scale((half[0] * 2) / sz.x, (half[1] * 2) / sz.y, (half[2] * 2) / sz.z);
  g.computeVertexNormals();
  return g;
}

