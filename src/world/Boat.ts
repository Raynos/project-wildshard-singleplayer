/**
 * Boat — a little low-poly sailboat moored beside the pier (Driftwood Isle). Flat-shaded,
 * vertex-coloured, no textures. Two meshes: the hull (a solid, planked dinghy with its thwarts, mast, boom and gear,
 * single-sided so it can't shadow itself) and the sail + rigging (two-sided, casts, never receives), plus mooring lines
 * to the pier's bollards. Bobs on the swell in `update(dt)`.
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
import { SEED } from '../core/config';
import type { Sky } from './Sky';
import { heightAt } from './Heightfield';
import { waveHeight, seaDamp } from './waves';
import { swayDepthMaterial } from './wind';
import { LowPolyKit, lowPolyMaterial, beam, log, plank, rope, sagLine } from './lowpolyKit';
import type { ColliderDesc } from './registry';

export interface BoatSpec {
  x: number; z: number;
  heading?: number;
  /** still-water level; the hull floats with its waterline here */
  waterY: number;
  /** world xz of posts to run mooring lines to (bow → first, stern → second) */
  moorTo?: { x: number; z: number }[];
}

const ROPE = new THREE.Color('#d2bd85');

const LENGTH = 6.4, BEAM = 2.2;

export class Boat {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  /** the sail, its own mesh: casts, never receives (E110: a thin swaying two-sided cloth shadowed itself into triangle acne) */
  sail!: THREE.Mesh;
  colliders: Collider[] = [];
  private t = 0;
  private floorY: number;

  constructor(private sky: Sky, private spec: BoatSpec) { this.floorY = spec.waterY + 0.32; }

