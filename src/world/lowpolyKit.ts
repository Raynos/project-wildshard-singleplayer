/**
 * Low-poly model kit — the shared toolbox for Driftwood Isle's faceted, flat-shaded, vertex-coloured
 * models (E8: model fidelity). Every static prop / building / wreck is one merged non-indexed mesh on
 * one shared material, so detail costs triangles, never draw calls.
 *
 *   const kit = new LowPolyKit(SEED ^ 0x1234);
 *   kit.add(new THREE.BoxGeometry(1, 1, 1), '#9c7a52', { matrix: m, jitter: 0.06 });
 *   kit.add(log(a, b, 0.2, 0.16), C.wood);                   // faceted, hand-cut beam between two points
 *   kit.add(rope([p0, p1, p2], 0.035), C.rope);              // 4-sided tube along a polyline
 *   kit.add(rock(1.2, 1, rng), C.stone);                     // displaced icosahedron boulder
 *   const geo = kit.finish({ ao: { ground: heightAt } });    // merge + baked AO (+ ground contact)
 *   const mesh = new THREE.Mesh(geo, lowPolyMaterial(sky));
 *
 * bakeAO(geo, opts) — the part that makes a model stop reading as flat plastic: the merged triangles
 * (and the terrain under them) are rasterised into a coarse occupancy grid, each face marches a handful
 * of hemisphere rays through it, and the occluded fraction darkens the face toward a cool shadow tint.
 * Per face, not per vertex, so it keeps the faceted look. ~5–20 ms for a 10k-tri model, once at build.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import type { Sky } from './Sky';
import { patchSway, swayByHeight } from './wind';
import { attachFogUniforms } from './Atmosphere';

export type ColorLike = THREE.Color | string;

const tmpColor = new THREE.Color();
const asColor = (c: ColorLike): THREE.Color => (typeof c === 'string' ? tmpColor.set(c) : c);

export interface AddOpts {
  /** per-face lightness jitter, ± fraction (default 0.06) */
  jitter?: number;
  /** applied to the geometry before it is merged */
  matrix?: THREE.Matrix4;
  /** random per-vertex displacement in metres (hand-cut look; default 0) — applied before the matrix */
  wobble?: number;
  /** sways in the shared wind (M5, wind.ts): weight `w` (~1 = cloth), rising with height from the part's base — or, with
   * `hang`, from its top down (a sail, a banner, weed hanging off a rail). Meshes with swaying parts want
   * `mesh.customDepthMaterial = swayDepthMaterial()` so their shadows move too. */
  sway?: { w: number; phase?: number; hang?: boolean; /** absolute (post-matrix) y where the weight is 0 → where it reaches w (a sail built from many quads) */ span?: [number, number] };
}

export class LowPolyKit {
  readonly rng: Rng;
  private parts: THREE.BufferGeometry[] = [];

  constructor(seed: number) { this.rng = new Rng(seed); }

