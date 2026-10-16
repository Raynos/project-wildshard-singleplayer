/**
 * The pond's two baked inputs (PH-L9), shared by the engine pond (pond.ts) and a shard that dresses it in its own water
 * look (Pine Hollow's graphs): the tiling ripple normal map and the skyline probe. The frozen classic shader that once
 * read them lives on in waterSurface.ts for the legacy copies only.
 */
import * as THREE from 'three';
import type { TreeInstance } from '../forest/placement';

/** the skyline texture's encoding: R = occluder top above the water (/ SKY_TOP m), G = its distance (/ SKY_DIST m),
 *  B = the bank's albedo where the occluder is the ground (/ BANK_MAX; 0 = a tree crown, drawn with the forest's albedo) */
export const SKY_TOP = 80, SKY_DIST = 400, BANK_MAX = 0.5;
const SKY_BINS = 512;
/** the shore's albedo in the reflection where the ground is the occluder: a bank's earth, a cliff's rock (E401) */
const BANK_EARTH = 0.12, BANK_ROCK = 0.3;

let texCache: THREE.DataTexture | null = null;

/**
 * The tiling ripple texture: RGB a tangent-space normal from a periodic fbm height field (value noise on integer
 * lattices, so it tiles), A a separate bubbly noise for the foam. 256², mipmapped; built once (~20 ms).
 */
