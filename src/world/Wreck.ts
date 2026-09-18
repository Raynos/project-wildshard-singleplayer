/**
 * Wreck — the shipwreck in Wreck Cove (Driftwood Isle): a beached two-master heeled over on the
 * sand, hull planked strake by strake with holes stove in, a broken deck, a stub foremast and a
 * leaning mainmast with a tattered sail and rigging, crates, barrels and driftwood strewn on the
 * beach around it. Flat-shaded vertex colours, one mesh.
 *
 *   const wreck = new Wreck(sky, { x, z, heading, roll }).build();
 *   scene.add(wreck.group); player.colliders.push(...wreck.colliders);
 *   player.platforms.push((x, z) => wreck.floorHeightAt(x, z));   // the tilted deck is walkable
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface WreckSpec { x: number; z: number; heading: number; /** radians of heel to starboard */ roll?: number }

const C = {
  hull: new THREE.Color('#6e5238'), hullDark: new THREE.Color('#4e3925'), hullGrey: new THREE.Color('#7c6f5c'),
  deck: new THREE.Color('#8a7150'), mast: new THREE.Color('#5e4630'), sail: new THREE.Color('#d9d0bd'), sailDark: new THREE.Color('#b8ad98'),
  rope: new THREE.Color('#b9a57a'), crate: new THREE.Color('#9c7b52'), barrel: new THREE.Color('#7a5a3a'), band: new THREE.Color('#3a3a3a'), drift: new THREE.Color('#b3a48a'),
};

const LENGTH = 17, BEAM = 5.2, DEPTH = 2.6;

export class Wreck {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private deckY = 0;
  private m = new THREE.Matrix4();

  constructor(private sky: Sky, private spec: WreckSpec) {}