  /** add a geometry painted one colour (per-face jitter); the input is consumed */
  add(g: THREE.BufferGeometry, col: ColorLike, opts: AddOpts = {}): void {
    const jitter = opts.jitter ?? 0.06;
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    if (g.hasAttribute('normal')) g.deleteAttribute('normal');
    if (g.hasAttribute('color')) g.deleteAttribute('color');
    if (opts.wobble !== undefined && opts.wobble > 0) wobble(g, opts.wobble, this.rng);
    const ni = g.index ? g.toNonIndexed() : g;
    if (ni !== g) g.dispose();
    if (opts.matrix) ni.applyMatrix4(opts.matrix);
    const c = asColor(col), r = c.r, gg = c.g, b = c.b;
    const n = ni.getAttribute('position').count, out = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const k = 1 - jitter + this.rng.next() * jitter * 2;
      for (let j = 0; j < 3; j++) { const o = (i + j) * 3; out[o] = r * k; out[o + 1] = gg * k; out[o + 2] = b * k; }
    }
    ni.setAttribute('color', new THREE.BufferAttribute(out, 3));
    if (opts.sway) this.sway(ni, opts.sway);
    this.parts.push(ni);
  }

  private sway(g: THREE.BufferGeometry, sw: NonNullable<AddOpts['sway']>): void {
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (!bb) return;
    const phase = sw.phase ?? this.rng.range(0, Math.PI * 2);
    if (sw.span) swayByHeight(g, sw.w, sw.span[0], sw.span[1], phase);
    else if (sw.hang) swayByHeight(g, sw.w, bb.max.y, bb.min.y, phase); else swayByHeight(g, sw.w, bb.min.y, bb.max.y, phase);
  }

  /**
   * add a geometry painted by facing: faces whose (post-matrix) normal points up past `minY` take `top` (moss on a rock,
   * grass on a ledge, sand on a step), the rest `side`; per-face jitter as `add`. The input is consumed.
   */
  addTopped(g: THREE.BufferGeometry, side: ColorLike, top: ColorLike, opts: AddOpts & { minY?: number } = {}): void {
    const jitter = opts.jitter ?? 0.06, minY = opts.minY ?? 0.55;
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    if (g.hasAttribute('normal')) g.deleteAttribute('normal');
    if (g.hasAttribute('color')) g.deleteAttribute('color');
    if (opts.wobble !== undefined && opts.wobble > 0) wobble(g, opts.wobble, this.rng);
    const ni = g.index ? g.toNonIndexed() : g;
    if (ni !== g) g.dispose();
    if (opts.matrix) ni.applyMatrix4(opts.matrix);
    const s = asColor(side).clone(), t = asColor(top).clone();
    const pos = ni.getAttribute('position'), n = pos.count, out = new Float32Array(n * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      b.sub(a); c.sub(a); b.cross(c).normalize();
      const col = b.y > minY ? t : s, k = 1 - jitter + this.rng.next() * jitter * 2;
      for (let j = 0; j < 3; j++) { const o = (i + j) * 3; out[o] = col.r * k; out[o + 1] = col.g * k; out[o + 2] = col.b * k; }
    }
    ni.setAttribute('color', new THREE.BufferAttribute(out, 3));
    this.parts.push(ni);
  }

  /** add several [geometry, colour] parts (a plant, a statue) under one matrix */
  addParts(parts: [THREE.BufferGeometry, ColorLike][], opts: AddOpts = {}): void {
    for (const [g, c] of parts) this.add(g, c, opts);
  }

  /** add a geometry that already carries a `color` attribute (non-indexed or indexed) */
  addPainted(g: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    if (g.hasAttribute('normal')) g.deleteAttribute('normal');
    const ni = g.index ? g.toNonIndexed() : g;
    if (matrix) ni.applyMatrix4(matrix);
    this.parts.push(ni);
  }

  get triangleCount(): number { let n = 0; for (const p of this.parts) n += p.getAttribute('position').count / 3; return n; }

  /** merge everything, flat normals, optional AO bake; the kit is empty afterwards */
  finish(opts: { ao?: AOOptions | false } = {}): THREE.BufferGeometry {
    // the parts must share their attributes to merge: if any part sways, the still ones get a zero aSway
    if (this.parts.some((p) => p.hasAttribute('aSway'))) for (const p of this.parts) if (!p.hasAttribute('aSway')) p.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(p.getAttribute('position').count * 2), 2));
    const geo = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    geo.computeVertexNormals(); // non-indexed → flat per-face normals
    if (opts.ao !== false) bakeAO(geo, opts.ao ?? {});
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

// ── primitives ────────────────────────────────────────────────────────────────────────────────────

/** displace every distinct vertex position by up to ±amp (shared corners move together) */
export function wobble(g: THREE.BufferGeometry, amp: number, rng: Rng): void {
  const pos = g.getAttribute('position');
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let d = seen.get(key);
    if (!d) { d = [rng.range(-amp, amp), rng.range(-amp, amp), rng.range(-amp, amp)]; seen.set(key, d); }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  pos.needsUpdate = true;
}

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();

