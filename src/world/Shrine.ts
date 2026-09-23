/**
 * Shrine — the Ring Shrine in the north-west jungle (Driftwood Isle, remaster M2): a three-tier stepped platform of
 * mossy masonry with a broad stair up its front, and on the top terrace a vine-hung stone MONOLITH crowned by a ring
 * whose opening frames the ringed planet from the top of the stair (SHRINE.rot points the back of the shrine at the
 * planet's azimuth; the ring's centre sits at the planet's elevation seen from the terrace). Two pedestals flank the stair
 * head with stone GULL STATUES; glowing cyan glyphs on the monolith, the pedestals, four glyph pillars round the spring
 * pool and a broken arc of standing stones. In front: the spring POOL (lily pads, lotus, a stepping-slab causeway across).
 * Around it: broad-leaf jungle, ferns, hibiscus, vines. Fireflies drift round the platform.
 *
 * Draws: the stone + jungle (one LowPolyKit mesh on lowPolyMaterial, AO baked), the glyphs (unlit, pulsing), the pool
 * water, the fireflies.
 *
 *   const shrine = new Shrine(sky, { x, z, rot }).build();
 *   scene.add(shrine.group); player.colliders.push(...shrine.colliders);
 *   player.platforms.push((x, z) => shrine.floorHeightAt(x, z));    // the stair, the three terraces, the causeway
 *   game.onUpdate((dt) => shrine.update(dt));
 *   shrine.setDusk(k)       // 0 = broad day … 1 = dusk / night: glyph brightness + the firefly cloud (the day clock drives it)
 *
 * Frame: local +z = the FRONT (the stair and the pool face the approach from the hut path), world = origin + R_y(rot) ·
 * local. `anchors` (world coords, yaw = world facing, 0 = +Z): altar (the top terrace in front of the monolith, y =
 * terrace, facing the stair), pool (the pool's middle, y = the water surface), stairFoot (y = ground), ring (the ring's
 * centre — the reward view looks through it; y = its centre).
 */
import * as THREE from 'three';
import { heightAt } from './Heightfield';
import { SEED } from '../core/config';
import { Rng } from '../core/rng';
import { attachFogUniforms } from './Atmosphere';
import { LowPolyKit, rock, tris, bakeLight, lowPolyMaterial, fern, broadClump, hibiscusBush, hibiscus, lilyPad, lotus, vineStrand, PLANT } from './lowpolyKit';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface ShrineSpec { x: number; z: number; rot: number }
export interface ShrineAnchor { x: number; y: number; z: number; yaw: number }

const C = {
  stone: '#aeb0b2', stoneB: '#a0a2a5', stoneDark: '#83868b', stoneLight: '#c4c5c4', statue: '#d6d4cc', statueB: '#c2c0b8',
  moss: '#5f9c3e', mossB: '#73ad48', rune: new THREE.Color('#7fd9ff'), beak: '#c9a45a', water: '#2aa7b0',
};

// layout (local metres; +z = front)
const TIERS = [
  { hw: 6.5, z0: -7.5, z1: 4.0, top: 1.0 },
  { hw: 5.5, z0: -6.5, z1: 3.0, top: 2.0 },
  { hw: 4.5, z0: -5.5, z1: 2.0, top: 3.0 },
] as const;
const STAIR = { hw: 1.6, z0: 2.0, z1: 7.0 };          // top edge at z0 (terrace height), foot at z1 (ground)
const MONO = { z: -3.2, w: 2.3, d: 0.85, shaft: 4.2 };
const RING = { ro: 1.95, ri: 1.2, depth: 0.8, seg: 14 };
const POOL = { z: 11, rx: 7, rz: 3.2, causeway: 1.2 };
const FIREFLIES = 90;

export class Shrine {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  anchors: Record<string, ShrineAnchor> = {};
  private baseY = 0;
  private waterY = 0;
  private glyphMat!: THREE.MeshBasicMaterial;
  private fireflies!: THREE.Points;
  private ffMat!: THREE.PointsMaterial;
  private ffPos = new Float32Array(FIREFLIES * 3);
  private ffSeed = new Float32Array(FIREFLIES * 4);
  private ffAttr!: THREE.BufferAttribute;
  private dusk = 0.35;
  private t = 0;
  private uniforms = { uTime: { value: 0 } };
  private cs: number;
  private sn: number;
  private glyphV: number[] = [];

  constructor(private sky: Sky, private spec: ShrineSpec) {
    this.cs = Math.cos(spec.rot); this.sn = Math.sin(spec.rot);
  }

