/**
 * Shrine — the ring shrine in the north-west jungle (Driftwood Isle): a three-step round stone
 * dais, a great standing stone ring (faceted, moss on its upper faces), two flanking pillars,
 * a broken arc of standing stones around it and a scatter of loose slabs. Flat-shaded vertex
 * colours, one mesh; the dais is walkable.
 *
 *   const shrine = new Shrine(sky, { x, z, rot }).build();
 *   scene.add(shrine.group); player.colliders.push(...shrine.colliders);
 *   player.platforms.push((x, z) => shrine.floorHeightAt(x, z));
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface ShrineSpec { x: number; z: number; rot: number }

const C = {
  stone: new THREE.Color('#8a8d93'), stoneDark: new THREE.Color('#5f636a'), stoneLight: new THREE.Color('#a9acb1'),
  moss: new THREE.Color('#5f9c3e'), rune: new THREE.Color('#7fd9ff'),
};

const DAIS_R = [6.5, 5.2, 3.9], STEP = 0.38;

export class Shrine {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private baseY = 0;

  constructor(private sky: Sky, private spec: ShrineSpec) {}

  build() {
    const rng = new Rng(SEED ^ 0x5417);
    const parts: THREE.BufferGeometry[] = [];
    const base = heightAt(this.spec.x, this.spec.z) + 0.05; this.baseY = base;
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.08, mossTop = false) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const p = ni.attributes.position as THREE.BufferAttribute;
      const n = p.count, c = new Float32Array(n * 3), col3 = new THREE.Color();
      const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), nrm = new THREE.Vector3();
      for (let i = 0; i < n; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2);
        nrm.copy(b).sub(a).cross(d.clone().sub(a)).normalize();
        const k = 1 - jitter + rng.next() * jitter * 2;
        col3.copy(col).multiplyScalar(k);
        if (mossTop && nrm.y > 0.55) col3.lerp(C.moss, 0.7 + rng.next() * 0.3);
        else if (nrm.y < -0.3) col3.multiplyScalar(0.75);
        for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col3.r; c[(i + j) * 3 + 1] = col3.g; c[(i + j) * 3 + 2] = col3.b; }
      }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    };
    const place = (g: THREE.BufferGeometry, lx: number, ly: number, lz: number) => {
      g.rotateY(this.spec.rot);
      const cs = Math.cos(this.spec.rot), sn = Math.sin(this.spec.rot);
      g.translate(this.spec.x + lx * cs + lz * sn, ly, this.spec.z - lx * sn + lz * cs);
      return g;
    };

    // ── dais: three round steps of fitted slabs (octagonal-ish cylinders, 14 sides) ──
    DAIS_R.forEach((r, i) => {
      const g = new THREE.CylinderGeometry(r, r + 0.25, STEP, 14);
      add(place(g, 0, base + STEP * (i + 0.5), 0), i === 2 ? C.stoneLight : C.stone, 0.07, true);
    });
    const top = base + STEP * 3;
    // ── the ring: a fat faceted torus standing on edge, moss on the top faces, a rune band inside ──
    const ringR = 3.4;
    {
      const g = new THREE.TorusGeometry(ringR, 0.55, 6, 22);
      add(place(g, 0, top + ringR + 0.35, 0), C.stone, 0.09, true);
      const inner = new THREE.TorusGeometry(ringR - 0.42, 0.12, 4, 22);
      add(place(inner, 0, top + ringR + 0.35, 0), C.rune, 0.03);
      // two footing blocks so the ring reads as planted, not balanced
      for (const s of [-1, 1]) add(place(new THREE.BoxGeometry(1.3, 0.9, 1.1), s * (ringR - 0.3), top + 0.45, 0), C.stoneDark, 0.06, true);
    }
    this.colliders.push({ x: this.spec.x, z: this.spec.z, hw: ringR + 0.6, hd: 0.7, rot: -this.spec.rot, yTop: top + 1.6, yBottom: top - 1 });
    // ── two flanking pillars in front, a lintel stone across them ──
    for (const s of [-1, 1]) {
      add(place(new THREE.BoxGeometry(0.9, 3.4, 0.9).translate(0, 0, 0), s * 2.6, top + 1.7, -3.2), C.stone, 0.07, true);
      const cs = Math.cos(this.spec.rot), sn = Math.sin(this.spec.rot);
      this.colliders.push({ x: this.spec.x + s * 2.6 * cs - 3.2 * sn, z: this.spec.z - s * 2.6 * sn - 3.2 * cs, hw: 0.5, hd: 0.5, rot: -this.spec.rot, yTop: top + 3.4, yBottom: top - 1 });
    }
    add(place(new THREE.BoxGeometry(6.4, 0.7, 1.1), 0, top + 3.75, -3.2), C.stoneDark, 0.06, true);
    // ── a broken arc of standing stones around the dais ──
    const nStones = 9;
    for (let i = 0; i < nStones; i++) {
      if (i === 4) continue; // the gap the pillars face
      const a = (i / nStones) * Math.PI * 2 + Math.PI / 2, r = DAIS_R[0] + 2.4 + rng.range(-0.4, 0.6);
      const h = rng.range(1.6, 3.2), w = rng.range(0.7, 1.1);
      const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      const cs = Math.cos(this.spec.rot), sn = Math.sin(this.spec.rot);
      const wx = this.spec.x + lx * cs + lz * sn, wz = this.spec.z - lx * sn + lz * cs;
      const gy = heightAt(wx, wz);
      const g = new THREE.BoxGeometry(w, h, w * 0.6);
      const pp = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < pp.count; k++) if (pp.getY(k) > 0) pp.setXYZ(k, pp.getX(k) * 0.75 + rng.range(-0.08, 0.08), pp.getY(k) + rng.range(-0.15, 0.15), pp.getZ(k) * 0.8);
      g.rotateY(a + Math.PI / 2 + rng.range(-0.2, 0.2)); g.rotateZ(rng.range(-0.08, 0.08));
      g.translate(wx, gy + h / 2 - 0.25, wz);
      add(g, rng.next() < 0.5 ? C.stone : C.stoneDark, 0.08, true);
      this.colliders.push({ x: wx, z: wz, hw: w / 2, hd: w * 0.3, rot: -(a + Math.PI / 2), yTop: gy + h, yBottom: gy - 1 });
    }
    // ── loose slabs on the ground ──
    for (let i = 0; i < 8; i++) {
      const a = rng.range(0, Math.PI * 2), r = DAIS_R[0] + rng.range(1, 9);
      const wx = this.spec.x + Math.cos(a) * r, wz = this.spec.z + Math.sin(a) * r;
      const g = new THREE.BoxGeometry(rng.range(0.6, 1.4), 0.25, rng.range(0.5, 1.0)); g.rotateY(rng.range(0, 3)); g.rotateX(rng.range(-0.15, 0.15));
      g.translate(wx, heightAt(wx, wz) + 0.08, wz);
      add(g, C.stoneDark, 0.08, true);
    }

    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    return this;
  }

  /** the dais steps under (x, z) */
  floorHeightAt(x: number, z: number): number | undefined {
    const d = Math.hypot(x - this.spec.x, z - this.spec.z);
    for (let i = DAIS_R.length - 1; i >= 0; i--) if (d <= DAIS_R[i] + 0.1) return this.baseY + STEP * (i + 1);
    return undefined;
  }
}