/** orient a geometry built along +Y (centred at origin, length 1 unit along y) from a to b */
function alongSegment(g: THREE.BufferGeometry, a: THREE.Vector3, b: THREE.Vector3): THREE.BufferGeometry {
  _d.subVectors(b, a);
  const len = _d.length();
  g.scale(1, len, 1);
  _q.setFromUnitVectors(UP, _d.normalize());
  g.applyQuaternion(_q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/**
 * A faceted log / beam / post between two points: an n-sided prism (default 6) tapering r0 → r1, the
 * ring rotated a random amount so neighbouring logs don't line their facets up.
 */
export function log(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, sides = 6, twist = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, 1, sides, 1, false, twist);
  return alongSegment(g, a, b);
}

/** a squared timber (w × h cross-section) between two points; `roll` spins it about its own axis */
export function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, roll = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, 1, h);
  if (roll !== 0) g.rotateY(roll);
  return alongSegment(g, a, b);
}

/** a rope / cable: a 4-sided tube through the points (segments share no caps; cheap and reads fine) */
export function rope(points: THREE.Vector3[], r: number, sides = 4): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const p = points[i], q = points[i + 1];
    if (p === undefined || q === undefined) continue;
    const g = new THREE.CylinderGeometry(r, r, 1, sides, 1, true, Math.PI / 4);
    parts.push(alongSegment(g, p, q).toNonIndexed());
  }
  return mergeGeometries(parts, false);
}

/** points along a catenary-ish sag from a to b (n segments), for ropes and rigging */
export function sagLine(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 6): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t))); }
  return pts;
}

/**
 * A boulder: an icosahedron (detail 0 = 20 faces, 1 = 80) with every vertex pushed in/out by value
 * noise, squashed vertically. Shared vertices move together so the rock stays watertight.
 */
export function rock(r: number, detail: number, rng: Rng, squash = 0.7, rough = 0.28): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const pos = g.getAttribute('position');
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) { k = 1 + rng.range(-rough, rough); seen.set(key, k); }
    pos.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return g;
}

/** a flat-bottomed plank/board: a box with its corners nudged (± wob) so rows of them look hand-sawn */
export function plank(len: number, w: number, t: number, rng: Rng, wob = 0.012): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(len, t, w);
  wobble(g, wob, rng);
  return g;
}

// ── plants (multi-colour parts: `kit.addParts(fern(rng, 1), { matrix })`) ────────────────────────

/** a geometry + the colour to paint it: plants are a few of these */
export type Part = [THREE.BufferGeometry, ColorLike];

export const PLANT = {
  leaf: '#4f8f34', leafB: '#63a63c', leafDark: '#3c7430', leafLight: '#7fbf4a', stem: '#5b7a34',
  hibiscus: '#e2372c', hibiscusB: '#f0543a', stamen: '#ffd24a', lily: '#4f9a3c', lilyB: '#66ad45', lotus: '#f4f0ea', lotusPink: '#f2b6c6',
  grass: '#7cbc45', grassB: '#95cc55', grassTip: '#b9dc6e',
};

/**
 * A leaf along +z from the origin: a diamond folded along its midrib (the edges ride `fold` × width above it), the tip
 * drooping `droop` × length. 4 triangles.
 */
export function leaf(len: number, w: number, fold = 0.25, droop = 0.3): THREE.BufferGeometry {
  const f = fold * w, mid = len * 0.42;
  const B = [0, 0, 0], L = [-w / 2, f, mid], R = [w / 2, f, mid], M = [0, -f * 0.2, mid], T = [0, -droop * len, len];
  return tris([...B, ...M, ...L, ...B, ...R, ...M, ...M, ...T, ...L, ...M, ...R, ...T]);
}