  build(): this {
    this.buildHull();
    this.group.add(this.mesh, this.sail);
    this.group.position.set(this.spec.x, this.spec.waterY, this.spec.z);
    this.group.rotation.y = this.spec.heading ?? 0;
    const mat = this.ropeMat;

    // mooring lines: bow / stern cleats → the posts, in world space (a separate static mesh so they don't bob)
    if (this.spec.moorTo?.length) {
      const ropeParts: THREE.BufferGeometry[] = [];
      const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
      const cleat = (lz: number, ly: number): THREE.Vector3 => new THREE.Vector3(this.spec.x + lz * sn, this.spec.waterY + ly, this.spec.z + lz * cs);
      const ends = [cleat(-LENGTH / 2 + 0.3, this.cleatY[0] ?? 0.7), cleat(LENGTH / 2 - 0.3, this.cleatY[1] ?? 0.7)];
      this.spec.moorTo.slice(0, 2).forEach((post, i) => {
        const a = ends[i];
        if (a === undefined) return;
        const b = new THREE.Vector3(post.x, this.spec.waterY + 1.9, post.z);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35; // sag
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const g = new THREE.TubeGeometry(curve, 8, 0.03, 4, false);
        g.deleteAttribute('uv'); g.deleteAttribute('normal');
        const ni = g.toNonIndexed(); const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { c[k * 3] = ROPE.r; c[k * 3 + 1] = ROPE.g; c[k * 3 + 2] = ROPE.b; }
        ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
        ropeParts.push(ni);
      });
      const ropeGeo = mergeGeometries(ropeParts, false);
      // each rope vertex remembers its rest position, which rope it is and how far along it lies (1 at the cleat, 0 at
      // the post), so update() can lift the cleat end with the boat on the swell and leave the post end tied
      const rp = ropeGeo.getAttribute('position');
      this.ropeRest = new Float32Array(rp.array);
      this.ropeW = new Float32Array(rp.count);
      this.ropeWhich = new Uint8Array(rp.count);
      const perRope = rp.count / ropeParts.length;
      for (let k = 0; k < rp.count; k++) {
        const which = Math.min(ropeParts.length - 1, Math.floor(k / perRope)), a = ends[which], post = this.spec.moorTo[which];
        if (a === undefined || post === undefined) continue;
        const bx = post.x, bz = post.z, dx = bx - a.x, dz = bz - a.z, len2 = dx * dx + dz * dz || 1;
        const t = Math.min(1, Math.max(0, ((rp.getX(k) - a.x) * dx + (rp.getZ(k) - a.z) * dz) / len2));
        this.ropeW[k] = 1 - t; this.ropeWhich[k] = which;
      }
      this.cleatZ = [-LENGTH / 2 + 0.3, LENGTH / 2 - 0.3];
      const ropes = new THREE.Mesh(ropeGeo, mat);
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

  /** the material the mooring lines use */
  private ropeMat!: THREE.Material;
  /** local y of the bow / stern cleats the mooring lines start from */
  private cleatY = [0.7, 0.7];

  /**
   * The boat (E113's B, the rebuild Jake picked): the dinghy of the round-8 reference (art/driftwood-isle/round-8-assets/ref-sailboat.jpg),
   * built as SOLIDS. The hull is one closed loft: every station is a ring round the planking's cross-section — outer
   * skin keel → sheer, the gunwale cap, the inner skin down to the floor boards, across, and back up — so it has real
   * thickness and no open, zero-thickness sheet anywhere. The hull mesh is single-sided (FrontSide), which makes three
   * draw its BACK faces into the shadow map: a lit face can't shadow itself, so no triangle acne. Five strakes a side
   * in two tones and a dark wale band under the cap; the sheer rises to the stem and, less, to the transom; stem post,
   * keel strip, ribs, three thwarts, quarter posts, rudder + tiller, oars, a rope coil and a lantern. The sail is a
   * bellied triangle on a boom, lashed to the mast, with a forestay, shrouds and a sheet — its own two-sided mesh that
   * casts but never receives (the E110 fix). The thin gear (oars, lashings, boom, tiller, rigging, coil, lantern) is a third
   * mesh that receives but never casts. ~2.3k triangles, 3 draw calls (+ the mooring lines).
   */
  private buildHull(): void {
    // kit: the hull + timbers (casts, receives); rig: the sail (casts only); gear: the thin bits — oars, lashings, boom,
    // tiller, rigging, coil, lantern — which receive but don't cast: at the phone's ~10–15 cm shadow texels a 3–6 cm spar
    // casts a dotted chain of blobs across the floor boards
    const kit = new LowPolyKit(SEED ^ 0x0b0a8), rig = new LowPolyKit(SEED ^ 0x5a11), gear = new LowPolyKit(SEED ^ 0x9ea5);
    const K = {
      plankA: '#b27b45', plankB: '#9e6a39', wale: '#6b4630', cap: '#583a25', inner: '#8c6038', floorA: '#bc8d5b', floorB: '#a97c4c',
      rib: '#7a5132', post: '#6b4630', mast: '#94643a', sail: '#f2e9d6', sailB: '#e8dec8', patch: '#a99a80', rope: '#d8bf8a',
      iron: '#3a332e', glass: '#ffcf6a', oar: '#c49a62',
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    // ── stations bow (t = 0, −z) → transom (t = 1); y = 0 is the waterline ──
    interface St { t: number; z: number; w: number; sheer: number; keel: number; floor: number }
    const W = BEAM / 2 - 0.03, FLOOR = this.floorY - this.spec.waterY, DECK_T = 0.105;
    const station = (t: number): St => {
      const fore = Math.min(1, t / 0.42), aft = Math.max(0, (t - 0.55) / 0.45);
      const w = W * Math.sin(fore * Math.PI / 2) ** 0.85 * (1 - 0.3 * aft ** 1.5);
      const sheer = 0.7 + 0.46 * Math.max(0, 1 - t / 0.5) ** 2.2 + 0.2 * aft ** 2;
      const keel = -0.52 + 0.34 * Math.max(0, 1 - t / 0.35) ** 2 + 0.14 * aft ** 2;
      return { t, z: -LENGTH / 2 + t * LENGTH, w, sheer, keel, floor: t <= DECK_T ? sheer : FLOOR };
    };
    const TS = [0, 0.035, 0.075, DECK_T, 0.115, 0.17, 0.25, 0.33, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.96, 1];
    const sts = TS.map(station);
    const stAt = (i: number): St => { const s = sts[i]; if (s === undefined) throw new Error(`Boat: no station ${i}`); return s; };
    // the outer section, keel → sheer: (fraction of half-beam, fraction of keel→sheer height); a touch of flare at the top
    const PROF: [number, number][] = [[0, 0], [0.42, 0.07], [0.78, 0.28], [0.95, 0.56], [1, 0.8], [1.02, 1]];
    const pr = (j: number): [number, number] => PROF[j] ?? [1, 1];
    const outer = (s: St, j: number): [number, number] => { const [u, v] = pr(j); return [s.w * u, s.keel + v * (s.sheer - s.keel)]; };
    const xAt = (s: St, y: number): number => {
      for (let j = 0; j < PROF.length - 1; j++) {
        const [x0, y0] = outer(s, j), [x1, y1] = outer(s, j + 1);
        if (y <= y1 || j === PROF.length - 2) return x0 + (x1 - x0) * Math.min(1, Math.max(0, (y - y0) / ((y1 - y0) || 1)));
      }
      return s.w;
    };
    const STRAKE = [K.plankB, K.plankA, K.plankB, K.plankA, K.wale];
    // one closed ring per station: [x, y] points and the colour of the edge leaving each point
    const ring = (s: St): { p: [number, number][]; c: string[] } => {
      const p: [number, number][] = [], c: string[] = [];
      const th = Math.min(0.085, s.w * 0.35), xs = outer(s, PROF.length - 1)[0];
      for (let j = PROF.length - 1; j >= 0; j--) { const [x, y] = outer(s, j); p.push([x, y]); c.push(STRAKE[Math.max(0, j - 1)] ?? K.wale); }
      for (let j = 1; j < PROF.length; j++) { const [x, y] = outer(s, j); p.push([-x, y]); c.push(j === PROF.length - 1 ? K.cap : STRAKE[j] ?? K.wale); }
      const ym = (s.sheer + s.floor) / 2, x0 = xs - th, x1 = Math.max(0, Math.min(x0, xAt(s, ym) - th)), xf = Math.max(0, Math.min(x1, xAt(s, s.floor) - th));
      // port inner skin down to the floor, four floor boards across (two tones), starboard inner skin back up to the cap
      p.push([-x0, s.sheer], [-x1, ym], [-xf, s.floor]); c.push(K.inner, K.inner, K.floorA);
      p.push([-xf * 0.5, s.floor], [0, s.floor], [xf * 0.5, s.floor]); c.push(K.floorB, K.floorA, K.floorB);
      p.push([xf, s.floor], [x1, ym], [x0, s.sheer]); c.push(K.inner, K.inner, K.cap);
      return { p, c };
    };
    // the ring's winding (the same at every station): its signed area picks which way the quads face out
    const r0 = ring(stAt(9)).p;
    let area = 0;
    for (let k = 0; k < r0.length; k++) { const a = r0[k], b = r0[(k + 1) % r0.length]; if (a && b) area += a[0] * b[1] - b[0] * a[1]; }
    const ccw = area > 0;
    const hull: number[] = [], hullCol: string[] = [];
    const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, col: string) => {
      if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).lengthSq() < 1e-10) return; // a collapsed sliver at the bow
      hull.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); hullCol.push(col);
    };
    for (let i = 0; i + 1 < sts.length; i++) {
      const sa = stAt(i), sb = stAt(i + 1), ra = ring(sa), rb = ring(sb), n = ra.p.length;
      for (let k = 0; k < n; k++) {
        const pa = ra.p[k], qa = ra.p[(k + 1) % n], pb = rb.p[k], qb = rb.p[(k + 1) % n];
        if (!pa || !qa || !pb || !qb) continue;
        const A = V(pa[0], pa[1], sa.z), B = V(qa[0], qa[1], sa.z), Cc = V(qb[0], qb[1], sb.z), D = V(pb[0], pb[1], sb.z), col = ra.c[k] ?? K.plankA;
        if (ccw) { face(A, B, Cc, col); face(A, Cc, D, col); } else { face(A, Cc, B, col); face(A, D, Cc, col); }
      }
    }
    // the transom: the last ring, capped flat (facing +z) …
    const sN = stAt(sts.length - 1), rN = ring(sN);
    const contour = rN.p.map(([x, y]) => new THREE.Vector2(x, y));
    for (const tri of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const pa = contour[tri[0] ?? 0], pb = contour[tri[1] ?? 0], pc = contour[tri[2] ?? 0];
      if (!pa || !pb || !pc) continue;
      const A = V(pa.x, pa.y, sN.z), B = V(pb.x, pb.y, sN.z), Cc = V(pc.x, pc.y, sN.z);
      const nz = (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
      if (nz > 0) face(A, B, Cc, K.wale); else face(A, Cc, B, K.wale);
    }
    // per-face colour (kit.add paints one colour per call, so the loft goes in one colour-tagged triangle list)
    {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
      const col = new Float32Array(hull.length), tmp = new THREE.Color();
      for (let f = 0; f < hullCol.length; f++) {
        tmp.set(hullCol[f] ?? K.plankA); const k = 0.95 + kit.rng.next() * 0.1;
        for (let v = 0; v < 3; v++) { col[f * 9 + v * 3] = tmp.r * k; col[f * 9 + v * 3 + 1] = tmp.g * k; col[f * 9 + v * 3 + 2] = tmp.b * k; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      kit.addPainted(g);
    }
    // … and the transom board closing the open interior (a slab across the inner skin, sheer → floor)
    {
      const th = Math.min(0.085, sN.w * 0.35), xs = outer(sN, PROF.length - 1)[0], ym = (sN.sheer + sN.floor) / 2;
      const x0 = xs - th, x1 = Math.min(x0, xAt(sN, ym) - th), xf = Math.min(x1, xAt(sN, sN.floor) - th);
      const shape = new THREE.Shape([V(-x0, sN.sheer, 0), V(-x1, ym, 0), V(-xf, sN.floor, 0), V(xf, sN.floor, 0), V(x1, ym, 0), V(x0, sN.sheer, 0)].map((v) => new THREE.Vector2(v.x, v.y)));
      kit.add(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }).translate(0, 0, sN.z - 0.08), K.inner, { jitter: 0.04 });
    }

    // ── timbers: keel strip, stem post, quarter posts, ribs, thwarts ──
    for (let i = 1; i + 1 < sts.length; i++) {
      const a = stAt(i), b = stAt(i + 1);
      kit.add(beam(V(0, a.keel - 0.03, a.z), V(0, b.keel - 0.03, b.z + (i + 2 === sts.length ? 0.04 : 0)), 0.09, 0.1), K.post, { jitter: 0.04 });
    }
    const s0 = stAt(0), s1 = stAt(1);
    const stemFoot = V(0, s1.keel - 0.03, s1.z), stemMid = V(0, (s0.keel + s0.sheer) / 2 - 0.1, s0.z - 0.05), stemHead = V(0, s0.sheer + 0.3, s0.z - 0.1);
    kit.add(beam(stemFoot, stemMid, 0.11, 0.13), K.post, { jitter: 0.04 });
    kit.add(beam(stemMid, stemHead, 0.11, 0.13), K.post, { jitter: 0.04 });
    for (const sd of [-1, 1]) {
      const x = sd * (outer(sN, PROF.length - 1)[0] - 0.08);
      kit.add(new THREE.BoxGeometry(0.12, 0.62, 0.12).translate(x, sN.sheer - 0.02, sN.z - 0.07), K.post, { jitter: 0.04, wobble: 0.008 });
    }
    // ribs: two straight timbers a side, floor edge → mid → sheer, laid on the inner skin
    for (const t of [0.2, 0.31, 0.42, 0.53, 0.64, 0.75, 0.86]) {
      const s = station(t), th = Math.min(0.085, s.w * 0.35) + 0.035, ym = (s.sheer + s.floor) / 2;
      for (const sd of [-1, 1]) {
        const pF = V(sd * (xAt(s, s.floor + 0.02) - th), s.floor + 0.02, s.z), pM = V(sd * (xAt(s, ym) - th), ym, s.z), pS = V(sd * (outer(s, PROF.length - 1)[0] - th), s.sheer - 0.03, s.z);
        kit.add(beam(pF, pM, 0.08, 0.06), K.rib, { jitter: 0.05 });
        kit.add(beam(pM, pS, 0.08, 0.06), K.rib, { jitter: 0.05 });
      }
    }
    const MAST_T = 0.3, mast = station(MAST_T), mz = mast.z;
    const thwart = (t: number, y: number, d: number) => {
      const s = station(t), half = xAt(s, y) - Math.min(0.085, s.w * 0.35);
      kit.add(plank(half * 2, d, 0.07, kit.rng, 0.01).translate(0, y, s.z), K.floorA, { jitter: 0.05 });
      kit.add(new THREE.BoxGeometry(0.08, y - s.floor, 0.08).translate(0, (y + s.floor) / 2, s.z), K.rib, { jitter: 0.04 }); // the pillar under it
    };
    thwart(MAST_T, 0.66, 0.3); thwart(0.55, 0.64, 0.32); thwart(0.86, 0.66, 0.5);
    // rowlocks on the cap by the middle thwart, cleats fore and aft for the mooring lines
    { const s = station(0.55), xs = outer(s, PROF.length - 1)[0] - 0.04;
      for (const sd of [-1, 1]) gear.add(new THREE.BoxGeometry(0.06, 0.12, 0.1).translate(sd * xs, s.sheer + 0.06, s.z + 0.3), K.iron, { jitter: 0.04 }); }
    const cz = [-LENGTH / 2 + 0.3, LENGTH / 2 - 0.3], cs = cz.map((z) => station((z + LENGTH / 2) / LENGTH));
    cs.forEach((s, i) => { kit.add(new THREE.BoxGeometry(0.3, 0.06, 0.1).translate(0, s.sheer + 0.03, (cz[i] ?? 0)), K.post, { jitter: 0.04 }); });
    this.cleatY = cs.map((s) => s.sheer + 0.06);

    // ── mast, step, lashings, boom, rudder + tiller ──
    const MAST_H = 5.1, mastTop = FLOOR + MAST_H, BOOM_Y = 1.42, BOOM_L = 3.35;
    kit.add(new THREE.BoxGeometry(0.26, 0.1, 0.34).translate(0, FLOOR + 0.05, mz), K.post, { jitter: 0.04 });
    kit.add(log(V(0, FLOOR, mz), V(0, mastTop, mz), 0.085, 0.055, 8, 0.3), K.mast, { jitter: 0.05 });
    kit.add(new THREE.BoxGeometry(0.13, 0.12, 0.13).translate(0, mastTop + 0.04, mz), K.post, { jitter: 0.04 });
    const lash = (y: number, r: number, h = 0.07) => {
      for (let k = 0; k < 2; k++) gear.add(new THREE.TorusGeometry(r, 0.022, 3, 7).rotateX(Math.PI / 2).translate(0, y + (k - 0.5) * h, mz), K.rope, { jitter: 0.06 });
    };
    lash(0.73, 0.085); lash(BOOM_Y + 0.04, 0.08); lash(2.9, 0.075); lash(mastTop - 0.28, 0.064);
    const boomEnd = V(0, BOOM_Y + 0.12, mz + BOOM_L);
    gear.add(log(V(0, BOOM_Y, mz + 0.06), boomEnd, 0.05, 0.042, 6, 0.4), K.mast, { jitter: 0.05 });
    gear.add(new THREE.TorusGeometry(0.06, 0.02, 3, 6).translate(0, boomEnd.y, boomEnd.z - 0.12), K.rope, { jitter: 0.06 });
    {
      const rud = new THREE.Shape([[0, 1.0], [0.13, 1.0], [0.13, 0.25], [0.5, -0.05], [0.44, -0.55], [0, -0.6]].map(([z, y]) => new THREE.Vector2(z, y)));
      kit.add(new THREE.ExtrudeGeometry(rud, { depth: 0.06, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0.03, 0, sN.z + 0.03), K.post, { jitter: 0.05 });
      gear.add(log(V(0, 1.0, sN.z + 0.1), V(0, 0.92, sN.z - 1.2), 0.035, 0.028, 6), K.mast, { jitter: 0.05 });
    }

    // ── gear: two oars on the thwarts, a rope coil on the floor, a lantern on the port quarter post ──
    for (const x of [-0.42, -0.58]) {
      const a = V(x, 0.74, -0.35 + (x + 0.5) * 0.4), b = V(x + 0.08, 0.72, 2.25);
      gear.add(log(a, b, 0.032, 0.03, 6), K.oar, { jitter: 0.05 });
      gear.add(new THREE.BoxGeometry(0.03, 0.14, 0.62).translate(b.x + 0.01, b.y - 0.02, b.z + 0.26), K.oar, { jitter: 0.05 });
    }
    for (let k = 0; k < 3; k++) gear.add(new THREE.TorusGeometry(0.2 - (k % 2) * 0.03, 0.04, 4, 9).rotateX(Math.PI / 2).translate(0.3, FLOOR + 0.045 + k * 0.07, mz - 0.55), K.rope, { jitter: 0.06 });
    {
      const lx = -(outer(sN, PROF.length - 1)[0] - 0.08), ly = sN.sheer + 0.36, lz = sN.z - 0.07;
      gear.add(new THREE.BoxGeometry(0.03, 0.03, 0.2).translate(lx, ly + 0.02, lz - 0.1), K.iron, { jitter: 0.02 });
      gear.add(new THREE.BoxGeometry(0.13, 0.18, 0.13).translate(lx, ly - 0.14, lz - 0.2), K.glass, { jitter: 0.02 });
      gear.add(new THREE.ConeGeometry(0.11, 0.09, 4, 1).rotateY(Math.PI / 4).translate(lx, ly - 0.005, lz - 0.2), K.iron, { jitter: 0.02 });
      gear.add(new THREE.BoxGeometry(0.15, 0.03, 0.15).translate(lx, ly - 0.24, lz - 0.2), K.iron, { jitter: 0.02 });
    }

    // ── the sail: a triangle, tack at the gooseneck, head at the masthead, clew at the boom end; a belly to leeward ──
    {
      const T = V(0, BOOM_Y + 0.1, mz + 0.1), H = V(0, mastTop - 0.22, mz + 0.09), Cl = V(0, boomEnd.y + 0.06, boomEnd.z - 0.14);
      const n = 6, pos: number[] = [], sway: number[] = [], tris: { v: number[]; patch: boolean; shade: boolean }[] = [];
      const pt = (a: number, b: number): THREE.Vector3 => {
        // a: toward the head, b: toward the clew; 0 on the luff (b = 0) and the foot (a = 0), fullest a third of the way in
        const p = T.clone().addScaledVector(V(H.x - T.x, H.y - T.y, H.z - T.z), a).addScaledVector(V(Cl.x - T.x, Cl.y - T.y, Cl.z - T.z), b);
        p.x += 1.8 * a * b * (1 - 0.6 * (a + b));
        return p;
      };
      for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) {
        const a0 = i / n, a1 = (i + 1) / n, b0 = j / n, b1 = (j + 1) / n;
        const patch = i === 2 && j === 2;
        tris.push({ v: [a0, b0, a0, b1, a1, b0], patch, shade: (i + j) % 2 === 0 });
        if (i + j + 1 < n) tris.push({ v: [a1, b0, a0, b1, a1, b1], patch, shade: (i + j) % 2 === 1 });
      }
      const col: number[] = [], tmp = new THREE.Color();
      for (const tr of tris) {
        tmp.set(tr.patch ? K.patch : tr.shade ? K.sail : K.sailB);
        const k = 0.97 + rig.rng.next() * 0.06;
        for (let v = 0; v < 3; v++) {
          const a = tr.v[v * 2] ?? 0, b = tr.v[v * 2 + 1] ?? 0, p = pt(a, b);
          pos.push(p.x, p.y, p.z); col.push(tmp.r * k, tmp.g * k, tmp.b * k);
          sway.push(Math.min(1, 4 * a * b) * 0.8, 2.1); // still on the mast, the boom and the head; flutters at the leech
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 2));
      rig.addPainted(g);
      // rigging: forestay to the stem head, a shroud to each side, the sheet from the boom end down to the stern thwart
      const top = V(0, mastTop - 0.3, mz), stemTop = V(0, stemHead.y - 0.1, stemHead.z + 0.06);
      gear.add(rope(sagLine(top, stemTop, 0.04, 4), 0.016), K.rope, { jitter: 0.04 });
      for (const sd of [-1, 1]) gear.add(rope(sagLine(top, V(sd * (outer(mast, PROF.length - 1)[0] - 0.04), mast.sheer + 0.02, mz + 0.35), 0.03, 3), 0.014), K.rope, { jitter: 0.04 });
      const s86 = station(0.86);
      gear.add(rope(sagLine(V(0, boomEnd.y - 0.04, boomEnd.z - 0.3), V(0.1, 0.72, s86.z), 0.05, 3), 0.016), K.rope, { jitter: 0.04 });
    }

    const hullGeo = kit.finish({ ao: { strength: 0.5, downDark: 0.22 } });
    this.mesh = new THREE.Mesh(hullGeo, lowPolyMaterial(this.sky, 'solid', (m) => { m.side = THREE.FrontSide; }));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.sail = new THREE.Mesh(rig.finish({ ao: false }), lowPolyMaterial(this.sky));
    this.sail.castShadow = true; this.sail.receiveShadow = false;
    this.sail.customDepthMaterial = swayDepthMaterial();
    const gearMesh = new THREE.Mesh(gear.finish({ ao: false }), lowPolyMaterial(this.sky));
    gearMesh.castShadow = false; gearMesh.receiveShadow = true;
    this.mesh.add(gearMesh);
    this.ropeMat = lowPolyMaterial(this.sky);
    this.triangles = [hullGeo, this.sail.geometry, gearMesh.geometry].reduce((n, g) => n + g.getAttribute('position').count / 3, 0);
  }

