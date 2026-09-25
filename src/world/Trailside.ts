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
import { boxDesc, type ColliderDesc } from './registry';

export interface FenceSpec { path: [number, number][]; spacing?: number }
export interface StepsSpec { from: [number, number]; to: [number, number]; width?: number }
/** a trestle stair down a cliff the path crosses: straight from the top (on the upper ground) to the bottom (on the path below) */
export interface FlightSpec { top: [number, number]; bottom: [number, number]; width?: number }
export interface SignSpec { x: number; z: number; /** arrow boards: heading in radians (0 = +z) and which side of the post */ arrows: { toward: number }[] }
export interface TrailsideSpec { fences: FenceSpec[]; steps: StepsSpec[]; signs: SignSpec[]; flights?: FlightSpec[] }

const C = {
  post: new THREE.Color('#6f5638'), postTop: new THREE.Color('#8a6d48'), rope: new THREE.Color('#d2bd85'),
  plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), board: new THREE.Color('#b8925f'), boardEdge: new THREE.Color('#6a4e33'),
};

/** a polyline moved `d` m to its left (negative: right), for fences either side of a path's centreline */
function offset(path: [number, number][], d: number): [number, number][] {
  return path.map(([x, z], i) => {
    const a = path[Math.max(0, i - 1)] ?? [x, z], b = path[Math.min(path.length - 1, i + 1)] ?? [x, z];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [x - (dz / l) * d, z + (dx / l) * d];
  });
}