/** place a leaf: yaw about +y, then tilted up by `pitch` (0 = flat out, π/2 = straight up), at (x, y, z) */
function leafAt(g: THREE.BufferGeometry, yaw: number, pitch: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return g.rotateX(-pitch).rotateY(yaw).translate(x, y, z);
}

/** a fern: 7–9 long narrow fronds fanning out and up from the crown */
export function fern(rng: Rng, size = 1): Part[] {
  const out: Part[] = [];
  const n = rng.int(7, 9);
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25), len = size * rng.range(0.75, 1.1);
    out.push([leafAt(leaf(len, len * 0.2, 0.18, 0.35), yaw, rng.range(0.45, 0.85)), i % 3 === 0 ? PLANT.leafLight : i % 2 ? PLANT.leaf : PLANT.leafB]);
  }
  return out;
}

/** a broad-leaf clump (taro / monstera): 5–7 wide leaves on short stems */
export function broadClump(rng: Rng, size = 1): Part[] {
  const out: Part[] = [];
  const n = rng.int(5, 7);
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3), len = size * rng.range(0.6, 0.9), up = rng.range(0.15, 0.45) * size;
    const pitch = rng.range(0.35, 0.8);
    out.push([leafAt(leaf(len, len * 0.62, 0.22, 0.28), yaw, pitch, Math.sin(yaw) * 0.08 * size, up, Math.cos(yaw) * 0.08 * size), i % 2 ? PLANT.leafDark : PLANT.leaf]);
    out.push([log(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(yaw) * 0.08 * size, up, Math.cos(yaw) * 0.08 * size), 0.025 * size, 0.02 * size, 3), PLANT.stem]);
  }
  return out;
}

/** a hibiscus flower facing +y at the origin: five red petals and a yellow stamen */
export function hibiscus(r = 0.14): Part[] {
  const out: Part[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, b = a + Math.PI / 5, c = a - Math.PI / 5;
    const v = [0, 0, 0, Math.cos(c) * r * 0.75, r * 0.25, Math.sin(c) * r * 0.75, Math.cos(a) * r, r * 0.35, Math.sin(a) * r,
      0, 0, 0, Math.cos(a) * r, r * 0.35, Math.sin(a) * r, Math.cos(b) * r * 0.75, r * 0.25, Math.sin(b) * r * 0.75];
    out.push([tris(v), k % 2 ? PLANT.hibiscus : PLANT.hibiscusB]);
  }
  out.push([new THREE.ConeGeometry(r * 0.1, r * 0.9, 4).translate(0, r * 0.45, 0), PLANT.stamen]);
  return out;
}

/** a hibiscus bush: a broad-leaf clump with 3–5 flowers on top */
export function hibiscusBush(rng: Rng, size = 1): Part[] {
  const out = broadClump(rng, size);
  const n = rng.int(3, 5);
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0.1, 0.45) * size, y = rng.range(0.35, 0.6) * size, m = new THREE.Matrix4().makeRotationX(rng.range(-0.6, 0.6)).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * d, y, Math.sin(a) * d));
    for (const [g, c] of hibiscus(0.12 * size + 0.04)) out.push([g.applyMatrix4(m), c]);
  }
  return out;
}

/** a lily pad lying flat at y = 0: an 8-segment disc with a notch */
export function lilyPad(r: number, rot = 0): THREE.BufferGeometry {
  const v: number[] = [];
  for (let k = 0; k < 8; k++) {
    if (k === 0) continue;
    const a0 = rot + (k / 8) * Math.PI * 2, a1 = rot + ((k + 1) / 8) * Math.PI * 2;
    v.push(0, 0.01, 0, Math.cos(a1) * r, 0, Math.sin(a1) * r, Math.cos(a0) * r, 0, Math.sin(a0) * r);
  }
  return tris(v);
}

