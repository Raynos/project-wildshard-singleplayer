/**
 * Flutter — every piece of cloth on the Nalati POIs in ONE mesh (one draw call): the ribbons on the camp's pole,
 * pennants on the yurt crowns, the cloth strips tied at the Wind Cairn, the prayer-strip lines. Each strip is a
 * ribbon of quads animated on the CPU (a few thousand vertices, no allocation per frame), streaming downwind and
 * rippling; stronger wind lifts it, calm lets it hang. Both faces are emitted (reversed winding) so the shared
 * FrontSide painterly material draws it without a DoubleSide program fork.
 *
 *   const flutter = new Flutter();
 *   flutter.streamer(v3(x, y, z), 2.8, 0.12, '#d63a2a');                  // ribbon from a point
 *   flutter.flag(v3(x, yTop, z), 0.7, 1.1, '#c8432b', { taper: 1 });      // pennant on a pole (edge down from yTop)
 *   flutter.strip(v3(x, y, z), 0.45, 0.07, '#f4f1ea');                    // strip tied to a line: hangs, flutters
 *   scene.add(flutter.build(sky));  game.onUpdate((dt) => flutter.update(dt));
 *   flutter.setWind(dirX, dirZ, strength01)   // else it follows the shared painterly wind (setPainterlyLook({ wind }))
 */
import * as THREE from 'three';
import { poiMaterial } from './paint';
import { painterlyUniforms } from '../painterly';
import type { Sky } from '../Sky';

interface Strip {
  ax: number; ay: number; az: number;
  /** the attached edge vector (flag: down the pole; ribbon: across) */
  sx: number; sy: number; sz: number;
  len: number;
  seg: number;
  /** 0 = streams level downwind, 1 = hangs straight down (in calm) */
  droop: number;
  taper: number;
  /** > 0: the attached edge is this wide and turns to stay across the wind (streamers, tied strips) */
  across: number;
  phase: number;
  /** first vertex of its front face in the buffers */
  v0: number;
}

const SEG_PER_M = 5;

export class Flutter {
  mesh: THREE.Mesh | null = null;
  private strips: Strip[] = [];
  private colors: number[] = [];
  private pos!: Float32Array;
  private nrm!: Float32Array;
  private posAttr!: THREE.BufferAttribute;
  private nrmAttr!: THREE.BufferAttribute;
  private t = 0;
  private wind = { x: -0.92, z: -0.38, s: 0.7 };
  /** follow the shard-wide painterly wind (`setPainterlyLook({ wind })`) until `setWind` is called */
  private followShared = true;
  private nVerts = 0;
  private bounds = new THREE.Box3();

  /** a ribbon streaming from a single point (the attached edge is `w` wide, horizontal, across the wind) */
  streamer(a: THREE.Vector3, len: number, w: number, color: THREE.ColorRepresentation, o: { droop?: number; taper?: number } = {}): void {
    this.push(a, new THREE.Vector3(0, 0, w), len, color, o.droop ?? 0.45, o.taper ?? 0.35, w);
  }

  /** a flag / pennant: the attached edge runs from `top` down `h` metres, the cloth extends `len` downwind */
  flag(top: THREE.Vector3, h: number, len: number, color: THREE.ColorRepresentation, o: { droop?: number; taper?: number } = {}): void {
    this.push(top, new THREE.Vector3(0, -h, 0), len, color, o.droop ?? 0.25, o.taper ?? 0, 0);
  }

  /** a short strip tied to a line: hangs, lifts and flutters */
  strip(a: THREE.Vector3, len: number, w: number, color: THREE.ColorRepresentation): void {
    this.push(a, new THREE.Vector3(w, 0, 0), len, color, 0.8, 0.2, w);
  }

  private push(a: THREE.Vector3, s: THREE.Vector3, len: number, color: THREE.ColorRepresentation, droop: number, taper: number, across: number): void {
    const seg = Math.max(2, Math.min(14, Math.round(len * SEG_PER_M)));
    const c = new THREE.Color(color);
    this.strips.push({ ax: a.x, ay: a.y, az: a.z, sx: s.x, sy: s.y, sz: s.z, len, seg, droop, taper, across, phase: (a.x * 1.7 + a.z * 2.3 + this.strips.length * 0.61) % (Math.PI * 2), v0: 0 });
    this.colors.push(c.r, c.g, c.b);
    this.bounds.expandByPoint(a);
  }

  get count(): number { return this.strips.length; }

