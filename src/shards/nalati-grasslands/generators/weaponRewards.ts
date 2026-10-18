import * as THREE from 'three';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { isMesh } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const GOLD = new THREE.Color(0.78, 0.42, 0.07), GOLD_HI = new THREE.Color(1.0, 0.72, 0.26), GOLD_LO = new THREE.Color(0.36, 0.17, 0.03);
const STRING_LIGHT = new THREE.Color(3.2, 2.6, 1.3), _c = new THREE.Color();
const STORM_BLUE = new THREE.Color(0.62, 0.78, 1.0), STORM_GLOW = new THREE.Color(0.1, 0.2, 0.55);

/** the reward's display model: a Scythian recurve in gold, ibex heads at the limb tips, a string of light (≈ 1.2 m) */
export function goldenBowModel(sky: Sky): THREE.Object3D {
  const mat = painterlyMaterial(sky, { rim: 0.8, bands: 0.6, emissive: new THREE.Color(0.35, 0.2, 0.04) });
  const group = new THREE.Group();
  // the limbs: a recurve along a curve in the XY plane (grip at the origin, tips curling forward, +z = back of the bow)
  const half = (s: number) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, s * 0.18, 0.02), new THREE.Vector3(0, s * 0.36, 0.1), new THREE.Vector3(0, s * 0.5, 0.2),
    new THREE.Vector3(0, s * 0.58, 0.16), new THREE.Vector3(0, s * 0.62, 0.06),
  ]);
  const paintTube = (g: THREE.BufferGeometry, banded: boolean) => {
    const pos = g.getAttribute('position'), n = pos.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = Math.abs(pos.getY(i));
      const band = banded && (Math.abs(y - 0.12) < 0.02 || Math.abs(y - 0.3) < 0.018 || Math.abs(y - 0.46) < 0.016);
      _c.copy(band ? GOLD_HI : GOLD).lerp(GOLD_LO, banded ? 0.15 * Math.sin(y * 40) + 0.1 : 0);
      if (y < 0.07) _c.setRGB(0.18, 0.1, 0.05);             // the leather grip
      c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const tips: THREE.Vector3[] = [];
  for (const s of [1, -1]) {
    const curve = half(s);
    const tube = new THREE.TubeGeometry(curve, 40, 0.032, 8, false);
    // taper the tube toward the tip
    const pos = tube.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), t = Math.min(1, Math.abs(y) / 0.62), k = 1 - 0.5 * t;
      const cp = curve.getPoint(Math.min(1, t));
      pos.setX(i, cp.x + (pos.getX(i) - cp.x) * k); pos.setZ(i, cp.z + (pos.getZ(i) - cp.z) * k);
    }
    tube.computeVertexNormals();
    group.add(new THREE.Mesh(paintTube(tube, true), mat));
    const tip = curve.getPoint(1);
    tips.push(tip);
    // the ibex head: a muzzle and two swept-back horns
    const head = new THREE.SphereGeometry(0.035, 10, 8).scale(0.8, 1, 1.6).translate(tip.x, tip.y + s * 0.02, tip.z - 0.03);
    group.add(new THREE.Mesh(paintTube(head, false), mat));
    for (const hx of [-0.012, 0.012]) {
      const horn = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(tip.x + hx, tip.y + s * 0.03, tip.z - 0.01), new THREE.Vector3(tip.x + hx * 1.5, tip.y + s * 0.09, tip.z + 0.03),
        new THREE.Vector3(tip.x + hx * 2, tip.y + s * 0.11, tip.z + 0.1), new THREE.Vector3(tip.x + hx * 2, tip.y + s * 0.08, tip.z + 0.14),
      ]), 12, 0.007, 5, false);
      group.add(new THREE.Mesh(paintTube(horn, false), mat));
    }
  }
  // the string of light between the tips
  const a = tips[0], b = tips[1];
  if (a && b) {
    const len = a.distanceTo(b);
    const s = new THREE.CylinderGeometry(0.006, 0.006, len, 5);
    s.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const n = s.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = STRING_LIGHT.r; c[i * 3 + 1] = STRING_LIGHT.g; c[i * 3 + 2] = STRING_LIGHT.b; }
    s.setAttribute('color', new THREE.BufferAttribute(c, 3));
    group.add(new THREE.Mesh(s, mat));
  }
  group.traverse((o) => { if (isMesh(o)) { o.castShadow = false; o.receiveShadow = false; } });
  group.rotation.z = -0.5;
  const wrap = new THREE.Group(); wrap.add(group);
  return wrap;
}

/** the display model in the reward orb: the blade point-down, pale steel with a white fork damascus, a gold guard */
export function naizagaiModel(): THREE.Object3D {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: STORM_BLUE, emissive: STORM_GLOW, emissiveIntensity: 1.2, metalness: 0.85, roughness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c25a, metalness: 0.9, roughness: 0.3 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x3a2216, roughness: 0.8 });
  // a curved blade: a lofted strip bent along an arc
  const seg = 16, P: number[] = [], I: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, y = -0.85 * u, x = 0.12 * u * u, w = 0.045 * (1 - 0.75 * u ** 3);
    P.push(x - w, y, 0, x + w * 0.6, y, 0.012, x + w * 0.6, y, -0.012);
    if (i < seg) { const k = i * 3; I.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k, k + 2, k + 3, k + 2, k + 5, k + 3, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setIndex(I); bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, steel));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.05), gold); guard.position.y = 0.01; g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 8), grip); hilt.position.y = 0.1; g.add(hilt);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), gold); pom.position.y = 0.19; g.add(pom);
  g.position.y = 0.35;
  const root = new THREE.Group(); root.add(g);
  return root;
}