/** a lotus: six raised white petals round a yellow heart */
export function lotus(r = 0.16): Part[] {
  const out: Part[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, w = r * 0.45;
    const tip = [Math.cos(a) * r, r * 0.8, Math.sin(a) * r], l = [Math.cos(a + 0.6) * w, r * 0.15, Math.sin(a + 0.6) * w], rr = [Math.cos(a - 0.6) * w, r * 0.15, Math.sin(a - 0.6) * w];
    out.push([tris([0, 0, 0, ...l, ...tip, 0, 0, 0, ...tip, ...rr]), k % 2 ? PLANT.lotus : PLANT.lotusPink]);
  }
  out.push([new THREE.CylinderGeometry(r * 0.25, r * 0.2, r * 0.3, 5).translate(0, r * 0.2, 0), PLANT.stamen]);
  return out;
}

/** a grass tuft: 5–8 bent blades (one triangle each) */
export function grassTuft(rng: Rng, h = 0.4): Part[] {
  const out: Part[] = [];
  const n = rng.int(5, 8);
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2), lean = rng.range(0.15, 0.55), hh = h * rng.range(0.6, 1.1), w = h * 0.09;
    const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, tx = ox + Math.cos(a) * hh * lean, tz = oz + Math.sin(a) * hh * lean;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    out.push([tris([ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, hh, tz]), k % 3 === 0 ? PLANT.grassTip : k % 2 ? PLANT.grass : PLANT.grassB]);
  }
  return out;
}

/** a hanging vine strand from `top` down `len` m, a leaf pair every 0.3 m (in the plane across `across`) */
export function vineStrand(top: THREE.Vector3, len: number, across: THREE.Vector3, rng: Rng): Part[] {
  const out: Part[] = [];
  const bot = top.clone().add(new THREE.Vector3(rng.range(-0.1, 0.1), -len, rng.range(-0.1, 0.1)));
  const w = across.clone().normalize().multiplyScalar(0.035);
  out.push([tris([top.x - w.x, top.y, top.z - w.z, top.x + w.x, top.y, top.z + w.z, bot.x, bot.y, bot.z]), PLANT.stem]);
  for (let s = 0.25; s < len; s += 0.3) {
    const p = top.clone().lerp(bot, s / len), side = rng.next() < 0.5 ? 1 : -1, l = rng.range(0.1, 0.17);
    const tip = p.clone().addScaledVector(w, side * l / 0.035 * 0.9).add(new THREE.Vector3(0, -l * 0.6, 0));
    const b1 = p.clone().add(new THREE.Vector3(0, -l * 0.25, 0)).addScaledVector(w, side * 1.5);
    out.push([tris([p.x, p.y, p.z, b1.x, b1.y, b1.z, tip.x, tip.y, tip.z]), rng.next() < 0.5 ? PLANT.leaf : PLANT.leafB]);
  }
  return out;
}

// ── baked ambient occlusion ───────────────────────────────────────────────────────────────────────

export interface AOOptions {
  /** terrain height under (x, z) in the geometry's space — cells below it are solid (ground contact AO) */
  ground?: (x: number, z: number) => number;
  /** a constant floor instead of `ground` (creatures / props built at the origin) */
  floorY?: number;
  /** occupancy cell size in metres (default: fit the bbox into ~72 cells on the longest axis, ≥ 0.12) */
  cell?: number;
  /** ray length in metres (default 6 cells) */
  dist?: number;
  /** 0..1 how dark a fully occluded face goes (default 0.62) */
  strength?: number;
  /** colour a fully occluded face is pulled toward (a cool shadow, default a dusky violet) */
  tint?: ColorLike;
  /** faces pointing down lose this much extra light (sky occlusion by orientation, default 0.18) */
  downDark?: number;
}

// 14 hemisphere directions in a +Z-up tangent frame (cosine-ish spread, fixed so bakes are deterministic)
const HEMI: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const rings: [number, number][] = [[0.95, 1], [0.72, 5], [0.38, 8]];
  for (const [cz, n] of rings) {
    const s = Math.sqrt(1 - cz * cz);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + cz * 1.7; out.push([Math.cos(a) * s, Math.sin(a) * s, cz]); }
  }
  return out;
})();

