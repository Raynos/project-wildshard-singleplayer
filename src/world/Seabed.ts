/**
 * Seabed — decorative dressing for the lagoon floor of an open-water shard (Driftwood Isle): faceted low-poly coral
 * clumps in pastel pink / orange / purple / cream (four shapes: brain domes, staghorn branches, fan plates, tube
 * clusters), beds of seaweed fronds that sway in the vertex shader (per-vertex weight + phase, like Palms), and a few
 * starfish on the sand. Everything is ONE flat-shaded vertex-coloured mesh (one draw call, ~15k tris at the default
 * count); nothing collides (you swim through it — underwater is decorative, no underworld).
 *
 *   const seabed = new Seabed(sky).build(Seabed.scatterLagoon(seed));   // where the water is 1.5–8 m deep
 *   scene.add(seabed.mesh);
 *   game.onUpdate((dt) => seabed.update(dt));                           // the sway clock
 *
 * Optional: `seabed.fish` — a small instanced school of faceted fish (one more draw call) that circles a lissajous
 * path over the reef; built by `build()` when `specs` has a `school` entry (scatterLagoon adds one).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { heightAt, normalAt, inChunk } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { getActiveChunk } from '../chunks/registry';
import { Rng } from '../core/rng';
import { Noise2D } from '../core/noise';
import type { Sky } from './Sky';

export type SeabedKind = 'coral' | 'weed' | 'star';
export interface SeabedSpec { kind: SeabedKind; x: number; z: number; s: number; rot: number; v: number }
export interface SeabedLayout { items: SeabedSpec[]; school?: { x: number; z: number; y: number; r: number; n: number } }

const CORAL = [
  new THREE.Color('#ff6f91'), new THREE.Color('#ff8c42'), new THREE.Color('#c86bff'), new THREE.Color('#fff0c8'),
  new THREE.Color('#ff5c6a'), new THREE.Color('#ffd23f'), new THREE.Color('#7ee8fa'),
];
const WEED = [new THREE.Color('#3f9a4a'), new THREE.Color('#5cb35a'), new THREE.Color('#2f7d5c'), new THREE.Color('#8bbf4a')];
const STAR = [new THREE.Color('#f07a3e'), new THREE.Color('#e35b6a'), new THREE.Color('#f4c04a')];
const FISH = [new THREE.Color('#ffb347'), new THREE.Color('#4fc3f7'), new THREE.Color('#f06292'), new THREE.Color('#fff176')];

export class Seabed {
  mesh!: THREE.Mesh;
  fish?: THREE.InstancedMesh;
  count = 0; tris = 0;
  private uniforms = { uTime: { value: 0 } };
  private school?: { x: number; z: number; y: number; r: number; n: number; seeds: Float32Array };
  private tmp = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), f: new THREE.Vector3() };

  constructor(private sky: Sky) {}

  /** Lagoon rule: sand shelf 1.5–8 m under the surface, on gentle slopes, off the four entry sandbars (the jetties); corals in
   *  noise-clustered reefs, seaweed in beds, a starfish here and there. `avoid` clears the wreck / anything else on the sand. */
  static scatterLagoon(seed: number, count = 360, avoid: { x: number; z: number; r: number }[] = []): SeabedLayout {
    const rng = new Rng(seed ^ 0x5eab), reef = new Noise2D(seed + 51), bed = new Noise2D(seed + 52);
    const level = getActiveChunk().ocean?.level ?? 0;
    const items: SeabedSpec[] = [];
    let tries = 0;
    const ok = (x: number, z: number, minD: number) => {
      if (!inChunk(x, z, 14)) return false;
      if (Math.abs(x) < ROAD_WIDTH / 2 + 5 && Math.abs(z) > CHUNK_HALF - 75) return false; // the S / N jetties' sandbars
      if (Math.abs(z) < ROAD_WIDTH / 2 + 5 && Math.abs(x) > CHUNK_HALF - 120) return false; // the W / E ones (the E jetty runs on into the cove)
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) return false;
      return !items.some((p) => Math.hypot(p.x - x, p.z - z) < minD);
    };
    while (items.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 14, CHUNK_HALF - 14), z = rng.range(-CHUNK_HALF + 14, CHUNK_HALF - 14);
      const d = level - heightAt(x, z);
      if (d < 1.5 || d > 8) continue;
      const [, ny] = normalAt(x, z, 1.5);
      if (ny < 0.86) continue;
      const r = reef.fbm(x * 0.02, z * 0.02, 2), b = bed.fbm(x * 0.03 + 7, z * 0.03, 2);
      const roll = rng.next();
      if (r > 0.12 && roll < 0.75) {
        // a reef: corals, denser toward the reef's heart
        if (rng.next() > (r - 0.12) * 2.2 + 0.25) continue;
        if (!ok(x, z, 1.6)) continue;
        items.push({ kind: 'coral', x, z, s: rng.range(0.6, 1.5) * (1 + Math.max(0, r) * 0.6), rot: rng.range(0, Math.PI * 2), v: rng.next() });
      } else if (b > 0.05 && roll < 0.92) {
        if (rng.next() > (b - 0.05) * 2.6 + 0.2) continue;
        if (!ok(x, z, 1.2)) continue;
        items.push({ kind: 'weed', x, z, s: rng.range(0.7, 1.4) * (0.7 + Math.min(1, d / 4) * 0.5), rot: rng.range(0, Math.PI * 2), v: rng.next() });
      } else if (roll >= 0.92 && rng.next() < 0.5) {
        if (!ok(x, z, 2.5)) continue;
        items.push({ kind: 'star', x, z, s: rng.range(0.5, 0.9), rot: rng.range(0, Math.PI * 2), v: rng.next() });
      }
    }
    // the fish school: over the densest reef patch we placed, at mid-depth
    let best: SeabedSpec | undefined, bestN = -1;
    for (const p of items) {
      if (p.kind !== 'coral') continue;
      let n = 0; for (const q of items) if (q.kind === 'coral' && Math.hypot(q.x - p.x, q.z - p.z) < 12) n++;
      if (n > bestN) { bestN = n; best = p; }
    }
    const school = best ? { x: best.x, z: best.z, y: level - Math.min(3, (level - heightAt(best.x, best.z)) * 0.55), r: 7, n: 28 } : undefined;
    return { items, school };
  }

  build(layout: SeabedLayout | SeabedSpec[]) {
    const specs = Array.isArray(layout) ? layout : layout.items;
    const rng = new Rng(0x5ea1 ^ 0xc0);
    const parts: THREE.BufferGeometry[] = [];
    const c = new THREE.Color();
    for (const p of specs) {
      const y = heightAt(p.x, p.z);
      const pos: number[] = [], col: number[] = [], sway: number[] = [];
      const phase = rng.range(0, Math.PI * 2);
      const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
      /** push a facet in local space (rotated by p.rot, scaled by p.s, sat on the floor) */
      const tri = (a: number[], b: number[], d: number[], color: THREE.Color, wa: number, wb: number, wd: number) => {
        for (const v of [a, b, d]) {
          const lx = v[0] * p.s, lz = v[2] * p.s;
          pos.push(p.x + lx * cs - lz * sn, y + v[1] * p.s, p.z + lx * sn + lz * cs);
          col.push(color.r, color.g, color.b);
        }
        sway.push(wa, phase, wb, phase, wd, phase);
      };
      /** a closed ring-strip between two rings of points */
      const strip = (r0: number[][], r1: number[][], color: THREE.Color, w0: number, w1: number, jitter = 0.1) => {
        const n = r0.length;
        for (let k = 0; k < n; k++) {
          c.copy(color).multiplyScalar(1 + (rng.next() * 2 - 1) * jitter);
          const a = r0[k], b = r0[(k + 1) % n], d = r1[(k + 1) % n], e = r1[k];
          tri(a, b, d, c, w0, w0, w1); tri(a, d, e, c, w0, w1, w1);
        }
      };
      const ring = (cx: number, cy: number, cz: number, r: number, n: number, off = 0, squash = 1) => {
        const out: number[][] = [];
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + off; out.push([cx + Math.cos(a) * r, cy + (rng.next() - 0.5) * r * 0.25, cz + Math.sin(a) * r * squash]); }
        return out;
      };
      if (p.kind === 'coral') {
        const tint = CORAL[Math.floor(p.v * CORAL.length)];
        const shape = Math.floor(rng.next() * 4);
        if (shape === 0) {
          // brain / boulder coral: a squashed icosahedron, lumpy
          const g = new THREE.IcosahedronGeometry(0.55, 1);
          const pp = g.attributes.position as THREE.BufferAttribute;
          const lump = rng.range(0, 100);
          for (let i = 0; i < pp.count; i++) {
            // lumpy: a per-position hash (not per-vertex random — the geometry is non-indexed, shared corners must agree)
            const x = pp.getX(i), yy = pp.getY(i), z = pp.getZ(i);
            const h = Math.sin(x * 12.9898 + yy * 78.233 + z * 37.719 + lump) * 43758.5453, k = 0.85 + (h - Math.floor(h)) * 0.3;
            pp.setXYZ(i, x * k, Math.max(-0.1, yy * 0.65 * k), z * k);
          }
          for (let i = 0; i < pp.count; i += 3) { // PolyhedronGeometry is non-indexed: three vertices per facet
            c.copy(tint).multiplyScalar(0.85 + rng.next() * 0.3);
            const v = [i, i + 1, i + 2].map((j) => [pp.getX(j), pp.getY(j), pp.getZ(j)]);
            tri(v[0], v[1], v[2], c, 0, 0, 0);
          }
          g.dispose();
        } else if (shape === 1) {
          // staghorn: 4–6 tapered branches leaning out from a base, 5-sided, a paler tip
          const n = 4 + Math.floor(rng.next() * 3);
          for (let b = 0; b < n; b++) {
            const a = (b / n) * Math.PI * 2 + rng.range(-0.3, 0.3), lean = rng.range(0.25, 0.6), h = rng.range(0.7, 1.3);
            const bx = Math.cos(a) * 0.12, bz = Math.sin(a) * 0.12;
            const r0 = ring(bx, 0, bz, 0.09, 5), r1 = ring(bx + Math.cos(a) * lean * 0.5, h * 0.55, bz + Math.sin(a) * lean * 0.5, 0.06, 5, 0.3);
            const r2 = ring(bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean, 0.025, 5, 0.6);
            strip(r0, r1, tint, 0, 0.02); strip(r1, r2, c.copy(tint).lerp(new THREE.Color(1, 1, 1), 0.35), 0.02, 0.05);
            // a side twig
            const t = ring(bx + Math.cos(a) * lean * 0.5, h * 0.55, bz + Math.sin(a) * lean * 0.5, 0.045, 4);
            const tt = ring(bx + Math.cos(a + 1.2) * 0.3 + Math.cos(a) * lean * 0.5, h * 0.85, bz + Math.sin(a + 1.2) * 0.3 + Math.sin(a) * lean * 0.5, 0.02, 4);
            strip(t, tt, c.copy(tint).lerp(new THREE.Color(1, 1, 1), 0.25), 0.02, 0.05);
          }
        } else if (shape === 2) {
          // fan coral: two or three flat lobed plates standing up, zig-zag rims (double-sided material)
          const plates = 2 + Math.floor(rng.next() * 2);
          for (let f = 0; f < plates; f++) {
            const a = (f / plates) * Math.PI * 2 + rng.range(-0.4, 0.4), w = rng.range(0.7, 1.1), h = rng.range(0.8, 1.3);
            const dx = Math.cos(a), dz = Math.sin(a), ox = -Math.sin(a) * 0.15, oz = Math.cos(a) * 0.15;
            const segs = 5, base = [ox, 0, oz];
            let prev: number[] | null = null;
            for (let s = 0; s <= segs; s++) {
              const t = s / segs - 0.5, ang = t * 1.9;
              const rr = (h * (0.85 + 0.15 * Math.sin(s * 2.1))) * (1 - Math.abs(t) * 0.35);
              const v = [ox + dx * Math.sin(ang) * w * 0.9 * rr, Math.cos(ang) * rr, oz + dz * Math.sin(ang) * w * 0.9 * rr];
              if (prev) { c.copy(tint).multiplyScalar(0.8 + s * 0.06); tri(base, prev, v, c, 0, 0.06, 0.06); }
              prev = v;
            }
          }
        } else {
          // tube / pillar coral: a cluster of 3–5 short fat tubes with open darker tops
          const n = 3 + Math.floor(rng.next() * 3);
          for (let b = 0; b < n; b++) {
            const a = (b / n) * Math.PI * 2, d = 0.22 + rng.next() * 0.15, h = rng.range(0.35, 0.8), r = rng.range(0.12, 0.2);
            const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
            const r0 = ring(bx, 0, bz, r * 1.15, 6), r1 = ring(bx, h, bz, r, 6, 0.3);
            strip(r0, r1, tint, 0, 0.02);
            const top = [bx, h - 0.06, bz]; c.copy(tint).multiplyScalar(0.55);
            for (let k = 0; k < 6; k++) tri(r1[(k + 1) % 6], r1[k], top, c, 0.02, 0.02, 0.02);
          }
        }
      } else if (p.kind === 'weed') {
        // a bed of 3–6 kelp ribbons: 5 segments each, waving more toward the tip; the width tapers and the ribbon twists
        const n = 3 + Math.floor(rng.next() * 4);
        const tint = WEED[Math.floor(p.v * WEED.length)];
        for (let f = 0; f < n; f++) {
          const a = rng.range(0, Math.PI * 2), d = rng.range(0, 0.45), h = rng.range(1.2, 2.6), segs = 5;
          const bx = Math.cos(a) * d, bz = Math.sin(a) * d, lean = rng.range(0, 0.35), la = rng.range(0, Math.PI * 2), w0 = rng.range(0.1, 0.16);
          let pl: number[] | null = null, pr: number[] | null = null;
          for (let s = 0; s <= segs; s++) {
            const t = s / segs, tw = a + t * 1.6, w = w0 * (1 - t * 0.7);
            const cx = bx + Math.cos(la) * lean * t * t * h, cz = bz + Math.sin(la) * lean * t * t * h, cy = t * h;
            const l = [cx - Math.sin(tw) * w, cy, cz + Math.cos(tw) * w], r = [cx + Math.sin(tw) * w, cy, cz - Math.cos(tw) * w];
            if (pl && pr) {
              c.copy(tint).multiplyScalar(0.75 + t * 0.45 + (rng.next() - 0.5) * 0.12);
              const wa = ((s - 1) / segs) ** 1.5, wb = t ** 1.5;
              tri(pl, pr, r, c, wa, wa, wb); tri(pl, r, l, c, wa, wb, wb);
            }
            pl = l; pr = r;
          }
        }
      } else {
        // starfish: five tapering arms around a raised centre, lying on the sand
        const tint = STAR[Math.floor(p.v * STAR.length)];
        const top = [0, 0.09, 0];
        for (let k = 0; k < 5; k++) {
          const a0 = (k / 5) * Math.PI * 2, a1 = ((k + 1) / 5) * Math.PI * 2, am = (a0 + a1) / 2;
          const tip = [Math.cos(am) * 0.5, 0.01, Math.sin(am) * 0.5];
          const i0 = [Math.cos(a0) * 0.16, 0.05, Math.sin(a0) * 0.16], i1 = [Math.cos(a1) * 0.16, 0.05, Math.sin(a1) * 0.16];
          c.copy(tint).multiplyScalar(0.95); tri(top, i1, i0, c, 0, 0, 0);
          c.copy(tint).multiplyScalar(1.05); tri(i0, i1, tip, c, 0, 0, 0);
          const e0 = [Math.cos(a0) * 0.2, 0.0, Math.sin(a0) * 0.2];
          c.copy(tint).multiplyScalar(0.8); tri(i0, tip, e0, c, 0, 0, 0);
          const e1 = [Math.cos(a1) * 0.2, 0.0, Math.sin(a1) * 0.2];
          tri(i1, e1, tip, c, 0, 0, 0);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('sway', new THREE.Float32BufferAttribute(sway, 2));
      parts.push(geo);
      this.count++;
    }
    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    this.tris = geo.attributes.position.count / 3;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 sway; uniform float uTime;')
        .replace('#include <begin_vertex>', /* glsl */`
          vec3 transformed = vec3( position );
          {
            // the current: a slow surge with a faster ripple on top; the tips of the fronds travel, the roots stay put
            float w = sway.x, ph = sway.y;
            float g = sin(uTime * 0.8 + ph) * 0.7 + sin(uTime * 1.9 + ph * 1.7) * 0.3;
            transformed.x += g * w * 0.35;
            transformed.z += cos(uTime * 0.65 + ph * 1.3) * w * 0.28;
            transformed.y -= abs(g) * w * 0.08;
          }`);
    };
    mat.customProgramCacheKey = () => 'seabed-sway';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.name = 'seabed';
    if (!Array.isArray(layout) && layout.school) this.buildSchool(layout.school);
    return this;
  }

  /** a school of small faceted fish (one InstancedMesh) weaving through a lissajous loop over the reef */
  private buildSchool(s: { x: number; z: number; y: number; r: number; n: number }) {
    const rng = new Rng(0xf15c);
    // one fish: a flattened diamond body (8 tris) and a tail fin (2 tris), nose along -z, ~0.35 m long
    const pos: number[] = [];
    const nose = [0, 0, -0.18], tail = [0, 0, 0.14], top = [0, 0.07, -0.02], bot = [0, -0.06, -0.02], l = [-0.035, 0, -0.03], r = [0.035, 0, -0.03];
    const t1 = [0, 0.07, 0.24], t2 = [0, -0.07, 0.24];
    const faces = [[nose, top, l], [nose, r, top], [nose, l, bot], [nose, bot, r], [tail, l, top], [tail, top, r], [tail, bot, l], [tail, r, bot], [tail, t1, t2], [tail, t2, t1]];
    for (const f of faces) for (const v of f) pos.push(v[0], v[1], v[2]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    // per-instance colour
    const n = s.n, colors = new Float32Array(n * 3), seeds = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const cc = FISH[Math.floor(rng.next() * FISH.length)];
      colors[i * 3] = cc.r; colors[i * 3 + 1] = cc.g; colors[i * 3 + 2] = cc.b;
      seeds[i * 3] = rng.range(0, Math.PI * 2); seeds[i * 3 + 1] = rng.range(0.6, 1); seeds[i * 3 + 2] = rng.range(-1, 1);
    }
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6, metalness: 0.1 });
    this.sky.setupMaterial(mat);
    const mesh = this.fish = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    mesh.name = 'seabed-fish';
    this.school = { ...s, seeds };
    this.update(0);
  }

  update(dt: number) {
    this.uniforms.uTime.value += dt;
    const s = this.school, mesh = this.fish;
    if (!s || !mesh) return;
    const t = this.uniforms.uTime.value * 0.35, { m, p, q, e, s: sc, f } = this.tmp;
    for (let i = 0; i < s.n; i++) {
      const ph = s.seeds[i * 3], spd = s.seeds[i * 3 + 1], off = s.seeds[i * 3 + 2];
      const u = t * spd + ph;
      // lissajous loop around the school centre, each fish on its own offset ring; a little bob
      const x = s.x + Math.sin(u) * s.r * (1 + off * 0.25) + Math.cos(u * 2.3 + ph) * 0.6;
      const z = s.z + Math.sin(u * 0.5 + 1.2) * s.r * 0.8 + Math.sin(u * 1.7 + ph) * 0.5;
      const y = s.y + Math.sin(u * 1.3 + ph) * 0.5 + off * 0.4;
      // heading = the path tangent (finite difference)
      const du = 0.05;
      f.set(Math.sin(u + du) * s.r * (1 + off * 0.25) + Math.cos((u + du) * 2.3 + ph) * 0.6 - (x - s.x), Math.sin((u + du) * 1.3 + ph) * 0.5 + off * 0.4 - (y - s.y), Math.sin((u + du) * 0.5 + 1.2) * s.r * 0.8 + Math.sin((u + du) * 1.7 + ph) * 0.5 - (z - s.z));
      const yaw = Math.atan2(-f.x, -f.z), pitch = Math.atan2(f.y, Math.hypot(f.x, f.z));
      e.set(pitch, yaw, Math.sin(u * 9 + ph) * 0.15, 'YXZ');
      q.setFromEuler(e); p.set(x, y, z); sc.setScalar(0.8 + spd * 0.5);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
