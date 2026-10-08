/**
 * pineCoats — one rigged Pine Hollow hull, every coat (PINE-HOLLOW-REMASTER PH-M1 / PH-M2): the hull's photoreal atlas
 * recoloured per variant, plus the marks a recolour cannot make, painted onto the atlas by where each texel sits on the
 * animal (pineCreatures.ts).
 *
 *   const map = pineCoatAtlas(key, spec, rig, variantDef, bones)   // a CanvasTexture (cached by key), or the rig's map
 *                                                                  // itself when the coat is the hull's own
 *   adoptPineCoat(key, ktx2)                                       // the KTX2 path: the baked coat stands in (G187)
 *
 * 1. Recolour (Nalati's creatureCoats.ts method, made shard-agnostic): the species' palette names three coat keys — dark,
 *    body and light. The atlas's own levels for them are measured (texel luminance sampled over the mesh at the 12th / 55th
 *    / 92nd percentiles); every texel sits between two keys by its log luminance and is multiplied, in linear RGB, by the
 *    matching blend of target ÷ source (target = the variant's palette, source = the variant the hull was generated as).
 *    Multiplying keeps every hair of the photo texture; only the tones move (white deer, black boar, the pale elk, Old
 *    Ironhide's iron grey, the brown bear's Grizzled Sow, …).
 * 2. Marks (VariantDef.traits): `piebald` (white patches), `blaze` (the black bear's cream chest crescent), `scar` (pale
 *    healed stripes over Scarback's withers) and `thrall` (PH-M2, board B3 pick A "Overgrown": the coat dark and dead,
 *    moss on the back and the upper flanks, lichen spots, bark scabs). Each texel's rest-pose position and normal come from
 *    rasterising the hull's triangles into the atlas (`surfaceOf`, cached per rig), so a mark is solid 3D noise over the
 *    body, seamless across the atlas's charts (the charts' gutters are dilated so mip levels don't bleed).
 */
import * as THREE from 'three';
import type { RGB } from '@wildshard/engine/entities/species/loft';
import { variantDef, type BoneDef, type VariantDef } from '@wildshard/engine/entities/species/registry';
import { smoothstep } from '@wildshard/engine/core/noise';

export interface CoatSpec {
  /** the species default palette (the variant's `tint` overrides keys of it) */
  palette: Readonly<Record<string, RGB>>;
  /** the variant the hull was generated as: [kind, variant id] (its tint, over `palette`, is the atlas's coat) */
  source: readonly [string, string];
  /** the palette keys: [dark, body, light] */
  keys: readonly [string, string, string];
  /**
   * E322 F-M2 (Debug ▸ Bear fix = B): per variant id, the coat keys' target tones (sRGB). The SOURCE tones are then
   * measured off the atlas itself (the mean colour round each key's luminance percentile), not taken from the palette,
   * so the hull's own tones land exactly on the targets. A variant not listed keeps the palette path. A `grizzle` entry
   * (the tips' colour) paints silver guard-hair tips over the hump, the shoulders and the back, the legs darker.
   */
  measured?: Readonly<Record<string, Readonly<Record<string, RGB>>>>;
}

/**
 * What a coat reads from the rig: its rest-pose geometry (position, normal, uv, index) and its atlas. `flap` (E322 F-M2,
 * bearFix.ts): per vertex, 1 where a generator's flap was pressed onto the body — those texels take the rump's colour
 * beside the patch, keeping their own hair detail (flapTransplant + applyFlapFill), feathered across the border.
 */
export interface CoatRig { geometry: THREE.BufferGeometry; map: THREE.Texture; flap?: Uint8Array | null }

const toLin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const LUT_N = 4096;
const toSrgb = new Uint8ClampedArray(LUT_N + 1).map((_, i) => { const c = i / LUT_N; return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); });
const linOf = (c: RGB): [number, number, number] => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
const enc = (v: number): number => toSrgb[Math.min(LUT_N, Math.max(0, Math.round(v * LUT_N)))] ?? 0;

const cache = new Map<string, THREE.Texture>();
const _ab = new THREE.Vector3(), _ap = new THREE.Vector3();

// ── 3D value noise (seeded hash lattice), for marks that are solid over the body ──
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
function fbm(x: number, y: number, z: number, oct: number): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 5.7); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ── the atlas's surface: per texel, the rest-pose position + normal under it ──
interface Surface { w: number; h: number; pos: Float32Array; nrm: Float32Array; covered: Uint8Array }
const surfaces = new WeakMap<THREE.BufferGeometry, Surface>();