/**
 * Darken each face of a non-indexed, vertex-coloured geometry by how enclosed it is. Works in the
 * geometry's own coordinate space (world for placed props, local for creatures).
 */
export function bakeAO(geo: THREE.BufferGeometry, o: AOOptions = {}): void {
  if (!geo.hasAttribute('color') || geo.index !== null) return;
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb === null) return;
  const ext = new THREE.Vector3().subVectors(bb.max, bb.min);
  const cell = o.cell ?? Math.max(0.12, Math.max(ext.x, ext.y, ext.z) / 72);
  const pad = 2;
  const ox = bb.min.x - pad * cell, oy = bb.min.y - pad * cell, oz = bb.min.z - pad * cell;
  const nx = Math.ceil(ext.x / cell) + pad * 2 + 1, ny = Math.ceil(ext.y / cell) + pad * 2 + 1, nz = Math.ceil(ext.z / cell) + pad * 2 + 1;
  const grid = new Uint8Array(nx * ny * nz);
  const idx = (ix: number, iy: number, iz: number) => (iz * ny + iy) * nx + ix;

  // rasterise triangles: barycentric samples at ≤ 0.7 cell spacing
  const fc = pos.count / 3;
  for (let f = 0; f < fc; f++) {
    const i = f * 3;
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az;
    const cx = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz = pos.getZ(i + 2) - az;
    const e = Math.max(Math.hypot(bx, by, bz), Math.hypot(cx, cy, cz), Math.hypot(cx - bx, cy - by, cz - bz));
    const n = Math.min(400, Math.max(1, Math.ceil(e / (cell * 0.7))));
    for (let u = 0; u <= n; u++) for (let v = 0; u + v <= n; v++) {
      const s = u / n, t = v / n;
      const ix = Math.floor((ax + bx * s + cx * t - ox) / cell), iy = Math.floor((ay + by * s + cy * t - oy) / cell), iz = Math.floor((az + bz * s + cz * t - oz) / cell);
      grid[idx(ix, iy, iz)] = 1;
    }
  }
  // ground: a column cache of cell indices below the terrain (or a constant floor)
  let groundCell: Int32Array | null = null;
  if (o.ground || o.floorY !== undefined) {
    groundCell = new Int32Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const gy = o.ground ? o.ground(ox + (ix + 0.5) * cell, oz + (iz + 0.5) * cell) : (o.floorY ?? 0);
      groundCell[iz * nx + ix] = Math.floor((gy - oy) / cell);
    }
  }
  const solid = (ix: number, iy: number, iz: number): boolean => {
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
    if (groundCell !== null && iy <= (groundCell[iz * nx + ix] ?? -1)) return true;
    if (iy < 0 || iy >= ny) return false;
    return grid[idx(ix, iy, iz)] === 1;
  };

  const dist = o.dist ?? cell * 6;
  const steps = Math.max(3, Math.round(dist / cell));
  const strength = o.strength ?? 0.62, downDark = o.downDark ?? 0.18;
  const tint = new THREE.Color().copy(asColor(o.tint ?? '#4a4466'));
  if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  const N =new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3();
  for (let f = 0; f < fc; f++) {
    const i = f * 3;
    N.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    if (N.lengthSq() < 0.5) continue;
    T.set(Math.abs(N.y) < 0.9 ? 0 : 1, Math.abs(N.y) < 0.9 ? 1 : 0, 0).cross(N).normalize(); B.crossVectors(N, T);
    // start one cell off the face so the face's own cell doesn't occlude it
    const px = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 + N.x * cell * 1.05;
    const py = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 + N.y * cell * 1.05;
    const pz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 + N.z * cell * 1.05;
    let occ = 0, wsum = 0;
    for (const [hx, hy, hz] of HEMI) {
      const dx = T.x * hx + B.x * hy + N.x * hz, dy = T.y * hx + B.y * hy + N.y * hz, dz = T.z * hx + B.z * hy + N.z * hz;
      const w = hz; wsum += w;
      for (let s = 0; s < steps; s++) {
        const d = (s + 0.5) * cell;
        if (solid(Math.floor((px + dx * d - ox) / cell), Math.floor((py + dy * d - oy) / cell), Math.floor((pz + dz * d - oz) / cell))) { occ += w * (1 - (s / steps) * 0.5); break; }
      }
    }
    const a = Math.min(1, (occ / wsum) * strength + Math.max(0, -N.y) * downDark);
    for (let k = 0; k < 3; k++) {
      const v = i + k;
      col.setXYZ(v, col.getX(v) * (1 - a) + col.getX(v) * tint.r * a, col.getY(v) * (1 - a) + col.getY(v) * tint.g * a, col.getZ(v) * (1 - a) + col.getZ(v) * tint.b * a);
    }
  }
  col.needsUpdate = true;
}

