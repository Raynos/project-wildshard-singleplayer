import * as THREE from 'three';

/** Retained original static construction. Pose, shader hooks and hazards stay live. */
function rng(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
interface Puff { bone: THREE.Object3D; p: THREE.Vector3; r: number; ph: number }
interface PuffRow { bone: string; p: number[]; r: number; ph: number; colour: number[] }
export function titanPuffs(phone: boolean): PuffRow[] {
  const root = new THREE.Object3D(), chest = new THREE.Object3D(), head = new THREE.Object3D();
  const armR: [THREE.Object3D, THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
  const armL: [THREE.Object3D, THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
  const list: Puff[] = [];
  const r = rng(0x7174a);
  const add = (bone: THREE.Object3D, x: number, y: number, z: number, rad: number): void => { list.push({ bone, p: new THREE.Vector3(x, y, z), r: rad, ph: r() * 6.28 }); };
  const dir = (): THREE.Vector3 => { const u = r() * 2 - 1, a = r() * 6.283; const s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)); };
  // torso: an ellipsoid shell, broad at the shoulders
  for (let i = 0; i < 130; i++) { const d = dir(), k = 0.6 + 0.4 * r(), y = 11 + d.y * 12 * k; add(chest, d.x * 10 * k * (0.75 + 0.45 * (y / 24)), y, d.z * 6.5 * k, 3.2 + r() * 3); }
  // the skirt: the cloud sea he rises from — wide, heavy, down past the rim
  for (let i = 0; i < 70; i++) { const a = r() * 6.283, rr = 7 + r() * 10, y = -16 + r() * 18; add(root, Math.cos(a) * rr * (1 + (-y) * 0.03), y, Math.sin(a) * rr * 0.8, 4.5 + r() * 4 + Math.max(0, -y) * 0.12); }
  // head, the pointed helmet, the beard
  for (let i = 0; i < 26; i++) { const d = dir(), k = 0.5 + 0.5 * r(); add(head, d.x * 4.2 * k, d.y * 4.6 * k, d.z * 4 * k, 1.8 + r() * 1.4); }
  for (let i = 0; i < 18; i++) { const u = i / 17, a = i * 2.4; add(head, Math.cos(a) * 4.6 * (1 - u), 3 + u * 11, Math.sin(a) * 4.4 * (1 - u), 0.6 + 3.2 * (1 - u)); }
  for (let i = 0; i < 16; i++) { const u = r(); add(head, (r() - 0.5) * 5 * (1 - u * 0.6), -2 - u * 7, 3.4 + r() * 1.5, 1.6 + r() * 1.2); }
  // arms: upper + fore along −y, a fist
  for (const arm of [armR, armL]) {
    for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) { const u = i / 11; add(arm[s] ?? chest, (r() - 0.5) * 2.2, -u * 13.5, (r() - 0.5) * 2.2, (s === 0 ? 4.2 : 3.4) - u * 0.8 + r() * 0.6); }
    add(arm[2], 0, 0, 0, 3.4);
  }
  // the cloak: off the shoulders, streaming back and down
  for (let i = 0; i < 44; i++) { const u = r(), v = r() - 0.5; add(chest, v * 26 * (0.7 + 0.5 * u), 22 - u * 32, -5 - u * 7 - Math.abs(v) * 3, 3.5 + r() * 2.5); }

  // the cumulus's small heads: a smaller puff budding out of the outer side of most big ones (a cauliflower silhouette,
  // not a string of balls); per puff, how exposed it is (its distance out from its bone's cluster) shades it
  const centre = new Map<THREE.Object3D, { c: THREE.Vector3; n: number; max: number }>();
  for (const pf of list) { const e = centre.get(pf.bone) ?? { c: new THREE.Vector3(), n: 0, max: 0 }; e.c.add(pf.p); e.n++; centre.set(pf.bone, e); }
  for (const e of centre.values()) e.c.multiplyScalar(1 / Math.max(1, e.n));
  for (const pf of list) { const e = centre.get(pf.bone); if (e) e.max = Math.max(e.max, pf.p.distanceTo(e.c)); }
  const buds = phone ? 1 : 2;
  const primaries = list.length;
  for (let i = 0; i < primaries; i++) {
    const pf = list[i], e = pf ? centre.get(pf.bone) : undefined;
    if (!pf || !e) continue;
    for (let b = 0; b < buds; b++) {
      const out = pf.p.clone().sub(e.c); if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
      out.normalize().add(dir().multiplyScalar(0.7)).normalize();
      const k = 0.72 + 0.2 * r();
      add(pf.bone, pf.p.x + out.x * pf.r * k, pf.p.y + out.y * pf.r * k, pf.p.z + out.z * pf.r * k, pf.r * (0.34 + 0.2 * r()));
    }
  }
  const exposure = list.map((pf) => { const e = centre.get(pf.bone); return e && e.max > 0 ? Math.min(1, pf.p.distanceTo(e.c) / e.max) : 0.7; });

  const bones = { root, chest, head, upperR: armR[0], foreR: armR[1], handR: armR[2], upperL: armL[0], foreL: armL[1], handL: armL[2] };
  return list.map((pf, i) => {
    const bone = Object.entries(bones).find(([, value]) => value === pf.bone)?.[0];
    if (bone === undefined) throw new Error('Titan puff has no retained bone');
    const low = pf.bone === root ? 0.72 : pf.p.z < -4.5 ? 0.78 : 0.92 + 0.08 * Math.sin(i * 1.7);
    const k = low * (0.45 + 0.6 * (exposure[i] ?? 0.7));
    return { bone, p: pf.p.toArray(), r: pf.r, ph: pf.ph, colour: [0.95 * k, 0.97 * k, 1.05 * k] };
  });
}

