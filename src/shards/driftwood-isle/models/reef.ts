/**
 * The lagoon floor's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts; they were built inside
 * src/shards/driftwood-isle/world/Seabed.ts): faceted low-poly CORAL CLUMPS in pastel pink / orange / purple / cream (four shapes: brain
 * domes, staghorn branches, fan plates, tube clusters), SEAWEED BEDS whose fronds sway in the vertex shader (per-vertex
 * weight + phase, like the palms) and REEF STARFISH on the sand. Nothing collides (you swim through them).
 *
 * Each builds in its own space (its base on the sand at the origin, turned by `rot`, scaled by `s`, its tint picked by
 * `v`), from the rng stream it is handed: the lagoon (src/shards/driftwood-isle/world/Seabed.ts) builds its reef in scatter order from ONE
 * stream, across the three kinds, and welds every copy into one mesh on one material (one draw), then places each kind
 * `drawnInto` that mesh (its copies and card). The material (its sway clock, `reefMaterial(ctx).uniforms.uTime`) is the
 * shard's, through the model context.
 */
import * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';

export interface ReefParams {
  /** size, 1 = the builders' metre scale */
  readonly s: number;
  /** turn about +Y, radians */
  readonly rot: number;
  /** 0‥1: which tint of the kind's palette */
  readonly v: number;
  /** coral only: 0 brain, 1 staghorn, 2 fan, 3 tube (default: drawn from the stream, as the lagoon does) */
  readonly shape?: number;
}

const CORAL = [
  new THREE.Color('#ff6f91'), new THREE.Color('#ff8c42'), new THREE.Color('#c86bff'), new THREE.Color('#fff0c8'),
  new THREE.Color('#ff5c6a'), new THREE.Color('#ffd23f'), new THREE.Color('#7ee8fa'),
];
const WEED = [new THREE.Color('#3f9a4a'), new THREE.Color('#5cb35a'), new THREE.Color('#2f7d5c'), new THREE.Color('#8bbf4a')];
const STAR = [new THREE.Color('#f07a3e'), new THREE.Color('#e35b6a'), new THREE.Color('#f4c04a')];

/** the reef's one material: flat-shaded vertex colour, two-sided, the fronds swaying in the current */
export function reefMaterial(ctx: ModelContext): { material: THREE.MeshStandardMaterial; uniforms: { uTime: THREE.IUniform<number> } } {
  return ctx.once('driftwood-isle/reef:material', () => {
    const uniforms = { uTime: { value: 0 } };
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    patchShader(material, 'driftwood.seabed-sway', PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, uniforms);
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
    }, { mode: 'replace', key: 'seabed-sway' });
    ctx.sky.setupMaterial(material);
    return { material, uniforms };
  });
}

type Kind = 'coral' | 'weed' | 'star';