// ── baked point light ─────────────────────────────────────────────────────────────────────────────

export interface BakedLight { x: number; y: number; z: number; color: ColorLike; /** metres to zero */ range: number; /** 0..~2 */ intensity: number }

/**
 * Bake warm lantern / ember light into the vertex colours (after `finish`, so the AO is under it): every face that
 * FACES a light within its range is lifted toward colour × light (smooth falloff × N·L). No shadowing — a face behind a
 * wall that faces the light still catches it — so keep ranges inside the room they light. Runtime cost: none, which is
 * the point (no point light in every shader, no program recompile when a lantern goes out).
 */
export function bakeLight(geo: THREE.BufferGeometry, lights: BakedLight[]): void {
  if (!geo.hasAttribute('color') || geo.index !== null || lights.length === 0) return;
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  const lc = lights.map((l) => asColor(l.color).clone());
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < lights.length; k++) {
      const l = lights[k], c = lc[k];
      if (l === undefined || c === undefined) continue;
      const dx = l.x - cx, dy = l.y - cy, dz = l.z - cz, d = Math.hypot(dx, dy, dz);
      if (d >= l.range) continue;
      const ndl = d < 1e-4 ? 1 : Math.max(0, (dx * nx + dy * ny + dz * nz) / d);
      const f = (1 - d / l.range) ** 1.4 * (0.35 + 0.65 * ndl) * l.intensity;
      r += c.r * f; g += c.g * f; b += c.b * f;
    }
    if (r + g + b <= 0) continue;
    for (let j = 0; j < 3; j++) {
      const v = i + j;
      col.setXYZ(v, col.getX(v) * (1 + r * 2.2) + r * 0.16, col.getY(v) * (1 + g * 2.2) + g * 0.16, col.getZ(v) * (1 + b * 2.2) + b * 0.16);
    }
  }
  col.needsUpdate = true;
}

/** a flat list of triangles ([x,y,z]×3 per face) as a geometry for `kit.add` */
export function tris(v: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

// ── material ──────────────────────────────────────────────────────────────────────────────────────

const materials = new WeakMap<Sky, Map<string, THREE.MeshStandardMaterial>>();

/**
 * The one flat-shaded vertex-colour material every Driftwood model shares (so they batch into one
 * program and the scene pays one material state). `variant` keys an extra copy (e.g. 'glow' with an
 * emissive), everything else should take the default.
 */
export function lowPolyMaterial(sky: Sky, variant = 'default', init?: (m: THREE.MeshStandardMaterial) => void): THREE.MeshStandardMaterial {
  let bySky = materials.get(sky);
  if (!bySky) { bySky = new Map(); materials.set(sky, bySky); }
  let m = bySky.get(variant);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    // every kit model can sway (M5): geometry without aSway reads weight 0 and stays put
    m.onBeforeCompile = (sh) => { attachFogUniforms(sh); patchSway(sh); };
    m.customProgramCacheKey = () => `lowpoly-${variant}`;
    init?.(m);
    sky.setupMaterial(m);
    bySky.set(variant, m);
  }
  return m;
}