export function flameClusterGeometry(phone: boolean): THREE.BufferGeometry {
  const S = phone ? 8 : 12, R = phone ? 6 : 9;
  const tongues: [number, number, number, number][] = [[0, 0, 1.0, 1.0], [0.75, 0.35, 0.72, 0.8], [-0.55, -0.6, 0.6, 0.75]]; // x, z, height, width
  const pos: number[] = [], nrm: number[] = [], aH: number[] = [], aS: number[] = [], idx: number[] = [];
  tongues.forEach(([ox, oz, hh, ww], k) => {
    const base = pos.length / 3;
    for (let j = 0; j <= R; j++) {
      const v = j / R, y = v * 2.6 * hh;
      const r = (j === R ? 0 : 0.85 * ww * Math.sin(Math.PI * v ** 0.62) ** 0.85 + 0.02) * (1 - 0.15 * v);
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        pos.push(ox + Math.cos(a) * r, y, oz + Math.sin(a) * r);
        nrm.push(Math.cos(a), 0.25, Math.sin(a));
        aH.push(v); aS.push(k * 0.37 + 0.11);
      }
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
      const a = base + j * S + i, b = base + j * S + ((i + 1) % S), c = a + S, d = b + S;
      idx.push(a, c, b, b, c, d);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  return g;
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pa = a.getAttribute('position'), pb = b.getAttribute('position');
  const pos = new Float32Array((pa.count + pb.count) * 3);
  for (let i = 0; i < pa.count; i++) { pos[i * 3] = pa.getX(i); pos[i * 3 + 1] = pa.getY(i); pos[i * 3 + 2] = pa.getZ(i); }
  for (let i = 0; i < pb.count; i++) { const k = (pa.count + i) * 3; pos[k] = pb.getX(i); pos[k + 1] = pb.getY(i); pos[k + 2] = pb.getZ(i); }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ia = a.getIndex(), ib = b.getIndex(), idx: number[] = [];
  if (ia) for (let i = 0; i < ia.count; i++) idx.push(ia.getX(i)); else for (let i = 0; i < pa.count; i++) idx.push(i);
  if (ib) for (let i = 0; i < ib.count; i++) idx.push(ib.getX(i) + pa.count); else for (let i = 0; i < pb.count; i++) idx.push(i + pa.count);
  out.setIndex(idx);
  return out;
}


/** Three's ordinary serialized BufferGeometry, without its random serialization UUID. */
function geometryRow(g: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry().copy(g).toJSON();
  const { uuid: _uuid, ...row } = out; g.dispose();
  return row;
}
export function titanGeometry(): { phone: { puffs: PuffRow[]; flames: Omit<THREE.BufferGeometryJSON, 'uuid'> }; desktop: { puffs: PuffRow[]; flames: Omit<THREE.BufferGeometryJSON, 'uuid'> }; eyes: Omit<THREE.BufferGeometryJSON, 'uuid'> } {
  const eg = new THREE.SphereGeometry(0.9, 10, 8), eg2 = eg.clone();
  eg.translate(-1.8, 0.8, 4.1); eg2.translate(1.8, 0.8, 4.1);
  const eyes = geometryRow(mergeTwo(eg, eg2)); eg.dispose(); eg2.dispose();
  return { phone: { puffs: titanPuffs(true), flames: geometryRow(flameClusterGeometry(true)) },
    desktop: { puffs: titanPuffs(false), flames: geometryRow(flameClusterGeometry(false)) }, eyes };
}
