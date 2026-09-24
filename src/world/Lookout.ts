/**
 * Lookout — the watchtower on the headland summit (Driftwood Isle, remaster M2): four heavy splayed log posts with
 * X-bracing and rope lashings at every joint, a thick plank platform with a braced railing, a layered thatch roof with a
 * ragged fringe and a finial, the big blue Wildshard banner (white diamond) hung from the platform's front beside the
 * stair, a straight stair with rope handrails (walkable ramp), a zipline post with its pulley on the corner facing the
 * sea cave, a crate + spyglass on the platform, a gull signpost and rope-wrapped posts at the stair foot.
 * One LowPolyKit mesh on lowPolyMaterial (voxel AO).
 *
 *   const lookout = new Lookout(sky, { x, z, rot }).build();   // rot: which side the stair descends toward
 *   scene.add(lookout.group); player.colliders.push(...lookout.colliders);
 *   player.platforms.push((x, z) => lookout.floorHeightAt(x, z));
 *
 * Frame: world = origin + R_y(rot) · local; the stair runs down local −z. `anchors` (world coords, y = platform unless
 * noted, yaw = world facing, 0 = +Z): beacon (the back-right corner of the platform), shard (the back-left corner),
 * zipTop (the zipline post's foot on the platform corner facing the sea cave, yaw = toward the cave; the cable leaves
 * the pulley 2.5 m above it), stairFoot (y = ground).
 */
import * as THREE from 'three';
import { heightAt } from './Heightfield';
import { SEED } from '../core/config';
import { LowPolyKit, log, plank, rope, sagLine, tris, lowPolyMaterial } from './lowpolyKit';
import { Cove } from './Cove';
import { swayDepthMaterial } from './wind';
import type { Collider } from '../player/Player';
import { boxDesc, type ColliderDesc } from './registry';
import type { Sky } from './Sky';

export interface LookoutSpec { x: number; z: number; rot: number }
export interface LookoutAnchor { x: number; y: number; z: number; yaw: number }

const C = {
  post: '#6a4e33', log: '#735438', plank: '#a58056', plankB: '#8f6d47', plankDark: '#6f5335', rope: '#bfa274',
  thatch: '#c9a355', thatchB: '#b89346', thatchDark: '#9c7a38', thatchLight: '#dcbb6c',
  banner: '#2f5bd0', bannerB: '#2750bd', bannerDark: '#1c3c96', sigil: '#e8f0ff', iron: '#3a3c42', brass: '#c49a45', crate: '#a47b4b', sign: '#9a7550',
  gull: '#eceae4', gullGrey: '#9aa0a8', beak: '#e0a83a',
};

const PLAT = 4.4, H = 7.0;

export class Lookout {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  anchors: Record<string, LookoutAnchor> = {};
  platformY = 0;
  private cos = 1; private sin = 0;
  private stair = { x0: 0, len: 0, w: 1.5, n: 0 };