  build() {
    const rng = new Rng(SEED ^ 0x3ec4);
    const parts: THREE.BufferGeometry[] = [];
    const ground = heightAt(this.spec.x, this.spec.z);
    const roll = this.spec.roll ?? 0.3;
    // hull frame: local x = starboard, z = stern, y up; the ship sits with its keel ~1.6 m in the sand
    const keelY = ground - 1.2;
    this.m.makeRotationY(this.spec.heading).multiply(new THREE.Matrix4().makeRotationZ(roll)).setPosition(this.spec.x, keelY + DEPTH, this.spec.z);
    const tri = (v: number[], col: THREE.Color, jitter = 0.07) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      const k = 1 - jitter + rng.next() * jitter * 2;
      const c: number[] = []; for (let i = 0; i < 3; i++) c.push(col.r * k, col.g * k, col.b * k);
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      g.applyMatrix4(this.m);
      parts.push(g);
    };
    const quad = (a: number[], b: number[], c: number[], d: number[], col: THREE.Color, j?: number) => { tri([...a, ...b, ...c], col, j); tri([...a, ...c, ...d], col, j); };
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.07, local = true) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      if (local) ni.applyMatrix4(this.m);
      parts.push(ni);
    };

    // ── hull: stations bow (−z) → stern (+z), 5 strake rows from the gunwale down to the keel ──
    const N = 12, rows = 5;
    const st: { z: number; w: number; top: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, bell = Math.sin(Math.PI * Math.pow(t, 0.7));
      st.push({ z: -LENGTH / 2 + t * LENGTH, w: Math.max(0.15, (BEAM / 2) * Math.pow(bell, 0.6) * (t > 0.95 ? 0.75 : 1)), top: 0.4 + 0.9 * (1 - Math.sin(Math.PI * t)) * (t < 0.5 ? 1.2 : 0.6) });
    }
    const P = (s: typeof st[number], side: number, row: number): number[] => {
      const u = row / rows;                                   // 0 gunwale → 1 keel
      const w = s.w * (1 - u * u * 0.95), y = s.top - DEPTH * u * (0.55 + 0.45 * u);
      return [side * w, y, s.z];
    };
    for (let i = 0; i < N; i++) for (let r = 0; r < rows; r++) for (const side of [-1, 1]) {
      // holes stove in the port quarter and a gash forward on starboard
      const t = (i + 0.5) / N;
      const hole = (side < 0 && t > 0.55 && t < 0.8 && r >= 1 && r <= 3) || (side > 0 && t > 0.2 && t < 0.32 && r >= 2 && r <= 3);
      if (hole && rng.next() < 0.85) continue;
      const col = r === 0 ? C.hullDark : rng.next() < 0.25 ? C.hullGrey : C.hull;
      const a = P(st[i], side, r), b = P(st[i + 1], side, r), c = P(st[i + 1], side, r + 1), d = P(st[i], side, r + 1);
      if (side < 0) quad(a, b, c, d, col); else quad(b, a, d, c, col);
    }
    // transom
    { const s = st[N]; quad(P(s, 1, 0), P(s, -1, 0), P(s, -1, rows), P(s, 1, rows), C.hullDark); }
    // keel beam + stem
    add(new THREE.BoxGeometry(0.3, 0.35, LENGTH + 0.6).translate(0, -DEPTH + 0.1, 0), C.hullDark, 0.05);
    add(new THREE.BoxGeometry(0.28, DEPTH + 1.2, 0.3).translate(0, -DEPTH / 2 + 0.7, -LENGTH / 2 - 0.1), C.hullDark, 0.05);
    // ── deck at the gunwale line, planks along the length, some missing ──
    for (let i = 0; i < N; i++) {
      const a = st[i], b = st[i + 1];
      const nPl = 9;
      for (let k = 0; k < nPl; k++) {
        const u0 = -1 + (2 * k) / nPl, u1 = -1 + (2 * (k + 1)) / nPl - 0.04;
        const t = (i + 0.5) / N;
        if (t > 0.5 && t < 0.78 && rng.next() < 0.45) continue;  // the broken midships deck
        quad([u0 * a.w * 0.95, a.top - 0.05, a.z], [u0 * b.w * 0.95, b.top - 0.05, b.z], [u1 * b.w * 0.95, b.top - 0.05, b.z], [u1 * a.w * 0.95, a.top - 0.05, a.z], k % 2 ? C.deck : C.hull, 0.06);
      }
    }
    // bulwark rail
    for (let i = 0; i < N; i++) for (const side of [-1, 1]) {
      const a = st[i], b = st[i + 1];
      if (side < 0 && i > 6 && i < 9) continue; // rail smashed where the hull is holed
      quad([side * (a.w + 0.1), a.top + 0.1, a.z], [side * (b.w + 0.1), b.top + 0.1, b.z], [side * (b.w - 0.12), b.top + 0.1, b.z], [side * (a.w - 0.12), a.top + 0.1, a.z], C.hullDark, 0.05);
    }
    // ── masts: foremast broken off at 3 m; mainmast leaning aft with a yard, a tattered sail and stays ──
    const fz = st[3].z, mz = st[7].z;
    add(new THREE.CylinderGeometry(0.16, 0.2, 3.2, 7).translate(0, st[3].top + 1.6, fz), C.mast, 0.05);
    add(new THREE.CylinderGeometry(0.14, 0.17, 1.0, 7).rotateX(0.9).translate(0.2, st[3].top + 3.2, fz + 0.5), C.mast, 0.05); // splintered top hanging
    {
      const h = 12, lean = -0.18;
      const g = new THREE.CylinderGeometry(0.12, 0.22, h, 7); g.rotateX(lean); g.translate(0, st[7].top + Math.cos(lean) * h / 2, mz + Math.sin(-lean) * h / 2 * -1);
      add(g, C.mast, 0.05);
      const yardY = st[7].top + 7.5, yardZ = mz + 7.5 * Math.tan(lean);
      add(new THREE.CylinderGeometry(0.07, 0.07, 6.0, 6).rotateZ(Math.PI / 2).rotateY(0.15).translate(0, yardY, yardZ), C.mast, 0.05);
      // tattered sail: a quad strip hanging from the yard, ragged lower edge, torn in two
      const cols = 8, rowsS = 5, w = 5.6, drop = 4.2;
      for (let c = 0; c < cols; c++) for (let r = 0; r < rowsS; r++) {
        const u0 = -w / 2 + (w * c) / cols, u1 = -w / 2 + (w * (c + 1)) / cols;
        const frac0 = r / rowsS, frac1 = (r + 1) / rowsS;
        const rag = (u: number) => 0.55 + 0.45 * Math.abs(Math.sin(u * 2.1 + 0.4)); // how far down this column survives
        if (frac0 > rag(u0)) continue;
        if (c === 3 && r > 1) continue; // the rip
        const belly = (u: number, f: number) => 0.35 * Math.sin(f * Math.PI) * (0.6 + 0.4 * Math.cos(u));
        const pt = (u: number, f: number) => [u * Math.cos(0.15), yardY - f * drop, yardZ - u * Math.sin(0.15) + belly(u, f) + f * 0.6];
        quad(pt(u0, frac0), pt(u1, frac0), pt(u1, Math.min(frac1, rag(u1))), pt(u0, Math.min(frac1, rag(u0))), r % 2 ? C.sail : C.sailDark, 0.05);
      }
      // stays and shrouds as thin boxes
      for (const [x0, z0] of [[-BEAM / 2 + 0.3, mz - 1], [BEAM / 2 - 0.3, mz - 1], [0, -LENGTH / 2 + 0.4], [0, LENGTH / 2 - 0.6]]) {
        const top = new THREE.Vector3(0, st[7].top + 10.5, mz + 10.5 * Math.tan(lean)), bot = new THREE.Vector3(x0, st[7].top + 0.2, z0);
        const len = top.distanceTo(bot), g = new THREE.BoxGeometry(0.04, len, 0.04);
        g.translate(0, len / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
        g.applyQuaternion(q); g.translate(bot.x, bot.y, bot.z);
        add(g, C.rope, 0.04);
      }
    }
    // ── colliders: the hull as a box (walkable deck from above) ──
    const deckTop = keelY + DEPTH + 0.35 * Math.cos(roll);
    this.deckY = deckTop;
    this.colliders.push({ x: this.spec.x, z: this.spec.z, hw: BEAM / 2, hd: LENGTH / 2, rot: -this.spec.heading, yTop: deckTop - 0.3, yBottom: keelY - 2 });

    // ── strewn cargo and driftwood on the sand around the wreck (world space) ──
    const strew = (g: THREE.BufferGeometry, col: THREE.Color, dx: number, dz: number, yOff: number, rotY: number) => {
      const wx = this.spec.x + dx, wz = this.spec.z + dz; const wy = heightAt(wx, wz) + yOff;
      g.rotateY(rotY); g.translate(wx, wy, wz); add(g, col, 0.07, false);
    };
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(BEAM + 2, BEAM + 12), s = rng.range(0.7, 1.2);
      const dx = Math.cos(a) * d, dz = Math.sin(a) * d;
      if (i < 3) { strew(new THREE.BoxGeometry(s, s, s), C.crate, dx, dz, s / 2 - 0.15, rng.range(0, 3)); }
      else { strew(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 8).rotateZ(Math.PI / 2), C.barrel, dx, dz, 0.3, rng.range(0, 3)); for (const o of [-0.35, 0.35]) strew(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 8).rotateZ(Math.PI / 2).translate(o, 0, 0), C.band, dx, dz, 0.3, 0); }
      this.colliders.push({ x: this.spec.x + dx, z: this.spec.z + dz, hw: 0.6, hd: 0.6, rot: 0, yTop: heightAt(this.spec.x + dx, this.spec.z + dz) + 1.2, yBottom: heightAt(this.spec.x + dx, this.spec.z + dz) - 1 });
    }
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(BEAM + 1, BEAM + 16), len = rng.range(2.5, 5);
      strew(new THREE.CylinderGeometry(0.14, 0.22, len, 5).rotateZ(Math.PI / 2).rotateX(rng.range(-0.1, 0.1)), C.drift, Math.cos(a) * d, Math.sin(a) * d, 0.1, rng.range(0, Math.PI));
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

  /** the heeled deck under (x, z): a plane tilted by the roll, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const h = this.spec.heading, cs = Math.cos(h), sn = Math.sin(h);
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * sn + dz * cs, lx = dx * cs - dz * sn;
    if (Math.abs(lz) > LENGTH / 2 - 0.5 || Math.abs(lx) > BEAM / 2 * 0.9) return undefined;
    return this.deckY + lx * Math.sin(this.spec.roll ?? 0.3);
  }
}