  /** 0 = broad daylight (the fireflies barely show), 1 = dusk / night (the full cloud, the glyphs at their brightest) */
  setDusk(k: number): void { this.dusk = Math.max(0, Math.min(1, k)); }

  /** local (lx, lz) → world (x, z) */
  private W(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cs + lz * this.sn, this.spec.z - lx * this.sn + lz * this.cs]; }
  private L(x: number, z: number): [number, number] { const dx = x - this.spec.x, dz = z - this.spec.z; return [dx * this.cs - dz * this.sn, dx * this.sn + dz * this.cs]; }
  /** local point (y absolute) → a world matrix, `yaw` local */
  private M(lx: number, y: number, lz: number, yaw = 0, rx = 0, rz = 0, s = 1): THREE.Matrix4 {
    const [x, z] = this.W(lx, lz);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, this.spec.rot + yaw, rz, 'YXZ')), new THREE.Vector3(s, s, s));
  }

  build(): this {
    const kit = new LowPolyKit(SEED ^ 0x5417), rng = kit.rng;
    const base = heightAt(this.spec.x, this.spec.z) + 0.02; this.baseY = base;
    const stone = (): string => { const r = rng.next(); return r < 0.45 ? C.stone : r < 0.75 ? C.stoneB : r < 0.9 ? C.stoneLight : C.stoneDark; };
    const block = (lx: number, y: number, lz: number, w: number, h: number, d: number, yaw = 0, col = stone(), mossy = true): void => {
      kit.addTopped(new THREE.BoxGeometry(w, h, d), col, mossy && rng.next() < 0.7 ? (rng.next() < 0.5 ? C.moss : C.mossB) : col, { matrix: this.M(lx, y, lz, yaw), wobble: 0.025, minY: 0.6, jitter: 0.06 });
    };

    // ── the three tiers: a core box each, dressed with a course of proud masonry blocks round the faces, flagstone caps ──
    TIERS.forEach((t, i) => {
      const y0 = i === 0 ? base - 1.2 : base + TIERS[i - 1 as 0 | 1].top - 0.05, h = base + t.top - y0;
      const zc = (t.z0 + t.z1) / 2, hd = (t.z1 - t.z0) / 2;
      kit.add(new THREE.BoxGeometry(t.hw * 2 - 0.1, h, hd * 2 - 0.1), C.stoneDark, { matrix: this.M(0, y0 + h / 2, zc) });
      const courses = 2, ch = 1.0 / courses;
      for (let c = 0; c < courses; c++) {
        const yc = base + t.top - ch * (c + 0.5);
        // front + back faces (the front leaves the stair's slot open)
        for (const [fz, face] of [[t.z1, 1], [t.z0, -1]] as const) {
          for (let x = -t.hw; x < t.hw - 0.2;) {
            const len = Math.min(rng.range(0.8, 1.5), t.hw - x);
            const cx = x + len / 2;
            x += len;
            if (face > 0 && Math.abs(cx) < STAIR.hw + len / 2) continue;
            block(cx, yc, fz + face * 0.02, len - 0.05, ch - 0.04, 0.5, 0, stone(), c === 0);
          }
        }
        for (const side of [-1, 1]) for (let z = t.z0; z < t.z1 - 0.2;) {
          const len = Math.min(rng.range(0.8, 1.5), t.z1 - z);
          block(side * (t.hw + 0.02), yc, z + len / 2, 0.5, ch - 0.04, len - 0.05, 0, stone(), c === 0);
          z += len;
        }
      }
      // flagstones on the ledge / terrace
      for (let x = -t.hw + 0.5; x < t.hw; x += 1.0) for (let z = t.z0 + 0.5; z < t.z1; z += 1.0) {
        const inner = i < 2 ? TIERS[i + 1 as 1 | 2] : null;
        if (inner && Math.abs(x) < inner.hw - 0.4 && z > inner.z0 + 0.4 && z < inner.z1 - 0.4) continue;
        if (Math.abs(x) < STAIR.hw && z > STAIR.z0 - 0.2) continue;
        kit.add(new THREE.BoxGeometry(0.94, 0.08, 0.94), rng.next() < 0.5 ? C.stoneLight : C.stone, { matrix: this.M(x + rng.range(-0.04, 0.04), base + t.top + 0.01, z, rng.range(-0.05, 0.05)), wobble: 0.02, jitter: 0.05 });
      }
    });
    // ── the stair: ten steps up the front, cheek walls of stacked blocks either side ──
    {
      const n = 10, rise = TIERS[2].top / n, run = (STAIR.z1 - STAIR.z0) / n;
      for (let k = 0; k < n; k++) {
        const zf = STAIR.z1 - k * run, top = base + rise * (k + 1), y0 = base - 0.6;
        kit.addTopped(new THREE.BoxGeometry(STAIR.hw * 2, top - y0, run + 0.04), C.stoneB, rng.next() < 0.3 ? C.mossB : C.stoneLight, { matrix: this.M(0, (top + y0) / 2, zf - run / 2), wobble: 0.02, minY: 0.7, jitter: 0.05 });
      }
      for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
        const z = STAIR.z1 - 0.5 - k * 1.0, top = base + TIERS[2].top * ((STAIR.z1 - z) / (STAIR.z1 - STAIR.z0)) + 0.55;
        const h = top - base + 0.3;
        block(side * (STAIR.hw + 0.28), base - 0.3 + h / 2, z, 0.56, h, 1.02, 0, stone(), true);
      }
    }
    // ── the monolith: plinth, a three-block shaft, the ring of fourteen voussoirs, vines ──
    const terrace = base + TIERS[2].top;
    const ringY = terrace + MONO.shaft + RING.ro - 0.2;
    {
      block(0, terrace + 0.3, MONO.z, MONO.w + 0.9, 0.6, MONO.d + 0.8, 0, C.stoneDark, true);
      const hs = MONO.shaft / 3;
      for (let k = 0; k < 3; k++) block(rng.range(-0.04, 0.04), terrace + 0.6 + hs * (k + 0.5) - 0.3, MONO.z, MONO.w - k * 0.12, hs - 0.04, MONO.d, rng.range(-0.02, 0.02), k === 1 ? C.stoneB : C.stone, true);
      for (let s = 0; s < RING.seg; s++) {
        const a0 = (s / RING.seg) * Math.PI * 2 + 0.02, a1 = ((s + 1) / RING.seg) * Math.PI * 2 - 0.02;
        const wo = rng.range(-0.06, 0.06), ro = RING.ro + wo, ri = RING.ri + rng.range(-0.03, 0.03), d = RING.depth / 2;
        const P = (a: number, r: number, z: number) => [Math.cos(a) * r, Math.sin(a) * r, z];
        const q = (p0: number[], p1: number[], p2: number[], p3: number[]) => [...p0, ...p1, ...p2, ...p0, ...p2, ...p3];
        const v = [
          ...q(P(a0, ri, d), P(a0, ro, d), P(a1, ro, d), P(a1, ri, d)), ...q(P(a0, ri, -d), P(a1, ri, -d), P(a1, ro, -d), P(a0, ro, -d)),
          ...q(P(a0, ro, d), P(a0, ro, -d), P(a1, ro, -d), P(a1, ro, d)), ...q(P(a0, ri, d), P(a1, ri, d), P(a1, ri, -d), P(a0, ri, -d)),
          ...q(P(a0, ri, d), P(a0, ri, -d), P(a0, ro, -d), P(a0, ro, d)), ...q(P(a1, ri, d), P(a1, ro, d), P(a1, ro, -d), P(a1, ri, -d)),
        ];
        const mid = (a0 + a1) / 2;
        kit.addTopped(tris(v), s % 3 === 0 ? C.stoneB : C.stone, Math.sin(mid) > 0.2 ? C.moss : C.stoneLight, { matrix: this.M(0, ringY, MONO.z), minY: 0.55, jitter: 0.06 });
      }
      // vines down the ring and the shaft's edges
      const across = new THREE.Vector3(this.cs, 0, -this.sn);
      for (let k = 0; k < 18; k++) {
        const a = rng.range(0.15, Math.PI - 0.15), side = k % 2 ? 1 : -1;
        const onRing = k < 12;
        const lx = onRing ? Math.cos(a) * RING.ro * 0.95 : side * (MONO.w / 2 - 0.05), y = onRing ? ringY + Math.sin(a) * RING.ro * 0.9 : terrace + MONO.shaft * rng.range(0.5, 0.95);
        const [x, z] = this.W(lx, MONO.z + MONO.d / 2 + 0.06);
        kit.addParts(vineStrand(new THREE.Vector3(x, y, z), rng.range(1.2, onRing ? 3.2 : 2.6), across, rng));
      }
    }
    // ── the pedestals at the stair head with their gull statues ──
    for (const side of [-1, 1]) {
      const px = side * 2.75, pz = 0.9;
      block(px, terrace + 0.8, pz, 1.0, 1.6, 1.0, 0, C.stoneB, false);
      block(px, terrace + 1.68, pz, 1.2, 0.16, 1.2, 0, C.stoneLight, true);
      this.gull(kit, rng, px, terrace + 1.76, pz, side * -0.35);
      this.glyphDiamond(px, terrace + 0.9, pz + 0.515, 0, 0.26);
      this.colliders.push(this.box(px, pz, 0.55, 0.55, terrace - 3, terrace + 2.7));
    }
    // monolith glyphs: a diamond, a line, a circle, three dots
    {
      const fz = MONO.z + MONO.d / 2 + 0.005, y = terrace + 3.1;
      this.glyphDiamond(0, y, fz, 0, 0.36);
      this.glyphSeg(0, fz, 0, 0, y - 0.62, 0, y - 1.25, 0.05);
      this.glyphCircle(0, y - 1.45, fz, 0.2);
      for (let k = 0; k < 3; k++) this.glyphSeg(0, fz, 0, 0, y - 1.8 - k * 0.2, 0, y - 1.88 - k * 0.2, 0.07);
      this.colliders.push(this.box(0, MONO.z, MONO.w / 2 + 0.45, MONO.d / 2 + 0.4, terrace - 3, ringY + RING.ro));
    }

    // ── the spring pool: a stone rim, lily pads, lotus, a causeway of slabs across the middle ──
    const [pcx, pcz] = this.W(0, POOL.z);
    // the water stands a hand over the highest ground inside the basin (the knoll slopes away under the front rim; a
    // kerb of blocks round the rim hides the drop there)
    let highest = -Infinity;
    for (let u = -1; u <= 1.001; u += 0.2) for (let v = -1; v <= 1.001; v += 0.25) {
      if (u * u + v * v > 1) continue;
      const [x, z] = this.W(u * POOL.rx, POOL.z + v * POOL.rz); highest = Math.max(highest, heightAt(x, z));
    }
    this.waterY = highest + 0.1;
    const wy = this.waterY;
    const waterGeo = (() => {
      const v: number[] = [];
      for (let k = 0; k < 20; k++) {
        const a0 = (k / 20) * Math.PI * 2, a1 = ((k + 1) / 20) * Math.PI * 2;
        const p = (a: number) => { const [x, z] = this.W(Math.cos(a) * (POOL.rx + 0.3), POOL.z + Math.sin(a) * (POOL.rz + 0.3)); return [x, wy, z]; };
        v.push(pcx, wy, pcz, ...p(a1), ...p(a0));
      }
      return tris(v);
    })();
    // the basin under the water: a dark bed so the terrain's grass doesn't read through
    {
      const v: number[] = [];
      for (let k = 0; k < 20; k++) {
        const a0 = (k / 20) * Math.PI * 2, a1 = ((k + 1) / 20) * Math.PI * 2;
        const p = (a: number) => { const [x, z] = this.W(Math.cos(a) * (POOL.rx + 0.2), POOL.z + Math.sin(a) * (POOL.rz + 0.2)); return [x, Math.max(heightAt(x, z), wy - 0.35) + 0.01, z]; };
        v.push(pcx, wy - 0.3, pcz, ...p(a1), ...p(a0));
      }
      kit.add(tris(v), '#2d5b52', { jitter: 0.08 });
    }
    for (let k = 0; k < 44; k++) {                                                              // the kerb
      const a0 = (k / 44) * Math.PI * 2, a1 = ((k + 1) / 44) * Math.PI * 2;
      const p0 = [Math.cos(a0) * (POOL.rx + 0.25), POOL.z + Math.sin(a0) * (POOL.rz + 0.25)] as const, p1 = [Math.cos(a1) * (POOL.rx + 0.25), POOL.z + Math.sin(a1) * (POOL.rz + 0.25)] as const;
      const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
      if (Math.abs(mx) < POOL.causeway + 0.1) continue;
      const [x, z] = this.W(mx, mz), gy = heightAt(x, z), top = wy + 0.14, h = Math.max(0.3, top - gy + 0.3);
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.08, yaw = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
      kit.addTopped(new THREE.BoxGeometry(0.42, h, len), k % 3 ? C.stone : C.stoneB, rng.next() < 0.4 ? C.moss : C.stoneLight, { matrix: this.M(mx, top - h / 2, mz, yaw), wobble: 0.02, minY: 0.6, jitter: 0.06 });
    }
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2 + rng.range(-0.05, 0.05), r = rng.range(0.28, 0.55);
      const lx = Math.cos(a) * (POOL.rx + 0.75), lz = POOL.z + Math.sin(a) * (POOL.rz + 0.75);
      if (Math.abs(lx) < POOL.causeway + 0.2) continue;
      const [x, z] = this.W(lx, lz);
      kit.addTopped(rock(r, 1, rng, 0.6, 0.25), rng.next() < 0.5 ? C.stone : C.stoneB, C.moss, { matrix: new THREE.Matrix4().makeTranslation(x, Math.max(heightAt(x, z), wy) + r * 0.1, z), minY: 0.6, jitter: 0.08 });
    }
    for (let lz = POOL.z - POOL.rz - 0.5; lz < POOL.z + POOL.rz + 0.6; lz += 0.85) {
      const [x, z] = this.W(rng.range(-0.08, 0.08), lz);
      kit.add(new THREE.CylinderGeometry(0.62, 0.66, 0.3, 7), rng.next() < 0.5 ? C.stoneLight : C.stone, { matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, wy - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6), 0)), new THREE.Vector3(1.6, 1, 1)), wobble: 0.03, jitter: 0.06 });
    }
    for (let k = 0; k < 16; k++) {
      const side = k % 2 ? 1 : -1, lx = side * rng.range(POOL.causeway + 0.8, POOL.rx - 0.6), lz = POOL.z + rng.range(-POOL.rz + 0.6, POOL.rz - 0.6);
      if ((lx / POOL.rx) ** 2 + ((lz - POOL.z) / POOL.rz) ** 2 > 0.8) continue;
      const [x, z] = this.W(lx, lz), r = rng.range(0.22, 0.42);
      kit.add(lilyPad(r, rng.range(0, 6)), rng.next() < 0.5 ? PLANT.lily : PLANT.lilyB, { matrix: new THREE.Matrix4().makeTranslation(x, wy + 0.012, z), jitter: 0.05 });
      if (k % 4 === 0) kit.addParts(lotus(0.15), { matrix: new THREE.Matrix4().makeTranslation(x + 0.08, wy + 0.02, z + 0.05), jitter: 0.04 });
    }
    // ── the four glyph pillars round the pool ──
    for (const [lx, lz] of [[-7.9, 8.2], [7.9, 8.2], [-7.2, 14.4], [7.2, 14.4]] as const) {
      const [x, z] = this.W(lx, lz), gy = heightAt(x, z);
      block(lx, gy + 1.2, lz, 0.8, 2.8, 0.8, 0, C.stoneB, true);
      block(lx, gy + 2.7, lz, 1.0, 0.25, 1.0, 0, C.stoneLight, true);
      // the glyph on the face toward the pool's middle
      const face = Math.abs(lx) > 0 ? -Math.sign(lx) : 1;
      this.glyphDiamond(lx + face * 0.405, gy + 1.7, lz, Math.PI / 2 * face, 0.2);
      this.glyphCircle(lx + face * 0.405, gy + 1.05, lz, 0.1, Math.PI / 2 * face);
      this.colliders.push(this.box(lx, lz, 0.45, 0.45, gy - 1, gy + 3));
    }
    // ── the broken arc of standing stones behind and beside the platform (runes on their inner faces) ──
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.05 + (i / 6) * 0.9) + Math.PI, r = 10.2 + rng.range(-0.5, 0.8);
      const lx = Math.cos(a) * r, lz = -1.5 + Math.sin(a) * r * 0.85;
      if (i === 3) continue;
      const [x, z] = this.W(lx, lz), gy = heightAt(x, z), h = rng.range(1.8, 3.2), w = rng.range(0.7, 1.1);
      const yaw = -a + Math.PI / 2;
      kit.addTopped(new THREE.BoxGeometry(w, h, w * 0.6).translate(0, h / 2, 0), rng.next() < 0.5 ? C.stone : C.stoneDark, C.moss, { matrix: this.M(lx, gy - 0.3, lz, yaw, 0, rng.range(-0.07, 0.07)), wobble: 0.08, minY: 0.6 });
      const n = new THREE.Vector3(Math.sin(this.spec.rot + yaw), 0, Math.cos(this.spec.rot + yaw));
      if (n.x * (this.spec.x - x) + n.z * (this.spec.z - z) < 0) n.negate();
      this.rune(rng, new THREE.Vector3(x + n.x * (w * 0.3 + 0.01), gy - 0.3 + h * 0.5, z + n.z * (w * 0.3 + 0.01)), new THREE.Vector3(-n.z, 0, n.x), n, h * 0.4);
      this.colliders.push({ x, z, hw: w / 2, hd: w * 0.3, rot: -(this.spec.rot + yaw), yTop: gy + h, yBottom: gy - 1 });
    }
    // ── the jungle: broad-leaf clumps, ferns and hibiscus round the platform; ferns + flowers on the ledges ──
    for (let i = 0; i < 170; i++) {
      const a = rng.range(0, Math.PI * 2), r = 8.2 + rng.next() ** 1.6 * 9;
      const lx = Math.cos(a) * r * 1.05, lz = -1 + Math.sin(a) * r;
      if (lz > 6 && Math.abs(lx) < 3.2) continue;                                              // the approach
      if ((lx / (POOL.rx + 1)) ** 2 + ((lz - POOL.z) / (POOL.rz + 1)) ** 2 < 1) continue;      // the pool
      const [x, z] = this.W(lx, lz), m = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6), 0)), new THREE.Vector3(1, 1, 1));
      const kind = i % 3, s = rng.range(1.1, 2.4) * (r > 13 ? 1.3 : 1);
      kit.addParts(kind === 0 ? broadClump(rng, s) : kind === 1 ? fern(rng, s * 0.9) : hibiscusBush(rng, s * 0.8), { matrix: m, jitter: 0.1 });
    }
    TIERS.forEach((t, i) => {
      if (i === 2) return;
      for (let k = 0; k < 7; k++) {
        const side = k % 2 ? 1 : -1, lz = rng.range(t.z0 + 0.4, t.z1 - 0.3), lx = side * (TIERS[i + 1 as 1 | 2].hw + rng.range(0.25, 0.7));
        kit.addParts(k % 3 === 0 ? hibiscusBush(rng, 0.7) : fern(rng, 0.7), { matrix: this.M(lx, base + t.top, lz, rng.range(0, 6)), jitter: 0.1 });
      }
    });
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const lz = STAIR.z1 - 0.8 - k * 1.6, y = base + TIERS[2].top * ((STAIR.z1 - lz) / (STAIR.z1 - STAIR.z0)) + 0.85;
      for (const [g, c] of hibiscus(0.13)) kit.add(g, c, { matrix: this.M(side * (STAIR.hw + 0.28) + rng.range(-0.15, 0.15), y, lz, 0, rng.range(-0.4, 0.4)), jitter: 0.05 });
    }

    // ── meshes ──
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.3, strength: 0.62 } });
    // the sun sits behind the ring (it has to: the ring frames the planet, which hangs near the sun), so its face would
    // stay in the toon shade band; a broad, soft bounce baked from the approach lifts the stair face like the mockup
    { const [x, z] = this.W(0, 26); bakeLight(geo, [{ x, y: base + 7, z, color: '#fff1dc', range: 42, intensity: 0.32 }]); }
    this.mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    const wmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.water), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.82, flatShading: true });
    this.patchWater(wmat);
    this.sky.setupMaterial(wmat);
    const water = new THREE.Mesh(waterGeo, wmat);
    water.receiveShadow = true; water.renderOrder = 1;
    this.group.add(water);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.glyphV, 3));
    g.computeBoundingSphere();
    this.glyphMat = new THREE.MeshBasicMaterial({ color: C.rune, side: THREE.DoubleSide });
    const gm = new THREE.Mesh(g, this.glyphMat);
    gm.renderOrder = 1;
    this.group.add(gm);
    this.buildFireflies(new Rng(SEED ^ 0x5418), terrace);

    // ── colliders: the three tiers (each lets you stand on it), the stair's cheek walls ──
    for (const t of TIERS) this.colliders.push(this.box(0, (t.z0 + t.z1) / 2, t.hw, (t.z1 - t.z0) / 2, base - 2, base + t.top - 0.06));
    for (const side of [-1, 1]) this.colliders.push(this.box(side * (STAIR.hw + 0.28), (STAIR.z0 + STAIR.z1) / 2 + 0.3, 0.26, (STAIR.z1 - STAIR.z0) / 2 + 0.3, base - 2, base + TIERS[2].top + 0.5));

    // ── anchors ──
    const A = (lx: number, lz: number, y: number, yaw: number): ShrineAnchor => { const [x, z] = this.W(lx, lz); return { x, y, z, yaw: this.spec.rot + yaw }; };
    this.anchors['altar'] = A(0, MONO.z + 1.55, terrace, 0);
    this.anchors['pool'] = A(0, POOL.z, wy, Math.PI);
    this.anchors['stairFoot'] = A(0, STAIR.z1 + 0.6, heightAt(...this.W(0, STAIR.z1 + 0.6)), Math.PI);
    this.anchors['ring'] = A(0, MONO.z, ringY, 0);
    return this;
  }

  /** a stone gull on a pedestal top, looking out along local +z (turned `yaw`) */
  private gull(kit: LowPolyKit, rng: Rng, lx: number, y: number, lz: number, yaw: number): void {
    const m = this.M(lx, y, lz, yaw);
    const body = new THREE.IcosahedronGeometry(1, 1).scale(0.26, 0.24, 0.46).translate(0, 0.42, -0.02);
    kit.add(body, C.statue, { matrix: m, jitter: 0.06 });
    kit.add(new THREE.IcosahedronGeometry(0.17, 1).translate(0, 0.78, 0.3), C.statue, { matrix: m, jitter: 0.06 });
    kit.add(new THREE.ConeGeometry(0.05, 0.22, 4).rotateX(Math.PI / 2).translate(0, 0.76, 0.52), C.beak, { matrix: m });
    for (const s of [-1, 1]) {
      const wing = new THREE.BoxGeometry(0.08, 0.24, 0.66).rotateX(-0.25).rotateZ(s * 0.18).translate(s * 0.24, 0.5, -0.12);
      kit.add(wing, C.statueB, { matrix: m, wobble: 0.02, jitter: 0.05 });
    }
    kit.add(new THREE.BoxGeometry(0.2, 0.06, 0.34).rotateX(0.35).translate(0, 0.38, -0.55), C.statueB, { matrix: m });
    kit.add(new THREE.BoxGeometry(0.34, 0.14, 0.4).translate(0, 0.07, 0), C.statueB, { matrix: m, jitter: 0.05 });
    if (rng.next() < 0.8) kit.add(new THREE.IcosahedronGeometry(0.12, 0).scale(1.4, 0.4, 1.2).translate(0.1, 0.62, -0.1), C.moss, { matrix: m });
  }

  // ── glyph strokes (all into one unlit mesh) ──
  /** a stroke between two points given in face coordinates (u across, y up) */
  private glyphSeg(lx: number, lz: number, yaw: number, u0: number, y0: number, u1: number, y1: number, th = 0.05): void {
    const n = new THREE.Vector3(Math.sin(this.spec.rot + yaw), 0, Math.cos(this.spec.rot + yaw)), u = new THREE.Vector3(n.z, 0, -n.x);
    const [x, z] = this.W(lx, lz), o = new THREE.Vector3(x, 0, z).addScaledVector(n, 0.012);
    const a = new THREE.Vector3(o.x, y0, o.z).addScaledVector(u, u0), b = new THREE.Vector3(o.x, y1, o.z).addScaledVector(u, u1);
    const across = new THREE.Vector3().crossVectors(b.clone().sub(a), n).normalize().multiplyScalar(th / 2);
    const p0 = a.clone().add(across), p1 = a.clone().sub(across), p2 = b.clone().sub(across), p3 = b.clone().add(across);
    this.glyphV.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
  }
  private glyphDiamond(lx: number, y: number, lz: number, yaw: number, s: number): void {
    const pts: [number, number][] = [[0, s * 1.5], [s, 0], [0, -s * 1.5], [-s, 0]];
    for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; if (a && b) this.glyphSeg(lx, lz, yaw, a[0], y + a[1], b[0], y + b[1], s * 0.16); }
    const inner = 0.45;
    for (let k = 0; k < 4; k++) { const a = pts[k], b = pts[(k + 1) % 4]; if (a && b) this.glyphSeg(lx, lz, yaw, a[0] * inner, y + a[1] * inner, b[0] * inner, y + b[1] * inner, s * 0.1); }
  }
  private glyphCircle(lx: number, y: number, lz: number, r: number, yaw = 0): void {
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      this.glyphSeg(lx, lz, yaw, Math.cos(a0) * r, y + Math.sin(a0) * r, Math.cos(a1) * r, y + Math.sin(a1) * r, r * 0.3);
    }
  }
  /** an angular rune (3–5 zig-zag strokes, a bar) on a stone face: origin o, across u, face normal n (world) */
  private rune(rng: Rng, o: THREE.Vector3, u: THREE.Vector3, n: THREE.Vector3, h: number): void {
    const stroke = (x0: number, y0: number, x1: number, y1: number, th = 0.035) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, px = -dy / len * th, py = dx / len * th;
      const P = (x: number, y: number) => [o.x + u.x * x + n.x * 0.012, o.y + y, o.z + u.z * x + n.z * 0.012];
      const a = P(x0 + px, y0 + py), b = P(x0 - px, y0 - py), c = P(x1 - px, y1 - py), d = P(x1 + px, y1 + py);
      this.glyphV.push(...a, ...b, ...c, ...a, ...c, ...d);
    };
    const pts: [number, number][] = [];
    const k = rng.int(3, 5);
    for (let i = 0; i < k; i++) pts.push([rng.range(-0.16, 0.16), -h / 2 + (i / (k - 1)) * h]);
    for (let i = 0; i < k - 1; i++) { const p = pts[i], q = pts[i + 1]; if (p && q) stroke(p[0], p[1], q[0], q[1]); }
    if (rng.next() < 0.6) { const y = rng.range(-h * 0.3, h * 0.3); stroke(-0.14, y, 0.14, y + rng.range(-0.1, 0.1)); }
  }

  private box(lx: number, lz: number, hw: number, hd: number, y0: number, y1: number): Collider {
    const [x, z] = this.W(lx, lz);
    return { x, z, hw, hd, rot: -this.spec.rot, yTop: y1, yBottom: y0 };
  }

  /** the pool: soft ripple rings and a caustic shimmer, brighter at the edges */
  private patchWater(mat: THREE.MeshStandardMaterial): void {
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.uniforms['uTime'] = u.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float w = sin(vWp.x * 2.3 + uTime * 1.1) * sin(vWp.z * 2.9 - uTime * 0.9) + sin((vWp.x + vWp.z) * 4.1 + uTime * 1.7) * 0.5;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.95, 0.95), smoothstep(0.9, 1.4, w) * 0.45);
          }`);
    };
    mat.customProgramCacheKey = () => 'shrine-pool';
  }

  /** the firefly cloud: FIREFLIES points wandering on seeded sine paths round the platform, 0.4–3 m up */
  private buildFireflies(rng: Rng, top: number) {
    for (let i = 0; i < FIREFLIES; i++) {
      this.ffSeed[i * 4] = rng.range(0, Math.PI * 2);
      this.ffSeed[i * 4 + 1] = rng.range(4, 13);
      this.ffSeed[i * 4 + 2] = rng.range(0.4, 3.4);
      this.ffSeed[i * 4 + 3] = rng.range(0, 100);
    }
    const g = new THREE.BufferGeometry();
    this.ffAttr = new THREE.BufferAttribute(this.ffPos, 3); this.ffAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.ffAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(this.spec.x, top, this.spec.z), 18);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('[shrine] no 2d canvas context');
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
    this.ffMat = new THREE.PointsMaterial({ color: new THREE.Color(0.75, 1.0, 0.55), size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending });
    this.fireflies = new THREE.Points(g, this.ffMat);
    this.fireflies.renderOrder = 4;
    this.group.add(this.fireflies);
    this.update(0);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    this.uniforms.uTime.value = t;
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.1) * Math.sin(t * 0.37 + 1);
    this.glyphMat.color.copy(C.rune).multiplyScalar(1.6 + 2.6 * pulse * (0.6 + 0.4 * this.dusk));
    const S = this.ffSeed, P = this.ffPos, base = this.baseY;
    for (let i = 0; i < FIREFLIES; i++) {
      const ph = S[i * 4 + 3] ?? 0;
      const a = (S[i * 4] ?? 0) + t * 0.12 * (1 + 0.5 * Math.sin(ph)), r = (S[i * 4 + 1] ?? 0) + 0.6 * Math.sin(t * 0.7 + ph);
      const wob = Math.sin(t * 1.9 + ph * 3) * 0.35;
      P[i * 3] = this.spec.x + Math.cos(a) * r + wob;
      P[i * 3 + 1] = base + (S[i * 4 + 2] ?? 0) + 0.25 * Math.sin(t * 1.3 + ph);
      P[i * 3 + 2] = this.spec.z + Math.sin(a) * r - wob * 0.6;
    }
    this.ffAttr.needsUpdate = true;
    const flick = 0.7 + 0.3 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    this.ffMat.opacity = (0.3 + 0.7 * this.dusk) * flick;
    this.ffMat.size = 0.09 + 0.06 * this.dusk;
  }

  /** the walkable stone under (x, z): the stair (a ramp), the three terraces, the causeway across the pool */
  floorHeightAt(x: number, z: number): number | undefined {
    const [lx, lz] = this.L(x, z), b = this.baseY;
    if (Math.abs(lx) < STAIR.hw && lz >= STAIR.z0 && lz <= STAIR.z1) return b + TIERS[2].top * ((STAIR.z1 - lz) / (STAIR.z1 - STAIR.z0));
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const t = TIERS[i as 0 | 1 | 2];
      if (Math.abs(lx) <= t.hw && lz >= t.z0 && lz <= t.z1) return b + t.top;
    }
    if (Math.abs(lx) < POOL.causeway && Math.abs(lz - POOL.z) < POOL.rz + 0.5) return this.waterY + 0.1;
    return undefined;
  }
}