  /** triangles in the hull + sail meshes (the mooring lines aside) */
  triangles = 0;

  /**
   * PHYSICS P4: the boat's collision in the boat group's LOCAL frame (origin = the hull's waterline centre at rest,
   * (spec.x, waterY, spec.z); −z = the bow; no heading) — the four gunwale / bow / stern walls (the legacy boxes) and
   * the floor boards as a slab whose top is `floorHeightAt`'s floor, widened to the walls' inner faces so the tub is
   * closed. A kinematic body can re-pose these every step to ride the swell; `colliderDescs()` is them at rest.
   */
  colliderLocalDescs(): ColliderDesc[] {
    const yTop = 0.8, yBottom = -1.2, wy = (yTop + yBottom) / 2, wh = (yTop - yBottom) / 2, t = 0.08;
    const wall = (x: number, z: number, hx: number, hz: number): ColliderDesc => ({ kind: 'box', x, y: wy, z, hx, hy: wh, hz });
    const floorTop = this.floorY - this.spec.waterY, fh = 0.1;
    return [
      wall(-BEAM / 2, 0, t, LENGTH / 2), wall(BEAM / 2, 0, t, LENGTH / 2), wall(0, -LENGTH / 2, BEAM / 2, t), wall(0, LENGTH / 2, BEAM / 2, t),
      { kind: 'box', x: 0, y: floorTop - fh, z: 0, hx: BEAM / 2 - t, hy: fh, hz: LENGTH / 2 - t },
    ];
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls (the legacy boxes) and the floor
   * `floorHeightAt` describes, as real geometry: `colliderLocalDescs()` placed at the boat's rest pose.
   */
  colliderDescs(): ColliderDesc[] {
    const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h);
    const out: ColliderDesc[] = [];
    for (const d of this.colliderLocalDescs()) {
      if (d.kind !== 'box') continue; // the local set is boxes only
      out.push({ ...d, x: this.spec.x + d.x * cs + d.z * sn, y: this.spec.waterY + d.y, z: this.spec.z - d.x * sn + d.z * cs, yaw: h + (d.yaw ?? 0) });
    }
    return out;
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

  private ropeRest: Float32Array | null = null;
  private ropeW = new Float32Array(0);
  private ropeWhich = new Uint8Array(0);
  private cleatZ = [0, 0];
  private cleatDy = [0, 0];

  /**
   * Ride the shared swell (W3, src/world/waves.ts — the same Gerstner sum the ocean shader draws): heave from the wave
   * height under the hull, pitch from 2 m fore / aft, roll from 2 m to either side; the mooring lines' cleat ends follow.
   */
  update(dt: number): void {
    this.t += dt;
    const g = this.group, x = this.spec.x, z = this.spec.z, w = this.spec.waterY;
    const damp = seaDamp(w - heightAt(x, z));
    const h = this.spec.heading ?? 0, fx = -Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);   // bow (local −z), starboard (+x)
    const hFore = waveHeight(x + fx * 2, z + fz * 2, undefined, damp), hAft = waveHeight(x - fx * 2, z - fz * 2, undefined, damp);
    const hStar = waveHeight(x + sx * 2, z + sz * 2, undefined, damp), hPort = waveHeight(x - sx * 2, z - sz * 2, undefined, damp);
    g.rotation.order = 'YXZ';
    g.position.y = w + waveHeight(x, z, undefined, damp);
    g.rotation.x = Math.atan2(hFore - hAft, 4);            // bow up when the crest is under it
    g.rotation.z = Math.atan2(hStar - hPort, 4);           // port side up when the crest is to port
    // the mooring lines: lift each rope's cleat end with the hull (heave + pitch at that cleat), the post end stays put
    const rest = this.ropeRest;
    if (this.ropes && rest) {
      const heave = g.position.y - w, s = Math.sin(g.rotation.x);
      for (let i = 0; i < 2; i++) this.cleatDy[i] = heave - (this.cleatZ[i] ?? 0) * s;
      const pos = this.ropes.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let k = 0; k < this.ropeW.length; k++) arr[k * 3 + 1] = (rest[k * 3 + 1] ?? 0) + (this.cleatDy[this.ropeWhich[k] ?? 0] ?? 0) * (this.ropeW[k] ?? 0);
      pos.needsUpdate = true;
    }
  }
}
