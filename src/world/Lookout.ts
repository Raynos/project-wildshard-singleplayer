/**
 * Lookout — the wooden watchtower on the headland summit (Driftwood Isle): four splayed posts,
 * a railed platform with a small thatch roof, a straight stair up one side (walkable ramp via
 * floorHeightAt) and a tall banner pole with the blue Wildshard pennant. Flat-shaded vertex
 * colours, one mesh.
 *
 *   const lookout = new Lookout(sky, { x, z, rot }).build();   // rot: which side the stair descends toward
 *   scene.add(lookout.group); player.colliders.push(...lookout.colliders);
 *   player.platforms.push((x, z) => lookout.floorHeightAt(x, z));
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface LookoutSpec { x: number; z: number; rot: number }

const C = {
  post: new THREE.Color('#6a4e33'), plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'),
  thatch: new THREE.Color('#c8a256'), thatchDark: new THREE.Color('#a8853f'),
  banner: new THREE.Color('#2a55c8'), bannerDark: new THREE.Color('#1c3c96'), sigil: new THREE.Color('#dfe9ff'),
};

const PLAT = 4.2, H = 7.0;

export class Lookout {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  platformY = 0;
  private cos = 1; private sin = 0;
  private stair = { x0: 0, len: 0, w: 1.4 };

  constructor(private sky: Sky, private spec: LookoutSpec) { this.cos = Math.cos(spec.rot); this.sin = Math.sin(spec.rot); }
  private toWorld(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cos + lz * this.sin, this.spec.z - lx * this.sin + lz * this.cos]; }

  build() {
    const rng = new Rng(SEED ^ 0x100c);
    const parts: THREE.BufferGeometry[] = [];
    const ground = heightAt(this.spec.x, this.spec.z);
    const platY = ground + H; this.platformY = platY;
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.06) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    };
    const place = (g: THREE.BufferGeometry, lx: number, ly: number, lz: number) => { g.rotateY(this.spec.rot); const [wx, wz] = this.toWorld(lx, lz); g.translate(wx, ly, wz); return g; };
    const collider = (lx: number, lz: number, hw: number, hd: number, yBottom: number, yTop: number) => { const [wx, wz] = this.toWorld(lx, lz); this.colliders.push({ x: wx, z: wz, hw, hd, rot: this.spec.rot, yBottom, yTop }); };

    // ── four posts, splayed 0.5 m at the foot, with two cross-brace levels ──
    const half = PLAT / 2 - 0.2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [wx, wz] = this.toWorld(sx * (half + 0.5), sz * (half + 0.5));
      const gy = heightAt(wx, wz) - 0.4;
      const g = new THREE.BoxGeometry(0.26, platY + 2.6 - gy, 0.26);
      // splay: tilt the post so its foot sits 0.5 m outside the platform corner
      const len = platY + 2.6 - gy;
      g.rotateZ(Math.atan2(sx * 0.5, len)); g.rotateX(-Math.atan2(sz * 0.5, len));
      add(place(g, sx * (half + 0.25), (platY + 2.6 + gy) / 2, sz * (half + 0.25)), C.post, 0.05);
      collider(sx * (half + 0.3), sz * (half + 0.3), 0.2, 0.2, gy, platY);
    }
    for (const y of [ground + 2.2, ground + 4.6]) {
      for (const s of [-1, 1]) {
        add(place(new THREE.BoxGeometry(PLAT + 0.8, 0.12, 0.12), 0, y, s * (half + 0.35)), C.plankDark, 0.05);
        add(place(new THREE.BoxGeometry(0.12, 0.12, PLAT + 0.8), s * (half + 0.35), y, 0), C.plankDark, 0.05);
      }
    }
    // ── platform planks + railing ──
    for (let px = -PLAT / 2; px < PLAT / 2; px += 0.4) add(place(new THREE.BoxGeometry(0.36, 0.1, PLAT), px + 0.18, platY - 0.05, 0), rng.next() < 0.3 ? C.plankDark : C.plank, 0.05);
    add(place(new THREE.BoxGeometry(PLAT, 0.2, PLAT), 0, platY - 0.2, 0), C.plankDark, 0.03); // joists slab
    const railY = platY + 1.0;
    const rail = (lx: number, lz: number, len: number, alongX: boolean) => {
      add(place(new THREE.BoxGeometry(alongX ? len : 0.08, 0.08, alongX ? 0.08 : len), lx, railY, lz), C.plankDark, 0.04);
      add(place(new THREE.BoxGeometry(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len), lx, railY - 0.5, lz), C.plankDark, 0.04);
      const n = Math.max(1, Math.round(len / 1.0));
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (len * i) / n; add(place(new THREE.BoxGeometry(0.1, 1.05, 0.1), alongX ? lx + t : lx, platY + 0.5, alongX ? lz : lz + t), C.post, 0.05); }
      collider(lx, lz, alongX ? len / 2 : 0.08, alongX ? 0.08 : len / 2, platY, railY + 0.1);
    };
    const stairW = this.stair.w;
    rail(0, PLAT / 2 - 0.1, PLAT, true);
    rail(-PLAT / 2 + 0.1, 0, PLAT, false);
    rail(PLAT / 2 - 0.1, 0, PLAT, false);
    rail(-(PLAT / 4 + stairW / 4), -PLAT / 2 + 0.1, PLAT / 2 - stairW / 2, true);
    rail((PLAT / 4 + stairW / 4), -PLAT / 2 + 0.1, PLAT / 2 - stairW / 2, true);
    // ── roof: four corner posts and a thatch pyramid ──
    const roofY = platY + 2.6;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(place(new THREE.BoxGeometry(0.18, 2.6, 0.18), sx * (half - 0.05), platY + 1.3, sz * (half - 0.05)), C.post, 0.05);
    const pyr = (w: number, h: number, y: number, col: THREE.Color) => {
      const g = new THREE.ConeGeometry(w * 0.72, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, y + h / 2, 0);
      add(place(g, 0, 0, 0), col, 0.08);
    };
    pyr(PLAT + 1.4, 1.2, roofY, C.thatchDark); pyr(PLAT + 1.4, 1.2, roofY + 0.3, C.thatch); pyr(PLAT + 0.2, 1.6, roofY + 1.0, C.thatch);
    // ── stair: straight run down the −z side, 1.4 m wide, landing at the platform's edge ──
    const rise = H, run = rise * 1.25, steps = Math.round(rise / 0.28);
    const z0 = -PLAT / 2, stringerLen = Math.hypot(run, rise);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps, y = platY - rise * t, z = z0 - run * t;
      add(place(new THREE.BoxGeometry(stairW, 0.08, run / steps + 0.06), 0, y, z), i % 2 ? C.plankDark : C.plank, 0.05);
    }
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.12, 0.3, stringerLen); g.rotateX(-Math.atan2(rise, run));
      add(place(g, s * (stairW / 2 + 0.06), platY - rise / 2 - 0.2, z0 - run / 2), C.post, 0.05);
      // handrail posts along the stair
      for (let i = 0; i <= 4; i++) { const t = i / 4; add(place(new THREE.BoxGeometry(0.08, 1.0, 0.08), s * (stairW / 2 + 0.06), platY - rise * t + 0.45, z0 - run * t), C.post, 0.05); }
      const hr = new THREE.BoxGeometry(0.06, 0.06, stringerLen); hr.rotateX(-Math.atan2(rise, run));
      add(place(hr, s * (stairW / 2 + 0.06), platY - rise / 2 + 0.9, z0 - run / 2), C.plankDark, 0.04);
    }
    this.stair = { x0: z0, len: run, w: stairW };
    // ── banner pole on the far corner, a blue pennant with the pale diamond sigil ──
    const poleH = 6.5, bx = PLAT / 2 - 0.3, bz = PLAT / 2 - 0.3;
    add(place(new THREE.CylinderGeometry(0.06, 0.08, poleH, 6), bx, platY + poleH / 2, bz), C.post, 0.05);
    add(place(new THREE.SphereGeometry(0.14, 6, 4), bx, platY + poleH + 0.1, bz), C.plank, 0.05);
    {
      const w = 1.1, hgt = 2.6, top = platY + poleH - 0.2;
      const banner = new THREE.PlaneGeometry(w, hgt, 3, 6);
      const p = banner.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5; p.setZ(i, Math.sin(u * Math.PI * 2 + p.getY(i)) * 0.08); p.setX(i, p.getX(i) + w / 2 + 0.06); if (p.getY(i) < -hgt / 2 + 0.01) p.setY(i, p.getY(i) + Math.abs(u - 0.5) * 0.7); }
      banner.translate(0, top - hgt / 2, 0);
      add(place(banner, bx, 0, bz), C.banner, 0.07);
      const sig = new THREE.PlaneGeometry(0.5, 0.5); sig.rotateZ(Math.PI / 4); sig.translate(w / 2 + 0.06, top - hgt * 0.42, 0.1);
      add(place(sig, bx, 0, bz), C.sigil, 0.02);
      const sig2 = new THREE.PlaneGeometry(0.24, 0.24); sig2.rotateZ(Math.PI / 4); sig2.translate(w / 2 + 0.06, top - hgt * 0.42, 0.12);
      add(place(sig2, bx, 0, bz), C.bannerDark, 0.02);
    }

    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    return this;
  }

  /** platform under (x, z), or the stair ramp, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * this.sin + dz * this.cos, lx = dx * this.cos - dz * this.sin;
    if (Math.abs(lx) <= PLAT / 2 + 0.1 && Math.abs(lz) <= PLAT / 2 + 0.1) return this.platformY;
    if (Math.abs(lx) <= this.stair.w / 2 + 0.1 && lz < this.stair.x0 && lz > this.stair.x0 - this.stair.len) {
      const t = (this.stair.x0 - lz) / this.stair.len;
      return this.platformY - H * t;
    }
    return undefined;
  }
}
