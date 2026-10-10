/**
 * The lookout tower, built offline (SHARD-PLATFORM M3, G285 fixed bake; the builder was models/lookout.ts): the
 * watchtower on Driftwood Isle's headland summit. Four heavy splayed log posts with X-bracing and rope lashings, a thick
 * plank platform with a braced railing, a layered thatch roof with a ragged fringe and a finial, the blue Wildshard
 * banner (a swallowtail that sways), a straight stair with rope handrails, a zipline post with its pulley facing the sea
 * cave, a crate and spyglass, a gull signpost and rope-wrapped posts at the stair foot.
 *
 * The builder runs where the tower stands: its site (x, z, which side the stair descends toward), the native terrain
 * under its posts, stair foot and baked AO, and `zipTo` (the world point the pulley faces). It hands over the geometry in
 * own space (the site's origin subtracted) and the layout the page reads back from `data/lookoutBake.json`: the legacy
 * boxes, the physics descriptors, the anchors and the floor (platform, stair). scripts/bake-driftwood-fixed-models.mjs
 * writes both.
 */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { log, plank, rope, sagLine, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';

/** Where a lookout stands: its centre (world xz) and which side its stair descends toward (rot, radians). */
export interface LookoutSite { readonly x: number; readonly z: number; readonly rot: number }
/** A named spot of the tower (own space, y = platform unless noted, yaw = facing, 0 = +Z). */
export interface LookoutAnchor { x: number; y: number; z: number; yaw: number }

const C = {
  post: '#6a4e33', log: '#735438', plank: '#a58056', plankB: '#8f6d47', plankDark: '#6f5335', rope: '#bfa274',
  thatch: '#c9a355', thatchB: '#b89346', thatchDark: '#9c7a38', thatchLight: '#dcbb6c',
  banner: '#2f5bd0', bannerB: '#2750bd', bannerDark: '#1c3c96', bannerTrim: '#182c72', sigil: '#e8f0ff', iron: '#3a3c42', brass: '#c49a45', crate: '#a47b4b', sign: '#9a7550',
  gull: '#eceae4', gullGrey: '#9aa0a8', beak: '#e0a83a',
};

const PLAT = 4.4, H = 7.0;

/** the builder: where the tower stands, then its own space */
class LookoutBuilder {
  /** the kit mesh's geometry (handed to the model's build once, then dropped) */
  geometry: THREE.BufferGeometry | null = null;
  colliders: Collider[] = [];
  anchors: Record<string, LookoutAnchor> = {};
  platformY = 0;
  cos = 1; sin = 0;
  stair = { x0: 0, len: 0, w: 1.5, n: 0 };

  private readonly spec: LookoutSite;
  private readonly ground: (x: number, z: number) => number;
  private readonly zipTo: { readonly x: number; readonly z: number };
  /** the site's origin (own space = world − origin) */
  private readonly o: { x: number; y: number; z: number };

  constructor(site: LookoutSite, ground: (x: number, z: number) => number, zipTo: { readonly x: number; readonly z: number }, origin: { x: number; y: number; z: number }) {
    this.spec = site; this.ground = ground; this.zipTo = zipTo; this.o = origin;
    this.cos = Math.cos(site.rot); this.sin = Math.sin(site.rot);
  }
  private toWorld(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cos + lz * this.sin, this.spec.z - lx * this.sin + lz * this.cos]; }
  private V(lx: number, y: number, lz: number): THREE.Vector3 { const [x, z] = this.toWorld(lx, lz); return new THREE.Vector3(x, y, z); }
  private M(lx: number, y: number, lz: number, yaw = 0, rx = 0, rz = 0): THREE.Matrix4 {
    const [x, z] = this.toWorld(lx, lz);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, this.spec.rot + yaw, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  }

  build(): this {
    const kit = new LowPolyKit(SEED ^ 0x100c), rng = kit.rng;
    const ground = this.ground(this.spec.x, this.spec.z);
    const platY = ground + H; this.platformY = platY;
    const collider = (lx: number, lz: number, hw: number, hd: number, yBottom: number, yTop: number) => { const [wx, wz] = this.toWorld(lx, lz); this.colliders.push({ x: wx, z: wz, hw, hd, rot: -this.spec.rot, yBottom, yTop }); };
    const lash = (p: THREE.Vector3, dir: THREE.Vector3, r: number) => {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
      for (let k = 0; k < 3; k++) kit.add(new THREE.TorusGeometry(r + 0.025, 0.028, 3, 8), C.rope, { matrix: new THREE.Matrix4().compose(p.clone().addScaledVector(dir.clone().normalize(), (k - 1) * 0.07), q, new THREE.Vector3(1, 1, 1)), jitter: 0.05 });
    };

    // ── four heavy posts, splayed at the foot, from below the ground to the roof ──
    const half = PLAT / 2 - 0.2, splay = 0.75;
    const postAt = (sx: number, sz: number, y: number): THREE.Vector3 => {
      const t = (platY + 2.7 - y) / (platY + 2.7 - ground);                 // 0 at the roof, 1 at the ground
      return this.V(sx * (half + splay * t), y, sz * (half + splay * t));
    };
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
    for (const [sx, sz] of corners) {
      const foot = postAt(sx, sz, ground - 0.5), top = postAt(sx, sz, platY + 2.7);
      foot.y = this.ground(foot.x, foot.z) - 0.5;
      kit.add(log(foot, top, 0.22, 0.17, 7, rng.range(0, 1)), C.log, { jitter: 0.05 });
      const [cx, cz] = [sx * (half + splay * 0.6), sz * (half + splay * 0.6)];
      collider(cx, cz, 0.3, 0.3, foot.y, platY);
    }
    // bracing: horizontal logs at three levels, X-braces between them on every face, rope lashings at the joints
    const levels = [ground + 0.6, ground + 2.8, ground + 5.0, platY - 0.25];
    for (let li = 0; li < levels.length; li++) {
      const y = levels[li] ?? 0;
      for (let k = 0; k < 4; k++) {
        const [ax, az] = corners[k] ?? [0, 0], [bx, bz] = corners[(k + 1) % 4] ?? [0, 0];
        const a = postAt(ax, az, y), b = postAt(bx, bz, y);
        if (li > 0) kit.add(log(a, b, 0.1, 0.1, 6), C.post, { jitter: 0.05 });
        if (li > 0) { lash(a, new THREE.Vector3(0, 1, 0), 0.19); lash(b, new THREE.Vector3(0, 1, 0), 0.19); }
        const yNext = levels[li + 1];
        if (yNext !== undefined && li < 3) {
          const a2 = postAt(ax, az, yNext), b2 = postAt(bx, bz, yNext);
          // the stair face keeps its middle open under the stair's landing
          kit.add(log(a, b2, 0.075, 0.075, 5), C.post); kit.add(log(b, a2, 0.075, 0.075, 5), C.post);
        }
      }
    }
    // ── the platform: joists, thick planks, edge beams ──
    for (let lx = -PLAT / 2 + 0.3; lx < PLAT / 2; lx += 1.0) kit.add(log(this.V(lx, platY - 0.2, -PLAT / 2 - 0.15), this.V(lx, platY - 0.2, PLAT / 2 + 0.15), 0.1, 0.1, 6), C.post);
    for (let px = -PLAT / 2 + 0.2; px < PLAT / 2; px += 0.4) kit.add(plank(PLAT + 0.2, 0.37, 0.09, rng, 0.015), rng.next() < 0.3 ? C.plankB : C.plank, { matrix: this.M(px, platY - 0.045, 0, Math.PI / 2), jitter: 0.06 });
    for (const s of [-1, 1]) { kit.add(new THREE.BoxGeometry(PLAT + 0.4, 0.22, 0.18), C.plankDark, { matrix: this.M(0, platY - 0.14, s * (PLAT / 2 + 0.1)) }); kit.add(new THREE.BoxGeometry(0.18, 0.22, PLAT + 0.4), C.plankDark, { matrix: this.M(s * (PLAT / 2 + 0.1), platY - 0.14, 0) }); }
    // ── railing: log posts, a top and a mid rail, an X in each bay (a gap for the stair) ──
    const railY = platY + 1.0, stairW = this.stair.w;
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      const a = this.V(x0, railY, z0), b = this.V(x1, railY, z1), len = a.distanceTo(b), n = Math.max(1, Math.round(len / 1.1));
      kit.add(log(a, b, 0.06, 0.06, 5), C.post); kit.add(log(a.clone().setY(railY - 0.5), b.clone().setY(railY - 0.5), 0.045, 0.045, 5), C.post);
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); kit.add(log(p.clone().setY(platY), p.clone().setY(railY + 0.08), 0.07, 0.06, 5), C.log); }
      for (let i = 0; i < n; i++) { const p = a.clone().lerp(b, i / n), q = a.clone().lerp(b, (i + 1) / n); kit.add(log(p.clone().setY(platY + 0.05), q.clone().setY(railY - 0.5), 0.035, 0.035, 4), C.plankDark); kit.add(log(q.clone().setY(platY + 0.05), p.clone().setY(railY - 0.5), 0.035, 0.035, 4), C.plankDark); }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      collider(cx, cz, Math.max(0.08, Math.abs(x1 - x0) / 2), Math.max(0.08, Math.abs(z1 - z0) / 2), platY, railY + 0.1);
    };
    const e = PLAT / 2 - 0.05;
    rail(-e, e, e, e); rail(-e, -e, -e, e); rail(e, -e, e, e);
    rail(-e, -e, -stairW / 2, -e); rail(stairW / 2, -e, e, -e);
    // ── the roof: corner posts, three thatch layers, a fringe, a finial ──
    const roofY = platY + 2.6;
    for (const [sx, sz] of corners) kit.add(log(this.V(sx * (half - 0.05), platY, sz * (half - 0.05)), this.V(sx * (half - 0.05), roofY + 0.1, sz * (half - 0.05)), 0.09, 0.08, 6), C.log);
    const pyr = (w: number, h: number, y: number, col: string) => kit.add(new THREE.ConeGeometry(w * 0.72, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0), col, { matrix: this.M(0, y, 0), jitter: 0.1 });
    pyr(PLAT + 1.8, 1.4, roofY - 0.1, C.thatchDark); pyr(PLAT + 1.8, 1.4, roofY + 0.05, C.thatch); pyr(PLAT + 0.8, 1.5, roofY + 0.6, C.thatchB); pyr(PLAT - 0.4, 1.4, roofY + 1.3, C.thatchLight);
    {
      const r = (PLAT + 1.8) * 0.72 * Math.SQRT1_2;   // the cone's square base half-side
      const edges: [number, number, number, number][] = [[-r, -r, r, -r], [r, -r, r, r], [r, r, -r, r], [-r, r, -r, -r]];
      for (const [x0, z0, x1, z1] of edges) {
        const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.16);
        for (let i = 0; i < n; i++) {
          const a = this.V(x0 + (x1 - x0) * (i / n), roofY - 0.08, z0 + (z1 - z0) * (i / n)), b = this.V(x0 + (x1 - x0) * ((i + 1) / n), roofY - 0.08, z0 + (z1 - z0) * ((i + 1) / n));
          const m = a.clone().lerp(b, 0.5).setY(roofY - 0.08 - rng.range(0.18, 0.4));
          kit.add(tris([a.x, a.y, a.z, b.x, b.y, b.z, m.x, m.y, m.z]), rng.next() < 0.5 ? C.thatchDark : C.thatchB, { jitter: 0.1 });
        }
      }
      kit.add(log(this.V(0, roofY + 2.5, 0), this.V(0, roofY + 3.3, 0), 0.07, 0.03, 5), C.post);
      kit.add(new THREE.OctahedronGeometry(0.12, 0), C.brass, { matrix: this.M(0, roofY + 3.35, 0) });
    }
    // ── the stair: log stringers, thick treads, posts + rope handrails, rope-wrapped posts at the foot ──
    const rise = H, run = rise * 1.25, steps = Math.round(rise / 0.28), z0 = -PLAT / 2;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps, y = platY - rise * t, z = z0 - run * t;
      kit.add(plank(stairW, run / steps + 0.08, 0.09, rng, 0.012), i % 2 ? C.plankB : C.plank, { matrix: this.M(0, y, z, 0, 0, rng.range(-0.02, 0.02)), jitter: 0.05 });
    }
    for (const s of [-1, 1]) {
      const top = this.V(s * (stairW / 2 + 0.07), platY - 0.2, z0), foot = this.V(s * (stairW / 2 + 0.07), 0, z0 - run - 0.2); foot.y = this.ground(foot.x, foot.z) - 0.1;
      kit.add(log(top, foot, 0.1, 0.1, 6), C.log);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5, p = this.V(s * (stairW / 2 + 0.07), platY - rise * t, z0 - run * t);
        kit.add(log(p.clone().add(new THREE.Vector3(0, -0.1, 0)), p.clone().add(new THREE.Vector3(0, 1.0, 0)), 0.06, 0.055, 5), C.log);
        pts.push(p.clone().add(new THREE.Vector3(0, 0.95, 0)));
      }
      for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; if (a && b) kit.add(rope(sagLine(a, b, 0.12, 4), 0.03), C.rope); }
      const fp = this.V(s * (stairW / 2 + 0.35), 0, z0 - run - 0.5); fp.y = this.ground(fp.x, fp.z);
      kit.add(log(fp.clone().add(new THREE.Vector3(0, -0.3, 0)), fp.clone().add(new THREE.Vector3(0, 1.3, 0)), 0.16, 0.14, 7), C.log);
      lash(fp.clone().add(new THREE.Vector3(0, 0.9, 0)), new THREE.Vector3(0, 1, 0), 0.15);
      collider(s * (stairW / 2 + 0.35), z0 - run - 0.5, 0.18, 0.18, fp.y - 1, fp.y + 1.3);
    }
    this.stair = { x0: z0, len: run, w: stairW, n: steps };
    // ── the banner (E310 T1 B): hung from the platform's front beam beside the stair, a pole through its head. A
    // swallowtail like the pier's pennant (E111): a V cut up into the foot, a navy trim down both sides, along the V and
    // round the pole, and faceted pleats (zigzag columns, flat-shaded, every other one a shade darker). The white diamond
    // and the two white bands are decals clipped to the cloth's own triangles and lifted a hair along its facing, so
    // they ride its folds and its sway and the cloth never pokes through them. Still one kit mesh, vertex colours.
    {
      const bx = -1.35, bw = 1.25, bh = 3.0, top = platY - 0.3, zf = -PLAT / 2 - 0.22;
      const notch = 0.5, trimW = 0.06, trimH = 0.075, sleeve = 0.08, straightTo = 2.2, pleats = 6;
      kit.add(log(this.V(bx - bw / 2 - 0.15, top + 0.05, zf), this.V(bx + bw / 2 + 0.15, top + 0.05, zf), 0.04, 0.04, 5), C.post);
      const sway = { w: 0.8, phase: 1.3, span: [top, top - bh] as [number, number] };
      const out = this.V(0, 0, -1).sub(this.V(0, 0, 0));                 // the cloth's front, world, unit
      // x runs from the banner's centre; the foot is a V, its tails at the hems and its apex `notch` up at the centre
      const foot = (x: number) => top - bh + notch * (1 - Math.abs((2 * x) / bw));
      const inner = bw / 2 - trimW, xs: number[] = [-bw / 2], zig: number[] = [-1];
      for (let k = 0; k <= pleats; k++) { xs.push(-inner + (k * 2 * inner) / pleats); zig.push(k % 2 ? 1 : -1); }
      xs.push(bw / 2); zig.push(-1);
      // row lines, top down: the sleeve, straight rows to `straightTo`, then two rows easing into the V's trim line, the foot
      const rowY: ((x: number) => number)[] = [top, top - sleeve, top - 0.45, top - 0.8, top - 1.15, top - 1.5, top - 1.85, top - straightTo].map((y) => () => y);
      const trimLine = (x: number) => foot(x) + trimH;
      rowY.push((x) => top - straightTo + (trimLine(x) - (top - straightTo)) * 0.5, trimLine, foot);
      // the cloth's depth out of the beam's plane: it hangs out 10 cm per metre, clear of the tower's face (which splays
      // out 7.7 cm per metre, its braces 10 cm proud), plus pleats that deepen toward the foot and a slow diagonal wave
      const depth = (x: number, y: number, z: number) => {
        const f = (top - y) / bh;
        return (top - y) * 0.1 + z * (0.018 + 0.035 * f) + Math.sin((x / bw + 0.5) * Math.PI * 2 + f * 2.2) * 0.03 * f;
      };
      interface Vert { x: number; y: number; w: THREE.Vector3 }
      const grid: Vert[][] = rowY.map((ry) => xs.map((x, c) => {
        const y = ry(x), [wx, wz] = this.toWorld(bx + x, zf - depth(x, y, zig[c] ?? 0));
        return { x, y, w: new THREE.Vector3(wx, y, wz) };
      }));
      type Tri = [Vert, Vert, Vert];
      const cloth: Tri[] = [], fill: Record<'trim' | 'a' | 'b', number[]> = { trim: [], a: [], b: [] };
      for (let r = 0; r + 1 < grid.length; r++) for (let c = 0; c + 1 < xs.length; c++) {
        const a = grid[r]?.[c], b = grid[r]?.[c + 1], d = grid[r + 1]?.[c + 1], g = grid[r + 1]?.[c];
        if (!a || !b || !d || !g) continue;
        const key = r === 0 || r === grid.length - 2 || c === 0 || c === xs.length - 2 ? 'trim' : c % 2 ? 'a' : 'b';
        for (const t of [[a, b, d], [a, d, g]] as Tri[]) { cloth.push(t); for (const q of t) fill[key].push(q.w.x, q.w.y, q.w.z); }
      }
      kit.add(tris(fill.a), C.banner, { jitter: 0.04, sway });
      kit.add(tris(fill.b), C.bannerB, { jitter: 0.04, sway });
      kit.add(tris(fill.trim), C.bannerTrim, { jitter: 0.03, sway });
      // a decal: a convex polygon in the banner's (x, y), cut to each cloth triangle and mapped onto it
      type P2 = [number, number];
      const side = (a: Vert, b: Vert, p: P2) => (b.x - a.x) * (p[1] - a.y) - (b.y - a.y) * (p[0] - a.x);
      const clip = (poly: P2[], a: Vert, b: Vert, r: Vert): P2[] => {
        const s = Math.sign(side(a, b, [r.x, r.y])), res: P2[] = [];
        if (s === 0) return res;
        let prev = poly[poly.length - 1];
        for (const q of poly) {
          if (prev) {
            const dp = side(a, b, prev) * s, dq = side(a, b, q) * s;
            if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); res.push([prev[0] + (q[0] - prev[0]) * t, prev[1] + (q[1] - prev[1]) * t]); }
            if (dq >= 0) res.push(q);
          }
          prev = q;
        }
        return res;
      };
      const decal = (poly: P2[], col: string, lift: number) => {
        const v: number[] = [];
        for (const [a, b, d] of cloth) {
          let p = clip(clip(clip(poly, a, b, d), b, d, a), d, a, b);
          if (p.length < 3) continue;
          const area = side(a, b, [d.x, d.y]);
          let pa = 0;
          for (let i = 0; i < p.length; i++) { const q = p[i], n = p[(i + 1) % p.length]; if (q && n) pa += q[0] * n[1] - n[0] * q[1]; }
          if (pa * area < 0) p = p.reverse();                         // keep the cloth triangle's winding
          const pts = p.map(([x, y]) => {
            const l0 = side(b, d, [x, y]) / area, l1 = side(d, a, [x, y]) / area, l2 = 1 - l0 - l1;
            return a.w.clone().multiplyScalar(l0).addScaledVector(b.w, l1).addScaledVector(d.w, l2).addScaledVector(out, lift);
          });
          const p0 = pts[0];
          if (!p0) continue;
          for (let i = 1; i + 1 < pts.length; i++) { const p1 = pts[i], p2 = pts[i + 1]; if (p1 && p2) v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z); }
        }
        kit.add(tris(v), col, { jitter: 0.02, sway });
      };
      // the sigil: a white diamond outline round a blue one round a small white one; the two white bands above the V
      const cy = top - 1.1;
      const dia = (s: number, col: string, lift: number) => decal([[0, cy + s * 1.4], [-s, cy], [0, cy - s * 1.4], [s, cy]], col, lift);
      dia(0.36, C.sigil, 0.012); dia(0.25, C.bannerDark, 0.02); dia(0.12, C.sigil, 0.028);
      for (const y of [top - 1.95, top - 2.12]) decal([[-inner + 0.04, y], [inner - 0.04, y], [inner - 0.04, y - 0.08], [-inner + 0.04, y - 0.08]], C.sigil, 0.012);
    }
    // ── the zipline post on the corner facing the sea cave, a pulley and the cable's first metres ──
    const cave = this.zipTo;
    const [zx, zz] = this.toWorld(e - 0.35, -e + 0.35);
    const zipYaw = Math.atan2(cave.x - zx, cave.z - zz);
    {
      const p = this.V(e - 0.35, platY, -e + 0.35);
      kit.add(log(p, p.clone().add(new THREE.Vector3(0, 2.9, 0)), 0.14, 0.12, 7), C.log);
      const dir = new THREE.Vector3(Math.sin(zipYaw), 0, Math.cos(zipYaw));
      const arm = p.clone().add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(dir, 0.6);
      kit.add(log(p.clone().add(new THREE.Vector3(0, 2.6, 0)), arm, 0.07, 0.07, 5), C.post);
      kit.add(new THREE.TorusGeometry(0.14, 0.04, 4, 10), C.iron, { matrix: new THREE.Matrix4().compose(arm.clone().add(new THREE.Vector3(0, -0.12, 0)), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-dir.z, 0, dir.x)), new THREE.Vector3(1, 1, 1)) });
      kit.add(rope([arm.clone().add(new THREE.Vector3(0, -0.2, 0)), arm.clone().add(new THREE.Vector3(0, -0.2, 0)).addScaledVector(dir, 6).add(new THREE.Vector3(0, -1.1, 0))], 0.025), C.iron);
      lash(p.clone().add(new THREE.Vector3(0, 2.6, 0)), new THREE.Vector3(0, 1, 0), 0.13);
      this.anchors['zipTop'] = { x: p.x, y: platY, z: p.z, yaw: zipYaw };
      collider(e - 0.35, -e + 0.35, 0.2, 0.2, platY, platY + 3);
    }
    // ── on the platform: a crate with a spyglass on it; at the foot: a signpost with a gull on it ──
    {
      kit.add(new THREE.BoxGeometry(0.6, 0.55, 0.6), C.crate, { matrix: this.M(-e + 0.45, platY + 0.27, -e + 0.45, 0.2), jitter: 0.06 });
      const a = this.V(-e + 0.45, platY + 0.62, -e + 0.3), b = this.V(-e + 0.55, platY + 0.62, -e + 0.75);
      kit.add(log(a, b, 0.045, 0.03, 6), C.brass);
      const sp = this.V(-1.6, 0, z0 - run - 1.4); sp.y = this.ground(sp.x, sp.z);
      kit.add(log(sp.clone().add(new THREE.Vector3(0, -0.3, 0)), sp.clone().add(new THREE.Vector3(0, 2.3, 0)), 0.09, 0.08, 6), C.post);
      kit.add(new THREE.BoxGeometry(1.2, 0.36, 0.08).translate(0.35, 0, 0), C.sign, { matrix: this.M(-1.6, sp.y + 1.9, z0 - run - 1.4, 0.4), jitter: 0.05 });
      kit.add(new THREE.ConeGeometry(0.19, 0.36, 3).rotateZ(-Math.PI / 2).translate(1.12, 0, 0), C.sign, { matrix: this.M(-1.6, sp.y + 1.9, z0 - run - 1.4, 0.4) });
      const gm = this.M(-1.6, sp.y + 2.3, z0 - run - 1.4, 0.8);
      kit.add(new THREE.IcosahedronGeometry(1, 1).scale(0.13, 0.12, 0.24).translate(0, 0.14, 0), C.gull, { matrix: gm });
      kit.add(new THREE.IcosahedronGeometry(0.085, 0).translate(0, 0.3, 0.14), C.gull, { matrix: gm });
      kit.add(new THREE.ConeGeometry(0.025, 0.12, 4).rotateX(Math.PI / 2).translate(0, 0.29, 0.26), C.beak, { matrix: gm });
      for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.04, 0.1, 0.3).rotateZ(s * 0.2).translate(s * 0.12, 0.17, -0.05), C.gullGrey, { matrix: gm });
      collider(-1.6, z0 - run - 1.4, 0.12, 0.12, sp.y - 1, sp.y + 2.5);
    }

    const geo = kit.finish({ ao: { ground: this.ground, cell: 0.2, strength: 0.6 } });

    const A = (lx: number, lz: number, y: number, yaw: number): LookoutAnchor => { const [x, z] = this.toWorld(lx, lz); return { x, y, z, yaw: this.spec.rot + yaw }; };
    this.anchors['beacon'] = A(e - 0.8, e - 0.8, platY, Math.PI);
    this.anchors['shard'] = A(-e + 0.8, e - 0.8, platY, Math.PI);
    const [fx, fz] = this.toWorld(0, z0 - run - 0.6);
    this.anchors['stairFoot'] = A(0, z0 - run - 0.6, this.ground(fx, fz), Math.PI);

    // ── into own space: the site's origin subtracted from everything built where it stands ──
    const o = this.o;
    geo.translate(-o.x, -o.y, -o.z); geo.computeBoundingSphere(); geo.computeBoundingBox();
    this.geometry = geo;
    this.descs = this.worldColliderDescs();
    for (const d of this.descs) {
      if (d.kind === 'treads') { for (const end of [d.from, d.to]) { end.x -= o.x; end.y -= o.y; end.z -= o.z; } } else { d.x -= o.x; d.y -= o.y; d.z -= o.z; }
    }
    for (const c of this.colliders) { c.x -= o.x; c.z -= o.z; c.yTop -= o.y; c.yBottom -= o.y; }
    for (const a of Object.values(this.anchors)) { a.x -= o.x; a.y -= o.y; a.z -= o.z; }
    this.platformY -= o.y;
    return this;
  }

  /** own-space colliders (see worldColliderDescs) */
  private descs: ColliderDesc[] = [];
  colliderDescs(): ColliderDesc[] { return this.descs; }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/engine/physics/pieces.ts turns it into Rapier colliders.
   * The platform is one slab whose top is the deck. The stair is the mesh's 0.28 m treads (the top one 0.095 m under
   * the deck), as wide as `floorHeightAt`'s stair (the stringers included). The headland rises over the stair's foot,
   * so the treads buried under the ground are left out: the stair starts at the first tread that stands above it.
   */
  private worldColliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.colliders.map((c) => boxDesc(c));
    const yaw = this.spec.rot, py = this.platformY, slab = 0.15, half = PLAT / 2 + 0.1;
    const at = (lx: number, y: number, lz: number) => { const [x, z] = this.toWorld(lx, lz); return { x, y, z }; };
    out.push({ kind: 'box', ...at(0, py - slab, 0), hx: half, hy: slab, hz: half, yaw });
    const { x0, len, w, n } = this.stair, rise = H / n, run = len / n, width = w + 0.2, top = py - rise / 2 + 0.045;
    const foot = x0 - len, footY = top - n * rise;
    // the first tread (from the foot) whose top is above the ground somewhere under it
    let k = 0;
    for (; k < n - 1; k++) {
      const y = footY + rise * (k + 1);
      let low = Infinity;
      for (const [u, v] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 0.5]] as const) {
        const [x, z] = this.toWorld(u * width / 2, foot + run * (k + v));
        low = Math.min(low, this.ground(x, z));
      }
      if (y > low) break;
    }
    out.push({ kind: 'treads', from: at(0, footY + rise * k, foot + run * k), to: at(0, top, x0), width, count: n - k });
    return out;
  }
}