  constructor(private sky: Sky, private spec: LookoutSpec) { this.cos = Math.cos(spec.rot); this.sin = Math.sin(spec.rot); }
  private toWorld(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cos + lz * this.sin, this.spec.z - lx * this.sin + lz * this.cos]; }
  private V(lx: number, y: number, lz: number): THREE.Vector3 { const [x, z] = this.toWorld(lx, lz); return new THREE.Vector3(x, y, z); }
  private M(lx: number, y: number, lz: number, yaw = 0, rx = 0, rz = 0): THREE.Matrix4 {
    const [x, z] = this.toWorld(lx, lz);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, this.spec.rot + yaw, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  }

  build(): this {
    const kit = new LowPolyKit(SEED ^ 0x100c), rng = kit.rng;
    const ground = heightAt(this.spec.x, this.spec.z);
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
      foot.y = heightAt(foot.x, foot.z) - 0.5;
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
      const top = this.V(s * (stairW / 2 + 0.07), platY - 0.2, z0), foot = this.V(s * (stairW / 2 + 0.07), 0, z0 - run - 0.2); foot.y = heightAt(foot.x, foot.z) - 0.1;
      kit.add(log(top, foot, 0.1, 0.1, 6), C.log);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5, p = this.V(s * (stairW / 2 + 0.07), platY - rise * t, z0 - run * t);
        kit.add(log(p.clone().add(new THREE.Vector3(0, -0.1, 0)), p.clone().add(new THREE.Vector3(0, 1.0, 0)), 0.06, 0.055, 5), C.log);
        pts.push(p.clone().add(new THREE.Vector3(0, 0.95, 0)));
      }
      for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; if (a && b) kit.add(rope(sagLine(a, b, 0.12, 4), 0.03), C.rope); }
      const fp = this.V(s * (stairW / 2 + 0.35), 0, z0 - run - 0.5); fp.y = heightAt(fp.x, fp.z);
      kit.add(log(fp.clone().add(new THREE.Vector3(0, -0.3, 0)), fp.clone().add(new THREE.Vector3(0, 1.3, 0)), 0.16, 0.14, 7), C.log);
      lash(fp.clone().add(new THREE.Vector3(0, 0.9, 0)), new THREE.Vector3(0, 1, 0), 0.15);
      collider(s * (stairW / 2 + 0.35), z0 - run - 0.5, 0.18, 0.18, fp.y - 1, fp.y + 1.3);
    }
    this.stair = { x0: z0, len: run, w: stairW, n: steps };
    // ── the banner: hung from the platform's front beam beside the stair, a pole through its head, a white diamond ──
    {
      const bx = -1.35, bw = 1.25, bh = 3.0, top = platY - 0.3, zf = -PLAT / 2 - 0.22;
      kit.add(log(this.V(bx - bw / 2 - 0.15, top + 0.05, zf), this.V(bx + bw / 2 + 0.15, top + 0.05, zf), 0.04, 0.04, 5), C.post);
      const cols = 4, rows = 7, v: number[] = [];
      const P = (u: number, f: number): number[] => {
        const x = bx - bw / 2 + u * bw, y = top - f * bh + (f > 0.9 ? -Math.abs(u - 0.5) * 0.9 * (f - 0.9) * 10 * 0.1 : 0);
        const wv = Math.sin(u * Math.PI * 2 + f * 2.2) * 0.07 * f;
        const [wx, wz] = this.toWorld(x, zf - wv);
        return [wx, f === 1 ? y - (0.5 - Math.abs(u - 0.5)) * 0.5 : y, wz];
      };
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const u0 = c / cols, u1 = (c + 1) / cols, f0 = r / rows, f1 = (r + 1) / rows;
        v.push(...P(u0, f0), ...P(u1, f0), ...P(u1, f1), ...P(u0, f0), ...P(u1, f1), ...P(u0, f1));
      }
      const bSpan: [number, number] = [top, top - bh];
      kit.add(tris(v), C.banner, { jitter: 0.04, sway: { w: 0.8, phase: 1.3, span: bSpan } });
      // the sigil: a diamond outline + a small solid diamond, a hair proud of the cloth, and a white wave band at the foot
      const cy = top - bh * 0.42, n = this.V(0, 0, -1).sub(this.V(0, 0, 0)).normalize().multiplyScalar(0.03);
      const dia = (s: number, col: string, dz: number) => {
        const p = (x: number, y: number) => { const w = this.V(bx + x, y, zf); return [w.x + n.x * dz, y, w.z + n.z * dz]; };
        kit.add(tris([...p(0, cy + s * 1.4), ...p(-s, cy), ...p(s, cy), ...p(-s, cy), ...p(0, cy - s * 1.4), ...p(s, cy)]), col, { jitter: 0.02, sway: { w: 0.8, phase: 1.3, span: [top, top - bh] } });
      };
      dia(0.36, C.sigil, 1.2); dia(0.25, C.bannerDark, 1.6); dia(0.12, C.sigil, 2.0);
      for (const y of [top - bh * 0.82, top - bh * 0.9]) {
        const p = (x: number, yy: number) => { const w = this.V(bx + x, yy, zf); return [w.x + n.x * 1.2, yy, w.z + n.z * 1.2]; };
        kit.add(tris([...p(-bw / 2 + 0.05, y), ...p(bw / 2 - 0.05, y), ...p(bw / 2 - 0.05, y - 0.08), ...p(-bw / 2 + 0.05, y), ...p(bw / 2 - 0.05, y - 0.08), ...p(-bw / 2 + 0.05, y - 0.08)]), C.sigil, { jitter: 0.02, sway: { w: 0.8, phase: 1.3, span: [top, top - bh] } });
      }
    }
    // ── the zipline post on the corner facing the sea cave, a pulley and the cable's first metres ──
    const cave = Cove.forIsland().cave;
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
      const sp = this.V(-1.6, 0, z0 - run - 1.4); sp.y = heightAt(sp.x, sp.z);
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

    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.2, strength: 0.6 } });
    this.mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = swayDepthMaterial();   // the banner's shadow moves with it (M5)
    this.group.add(this.mesh);

    const A = (lx: number, lz: number, y: number, yaw: number): LookoutAnchor => { const [x, z] = this.toWorld(lx, lz); return { x, y, z, yaw: this.spec.rot + yaw }; };
    this.anchors['beacon'] = A(e - 0.8, e - 0.8, platY, Math.PI);
    this.anchors['shard'] = A(-e + 0.8, e - 0.8, platY, Math.PI);
    const [fx, fz] = this.toWorld(0, z0 - run - 0.6);
    this.anchors['stairFoot'] = A(0, z0 - run - 0.6, heightAt(fx, fz), Math.PI);
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry. src/physics/pieces.ts turns it into Rapier colliders.
   * The platform is one slab whose top is the deck. The stair is the mesh's 0.28 m treads (the top one 0.095 m under
   * the deck), as wide as `floorHeightAt`'s stair (the stringers included). The headland rises over the stair's foot,
   * so the treads buried under the ground are left out: the stair starts at the first tread that stands above it.
   */
  colliderDescs(): ColliderDesc[] {
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
        low = Math.min(low, heightAt(x, z));
      }
      if (y > low) break;
    }
    out.push({ kind: 'treads', from: at(0, footY + rise * k, foot + run * k), to: at(0, top, x0), width, count: n - k });
    return out;
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