/** rasterise the hull's triangles into atlas space (each texel: the interpolated position / normal), gutters dilated */
function surfaceOf(geo: THREE.BufferGeometry, w: number, h: number, flipY: boolean): Surface {
  const hit = surfaces.get(geo);
  if (hit?.w === w && hit.h === h) return hit;
  const pos = new Float32Array(w * h * 3), nrm = new Float32Array(w * h * 3), covered = new Uint8Array(w * h);
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal'), U = geo.getAttribute('uv'), idx = geo.getIndex();
  const nTri = idx ? idx.count / 3 : P.count / 3;
  const vi = (t: number, k: number): number => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const sx = [0, 0, 0], sy = [0, 0, 0], ids = [0, 0, 0];
  for (let t = 0; t < nTri; t++) {
    for (let k = 0; k < 3; k++) {
      const i = vi(t, k); ids[k] = i;
      sx[k] = U.getX(i) * w; sy[k] = (flipY ? 1 - U.getY(i) : U.getY(i)) * h;
    }
    const [x0, x1, x2] = sx as [number, number, number], [y0, y1, y2] = sy as [number, number, number];
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(d) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx1 = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by1 = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    const [i0, i1, i2] = ids as [number, number, number];
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d;
      const l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
      const l2 = 1 - l0 - l1;
      if (l0 < -0.02 || l1 < -0.02 || l2 < -0.02) continue;
      const o = y * w + x;
      covered[o] = 1;
      for (let c = 0; c < 3; c++) {
        pos[o * 3 + c] = l0 * P.getComponent(i0, c) + l1 * P.getComponent(i1, c) + l2 * P.getComponent(i2, c);
        nrm[o * 3 + c] = l0 * N.getComponent(i0, c) + l1 * N.getComponent(i1, c) + l2 * N.getComponent(i2, c);
      }
    }
  }
  // dilate 4 texels into the gutters, so a mark's edge never meets an unmarked gutter under mip filtering
  let front = covered;
  for (let pass = 0; pass < 4; pass++) {
    const next = new Uint8Array(front);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = y * w + x;
      if (front[o] !== 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const q = Y * w + X;
        if (front[q] === 0) continue;
        for (let c = 0; c < 3; c++) { pos[o * 3 + c] = pos[q * 3 + c] ?? 0; nrm[o * 3 + c] = nrm[q * 3 + c] ?? 0; }
        next[o] = 2;
        break;
      }
    }
    front = next;
  }
  const out: Surface = { w, h, pos, nrm, covered: front };
  surfaces.set(geo, out);
  return out;
}

/** the coat's source tint (the variant the hull was generated as) */
const srcTint = (spec: CoatSpec): Readonly<Record<string, RGB>> | undefined => variantDef(spec.source[0], spec.source[1]).tint;

/** true when `tint` changes none of the coat keys from the hull's own coat */
function isOwnCoat(spec: CoatSpec, tint: Readonly<Record<string, RGB>> | undefined): boolean {
  return spec.keys.every((k) => {
    const a = tint?.[k] ?? spec.palette[k], b = srcTint(spec)?.[k] ?? spec.palette[k];
    return a !== undefined && b !== undefined && a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 1e-3);
  });
}

/** the variant's marks (VariantDef.traits) that the atlas carries */
function marksOf(v: VariantDef): { piebald: boolean; blaze: boolean; scar: boolean; thrall: boolean } {
  const t = v.traits ?? {};
  return { piebald: Boolean(t['piebald']), blaze: Boolean(t['blaze']), scar: Boolean(t['scar']), thrall: Boolean(t['thrall']) };
}

/** true when (spec, variant) would repaint the atlas at all */
export function coatDiffers(spec: CoatSpec, v: VariantDef): boolean {
  const m = marksOf(v);
  return spec.measured?.[v.id] !== undefined || !isOwnCoat(spec, v.tint) || m.piebald || m.blaze || m.scar || m.thrall;
}

/**
 * Rasterise the triangles `want` accepts into atlas space: `visit(texel, l0, l1, l2, i0, i1, i2)` per covered texel with
 * its barycentrics and the triangle's vertex indices.
 */
function rasterTris(geo: THREE.BufferGeometry, w: number, h: number, flipY: boolean, want: (i0: number, i1: number, i2: number) => boolean,
  visit: (o: number, l0: number, l1: number, l2: number, i0: number, i1: number, i2: number) => void): void {
  const U = geo.getAttribute('uv'), idx = geo.getIndex();
  const nTri = idx ? idx.count / 3 : U.count / 3;
  for (let t = 0; t < nTri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    if (!want(i0, i1, i2)) continue;
    const x0 = U.getX(i0) * w, x1 = U.getX(i1) * w, x2 = U.getX(i2) * w;
    const fy = (i: number): number => (flipY ? 1 - U.getY(i) : U.getY(i)) * h;
    const y0 = fy(i0), y1 = fy(i1), y2 = fy(i2);
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(d) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx1 = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by1 = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d;
      const l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
      const l2 = 1 - l0 - l1;
      if (l0 < -0.02 || l1 < -0.02 || l2 < -0.02) continue;
      visit(y * w + x, l0, l1, l2, i0, i1, i2);
    }
  }
}

