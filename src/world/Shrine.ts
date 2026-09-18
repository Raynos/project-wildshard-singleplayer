/**
 * Shrine — the ring shrine in the north-west jungle (Driftwood Isle): a three-step round stone
 * dais, a great standing stone ring (faceted, moss on its upper faces), two flanking pillars,
 * a broken arc of standing stones around it and a scatter of loose slabs. Flat-shaded vertex
 * colours, one mesh; the dais is walkable. Plus (enemies-agent, plan row C10): glowing cyan GLYPHS
 * carved into the standing stones, the pillars and the ring's footings (one emissive mesh, pulsing)
 * and a FIREFLY cloud drifting around the dais (one Points draw call, brightest at dusk —
 * `shrine.setDusk(0..1)`; the island has no clock yet, so it idles at a daytime 0.35).
 *
 *   const shrine = new Shrine(sky, { x, z, rot }).build();
 *   scene.add(shrine.group); player.colliders.push(...shrine.colliders);
 *   player.platforms.push((x, z) => shrine.floorHeightAt(x, z));
 *   game.onUpdate((dt) => shrine.update(dt));
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
const FIREFLIES = 90;

export class Shrine {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private baseY = 0;
  private glyphMat!: THREE.MeshBasicMaterial;
  private fireflies!: THREE.Points;
  private ffMat!: THREE.PointsMaterial;
  private ffPos = new Float32Array(FIREFLIES * 3);
  private ffSeed = new Float32Array(FIREFLIES * 4);
  private ffAttr!: THREE.BufferAttribute;
  private dusk = 0.6;
  private t = 0;
  private stones: { x: number; z: number; y: number; h: number; w: number; yaw: number }[] = [];

  constructor(private sky: Sky, private spec: ShrineSpec) {}

  /** 0 = broad daylight (the fireflies barely show), 1 = dusk / night (the full cloud, the glyphs at their brightest) */
  setDusk(k: number) { this.dusk = Math.max(0, Math.min(1, k)); }

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
      const yaw = a + Math.PI / 2 + rng.range(-0.2, 0.2);
      g.rotateY(yaw); g.rotateZ(rng.range(-0.08, 0.08));
      g.translate(wx, gy + h / 2 - 0.25, wz);
      this.stones.push({ x: wx, z: wz, y: gy - 0.25, h, w, yaw });
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
    this.buildGlyphs(rng, top);
    this.buildFireflies(rng, top);
    return this;
  }

  /**
   * Glyphs: angular rune strokes (thin quads a few mm proud of the stone) on the faces of the standing stones, the two
   * pillars and the ring's footings — one unlit emissive-cyan mesh; `update` pulses it.
   */
  private buildGlyphs(rng: Rng, top: number) {
    const v: number[] = [];
    const cs = Math.cos(this.spec.rot), sn = Math.sin(this.spec.rot);
    // a stroke in a stone's face frame: (u, w) across / up, `n` = the face normal (world), origin = the face centre (world)
    const stroke = (o: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3, n: THREE.Vector3, x0: number, y0: number, x1: number, y1: number, th = 0.035) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, px = -dy / len * th, py = dx / len * th;
      const P = (x: number, y: number) => [o.x + u.x * x + w.x * y + n.x * 0.012, o.y + u.y * x + w.y * y + n.y * 0.012, o.z + u.z * x + w.z * y + n.z * 0.012];
      const a = P(x0 + px, y0 + py), b = P(x0 - px, y0 - py), c = P(x1 - px, y1 - py), d = P(x1 + px, y1 + py);
      v.push(...a, ...b, ...c, ...a, ...c, ...d);
    };
    // a rune = 3–5 strokes joined in a zig-zag inside a (0.35 × 0.8) box, with a bar or a dot
    const rune = (o: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3, n: THREE.Vector3, h: number) => {
      const pts: [number, number][] = [];
      const k = rng.int(3, 5);
      for (let i = 0; i < k; i++) pts.push([rng.range(-0.16, 0.16), -h / 2 + (i / (k - 1)) * h]);
      for (let i = 0; i < k - 1; i++) stroke(o, u, w, n, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (rng.next() < 0.6) { const y = rng.range(-h * 0.3, h * 0.3); stroke(o, u, w, n, -0.14, y, 0.14, y + rng.range(-0.1, 0.1)); }
    };
    const U = new THREE.Vector3(), W = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3(), O = new THREE.Vector3();
    // the standing-stone arc: on whichever broad face of each stone looks toward the dais
    for (const st of this.stones) {
      N.set(Math.sin(st.yaw), 0, Math.cos(st.yaw));                    // the box's +z face after rotateY(yaw)
      if (N.x * (this.spec.x - st.x) + N.z * (this.spec.z - st.z) < 0) N.negate();
      U.set(-N.z, 0, N.x);
      O.set(st.x + N.x * (st.w * 0.3 + 0.01), st.y + st.h * 0.5, st.z + N.z * (st.w * 0.3 + 0.01));
      rune(O, U, W, N, st.h * 0.42);
    }
    // the two pillars (front faces, toward the ring) and the ring's footing blocks
    for (const s of [-1, 1]) {
      const lx = s * 2.6, lz = -3.2;
      const wx = this.spec.x + lx * cs + lz * sn, wz = this.spec.z - lx * sn + lz * cs;
      N.set(sn, 0, cs).multiplyScalar(1);   // the shrine's local +z (toward the ring)
      U.set(-N.z, 0, N.x);
      O.set(wx + N.x * 0.46, top + 1.9, wz + N.z * 0.46);
      rune(O, U, W, N, 1.4);
      const fx = s * (3.4 - 0.3), fz = 0;
      const bx = this.spec.x + fx * cs + fz * sn, bz = this.spec.z - fx * sn + fz * cs;
      N.set(-sn, 0, -cs);
      U.set(-N.z, 0, N.x);
      O.set(bx + N.x * 0.56, top + 0.45, bz + N.z * 0.56);
      rune(O, U, W, N, 0.5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeBoundingSphere();
    this.glyphMat = new THREE.MeshBasicMaterial({ color: C.rune, side: THREE.DoubleSide, toneMapped: true });
    const m = new THREE.Mesh(g, this.glyphMat);
    m.renderOrder = 1;
    this.group.add(m);
  }

  /** the firefly cloud: FIREFLIES points wandering on seeded sine paths inside a 9 m ring round the dais, 0.4–3 m up */
  private buildFireflies(rng: Rng, top: number) {
    for (let i = 0; i < FIREFLIES; i++) {
      this.ffSeed[i * 4] = rng.range(0, Math.PI * 2);            // orbit angle
      this.ffSeed[i * 4 + 1] = rng.range(2.5, 9.5);              // orbit radius
      this.ffSeed[i * 4 + 2] = rng.range(0.4, 2.8);              // height
      this.ffSeed[i * 4 + 3] = rng.range(0, 100);                // phase
    }
    const g = new THREE.BufferGeometry();
    this.ffAttr = new THREE.BufferAttribute(this.ffPos, 3); this.ffAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.ffAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(this.spec.x, top, this.spec.z), 14);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
    this.ffMat = new THREE.PointsMaterial({ color: new THREE.Color(0.75, 1.0, 0.55), size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending });
    this.fireflies = new THREE.Points(g, this.ffMat);
    this.fireflies.renderOrder = 4;
    this.group.add(this.fireflies);
    this.update(0);
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    // glyphs breathe (a slow pulse with a faster shimmer), brighter toward dusk
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.1) * Math.sin(t * 0.37 + 1);
    this.glyphMat.color.copy(C.rune).multiplyScalar(1.6 + 2.6 * pulse * (0.6 + 0.4 * this.dusk));
    // fireflies: every point drifts on its own orbit, flickering; the cloud fades in with dusk
    const S = this.ffSeed, P = this.ffPos, base = this.baseY;
    for (let i = 0; i < FIREFLIES; i++) {
      const a = S[i * 4] + t * 0.12 * (1 + 0.5 * Math.sin(S[i * 4 + 3])), r = S[i * 4 + 1] + 0.6 * Math.sin(t * 0.7 + S[i * 4 + 3]);
      const wob = Math.sin(t * 1.9 + S[i * 4 + 3] * 3) * 0.35;
      P[i * 3] = this.spec.x + Math.cos(a) * r + wob;
      P[i * 3 + 1] = base + S[i * 4 + 2] + 0.25 * Math.sin(t * 1.3 + S[i * 4 + 3]);
      P[i * 3 + 2] = this.spec.z + Math.sin(a) * r - wob * 0.6;
    }
    this.ffAttr.needsUpdate = true;
    const flick = 0.7 + 0.3 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    this.ffMat.opacity = (0.3 + 0.7 * this.dusk) * flick;
    this.ffMat.size = 0.09 + 0.06 * this.dusk;
  }

  /** the dais steps under (x, z) */
  floorHeightAt(x: number, z: number): number | undefined {
    const d = Math.hypot(x - this.spec.x, z - this.spec.z);
    for (let i = DAIS_R.length - 1; i >= 0; i--) if (d <= DAIS_R[i] + 0.1) return this.baseY + STEP * (i + 1);
    return undefined;
  }
}