  build(sky: Sky): THREE.Mesh {
    // per strip: (seg + 1) × 2 vertices per face, two faces
    let nv = 0;
    const index: number[] = [];
    for (const s of this.strips) {
      s.v0 = nv;
      const rows = s.seg + 1, back = nv + rows * 2;
      for (let i = 0; i < s.seg; i++) {
        const a = nv + i * 2, b = a + 1, c = a + 2, d = a + 3;
        index.push(a, c, b, b, c, d);                                    // front
        const a2 = back + i * 2, b2 = a2 + 1, c2 = a2 + 2, d2 = a2 + 3;
        index.push(a2, b2, c2, b2, d2, c2);                               // back (reversed)
      }
      nv += rows * 4;
    }
    this.nVerts = nv;
    this.pos = new Float32Array(nv * 3);
    this.nrm = new Float32Array(nv * 3);
    const col = new Float32Array(nv * 3);
    this.strips.forEach((s, k) => {
      const r = this.colors[k * 3] ?? 1, g = this.colors[k * 3 + 1] ?? 1, b = this.colors[k * 3 + 2] ?? 1;
      const rows = s.seg + 1;
      for (let f = 0; f < 2; f++) for (let i = 0; i < rows; i++) for (let j = 0; j < 2; j++) {
        const v = s.v0 + f * rows * 2 + i * 2 + j;
        const shade = 0.92 + 0.08 * (1 - i / rows);
        col[v * 3] = r * shade; col[v * 3 + 1] = g * shade; col[v * 3 + 2] = b * shade;
      }
    });
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.nrmAttr = new THREE.BufferAttribute(this.nrm, 3); this.nrmAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('normal', this.nrmAttr);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(index);
    let maxLen = 0; for (const s of this.strips) maxLen = Math.max(maxLen, s.len + Math.hypot(s.sx, s.sy, s.sz));
    const sphere = new THREE.Sphere(); this.bounds.getBoundingSphere(sphere); sphere.radius += maxLen;
    geo.boundingSphere = sphere;
    this.mesh = new THREE.Mesh(geo, poiMaterial(sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = true;
    this.update(0);
    return this.mesh;
  }

  /** wind direction (x, z; normalised here) and strength 0 (calm) … 1 (gale) */
  setWind(x: number, z: number, strength: number): void {
    this.followShared = false;
    const l = Math.hypot(x, z) || 1;
    this.wind.x = x / l; this.wind.z = z / l; this.wind.s = Math.max(0, Math.min(1.5, strength));
  }

  update(dt: number): void {
    if (!this.mesh) return;
    this.t += dt;
    if (this.followShared) {
      const w = painterlyUniforms.uPWind.value;
      this.wind.x = w.x; this.wind.z = w.y; this.wind.s = Math.min(1.2, w.z * 0.7);
    }
    const t = this.t, P = this.pos, N = this.nrm, W = this.wind;
    for (const s of this.strips) {
      const rows = s.seg + 1;
      if (s.across > 0) { s.sx = -W.z * s.across; s.sy = 0; s.sz = W.x * s.across; }
      // the strip's base direction: downwind, dropping by droop (less when the wind is strong)
      const drop = Math.min(0.97, s.droop * (1.25 - W.s * 0.75) + 0.08 * Math.sin(t * 0.7 + s.phase));
      const gust = 0.85 + 0.15 * Math.sin(t * 0.9 + s.phase * 1.3) * Math.sin(t * 0.37 + s.phase);
      let dx = W.x * (1 - drop), dy = -drop, dz = W.z * (1 - drop);
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      // flap normal = dir × span
      let nx = dy * s.sz - dz * s.sy, ny = dz * s.sx - dx * s.sz, nz = dx * s.sy - dy * s.sx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const amp = (0.06 + 0.16 * W.s) * gust, k = 7.5 / Math.max(0.4, s.len), w = 5.5 + 5 * W.s;
      for (let i = 0; i < rows; i++) {
        const u = i / s.seg, along = u * s.len;
        const wave = Math.sin(k * along - t * w + s.phase) * amp * u * s.len * 0.35;
        const sag = -u * u * s.len * 0.18 * (1 - W.s * 0.6);             // tips fall a little more
        const sw = 1 - s.taper * u;
        const cx = s.ax + dx * along + nx * wave, cy = s.ay + dy * along + ny * wave + sag, cz = s.az + dz * along + nz * wave;
        // twist the span a little along the strip
        const tw = Math.sin(k * 0.6 * along - t * w * 0.7 + s.phase) * 0.25 * u;
        for (let j = 0; j < 2; j++) {
          const f = j * sw;
          const px = cx + (s.sx + nx * tw * Math.hypot(s.sx, s.sy, s.sz)) * f, py = cy + s.sy * f, pz = cz + (s.sz + nz * tw * Math.hypot(s.sx, s.sy, s.sz)) * f;
          const a = (s.v0 + i * 2 + j) * 3, b = (s.v0 + rows * 2 + i * 2 + j) * 3;
          P[a] = px; P[a + 1] = py; P[a + 2] = pz; P[b] = px; P[b + 1] = py; P[b + 2] = pz;
          // normal leans with the ripple slope
          const slope = Math.cos(k * along - t * w + s.phase) * amp * 0.8 * u;
          let mx = nx - dx * slope, my = ny - dy * slope, mz = nz - dz * slope;
          const ml = Math.hypot(mx, my, mz) || 1; mx /= ml; my /= ml; mz /= ml;
          N[a] = mx; N[a + 1] = my; N[a + 2] = mz; N[b] = -mx; N[b + 1] = -my; N[b + 2] = -mz;
        }
      }
    }
    this.posAttr.needsUpdate = true;
    this.nrmAttr.needsUpdate = true;
  }

  get vertexCount(): number { return this.nVerts; }
}