/** a pressed flap's texels and, per texel, the coat texel it takes its colour from (flapTransplant) */
export interface FlapMap { dst: Int32Array; src: Int32Array; w: Float32Array }
const flapMaps = new WeakMap<THREE.BufferGeometry, FlapMap & { W: number; H: number }>();

/**
 * Where a pressed flap (CoatRig.flap) takes its colour from (cached per geometry and atlas size). The flap's texels are
 * the generator's tail — paler than the rump — and one tint for all of them never matched (tried: a mean-ratio tone left
 * a visible patch): each takes the colour of the rump's own texel beside the patch — its rest position pushed sideways
 * out of the patch (away from the patch's centre line, by the patch's width), then the nearest texel there that is not
 * flap and faces the same way. `w` feathers it: the flag interpolated across the border triangles. applyFlapFill blurs
 * it (a per-texel copy is a mosaic) and keeps the flap's own hair detail.
 */
export function flapTransplant(geo: THREE.BufferGeometry, flap: Uint8Array, W: number, H: number, flipY: boolean): FlapMap | null {
  const hit = flapMaps.get(geo);
  if (hit?.W === W && hit.H === H) return hit;
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal');
  if (flap.length !== P.count) return null;
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < P.count; i++) if (flap[i] === 1) { x0 = Math.min(x0, P.getX(i)); x1 = Math.max(x1, P.getX(i)); }
  if (!Number.isFinite(x0)) return null;
  const xc = (x0 + x1) / 2, shift = Math.max(0.06, x1 - x0);
  // the flap's texels (+ their position, normal and feather)
  const dst: number[] = [], wt: number[] = [], at: number[] = [];
  const mark = new Uint8Array(W * H);
  rasterTris(geo, W, H, flipY, (i0, i1, i2) => flap[i0] === 1 || flap[i1] === 1 || flap[i2] === 1, (o, l0, l1, l2, i0, i1, i2) => {
    if (mark[o] === 1) return;
    mark[o] = 1;
    dst.push(o);
    wt.push(Math.min(1, Math.max(0, l0 * (flap[i0] ?? 0) + l1 * (flap[i1] ?? 0) + l2 * (flap[i2] ?? 0))));
    for (const A of [P, N]) for (let c = 0; c < 3; c++) at.push(l0 * A.getComponent(i0, c) + l1 * A.getComponent(i1, c) + l2 * A.getComponent(i2, c));
  });
  // every other texel of the body, in a 2 cm grid
  const s = surfaceOf(geo, W, H, flipY);
  const CELL = 0.02, grid = new Map<string, number[]>();
  const cell = (x: number, y: number, z: number): string => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  for (let o = 0; o < W * H; o++) {
    if (s.covered[o] !== 1 || mark[o] === 1) continue;
    const k = cell(s.pos[o * 3] ?? 0, s.pos[o * 3 + 1] ?? 0, s.pos[o * 3 + 2] ?? 0);
    const list = grid.get(k);
    if (list) list.push(o); else grid.set(k, [o]);
  }
  const src = new Int32Array(dst.length).fill(-1);
  for (let j = 0; j < dst.length; j++) {
    const px = at[j * 6] ?? 0, py = at[j * 6 + 1] ?? 0, pz = at[j * 6 + 2] ?? 0, nx = at[j * 6 + 3] ?? 0, ny = at[j * 6 + 4] ?? 0, nz = at[j * 6 + 5] ?? 0;
    const qx = px + (px >= xc ? shift : -shift);
    const cx = Math.floor(qx / CELL), cy = Math.floor(py / CELL), cz = Math.floor(pz / CELL);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= 8 && best < 0; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
        const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!list) continue;
        for (const o of list) {
          if ((s.nrm[o * 3] ?? 0) * nx + (s.nrm[o * 3 + 1] ?? 0) * ny + (s.nrm[o * 3 + 2] ?? 0) * nz < 0.2) continue;
          const d = ((s.pos[o * 3] ?? 0) - qx) ** 2 + ((s.pos[o * 3 + 1] ?? 0) - py) ** 2 + ((s.pos[o * 3 + 2] ?? 0) - pz) ** 2;
          if (d < bd) { bd = d; best = o; }
        }
      }
    }
    src[j] = best;
  }
  const out = { dst: Int32Array.from(dst), src, w: Float32Array.from(wt), W, H };
  flapMaps.set(geo, out);
  return out;
}

