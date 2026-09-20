/**
 * Boat — a little low-poly sailboat moored beside the pier (Driftwood Isle). Flat-shaded,
 * vertex-coloured, no textures; one mesh. A lofted plank hull, thwarts, mast + boom, a patched
 * off-white sail and mooring lines to the pier's bollards. Bobs on the swell in `update(dt)`.
 *
 *   const boat = new Boat(sky, { x: -4.2, z: -244, heading: 0, waterY: 0.8, moorTo: pier.mooringsFor(-4.2, -244) }).build();
 *   scene.add(boat.group); if (boat.ropes) scene.add(boat.ropes);
 *   player.colliders.push(...boat.colliders);
 *   player.platforms.push((x, z) => boat.floorHeightAt(x, z));   // you can jump in
 *   game.onUpdate((dt) => boat.update(dt));
 *
 * `heading` is radians about +y (0 = bow toward −z, i.e. out to sea when moored at the south pier).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '../player/Player';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Sky } from './Sky';

export interface BoatSpec {
  x: number; z: number;
  heading?: number;
  /** still-water level; the hull floats with its waterline here */
  waterY: number;
  /** world xz of posts to run mooring lines to (bow → first, stern → second) */
  moorTo?: { x: number; z: number }[];
}

const C = {
  hull: new THREE.Color('#8e6b47'),
  hullDark: new THREE.Color('#6b4f34'),
  trim: new THREE.Color('#5a4029'),
  floor: new THREE.Color('#a8845c'),
  mast: new THREE.Color('#7a5c3c'),
  sail: new THREE.Color('#efe9dc'),
  patch: new THREE.Color('#c9bfa9'),
  rope: new THREE.Color('#d2bd85'),
};

const LENGTH = 6.4, BEAM = 2.2;

export class Boat {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private t = 0;
  private floorY: number;

  constructor(private sky: Sky, private spec: BoatSpec) { this.floorY = spec.waterY + 0.32; }