/** one copy of a kind, own space: position, colour, sway (weight, phase) — the old Seabed.build loop's body */
function reefGeometry(kind: Kind, p: ReefParams, rng: Rng): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], sway: number[] = [];
  const c = new THREE.Color();
  const phase = rng.range(0, Math.PI * 2);
  const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
  /** push a facet in local space (rotated by rot, scaled by s, sat on the floor) */
  const tri = (a: number[], b: number[], d: number[], color: THREE.Color, wa: number, wb: number, wd: number): void => {
    for (const v of [a, b, d]) {
      const lx = (v[0] ?? 0) * p.s, lz = (v[2] ?? 0) * p.s;
      pos.push(lx * cs - lz * sn, (v[1] ?? 0) * p.s, lx * sn + lz * cs);
      col.push(color.r, color.g, color.b);
    }
    sway.push(wa, phase, wb, phase, wd, phase);
  };
  /** a closed ring-strip between two rings of points */
  const strip = (r0: number[][], r1: number[][], color: THREE.Color, w0: number, w1: number, jitter = 0.1): void => {
    const n = r0.length;
    for (let k = 0; k < n; k++) {
      c.copy(color).multiplyScalar(1 + (rng.next() * 2 - 1) * jitter);
      const a = r0[k], b = r0[(k + 1) % n], d = r1[(k + 1) % n], e = r1[k];
      if (!a || !b || !d || !e) continue;
      tri(a, b, d, c, w0, w0, w1); tri(a, d, e, c, w0, w1, w1);
    }
  };
  const ring = (cx: number, cy: number, cz: number, r: number, n: number, off = 0, squash = 1): number[][] => {
    const out: number[][] = [];
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + off; out.push([cx + Math.cos(a) * r, cy + (rng.next() - 0.5) * r * 0.25, cz + Math.sin(a) * r * squash]); }
    return out;
  };
  if (kind === 'coral') {
    const tint = CORAL[Math.floor(p.v * CORAL.length)];
    if (tint === undefined) throw new Error('[reef] coral tint index out of range');
    const drawn = Math.floor(rng.next() * 4), shape = p.shape ?? drawn;
    if (shape === 0) {
      // brain / boulder coral: a squashed icosahedron, lumpy
      const g = new THREE.IcosahedronGeometry(0.55, 1);
      const pp = g.getAttribute('position');
      const lump = rng.range(0, 100);
      for (let i = 0; i < pp.count; i++) {
        // lumpy: a per-position hash (not per-vertex random — the geometry is non-indexed, shared corners must agree)
        const x = pp.getX(i), yy = pp.getY(i), z = pp.getZ(i);
        const h = Math.sin(x * 12.9898 + yy * 78.233 + z * 37.719 + lump) * 43758.5453, k = 0.85 + (h - Math.floor(h)) * 0.3;
        pp.setXYZ(i, x * k, Math.max(-0.1, yy * 0.65 * k), z * k);
      }
      for (let i = 0; i < pp.count; i += 3) { // PolyhedronGeometry is non-indexed: three vertices per facet
        c.copy(tint).multiplyScalar(0.85 + rng.next() * 0.3);
        const v = (j: number): number[] => [pp.getX(j), pp.getY(j), pp.getZ(j)];
        tri(v(i), v(i + 1), v(i + 2), c, 0, 0, 0);
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
        for (let k = 0; k < 6; k++) { const a1 = r1[(k + 1) % 6], a0 = r1[k]; if (!a1 || !a0) continue; tri(a1, a0, top, c, 0.02, 0.02, 0.02); }
      }
    }
  } else if (kind === 'weed') {
    // a bed of 3–6 kelp ribbons: 5 segments each, waving more toward the tip; the width tapers and the ribbon twists
    const n = 3 + Math.floor(rng.next() * 4);
    const tint = WEED[Math.floor(p.v * WEED.length)];
    if (tint === undefined) throw new Error('[reef] weed tint index out of range');
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
    if (tint === undefined) throw new Error('[reef] star tint index out of range');
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
  return geo;
}

const reefBuild = (kind: Kind) => (ctx: ModelContext, p: ReefParams, rng: Rng): ModelPart[] => [{ geometry: reefGeometry(kind, p, rng), material: reefMaterial(ctx).material, receiveShadow: true }];

export const coral = defineModel<ReefParams>({
  id: 'driftwood-isle/coral', name: 'Coral clump', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/reef.ts',
  // the specimen is the first variant (a brain coral); the lagoon's copies draw their shape from the stream
  defaults: { s: 1, rot: 0, v: 0, shape: 0 },
  variants: [
    { id: 'brain', label: 'Brain', params: { shape: 0 } }, { id: 'staghorn', label: 'Staghorn', params: { shape: 1, v: 0.3 } },
    { id: 'fan', label: 'Fan', params: { shape: 2, v: 0.45 } }, { id: 'tube', label: 'Tube', params: { shape: 3, v: 0.6 } },
  ],
  seed: 0x5ea1 ^ 0xc0,
  build: reefBuild('coral'),
});

export const seaweed = defineModel<ReefParams>({
  id: 'driftwood-isle/seaweed', name: 'Seaweed bed', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/reef.ts',
  defaults: { s: 1, rot: 0, v: 0 },
  variants: WEED.map((_, i) => ({ id: `tint-${i}`, label: `Tint ${i + 1}`, params: { v: (i + 0.5) / WEED.length } })),
  seed: 0x5ea1 ^ 0xc0,
  build: reefBuild('weed'),
});

export const reefStarfish = defineModel<ReefParams>({
  id: 'driftwood-isle/reef-starfish', name: 'Reef starfish', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/reef.ts',
  defaults: { s: 0.7, rot: 0, v: 0 },
  variants: STAR.map((_, i) => ({ id: `tint-${i}`, label: `Tint ${i + 1}`, params: { v: (i + 0.5) / STAR.length } })),
  seed: 0x5ea1 ^ 0xc0,
  build: reefBuild('star'),
});

/** the model of each scatter kind */
export const REEF = { coral, weed: seaweed, star: reefStarfish } as const;