/**
 * Fill a pressed flap's texels in `px` (the atlas, RGBA bytes): the transplanted rump colour, box-blurred over the flap's
 * own texels (a per-texel copy alone came back as a mosaic — neighbouring texels take their fur from different charts),
 * times the flap's own hair detail (its luminance over its blurred luminance), feathered by `w`.
 */
function applyFlapFill(m: FlapMap, px: Uint8ClampedArray, W: number, H: number): void {
  const n = W * H, mask = new Float32Array(n), col = new Float32Array(n * 3), lum = new Float32Array(n);
  for (let j = 0; j < m.dst.length; j++) {
    const d = m.dst[j] ?? 0, sI = m.src[j] ?? -1;
    if (sI < 0) continue;
    mask[d] = 1;
    for (let c = 0; c < 3; c++) col[d * 3 + c] = px[sI * 4 + c] ?? 0;
    lum[d] = 0.2126 * (px[d * 4] ?? 0) + 0.7152 * (px[d * 4 + 1] ?? 0) + 0.0722 * (px[d * 4 + 2] ?? 0);
  }
  // masked separable box blur (2 passes each way), radius ~6 texels at 1024²
  const R = Math.max(2, Math.round(6 * W / 1024));
  const blur = (src: Float32Array, k: number): Float32Array => {
    let cur = src, wts = mask;
    for (let pass = 0; pass < 4; pass++) {
      const horiz = pass % 2 === 0, out = new Float32Array(n * k), ow = new Float32Array(n);
      const len = horiz ? W : H, lines = horiz ? H : W;
      for (let li = 0; li < lines; li++) {
        const at = (t: number): number => (horiz ? li * W + t : t * W + li);
        const acc = new Float64Array(k);
        let aw = 0;
        for (let t = -R; t < len + R; t++) {
          const a = t + R, b = t - R - 1;
          if (a < len && a >= 0) { const o = at(a), mw = wts[o] ?? 0; aw += mw; for (let c = 0; c < k; c++) acc[c] = (acc[c] ?? 0) + (cur[o * k + c] ?? 0) * mw; }
          if (b >= 0 && b < len) { const o = at(b), mw = wts[o] ?? 0; aw -= mw; for (let c = 0; c < k; c++) acc[c] = (acc[c] ?? 0) - (cur[o * k + c] ?? 0) * mw; }
          if (t < 0 || t >= len) continue;
          const o = at(t);
          if ((mask[o] ?? 0) === 0 || aw <= 1e-6) continue;
          for (let c = 0; c < k; c++) out[o * k + c] = (acc[c] ?? 0) / aw;
          ow[o] = 1;
        }
      }
      cur = out; wts = ow;
    }
    return cur;
  };
  const bc = blur(col, 3), bl = blur(lum, 1);
  for (let j = 0; j < m.dst.length; j++) {
    const d = m.dst[j] ?? 0, w = m.w[j] ?? 0;
    if ((mask[d] ?? 0) === 0 || w <= 0) continue;
    const detail = Math.min(1.5, Math.max(0.6, (lum[d] ?? 0) / Math.max(1, bl[d] ?? 0)));
    for (let c = 0; c < 3; c++) {
      const v = Math.min(255, (bc[d * 3 + c] ?? 0) * detail);
      px[d * 4 + c] = (px[d * 4 + c] ?? 0) + (v - (px[d * 4 + c] ?? 0)) * w;
    }
  }
}

/** a bone's rest position (the rig's joints) */
function boneAt(bones: readonly BoneDef[], name: string): THREE.Vector3 | null {
  const b = bones.find((x) => x.name === name);
  return b ? new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2]) : null;
}

/**
 * G187 cut 2: a coat baked offline (scripts/bake-coats.mjs renders every coat with pineCoatAtlas itself, then encodes
 * it as KTX2) stands in for the canvas under the same key; the KTX2 path adopts them at preload (hulls.ts), so
 * pineCoatAtlas returns the compressed texture and never reads the hull's pixels.
 */
export function adoptPineCoat(key: string, tex: THREE.Texture): void { cache.set(key, tex); }

/**
 * The hull's atlas in variant `v`'s coat (cached by `key`). `bones` are the rest joints the rig is bound to (they place
 * the blaze and the scars). Returns `rig.map` itself when nothing changes, or when the atlas can't be read.
 */