  build(): this {
    const rng = new Rng(SEED ^ 0x0b0a7);
    const parts: THREE.BufferGeometry[] = [];
    const tri = (pos: number[], col: THREE.Color, jitter = 0.07) => {
      // pos: 9 numbers; one shade per face
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const k = 1 - jitter + rng.next() * jitter * 2;
      g.setAttribute('color', new THREE.Float32BufferAttribute([col.r * k, col.g * k, col.b * k, col.r * k, col.g * k, col.b * k, col.r * k, col.g * k, col.b * k], 3));
      parts.push(g);
    };
    const quad = (a: number[], b: number[], c: number[], d: number[], col: THREE.Color, jitter?: number) => { tri([...a, ...b, ...c], col, jitter); tri([...a, ...c, ...d], col, jitter); };
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.07) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    };

    // ── hull loft: stations bow (t=0, −z) → stern (t=1, +z); y = 0 is the waterline ──
    const N = 9;
    const st: { z: number; w: number; top: number; keel: number; chine: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const bell = Math.sin(Math.PI * t ** 0.75);
      const w = Math.max(0.04, (BEAM / 2) * bell ** 0.75 * (t > 0.97 ? 0.7 : 1));
      st.push({ z: -LENGTH / 2 + t * LENGTH, w, top: 0.72 - 0.22 * Math.sin(Math.PI * t) + (t < 0.15 ? 0.12 : 0), keel: -(0.35 + 0.55 * Math.sin(Math.PI * t) ** 0.6), chine: 0.25 });
    }
    const at = (i: number): typeof st[number] => { const v = st[i]; if (v === undefined) throw new Error(`Boat: no station ${i}`); return v; };
    const P = (s: typeof st[number], side: number, k: 'gun' | 'chine' | 'keel'): number[] =>
      k === 'gun' ? [side * s.w, s.top, s.z] : k === 'chine' ? [side * s.w * 0.85, s.chine, s.z] : [0, s.keel, s.z];
    for (let i = 0; i < N; i++) {
      const a = at(i), b = at(i + 1);
      for (const side of [-1, 1]) {
        const dark = i % 2 ? C.hullDark : C.hull;
        // upper strake gunwale→chine, lower strake chine→keel (winding flipped per side so both face out)
        if (side < 0) { quad(P(a, side, 'gun'), P(b, side, 'gun'), P(b, side, 'chine'), P(a, side, 'chine'), dark); quad(P(a, side, 'chine'), P(b, side, 'chine'), P(b, side, 'keel'), P(a, side, 'keel'), C.hull); }
        else { quad(P(b, side, 'gun'), P(a, side, 'gun'), P(a, side, 'chine'), P(b, side, 'chine'), dark); quad(P(b, side, 'chine'), P(a, side, 'chine'), P(a, side, 'keel'), P(b, side, 'keel'), C.hull); }
      }
      // floor boards inside (visible from above), a little above the chine
      const fy = 0.32, fw = (s: typeof st[number]) => s.w * 0.72;
      quad([-fw(a), fy, a.z], [-fw(b), fy, b.z], [fw(b), fy, b.z], [fw(a), fy, a.z], i % 2 ? C.floor : C.hullDark, 0.05);
      // inner hull face (gunwale down to the floor) so you don't see through from above
      for (const side of [-1, 1]) {
        const ia = [side * a.w, a.top, a.z], ib = [side * b.w, b.top, b.z], fa = [side * fw(a), fy, a.z], fb = [side * fw(b), fy, b.z];
        if (side < 0) quad(ib, ia, fa, fb, C.hullDark, 0.05); else quad(ia, ib, fb, fa, C.hullDark, 0.05);
      }
    }
    // transom
    const s = at(N);
    quad([s.w, s.top, s.z], [-s.w, s.top, s.z], [0, s.keel, s.z], [0, s.keel, s.z], C.trim);
    quad([-s.w * 0.72, 0.32, s.z], [s.w * 0.72, 0.32, s.z], [s.w, s.top, s.z], [-s.w, s.top, s.z], C.trim);
    // gunwale caps
    for (let i = 0; i < N; i++) {
      const a = at(i), b = at(i + 1);
      for (const side of [-1, 1]) {
        const o = 0.09;
        quad([side * (a.w + o), a.top + 0.05, a.z], [side * (b.w + o), b.top + 0.05, b.z], [side * (b.w - o), b.top + 0.05, b.z], [side * (a.w - o), a.top + 0.05, a.z], C.trim, 0.05);
      }
    }
    // thwarts (benches)
    for (const t of [0.3, 0.72]) {
      const station = at(Math.round(t * N)), w = station.w * 0.95;
      add(new THREE.BoxGeometry(w * 2, 0.08, 0.34).translate(0, 0.5, station.z), C.floor, 0.05);
    }
    // mast, boom, sail
    const mz = at(3).z, mastH = 5.2;
    add(new THREE.CylinderGeometry(0.06, 0.085, mastH, 7).translate(0, 0.32 + mastH / 2, mz), C.mast, 0.05);
    add(new THREE.CylinderGeometry(0.045, 0.045, 3.3, 6).rotateX(Math.PI / 2).translate(0, 1.45, mz + 1.65), C.mast, 0.05);
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6).rotateX(Math.PI / 2).translate(0, 0.32 + mastH - 0.05, mz + 1.1), C.mast, 0.05); // gaff-ish yard
    {
      const cols = 6, rows = 8, top = 0.32 + mastH - 0.1, bot = 1.55, foot = 3.1, head = 2.0;
      const pt = (u: number, v: number): number[] => {
        const y = bot + (top - bot) * v, len = foot + (head - foot) * v;
        const z = mz + 0.05 + len * u;
        const belly = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.35;
        return [belly, y, z];
      };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const u0 = c / cols, u1 = (c + 1) / cols, v0 = r / rows, v1 = (r + 1) / rows;
        const patch = (c >= 1 && c <= 2 && r >= 2 && r <= 3) || (c === 4 && r >= 5 && r <= 6);
        quad(pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1), patch ? C.patch : C.sail, 0.04);
      }
    }
    // rudder + tiller
    add(new THREE.BoxGeometry(0.06, 1.0, 0.5).translate(0, 0.1, LENGTH / 2 + 0.2), C.trim, 0.05);
    add(new THREE.BoxGeometry(0.05, 0.05, 1.3).translate(0, 0.78, LENGTH / 2 - 0.5), C.mast, 0.05);

    const geo = mergeGeometries(parts, false);
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this.group.position.set(this.spec.x, this.spec.waterY, this.spec.z);
    this.group.rotation.y = this.spec.heading ?? 0;

    // mooring lines: bow / stern cleats → the posts, in world space (a separate static mesh so they don't bob)
    if (this.spec.moorTo?.length) {
      const ropeParts: THREE.BufferGeometry[] = [];
      const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
      const cleat = (lz: number): THREE.Vector3 => new THREE.Vector3(this.spec.x + lz * sn, this.spec.waterY + 0.7, this.spec.z + lz * cs);
      const ends = [cleat(-LENGTH / 2 + 0.3), cleat(LENGTH / 2 - 0.3)];
      this.spec.moorTo.slice(0, 2).forEach((post, i) => {
        const a = ends[i];
        if (a === undefined) return;
        const b = new THREE.Vector3(post.x, this.spec.waterY + 1.9, post.z);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35; // sag
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const g = new THREE.TubeGeometry(curve, 8, 0.03, 4, false);
        g.deleteAttribute('uv'); g.deleteAttribute('normal');
        const ni = g.toNonIndexed(); const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { c[k * 3] = C.rope.r; c[k * 3 + 1] = C.rope.g; c[k * 3 + 2] = C.rope.b; }
        ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
        ropeParts.push(ni);
      });
      const ropes = new THREE.Mesh(mergeGeometries(ropeParts, false), mat);
      ropes.castShadow = true;
      this.ropes = ropes;
    }
    // gunwales + bow / stern as thin walls: they keep you in the boat once you're in, and keep a swimmer out
    // of the hull; from the pier deck (above yTop) you step over them and drop onto the floor
    {
      const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h), yTop = this.spec.waterY + 0.8, yBottom = this.spec.waterY - 1.2;
      const wall = (lx: number, lz: number, hw: number, hd: number) => this.colliders.push({ x: this.spec.x + lx * cs + lz * sn, z: this.spec.z - lx * sn + lz * cs, hw, hd, rot: -h, yTop, yBottom });
      wall(-BEAM / 2, 0, 0.08, LENGTH / 2); wall(BEAM / 2, 0, 0.08, LENGTH / 2); wall(0, -LENGTH / 2, BEAM / 2, 0.08); wall(0, LENGTH / 2, BEAM / 2, 0.08);
    }
    return this;
  }

  /** static mesh with the mooring lines (world space) — add it to the scene beside `group` */
  ropes: THREE.Mesh | null = null;

  /** the boat's floor if (x, z) is inside the hull */
  floorHeightAt(x: number, z: number): number | undefined {
    const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * sn + dz * cs, lx = dx * cs - dz * sn;
    if (Math.abs(lz) > LENGTH / 2 - 0.3 || Math.abs(lx) > BEAM / 2 * 0.8) return undefined;
    return this.floorY;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.group;
    g.position.y = this.spec.waterY + Math.sin(this.t * 0.9) * 0.05 + Math.sin(this.t * 1.7 + 1) * 0.02;
    g.rotation.z = Math.sin(this.t * 0.8) * 0.025;
    g.rotation.x = Math.sin(this.t * 0.55 + 0.7) * 0.012;
  }
}
