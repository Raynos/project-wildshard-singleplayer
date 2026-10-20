import * as THREE from 'three';

const GHOST_SEAT = new THREE.Vector3(0, .36, .28);

/** Build-only spectral figure; the live patrol borrows these admitted bytes. */
export function riderGeometry(captain = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const s = GHOST_SEAT;
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(s.x + x, s.y + y, s.z + z);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
  add(cap(0.15, 0.1).scale(1.3, 1, 1), 0, 0.12, -0.05);                              // hips in the saddle
  add(cap(0.17, 0.36).scale(1.15, 1, 0.85), 0, 0.5, 0.02, 0.28);                     // torso, leaning into the gallop
  add(new THREE.SphereGeometry(0.13, 14, 10), 0, 0.88, 0.16);                        // head
  add(new THREE.ConeGeometry(0.19, 0.42, 14, 1, true), 0, 0.98, 0.1, -0.2);          // the hood, peaked
  add(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1.05), 0, 0.84, 0.12);  // hood crown
  // the cloak: a flared, open cone from the shoulders, streaming back and down over the horse's rump
  const cloak = new THREE.CylinderGeometry(0.2, 0.46, 0.95, 16, 3, true, Math.PI * 0.2, Math.PI * 1.6);
  const cp = cloak.getAttribute('position');
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); cp.setZ(i, cp.getZ(i) - (0.475 - y) * 0.55); cp.setX(i, cp.getX(i) + Math.sin(y * 9 + cp.getZ(i) * 5) * 0.03); }
  cloak.computeVertexNormals();
  add(cloak, 0, 0.36, -0.2, 0.55);
  for (const sx of [1, -1]) add(cap(0.075, 0.42), sx * 0.24, -0.12, 0.1, 0.9, 0, sx * 0.25);   // thighs down the flanks
  // the bow arm (left, +x): straight out to the left-front; the bow a tall recurve arc at its fist
  add(cap(0.06, 0.5), 0.36, 0.64, 0.22, 0, 0, -1.25);
  const bow = new THREE.TorusGeometry(0.55, 0.018, 6, 24, Math.PI * 0.9);
  bow.rotateZ(Math.PI * 0.55); add(bow, 0.52, 0.64, 0.32, 0, Math.PI / 2, 0);
  // the draw arm (right): the elbow up and back, the hand at the cheek
  add(cap(0.058, 0.3), -0.2, 0.72, 0.05, 1.3, 0, 0.6);
  add(new THREE.SphereGeometry(0.06, 8, 6), -0.08, 0.84, 0.2);
  if (captain) {
    // Qara Batyr: a spiked helm peak and a tall horsetail standard (tug) on his back
    add(new THREE.ConeGeometry(0.05, 0.3, 8), 0, 1.22, 0.12);
    add(new THREE.CylinderGeometry(0.018, 0.018, 2.2, 6), 0, 1.3, -0.22, -0.15);
    add(new THREE.ConeGeometry(0.12, 0.6, 10, 1, true), 0, 2.2, -0.3, Math.PI - 0.15);
  }
  const g = new THREE.BufferGeometry();
  let n = 0; for (const p of parts) n += p.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) { pos.set(p.getAttribute('position').array, o); nrm.set(p.getAttribute('normal').array, o); o += p.getAttribute('position').count * 3; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.computeBoundingSphere();
  return g;
}