export class Trailside {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private steps: StepsSpec[] = [];
  private flights: FlightSpec[] = [];

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
        // the headland ramp's outer (south-east) edge, 1.8 m off the steps' centreline (x = z), clear of their 2.4 m
        { path: [[41.3, 38.7], [51.3, 48.7], [61.3, 58.7], [71.3, 68.7], [81.3, 78.7]] },
        // (M4) rope fences along the other paths' open stretches: both sides of the shrine approach, the wreck path's
        // seaward side, the pier landing's dune path, the hut → lookout path over the flats
        { path: offset([[-72, 20], [-80, 45], [-88, 70], [-94, 88]], 3.4) },
        { path: offset([[-72, 20], [-80, 45], [-88, 70], [-94, 88]], -3.4) },
        { path: offset([[62, 0], [80, -1.5], [100, -2], [124, 1.5]], -3.4), spacing: 3.2 },
        // the pier's landing (Pier landing: the deck steps down onto the sand at z ≈ −152): rope fences lead off it
        { path: [[2.9, -151], [2.9, -146], [-1.5, -141], [-10, -138]] },
        { path: [[-2.9, -151], [-6.5, -147.5], [-15, -146], [-22, -142]] },
        { path: offset([[-8, -50], [14, -24], [17, 8]], 3.4), spacing: 3.2 },
      ],
      steps: [
        { from: [-30, -140], to: [-30, -106] },
        { from: [46, 46], to: [86, 86] },
      ],
      // the hut plateau's rim where the lookout and shrine paths leave it: a 12 m cliff each, inside the Blender cove
      // (its ground is baked, so no grading there — PHYSICS.md §P9b, the user's pick: trestle stairs). Lines found by a
      // search for the lowest stair (≤ 35°) whose treads never sink into the rock.
      flights: [
        { top: [10.8, -27.8], bottom: [15.4, -8.6] },
        { top: [-52, -30], bottom: [-61.7, -5.9] },
      ],
      signs: [
        { x: 5, z: -150, arrows: [{ toward: 2.9 }, { toward: 0.6 }] },     // pier landing (on the sand): ← hut, ↗ lookout
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
      // thick weathered pilings, a rope lashing under the cap, the rope sagging in a catenary between them (E43)
      for (const p of posts) {
        const tilt = rng.range(-0.06, 0.06);
        add(new THREE.CylinderGeometry(0.13, 0.16, 1.55, 6).rotateZ(tilt).translate(p.x, p.y + 0.45, p.z), C.post, 0.08);
        add(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 6).translate(p.x, p.y + 1.22, p.z), C.postTop, 0.04);
        for (let r = 0; r < 3; r++) add(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 6).translate(p.x, p.y + 1.0 - r * 0.08, p.z), r === 1 ? C.postTop : C.rope, 0.04);
        this.colliders.push({ x: p.x, z: p.z, hw: 0.16, hd: 0.16, rot: 0, yTop: p.y + 1.2, yBottom: p.y - 1 });
      }
      for (let i = 0; i < posts.length - 1; i++) {
        const pa = posts[i], pb = posts[i + 1];
        if (!pa || !pb) continue;
        const a = pa.clone().setY(pa.y + 1.0), b = pb.clone().setY(pb.y + 1.0);
        const seg = 6, sag = 0.1 + a.distanceTo(b) * 0.06;
        let prev = a;
        for (let k = 1; k <= seg; k++) {
          const t = k / seg, q = a.clone().lerp(b, t); q.y -= sag * 4 * t * (1 - t);
          beam(prev, q, 0.035, C.rope); prev = q;
        }
      }
    }
    // ── plank steps: treads every 0.7 m along a climb, each let into the slope ──
    // A tread rolls with the ground across it (E118): where a climb crosses a hillside — the headland ramp past its crest —
    // a level tread at its centre's height sank its uphill end into the sand. The side rails follow the ground in short
    // runs instead of one straight beam from the bottom to the top (that one went metres under the crest).
    this.steps = spec.steps;
    for (const s of spec.steps) {
      const w = s.width ?? 2.4;
      const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1], len = Math.hypot(dx, dz), n = Math.floor(len / 0.7);
      const ang = Math.atan2(dx, dz), ax = Math.cos(ang), az = -Math.sin(ang); // the tread's local +x (across), in the world
      const at = (t: number): [number, number] => [s.from[0] + dx * t, s.from[1] + dz * t];
      for (let i = 0; i <= n; i++) {
        const [x, z] = at(i / n), hw = w / 2;
        const lo = heightAt(x - ax * hw, z - az * hw), hi = heightAt(x + ax * hw, z + az * hw);
        const y = Math.max(heightAt(x, z), (lo + hi) / 2);
        const g = new THREE.BoxGeometry(w, 0.14, 0.42); g.rotateZ(Math.atan2(hi - lo, w)); g.rotateY(ang); g.translate(x, y + 0.02, z);
        add(g, i % 2 ? C.plankDark : C.plank, 0.05);
      }
      const runs = Math.max(1, Math.round(len / 2.8));
      for (const side of [-1, 1]) {
        const o = side * (w / 2 + 0.05);
        const rail = (t: number): THREE.Vector3 => { const [x, z] = at(t), rx = x + ax * o, rz = z + az * o; return new THREE.Vector3(rx, heightAt(rx, rz) + 0.1, rz); };
        for (let r = 0; r < runs; r++) {
          const a = rail(r / runs), b = rail((r + 1) / runs), l = a.distanceTo(b) + 0.06;
          const g = new THREE.BoxGeometry(0.12, 0.18, l);
          g.translate(0, 0, l / 2 - 0.03);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()));
          g.translate(a.x, a.y, a.z);
          add(g, C.plankDark, 0.05);
        }
      }
    }
    // ── trestle stairs: treads on two stringers, posts down to the ground every ~2.4 m, a handrail each side ──
    this.flights = spec.flights ?? [];
    for (const f of this.flights) {
      const fl = flightOf(f), { ux, uz, sx, sz, w, m, run, rise } = fl;
      const at = (al: number, ac: number, y: number) => new THREE.Vector3(f.bottom[0] + ux * al + sx * ac, y, f.bottom[1] + uz * al + sz * ac);
      const yaw = Math.atan2(ux, uz);
      for (let i = 0; i < m; i++) {
        const c = at((i + 0.5) * run, 0, fl.yb + (i + 1) * rise - 0.035);
        const g = new THREE.BoxGeometry(w + rng.range(-0.03, 0.03), 0.07, run + 0.04); g.rotateY(yaw); g.translate(c.x, c.y, c.z);
        add(g, i % 3 === 0 ? C.plankDark : C.plank, 0.05);
      }
      const len = fl.len, slope = rise / run;
      for (const s of [-1, 1]) {
        const ac = s * (w / 2 + 0.07);
        // the stringer under the tread ends, then posts to the ground and a rail 1 m over the treads
        beam(at(-0.2, ac, fl.yb - 0.12), at(len + 0.1, ac, fl.yt - 0.1), 0.09, C.plankDark);
        beam(at(0, ac, fl.yb + 0.95), at(len, ac, fl.yt + 0.95), 0.045, C.plankDark);
        const n = Math.max(2, Math.ceil(len / 2.4));
        for (let k = 0; k <= n; k++) {
          const al = (k / n) * len, y = fl.yb + al * slope, p = at(al, ac, y), g = heightAt(p.x, p.z);
          beam(new THREE.Vector3(p.x, Math.min(g, y) - 0.4, p.z), new THREE.Vector3(p.x, y + 1.0, p.z), 0.08, C.post);
        }
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

  /**
   * PHYSICS P4: this builder's static collision in world space — the fence posts and signposts (the legacy boxes)
   * and, walkable for the first time, the plank steps. src/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.colliders.map((c) => boxDesc(c));
    for (const s of this.steps) out.push(...stepTreads(s));
    for (const f of this.flights) {
      const fl = flightOf(f), { ux, uz, sx, sz, w, m } = fl;
      // the treads (solid down to the foot of the flight), and a rail each side along the slope, 1.1 m over them
      out.push({ kind: 'treads', from: { x: f.bottom[0], y: fl.yb, z: f.bottom[1] }, to: { x: f.bottom[0] + ux * fl.len, y: fl.yt, z: f.bottom[1] + uz * fl.len }, width: w, count: m });
      const pitch = Math.atan2(fl.yt - fl.yb, fl.len), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, Math.atan2(ux, uz), 0, 'YXZ'));
      for (const s of [-1, 1]) {
        const ac = s * (w / 2 + 0.07), mx = f.bottom[0] + ux * fl.len / 2 + sx * ac, mz = f.bottom[1] + uz * fl.len / 2 + sz * ac;
        out.push({ kind: 'box', x: mx, y: (fl.yb + fl.yt) / 2 + 0.55, z: mz, hx: 0.06, hy: 0.6, hz: Math.hypot(fl.len, fl.yt - fl.yb) / 2, rot: { x: q.x, y: q.y, z: q.z, w: q.w } });
      }
    }
    return out;
  }
}

/** A flight's frame: along (bottom → top) and across unit vectors, its width, tread count, run and rise per tread. */
function flightOf(f: FlightSpec) {
  const dx = f.top[0] - f.bottom[0], dz = f.top[1] - f.bottom[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const yb = heightAt(f.bottom[0], f.bottom[1]), yt = heightAt(f.top[0], f.top[1]) + 0.02;
  // risers ≤ 0.28 m and treads ≥ 0.36 m deep (the character's stair rule, below)
  const m = Math.max(1, Math.ceil((yt - yb) / 0.28));
  return { ux, uz, sx: uz, sz: -ux, len, yb, yt, w: f.width ?? 1.8, m, run: len / m, rise: (yt - yb) / m };
}

/**
 * The character's stair rule (CharacterMotor: 0.38 m capsule, autostep 0.35 m), measured on Rapier: a tread under
 * 0.35 m deep lets the capsule's sphere rest on the next tread's edge at a 45° contact and it jams, whatever the rise;
 * from 0.354 m deep it climbs every rise to 0.33 m. So: treads ≥ 0.354 m deep, risers ≤ 0.32 m.
 */
const TREAD_RUN = 0.354, TREAD_RISE = 0.32, MAX_LIFT = 0.3;

/**
 * A flight of plank steps as solid treads. The planks follow the ground (a plank every ~0.7 m, its top 9 cm over
 * `heightAt` at its centre), and the plateau ramp's ground climbs at up to ~46° (0.73 m from one plank to the next),
 * past the character's 40° / 0.35 m. So the flight is cut into equal treads ≥ 0.354 m deep (two per plank gap), each
 * at the plank line (the drawn plank tops, joined) or 3 cm over the ground under its middle 1.2 m (where the capsule
 * walks), whichever is higher, so no slope between two planks pokes through as a wedge the capsule can't climb. Where
 * that still leaves a riser over 0.32 m (the 46° stretch rises ~0.37 m a tread) the treads before it are lifted, by at
 * most 0.3 m, until every riser is ≤ 0.32 m: the stair eases into the steep bit a little above the planks. A riser that
 * needs more lift than that is a cliff (the headland flight crosses two, 1–1.9 m between planks) and stays a wall, as
 * the ground is. Every tread is a solid box down to 0.3 m under the lowest ground at its corners, so none floats.
 */
function stepTreads(s: StepsSpec): ColliderDesc[] {
  const w = s.width ?? 2.4, hx = w / 2;
  const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1], len = Math.hypot(dx, dz), n = Math.floor(len / 0.7);
  if (n < 1) return [];
  const ux = dx / len, uz = dz / len, yaw = Math.atan2(dx, dz), gap = len / n;
  const ground = (al: number, ac: number) => heightAt(s.from[0] + ux * al + uz * ac, s.from[1] + uz * al - ux * ac);
  const plank: number[] = [];
  for (let i = 0; i <= n; i++) plank.push(ground(gap * i, 0) + 0.09);   // the drawn plank: y + 0.02, 0.14 thick
  const plankLine = (al: number) => {
    const f = Math.min(n, Math.max(0, al / gap)), i = Math.min(n - 1, Math.floor(f)), t = f - i;
    return (plank[i] ?? 0) * (1 - t) + (plank[i + 1] ?? 0) * t;
  };
  // equal treads from the first plank's front edge to the last plank's back edge
  const start = -0.21, span = len + 0.42, m = Math.max(1, Math.floor(span / TREAD_RUN)), run = span / m;
  const need: number[] = [], top: number[] = [];
  for (let i = 0; i < m; i++) {
    const a = start + i * run, b = a + run;
    let y = plankLine(a + run / 2);
    for (const al of [a, a + run / 2, b]) for (const ac of [-0.6, 0, 0.6]) y = Math.max(y, ground(al, ac) + 0.03);
    need.push(y); top.push(y);
  }
  // ease the steep bits: lift a tread (≤ MAX_LIFT) so neither neighbour is more than TREAD_RISE above it
  for (let i = 1; i < m; i++) top[i] = Math.min((need[i] ?? 0) + MAX_LIFT, Math.max(top[i] ?? 0, (top[i - 1] ?? 0) - TREAD_RISE));
  for (let i = m - 2; i >= 0; i--) top[i] = Math.min((need[i] ?? 0) + MAX_LIFT, Math.max(top[i] ?? 0, (top[i + 1] ?? 0) - TREAD_RISE));
  const out: ColliderDesc[] = [];
  for (let i = 0; i < m; i++) {
    const a = start + i * run, b = a + run, y = top[i] ?? 0, mid = (a + b) / 2;
    let lo = y;
    for (const al of [a, b]) for (const ac of [-hx, hx]) lo = Math.min(lo, ground(al, ac));
    const hy = (y - (lo - 0.3)) / 2;
    out.push({ kind: 'box', x: s.from[0] + ux * mid, y: y - hy, z: s.from[1] + uz * mid, hx, hy, hz: run / 2, yaw });
  }
  return out;
}