/** The baked lookout: its geometry in own space and the layout the page reads back. */
export interface LookoutBake {
  readonly geometry: THREE.BufferGeometry;
  readonly layout: {
    readonly site: LookoutSite;
    readonly zipTo: { readonly x: number; readonly z: number };
    readonly origin: { x: number; y: number; z: number };
    readonly platformY: number;
    readonly colliders: Collider[];
    readonly descs: ColliderDesc[];
    readonly anchors: Record<string, LookoutAnchor>;
    readonly floor: { readonly cos: number; readonly sin: number; readonly plat: number; readonly h: number; readonly stair: { x0: number; len: number; w: number } };
  };
}

/** Builds the tower on its site over the native terrain (`ground`, world xz → y), its pulley facing `zipTo`. */
export function lookoutBake(site: LookoutSite, ground: (x: number, z: number) => number, zipTo: { readonly x: number; readonly z: number }): LookoutBake {
  const origin = { x: site.x, y: Math.fround(ground(site.x, site.z)), z: site.z };
  const b = new LookoutBuilder(site, ground, zipTo, origin).build();
  if (b.geometry === null) throw new Error('lookout: no geometry');
  const { x0, len, w } = b.stair;
  return {
    geometry: b.geometry,
    layout: { site, zipTo, origin, platformY: b.platformY, colliders: b.colliders, descs: b.colliderDescs(), anchors: b.anchors,
      floor: { cos: b.cos, sin: b.sin, plat: PLAT, h: H, stair: { x0, len, w } } },
  };
}