export function waterTexture(): THREE.DataTexture {
  if (texCache) return texCache;
  const N = 256;
  const lattice = (seed: number, n: number): Float32Array => {
    const a = new Float32Array(n * n);
    let s = seed >>> 0;
    for (let i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s / 4294967296; }
    return a;
  };
  /** periodic value noise: `n` cells across the tile, smoothstep-interpolated */
  const vnoise = (L: Float32Array, n: number, u: number, v: number): number => {
    const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = L[y0 * n + x0] ?? 0, b = L[y0 * n + x1] ?? 0, c = L[y1 * n + x0] ?? 0, d = L[y1 * n + x1] ?? 0;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const oct = [4, 8, 16, 32, 64].map((n, i) => ({ n, L: lattice(0x51f + i * 7919, n), w: 0.55 ** i }));
  const foamOct = [8, 16, 32, 64].map((n, i) => ({ n, L: lattice(0xf0a + i * 104729, n), w: 0.6 ** i }));
  const H = new Float32Array(N * N), Fm = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let h = 0, f = 0;
    for (const o of oct) h += vnoise(o.L, o.n, u, v) * o.w;
    for (const o of foamOct) f += vnoise(o.L, o.n, u + 0.13, v + 0.29) * o.w;
    H[y * N + x] = h; Fm[y * N + x] = f;
  }
  // the foam: sharpen the fbm into bubbly clumps and stretch it to 0..1
  let fmin = Infinity, fmax = -Infinity;
  for (const f of Fm) { fmin = Math.min(fmin, f); fmax = Math.max(fmax, f); }
  const data = new Uint8Array(N * N * 4);
  const at = (xx: number, yy: number): number => H[((yy + N) % N) * N + ((xx + N) % N)] ?? 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 9, dy = (at(x, y + 1) - at(x, y - 1)) * 9, l = Math.hypot(dx, dy, 1);
    const i = (y * N + x) * 4;
    data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    const f = ((Fm[y * N + x] ?? 0) - fmin) / Math.max(1e-6, fmax - fmin);
    data[i + 3] = Math.round(Math.min(1, Math.max(0, f)) ** 1.4 * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  texCache = t;
  return t;
}

/**
 * The pond's skyline probe: per azimuth round (cx, cz), the tallest thing on the horizon seen from the centre — each
 * pine's crown as a cone (its top `height` over its foot, ~0.2 × height wide), the terrain (the Ridge) — kept as (its top
 * above the water, its distance, and for the terrain its albedo: earth on a bank, rock where the face below it is steep,
 * E401). 512 bins, RGB8, linear, wrapping round the circle.
 */
export function buildSkyline(cx: number, cz: number, level: number, trees: readonly TreeInstance[], heightAt: (x: number, z: number) => number): THREE.DataTexture {
  const el = new Float32Array(SKY_BINS).fill(-1), top = new Float32Array(SKY_BINS), dist = new Float32Array(SKY_BINS).fill(60);
  const alb = new Float32Array(SKY_BINS); // −1 = a tree crown, until the pass below
  const put = (bin: number, h: number, d: number, albedo: number): void => {
    const k = ((bin % SKY_BINS) + SKY_BINS) % SKY_BINS, e = Math.atan2(h, d);
    if (e > (el[k] ?? -1)) { el[k] = e; top[k] = h; dist[k] = d; alb[k] = albedo; }
  };
  // the terrain: march out along each bin's azimuth; its albedo from the slope of the 6 m below the top (a cliff's face is
  // grey rock, a grassy bank darker earth)
  for (let k = 0; k < SKY_BINS; k++) {
    const a = ((k + 0.5) / SKY_BINS - 0.5) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    for (let d = 20; d < 380; d += d < 80 ? 1.5 : 4) {
      const h = heightAt(cx + dx * d, cz + dz * d), slope = (h - heightAt(cx + dx * (d - 6), cz + dz * (d - 6))) / 6;
      put(k, h - level, d, BANK_EARTH + (BANK_ROCK - BANK_EARTH) * THREE.MathUtils.smoothstep(slope, 0.5, 1.2));
    }
  }
  const groundTop = top.slice(), groundAlb = alb.slice();
  // the pines: a cone per crown over the bins it covers
  for (const t of trees) {
    const dx = t.x - cx, dz = t.z - cz, d = Math.hypot(dx, dz);
    if (d < 12 || d > 380) continue;
    const a0 = Math.atan2(dz, dx), crownR = Math.max(1.2, t.height * 0.13), half = Math.atan2(crownR, d);
    const k0 = Math.floor(((a0 - half) / (Math.PI * 2) + 0.5) * SKY_BINS), k1 = Math.ceil(((a0 + half) / (Math.PI * 2) + 0.5) * SKY_BINS);
    const tip = t.y + t.height - level;
    for (let k = k0; k <= k1; k++) {
      const ak = ((k + 0.5) / SKY_BINS - 0.5) * Math.PI * 2;
      let da = Math.abs(ak - a0); if (da > Math.PI) da = Math.PI * 2 - da;
      const off = Math.min(1, (Math.tan(da) * d) / crownR); // 0 on the trunk's line → 1 at the crown's edge
      put(k, tip - off * t.height * 0.55, d, -1);
    }
  }
  // a bin a crown tops keeps its ground's albedo over the share of the mirrored column the ground fills (a pine on the
  // cliff's lip darkens only its top), and the albedo is smoothed over ±2 bins so the rock doesn't mirror in stripes
  const mixed = new Float32Array(SKY_BINS);
  for (let k = 0; k < SKY_BINS; k++) {
    const a = alb[k] ?? 0, h = top[k] ?? 0;
    mixed[k] = a >= 0 ? a : (groundAlb[k] ?? 0) * Math.min(1, Math.max(0, (groundTop[k] ?? 0) / Math.max(h, 1e-3)));
  }
  for (let k = 0; k < SKY_BINS; k++) {
    let sum = 0;
    for (let j = -2; j <= 2; j++) sum += mixed[(k + j + SKY_BINS) % SKY_BINS] ?? 0;
    alb[k] = sum / 5;
  }
  const data = new Uint8Array(SKY_BINS * 4);
  for (let k = 0; k < SKY_BINS; k++) {
    data[k * 4] = Math.round(Math.min(1, Math.max(0, (top[k] ?? 0) / SKY_TOP)) * 255);
    data[k * 4 + 1] = Math.round(Math.min(1, Math.max(0, (dist[k] ?? 0) / SKY_DIST)) * 255);
    data[k * 4 + 2] = Math.round(Math.min(1, Math.max(0, (alb[k] ?? 0) / BANK_MAX)) * 255);
    data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, SKY_BINS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