export function pineCoatAtlas(key: string, spec: CoatSpec, rig: CoatRig, v: VariantDef, bones: readonly BoneDef[]): THREE.Texture {
  const map = rig.map;
  const flap = rig.flap ?? null;
  const measured = spec.measured?.[v.id];
  if (!coatDiffers(spec, v) && flap === null) return map;
  const hit = cache.get(key);
  if (hit) return hit;
  // a KTX2 hull has no pixels to paint: its coats are baked (scripts/bake-coats.mjs) and adopted at preload; a coat
  // the bake doesn't hold keeps the hull's own
  if (map instanceof THREE.CompressedTexture) return map;
  const img = map.image as (CanvasImageSource & { width: number; height: number }) | null;
  if (!img || typeof document === 'undefined') return map;
  const W = img.width, H = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return map;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const geometry = rig.geometry, flipY = map.flipY;
  // ── 0. a pressed flap (E322 F-M2) takes the rump's fur beside it ──
  if (flap !== null) { const fm = flapTransplant(geometry, flap, W, H, flipY); if (fm) applyFlapFill(fm, px, W, H); }
  const texel = (u: number, vv: number): number => {
    const x = Math.min(W - 1, Math.max(0, Math.floor((u - Math.floor(u)) * W)));
    const yy = flipY ? 1 - vv : vv;
    const y = Math.min(H - 1, Math.max(0, Math.floor((yy - Math.floor(yy)) * H)));
    return (y * W + x) * 4;
  };
  // linear working copy
  const lin = new Float32Array(W * H * 3);
  for (let i = 0, o = 0; i < W * H; i++, o += 4) { lin[i * 3] = toLin[px[o] ?? 0] ?? 0; lin[i * 3 + 1] = toLin[px[o + 1] ?? 0] ?? 0; lin[i * 3 + 2] = toLin[px[o + 2] ?? 0] ?? 0; }

  // ── 1. recolour by the palette keys ──
  if (measured !== undefined || !isOwnCoat(spec, v.tint)) {
    const uv = geometry.getAttribute('uv'), idx = geometry.getIndex();
    const nTri = idx ? idx.count / 3 : uv.count / 3;
    const lums: number[] = [];
    const cols: [number, number, number, number][] = [];   // (lum, r, g, b) per sample: the measured source tones
    let seed = 1234567;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let s = 0; s < 24000; s++) {
      const t = Math.floor(rnd() * nTri);
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      let a = rnd(), b = rnd(); if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const u = uv.getX(i0) + (uv.getX(i1) - uv.getX(i0)) * a + (uv.getX(i2) - uv.getX(i0)) * b;
      const w = uv.getY(i0) + (uv.getY(i1) - uv.getY(i0)) * a + (uv.getY(i2) - uv.getY(i0)) * b;
      const o = texel(u, w) / 4;
      const lr = lin[o * 3] ?? 0, lg = lin[o * 3 + 1] ?? 0, lb = lin[o * 3 + 2] ?? 0, lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      lums.push(lum);
      if (measured !== undefined) cols.push([lum, lr, lg, lb]);
    }
    lums.sort((p, q) => p - q);
    const pct = (p: number): number => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))] ?? 0.1;
    const Ls = [Math.log(Math.max(1e-4, pct(0.12))), Math.log(Math.max(1e-4, pct(0.55))), Math.log(Math.max(1e-4, pct(0.92)))];
    // measured (E322 F-M2): each key's source = the atlas's mean linear colour over ±5 % round its percentile
    cols.sort((p, q) => p[0] - q[0]);
    const meanAt = (p: number): [number, number, number] => {
      const a = Math.max(0, Math.floor((p - 0.05) * cols.length)), b = Math.min(cols.length, Math.ceil((p + 0.05) * cols.length));
      const s: [number, number, number] = [0, 0, 0];
      for (let i = a; i < b; i++) { const c = cols[i]; if (c) { s[0] += c[1]; s[1] += c[2]; s[2] += c[3]; } }
      const k = Math.max(1, b - a);
      return [s[0] / k, s[1] / k, s[2] / k];
    };
    const measuredSrc = measured !== undefined ? [meanAt(0.12), meanAt(0.55), meanAt(0.92)] : null;
    const tgtOf = (k: string): RGB => measured?.[k] ?? v.tint?.[k] ?? spec.palette[k] ?? [1, 1, 1];
    const srcOf = (k: string): RGB => srcTint(spec)?.[k] ?? spec.palette[k] ?? [1, 1, 1];
    const srcLin = (k: string, i: number): [number, number, number] => measuredSrc?.[i] ?? linOf(srcOf(k));
    const ratios = spec.keys.map((k, ki) => { const a = linOf(tgtOf(k)), b = srcLin(k, ki); return a.map((x, i) => Math.min(14, x / Math.max(1e-3, b[i] ?? 1))); });
    const satOf = (c: [number, number, number]): number => { const mx = Math.max(...c); return mx > 0 ? 1 - Math.min(...c) / mx : 0; };
    // measured: the per-channel ratios already land every key's mean exactly on its target — no extra saturation push
    const sats = spec.keys.map((k, ki) => (measuredSrc !== null ? 1 : Math.min(1.3, satOf(linOf(tgtOf(k))) / Math.max(0.05, satOf(srcLin(k, ki))))));
    const l0 = Ls[0] ?? 0, l1 = Ls[1] ?? 0, l2 = Ls[2] ?? 0;
    for (let i = 0; i < W * H; i++) {
      const r = lin[i * 3] ?? 0, g = lin[i * 3 + 1] ?? 0, b = lin[i * 3 + 2] ?? 0;
      const L = Math.log(Math.max(1e-4, 0.2126 * r + 0.7152 * g + 0.0722 * b));
      const k0 = L < l1 ? 0 : L < l2 ? 1 : 2, k1 = L <= l0 ? 0 : L < l2 ? k0 + 1 : 2;
      let f = L <= l0 || L >= l2 ? 0 : L < l1 ? (L - l0) / Math.max(1e-6, l1 - l0) : (L - l1) / Math.max(1e-6, l2 - l1);
      f = f * f * (3 - 2 * f);
      const ra = ratios[k0] ?? [1, 1, 1], rb = ratios[k1] ?? [1, 1, 1];
      let mr = (ra[0] ?? 1) + ((rb[0] ?? 1) - (ra[0] ?? 1)) * f, mg = (ra[1] ?? 1) + ((rb[1] ?? 1) - (ra[1] ?? 1)) * f, mb = (ra[2] ?? 1) + ((rb[2] ?? 1) - (ra[2] ?? 1)) * f;
      const sa = sats[k0] ?? 1, sk = sa + ((sats[k1] ?? 1) - sa) * f;
      if (sk < 0.999 || sk > 1.001) {
        const lr = r * mr, lg = g * mg, lb = b * mb, Lm = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
        const dd = (x: number): number => (Lm + (x - Lm) * sk) / Math.max(1e-5, x);
        mr *= dd(lr); mg *= dd(lg); mb *= dd(lb);
      }
      lin[i * 3] = Math.min(1, r * mr); lin[i * 3 + 1] = Math.min(1, g * mg); lin[i * 3 + 2] = Math.min(1, b * mb);
    }
  }

  // ── 2. the marks, by where each texel sits on the animal ──
  const marks = marksOf(v);
  if (marks.piebald || marks.blaze || marks.scar || marks.thrall) {
    const s = surfaceOf(geometry, W, H, flipY);
    const box = geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
    const height = Math.max(0.2, box.max.y - box.min.y);
    const neck = boneAt(bones, 'neck1'), body = boneAt(bones, 'body'), head = boneAt(bones, 'head');
    // Scarback's three healed rakes over the withers (fixed per key, so the same boar always wears the same scars)
    const rakes: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
    if (marks.scar && body && neck) {
      for (let k = 0; k < 3; k++) {
        const z = body.z + (neck.z - body.z) * (0.35 + 0.22 * k);
        rakes.push({ a: new THREE.Vector3(0.28, body.y + 0.2, z + 0.12), b: new THREE.Vector3(-0.2, body.y - 0.1, z - 0.18) });
      }
    }
    const segDist = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => {
      const ab = _ab.subVectors(b, a), t = Math.min(1, Math.max(0, _ap.subVectors(p, a).dot(ab) / Math.max(1e-6, ab.lengthSq())));
      return _ap.copy(a).addScaledVector(ab, t).distanceTo(p);
    };
    const p = new THREE.Vector3();
    const white = linOf([0.93, 0.91, 0.86]), cream = linOf([0.82, 0.74, 0.58]), scarCol = linOf([0.78, 0.62, 0.55]);
    const mossDark = linOf([0.09, 0.13, 0.04]), mossLight = linOf([0.34, 0.41, 0.11]), lichen = linOf([0.47, 0.52, 0.42]), bark = linOf([0.13, 0.095, 0.065]);
    const sc = 1 / height;   // noise in units of the animal's height, so a boar and an elk wear the same-sized moss
    for (let i = 0; i < W * H; i++) {
      if (s.covered[i] === 0) continue;
      p.set(s.pos[i * 3] ?? 0, s.pos[i * 3 + 1] ?? 0, s.pos[i * 3 + 2] ?? 0);
      const ny = s.nrm[i * 3 + 1] ?? 0, nz = s.nrm[i * 3 + 2] ?? 0;
      let r = lin[i * 3] ?? 0, g = lin[i * 3 + 1] ?? 0, b = lin[i * 3 + 2] ?? 0;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const detail = Math.min(1.6, Math.max(0.55, Math.sqrt(lum / 0.08)));   // the photo's own hair detail, as a lightness factor
      const X = p.x * sc, Y = p.y * sc, Z = p.z * sc;
      if (marks.piebald) {
        // white patches over the flanks and the legs, ragged edges; the face and the back mostly keep the coat
        const n = fbm(X * 3.2 + 5, Y * 3.2, Z * 3.2, 4) + 0.1 * (1 - Math.abs(ny)) - 0.08 * smoothstep(0.5, 0.9, ny);
        const m = smoothstep(0.57, 0.61, n);
        if (m > 0) { r += (white[0] * detail * 0.8 - r) * m; g += (white[1] * detail * 0.8 - g) * m; b += (white[2] * detail * 0.8 - b) * m; }
      }
      if (marks.blaze && neck && body) {
        // a cream crescent on the chest, under the throat, facing forward
        const cz = neck.z + 0.05 * height, cy = neck.y - 0.14 * height;
        const dx = p.x / (0.2 * height), dy = (p.y - cy) / (0.11 * height), dz = (p.z - cz) / (0.3 * height);
        const e = dx * dx + dy * dy * (1 + 0.6 * Math.abs(dx)) + dz * dz;
        const m = (1 - smoothstep(0.7, 1.05, e + 0.25 * (fbm(X * 12, Y * 12, Z * 12, 2) - 0.5))) * smoothstep(-0.2, 0.3, nz);
        if (m > 0) { r += (cream[0] * detail * 0.9 - r) * m; g += (cream[1] * detail * 0.9 - g) * m; b += (cream[2] * detail * 0.9 - b) * m; }
      }
      if (rakes.length > 0) {
        let dmin = Infinity;
        for (const rk of rakes) dmin = Math.min(dmin, segDist(p, rk.a, rk.b));
        const m = (1 - smoothstep(0.012, 0.03, dmin + 0.012 * (fbm(X * 30, Y * 30, Z * 30, 2) - 0.5))) * smoothstep(-0.3, 0.2, ny);
        if (m > 0) { r += (scarCol[0] * 0.8 - r) * m; g += (scarCol[1] * 0.8 - g) * m; b += (scarCol[2] * 0.8 - b) * m; }
      }
      if (marks.thrall) {
        // the coat dead and damp: darker, colder, less saturated
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = (L + (r - L) * 0.6) * 0.75; g = (L + (g - L) * 0.6) * 0.77; b = (L + (b - L) * 0.6) * 0.75;
        const up = ny, headZ = head ? head.z : Infinity;
        const face = head ? smoothstep(0.25 * height, 0.1 * height, p.distanceTo(head)) : 0;   // the face stays bare (the eyes must read)
        // moss: the back, the withers and the upper flanks, in clumps with ragged, fuzzy edges; tufts down the legs; never the face
        const clump = fbm(X * 4.5 + 3, Y * 4.5, Z * 4.5, 4), grain = fbm(X * 40, Y * 40, Z * 40, 2), fine = noise3(X * 140, Y * 140, Z * 140);
        const low = smoothstep(0.35 * height, 0.1 * height, p.y) * smoothstep(0.55, 0.68, fbm(X * 7 + 9, Y * 7, Z * 7, 3) + (grain - 0.5) * 0.2);   // leg tufts
        const moss = Math.max(smoothstep(0.42, 0.6, 0.55 * up + clump * 0.9 + 0.02 + (grain - 0.5) * 0.4 + (fine - 0.5) * 0.12 + (p.z > headZ - 0.1 ? -1 : 0)), low) * (1 - face);
        if (moss > 0) {
          // cushion moss: dark hollows, bright yellow-green tips, a grain of fronds
          const t = Math.min(1, Math.max(0, fbm(X * 28, Y * 28, Z * 28, 3) * 1.4 - 0.2 + (fine - 0.5) * 0.5));
          const sh = (0.55 + 0.7 * grain) * (0.8 + 0.4 * fine);
          const mr = (mossDark[0] + (mossLight[0] - mossDark[0]) * t) * sh, mg = (mossDark[1] + (mossLight[1] - mossDark[1]) * t) * sh, mb = (mossDark[2] + (mossLight[2] - mossDark[2]) * t) * sh;
          r += (mr - r) * moss; g += (mg - g) * moss; b += (mb - b) * moss;
        }
        // lichen: small pale rosettes on the bare hide round the moss; bark scabs on the flanks and the haunches
        const li = smoothstep(0.73, 0.76, fbm(X * 38 + 7, Y * 38, Z * 38, 3)) * (1 - face) * (1 - moss * 0.75) * (0.5 + 0.5 * smoothstep(-0.3, 0.3, up)) * 0.55;
        if (li > 0) { r += (lichen[0] * (0.8 + 0.4 * fine) - r) * li; g += (lichen[1] * (0.8 + 0.4 * fine) - g) * li; b += (lichen[2] * (0.8 + 0.4 * fine) - b) * li; }
        const sb = fbm(X * 6 + 21, Y * 6, Z * 6, 3);
        const scab = smoothstep(0.62, 0.66, sb) * (1 - smoothstep(0.3, 0.7, up)) * (1 - face) * (1 - moss * 0.7);
        if (scab > 0) {
          const crack = smoothstep(0.45, 0.55, fbm(X * 60, Y * 25, Z * 60, 2));
          r += (bark[0] * (0.6 + 0.8 * crack) - r) * scab; g += (bark[1] * (0.6 + 0.8 * crack) - g) * scab; b += (bark[2] * (0.6 + 0.8 * crack) - b) * scab;
        }
      }
      lin[i * 3] = Math.min(1, Math.max(0, r)); lin[i * 3 + 1] = Math.min(1, Math.max(0, g)); lin[i * 3 + 2] = Math.min(1, Math.max(0, b));
    }
  }

  // ── 3. a measured coat's grizzle (E322 F-M2: the Grizzled Sow — `measured[v.id].grizzle` = the tips' colour): silver
  //    guard-hair tips over the hump, the shoulders and the back, streaky, riding the photo's own bright hairs; the legs
  //    fade darker. Brown stays brown under it ──
  const grizzle = measured?.['grizzle'];
  if (grizzle !== undefined) {
    const s = surfaceOf(geometry, W, H, flipY);
    const box = geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
    const y0 = box.min.y, hgt = Math.max(0.2, box.max.y - box.min.y), sc = 1 / hgt;
    const neck = boneAt(bones, 'neck1'), body = boneAt(bones, 'body');
    const hump = neck && body ? neck.z - 0.25 * (neck.z - body.z) : null;   // the shoulder hump, just behind the neck
    const tip = linOf(grizzle);
    for (let i = 0; i < W * H; i++) {
      if (s.covered[i] === 0) continue;
      const x = s.pos[i * 3] ?? 0, y = s.pos[i * 3 + 1] ?? 0, z = s.pos[i * 3 + 2] ?? 0, ny = s.nrm[i * 3 + 1] ?? 0;
      const h = (y - y0) * sc;   // 0 at the paws, 1 at the top of the hump
      let r = lin[i * 3] ?? 0, g = lin[i * 3 + 1] ?? 0, b = lin[i * 3 + 2] ?? 0;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // the tips: up-facing, high on the body, strongest over the hump, broken into streaks
      const streak = fbm(x * sc * 38 + 3, y * sc * 70, z * sc * 38, 2);   // hair-scale streaks, combed down
      const humpW = hump !== null ? 1 - 0.45 * smoothstep(0.15, 0.55, Math.abs(z - hump) * sc) : 0.8;
      const m = smoothstep(0, 0.7, ny) * smoothstep(0.6, 0.85, h) * humpW * smoothstep(0.42, 0.62, streak);
      if (m > 0) {
        const detail = Math.min(1.5, Math.max(0.5, Math.sqrt(lum / 0.1)));   // the photo's own hairs, as lightness
        const k = 0.55 * m;
        r += (tip[0] * detail - r) * k; g += (tip[1] * detail - g) * k; b += (tip[2] * detail - b) * k;
      }
      // the legs fade darker toward the paws
      const leg = 1 - 0.3 * smoothstep(0.45, 0.12, h);
      lin[i * 3] = Math.min(1, Math.max(0, r * leg)); lin[i * 3 + 1] = Math.min(1, Math.max(0, g * leg)); lin[i * 3 + 2] = Math.min(1, Math.max(0, b * leg));
    }
  }

  for (let i = 0, o = 0; i < W * H; i++, o += 4) { px[o] = enc(lin[i * 3] ?? 0); px[o + 1] = enc(lin[i * 3 + 1] ?? 0); px[o + 2] = enc(lin[i * 3 + 2] ?? 0); }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = map.flipY; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = map.anisotropy;
  tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  tex.name = `${map.name}:${key}`;
  cache.set(key, tex);
  return tex;
}
