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
import type { SkyRig as Sky } from './skyRig';
import { patchSway, swayByHeight } from './wind';
import { attachFogUniforms } from './Atmosphere';
import { PATCH_ORDER, patchShader } from '../render/shaderPatches';
import { voxelAO, aoTint, hemisphere } from './voxelAO';
import { wobble, log, tris } from './geometryKit';

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

// the shared engine geometry kit (E357 X5): imported here for the kit's own users


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
const HEMI = hemisphere([[0.95, 1], [0.72, 5], [0.38, 8]], 1.7);

/**
 * Darken each face of a non-indexed, vertex-coloured geometry by how enclosed it is (the one `voxelAO`, per face). Works
 * in the geometry's own coordinate space (world for placed props, local for creatures).
 */
export function bakeAO(geo: THREE.BufferGeometry, o: AOOptions = {}): void {
  if (!geo.hasAttribute('color') || geo.index !== null) return;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb === null) return;
  const ext = new THREE.Vector3().subVectors(bb.max, bb.min);
  const cell = o.cell ?? Math.max(0.12, Math.max(ext.x, ext.y, ext.z) / 72);
  const { ground, floorY } = o;
  const dist = o.dist ?? cell * 6;
  const tint = new THREE.Color().copy(asColor(o.tint ?? '#4a4466'));
  if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
  const k = voxelAO(geo, {
    box: bb, cell, pad: 2, spacing: 0.7, maxSamples: 400, indexed: false,
    ...(ground ? { ground: { columns: ground } } : floorY !== undefined ? { ground: { columns: () => floorY } } : {}),
    sample: 'face', offset: 1.05, hemi: HEMI, steps: Math.max(3, Math.round(dist / cell)), stepLen: cell, falloff: 0.5,
    strength: o.strength ?? 0.62, downDark: o.downDark ?? 0.18,
  });
  aoTint(geo.getAttribute('color'), k, tint);
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

// ── material ──────────────────────────────────────────────────────────────────────────────────────

const materials = new WeakMap<Sky, Map<string, THREE.MeshStandardMaterial>>();

const SHADOW_NORMAL = 'vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );';

/**
 * E112: turn each face's shadow normal-bias offset toward the light. The kit draws every model two-sided, and a lot of it
 * is single sheets (the hut's hipped roof, the lookout banner, the wreck's torn sail, fringe, vines). three pushes the
 * shadow lookup along the geometric normal (`normalBias`, 0.14 m here); on a sheet wound away from the sun that pushes it
 * through the sheet, so the sunlit face read its own shadow: the whole hut roof sat in shade all day, and the sails and
 * banner came out dark with ragged lit edges and per-triangle streaks. A face turned from the light is unlit by N·L
 * anyway, so flipping its offset changes nothing for closed shapes and frees the sheets. No extra draw calls.
 */
function patchShadowNormal(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string }, lightDir: THREE.Vector3): void {
  if (!shader.vertexShader.includes('#include <shadowmap_vertex>') || !THREE.ShaderChunk.shadowmap_vertex.includes(SHADOW_NORMAL)) {
    console.warn('[lowpoly] shadowmap_vertex changed: the E112 shadow-normal flip is off');
    return;
  }
  shader.uniforms['uShadowLightDir'] = { value: lightDir };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uShadowLightDir;')
    .replace('#include <shadowmap_vertex>', THREE.ShaderChunk.shadowmap_vertex.replace(SHADOW_NORMAL,
      `${SHADOW_NORMAL}\n\t\tif ( dot( shadowWorldNormal, uShadowLightDir ) > 0.0 ) shadowWorldNormal = - shadowWorldNormal;`));
}

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
    // csm.lightDirection is the one vector the day / night clock copies the sun (or the moon) into, so the uniform follows it
    patchShader(m, 'engine.lowpoly-kit', PATCH_ORDER.material, (sh) => { attachFogUniforms(sh); patchSway(sh); patchShadowNormal(sh, sky.csm.lightDirection); }, { mode: 'replace', key: `lowpoly-${variant}` });
    init?.(m);
    sky.setupMaterial(m);
    bySky.set(variant, m);
  }
  return m;
}
