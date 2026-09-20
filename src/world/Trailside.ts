/**
 * Trailside — the wooden dressing along Driftwood Isle's sand paths: rope fences (posts with a
 * sagging rope), plank steps set into the steeper climbs, and signposts with arrow boards at the
 * forks. Flat-shaded vertex colours, one mesh; fence posts and signposts collide, steps are
 * decoration on the walkable slope.
 *
 *   const trailside = new Trailside(sky).build({ fences, steps, signs });
 *   scene.add(trailside.mesh); player.colliders.push(...trailside.colliders);
 *
 * `Trailside.forIsland()` is Driftwood's layout: fences along the plateau ramp and the plateau's
 * seaward rim, steps up the plateau ramp and the headland ramp, signposts at the pier landing and
 * the hut fork.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface FenceSpec { path: [number, number][]; spacing?: number }
export interface StepsSpec { from: [number, number]; to: [number, number]; width?: number }
export interface SignSpec { x: number; z: number; /** arrow boards: heading in radians (0 = +z) and which side of the post */ arrows: { toward: number }[] }
export interface TrailsideSpec { fences: FenceSpec[]; steps: StepsSpec[]; signs: SignSpec[] }

const C = {
  post: new THREE.Color('#6f5638'), postTop: new THREE.Color('#8a6d48'), rope: new THREE.Color('#d2bd85'),
  plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), board: new THREE.Color('#b8925f'), boardEdge: new THREE.Color('#6a4e33'),
};

export class Trailside {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];

  constructor(private sky: Sky) {}

  /** Driftwood Isle's layout (see the PATHS / PLATEAU / HEADLAND constants in the def) */
  static forIsland(): TrailsideSpec {
    return {
      fences: [
        // both sides of the plateau ramp (the path runs x = −30 from z = −142 up to −104)
        { path: [[-36, -144], [-36, -128], [-36, -112], [-35, -100]] },
        { path: [[-24, -144], [-24, -128], [-24, -112], [-25, -100]] },
        // the plateau's seaward rim, from the ramp top round the south-east
        { path: [[-20, -98], [-6, -100], [6, -94], [14, -82], [18, -68], [16, -52]] },
        // the headland ramp's outer edge
        { path: [[40, 40], [50, 50], [60, 58], [70, 68], [80, 78]] },
      ],
      steps: [
        { from: [-30, -140], to: [-30, -106] },
        { from: [46, 46], to: [86, 86] },
      ],
      signs: [
        { x: 5, z: -184, arrows: [{ toward: 2.9 }, { toward: 0.6 }] },     // pier landing: ← hut, ↗ lookout
        { x: -14, z: -62, arrows: [{ toward: 0.9 }, { toward: 2.5 }] },    // hut fork: → lookout / wreck, ↖ shrine
      ],
    };
  }

  build(spec: TrailsideSpec): this {
    const rng = new Rng(SEED ^ 0x7a11);
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.06) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    };
    const beam = (a: THREE.Vector3, b: THREE.Vector3, r: number, col: THREE.Color) => {
      const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r, r, len, 4, 1, true);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate(a.x, a.y, a.z);
      add(g, col, 0.04);
    };

    // ── rope fences: a post every `spacing` metres along the polyline, rope in three sagging pieces ──
    for (const f of spec.fences) {
      const spacing = f.spacing ?? 2.6;
      const posts: THREE.Vector3[] = [];
      for (let i = 0; i < f.path.length - 1; i++) {
        const pa = f.path[i], pb = f.path[i + 1];
        if (!pa || !pb) continue;
        const [ax, az] = pa, [bx, bz] = pb;
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / spacing));
        for (let k = i === 0 ? 0 : 1; k <= n; k++) { const t = k / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; posts.push(new THREE.Vector3(x, heightAt(x, z), z)); }
      }
      for (const p of posts) {
        add(new THREE.CylinderGeometry(0.09, 0.11, 1.4, 6).translate(p.x, p.y + 0.5, p.z), C.post, 0.06);
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6).translate(p.x, p.y + 1.2, p.z), C.postTop, 0.04);
        this.colliders.push({ x: p.x, z: p.z, hw: 0.12, hd: 0.12, rot: 0, yTop: p.y + 1.2, yBottom: p.y - 1 });
      }
      for (let i = 0; i < posts.length - 1; i++) {
        const pa = posts[i], pb = posts[i + 1];
        if (!pa || !pb) continue;
        const a = pa.clone().setY(pa.y + 1.05), b = pb.clone().setY(pb.y + 1.05);
        const m1 = a.clone().lerp(b, 0.33), m2 = a.clone().lerp(b, 0.67); m1.y -= 0.16; m2.y -= 0.16;
        beam(a, m1, 0.03, C.rope); beam(m1, m2, 0.03, C.rope); beam(m2, b, 0.03, C.rope);
      }
    }
    // ── plank steps: treads every 0.7 m along a climb, each let into the slope ──
    for (const s of spec.steps) {
      const w = s.width ?? 2.4;
      const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1], len = Math.hypot(dx, dz), n = Math.floor(len / 0.7);
      const ang = Math.atan2(dx, dz);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = s.from[0] + dx * t, z = s.from[1] + dz * t;
        const y = heightAt(x, z);
        const g = new THREE.BoxGeometry(w, 0.14, 0.42); g.rotateY(ang); g.translate(x, y + 0.02, z);
        add(g, i % 2 ? C.plankDark : C.plank, 0.05);
      }
      for (const side of [-1, 1]) {
        const ox = Math.cos(ang) * side * (w / 2 + 0.05), oz = -Math.sin(ang) * side * (w / 2 + 0.05);
        const g = new THREE.BoxGeometry(0.12, 0.18, len + 0.4);
        const a = new THREE.Vector3(s.from[0] + ox, heightAt(s.from[0] + ox, s.from[1] + oz) + 0.1, s.from[1] + oz), b = new THREE.Vector3(s.to[0] + ox, heightAt(s.to[0] + ox, s.to[1] + oz) + 0.1, s.to[1] + oz);
        g.translate(0, 0, (len + 0.4) / 2);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()));
        g.translate(a.x, a.y, a.z);
        add(g, C.plankDark, 0.05);
      }
    }
    // ── signposts: a post with an arrow board per direction, stacked ──
    for (const sg of spec.signs) {
      const y = heightAt(sg.x, sg.z);
      add(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6).translate(sg.x, y + 1.1, sg.z), C.post, 0.06);
      sg.arrows.forEach((a, i) => {
        const by = y + 2.1 - i * 0.42;
        // an arrow board: a box with a wedge tip, pointing along `toward`
        const board = new THREE.BoxGeometry(0.9, 0.3, 0.06); board.translate(0.45 + 0.1, 0, 0);
        const tip = new THREE.ConeGeometry(0.19, 0.3, 4); tip.rotateZ(-Math.PI / 2); tip.rotateX(Math.PI / 4); tip.translate(1.15, 0, 0);
        for (const g of [board, tip]) { g.rotateY(a.toward - Math.PI / 2); g.translate(sg.x, by, sg.z); add(g, C.board, 0.05); }
        const edge = new THREE.BoxGeometry(0.92, 0.04, 0.08); edge.translate(0.55, -0.16, 0); edge.rotateY(a.toward - Math.PI / 2); edge.translate(sg.x, by, sg.z); add(edge, C.boardEdge, 0.04);
      });
      this.colliders.push({ x: sg.x, z: sg.z, hw: 0.12, hd: 0.12, rot: 0, yTop: y + 2.4, yBottom: y - 1 });
    }

    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    return this;
  }
}
