import { Vector3 } from 'three';
import { parseKtx2 } from '@wildshard/sdk/assets';
import { contentHash } from '@wildshard/sdk/project';
import { GROUND_HALF } from '../data/layout';
import { GRAIN_TILE, KEY_DIR, SAND_MAP, SHADOW_HALF, SKIRT_SWELL } from '../data/sand';
import { swellSkirtAt } from './skirt';
import { signalDunesField } from './tiles';

/**
 * Build-time only (SHARD-PLATFORM SF72; RENDERING.md: a world-build output that is a pure function of committed files is
 * baked): the sand's three maps, which the client used to compute behind the loading screen (a 257² sample of the dune
 * field and ~21 M height lookups for the shadow march). `scripts/bake-signal-sand.mjs` writes each as a zlib stream of its
 * raw bytes (`data/sand.ts` SAND_FILES) and the grain tile's means to `data/sand.json`; look/render.ts uploads them as the
 * same DataTextures it built before.
 */

/** How far (m) and in how many growing steps the bake marches toward the sun for the dunes' cast shadows. */
const SHADOW_MARCH = { first: 0.8, grow: 1.22, steps: 26 } as const;

/** The field sampled on the painter's 257² grid over the ground square, read back bilinearly. */
function sampledGround(heightAt: (x: number, z: number) => number): (x: number, z: number) => number {
  const segments = 256, side = segments + 1, cell = (GROUND_HALF * 2) / segments, heights = new Float32Array(side * side);
  for (let iz = 0; iz < side; iz++) for (let ix = 0; ix < side; ix++) heights[iz * side + ix] = heightAt(ix * cell - GROUND_HALF, iz * cell - GROUND_HALF);
  return (x, z) => {
    const fx = Math.min(segments - 1e-3, Math.max(0, (x + GROUND_HALF) / cell)), fz = Math.min(segments - 1e-3, Math.max(0, (z + GROUND_HALF) / cell));
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, w = fz - iz, at = (a: number, b: number): number => heights[b * side + a] ?? 0;
    return (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - w) + (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * w;
  };
}

/**
 * Dune self-shadow (R1; loop 2 sharpens it): per texel, march toward the key over the sampled ground; the deepest the
 * ground rises over the ray darkens the key light. A texture, not a vertex attribute, so a crest's shadow edge is drawn
 * at ~1 m, not smeared across the grid (no shadow map ever reaches 200 m on the phone). R8, 255 fully lit.
 */
function duneShadow(heightAt: (x: number, z: number) => number): Uint8Array {
  const n = SAND_MAP, data = new Uint8Array(n * n), texel = (SHADOW_HALF * 2) / n, key = new Vector3(...KEY_DIR).normalize();
  const flat = Math.hypot(key.x, key.z), sx = key.x / flat, sz = key.z / flat, rise = key.y / flat;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const x0 = -SHADOW_HALF + (ix + 0.5) * texel, z0 = -SHADOW_HALF + (iz + 0.5) * texel, h0 = heightAt(x0, z0) + 0.12;
    let d = SHADOW_MARCH.first, over = 0;
    for (let k = 0; k < SHADOW_MARCH.steps; k++, d *= SHADOW_MARCH.grow) over = Math.max(over, (heightAt(x0 + sx * d, z0 + sz * d) - (h0 + rise * d)) / (0.25 + d * 0.012)); // E407 row 3: the penumbra grows half as fast (crisp long shadows)
    data[iz * n + ix] = Math.round(255 * (1 - Math.min(1, Math.max(0, over))));
  }
  return data;
}

/** The trail mask (round 2): 1 on the trodden bed, 0 a few metres off it, over the ground square. R8. */
function trailMask(trailDistance: (x: number, z: number) => number): Uint8Array {
  const n = SAND_MAP, data = new Uint8Array(n * n), texel = (GROUND_HALF * 2) / n;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const d = trailDistance(-GROUND_HALF + (ix + 0.5) * texel, -GROUND_HALF + (iz + 0.5) * texel), t = Math.min(1, Math.max(0, (d - 1.8) / 1.6));
    data[iz * n + ix] = Math.round(255 * (1 - t * t * (3 - 2 * t)));
  }
  return data;
}

/**
 * The sand grain tile (loop 2): 1.8 m a side of fine grain. R is the grain's albedo (pale quartz and dark mineral specks in
 * a soft mottle), G / B its bump slope in x / z. Its means let the shader subtract them, so every distance-faded grain term
 * is zero-mean (round 17: no term may change brightness by camera distance).
 */
function grainTile(): { data: Uint8Array; meanR: number; meanGlint: number } {
  const n = GRAIN_TILE, data = new Uint8Array(n * n * 4), h = new Float32Array(n * n);
  const hash = (x: number, y: number): number => { const s = Math.sin(((x % n + n) % n) * 127.1 + ((y % n + n) % n) * 311.7) * 43758.5453; return s - Math.floor(s); };
  // value noise at a few periods that divide the tile, so it wraps seamlessly
  const noise = (x: number, y: number, p: number): number => {
    const k = n / p, fx = x / k, fy = y / k, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const at = (a: number, b: number): number => hash(((a % p) + p) % p * 7 + p, ((b % p) + p) % p * 13 + p);
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return (at(ix, iy) * (1 - su) + at(ix + 1, iy) * su) * (1 - sv) + (at(ix, iy + 1) * (1 - su) + at(ix + 1, iy + 1) * su) * sv;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = noise(x, y, 64) * 0.5 + noise(x, y, 128) * 0.3 + hash(x, y) * 0.35;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, speck = hash(x * 3 + 1, y * 5 + 2), mottle = noise(x, y, 8) * 0.5 + noise(x, y, 16) * 0.5;
    const albedo = 0.5 + (mottle - 0.5) * 0.35 + (speck > 0.985 ? -0.35 : speck > 0.96 ? 0.22 : 0) + (hash(x, y) - 0.5) * 0.18;
    const dx = (h[y * n + (x + 1) % n] ?? 0) - (h[y * n + (x + n - 1) % n] ?? 0), dz = (h[((y + 1) % n) * n + x] ?? 0) - (h[((y + n - 1) % n) * n + x] ?? 0);
    data[i * 4] = Math.round(255 * Math.min(1, Math.max(0, albedo)));
    data[i * 4 + 1] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + dx * 0.9)));
    data[i * 4 + 2] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + dz * 0.9)));
    data[i * 4 + 3] = 255;
  }
  let sumR = 0, sumGlint = 0;
  const step01 = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n * n; i++) { const r = (data[i * 4] ?? 0) / 255; sumR += r; sumGlint += step01(0.82, 0.95, r) - step01(0.82, 0.95, 1 - r); }
  return { data, meanR: sumR / (n * n), meanGlint: sumGlint / (n * n) };
}

/** The sand's three maps as raw bytes, and the grain tile's means. */
export function bakeSignalSand(): { shadow: Uint8Array; trail: Uint8Array; grain: Uint8Array; meanR: number; meanGlint: number } {
  const ground = signalDunesField(), sampled = sampledGround((x, z) => ground.heightAt(x, z)), grain = grainTile();
  return { shadow: duneShadow((x, z) => swellSkirtAt(SKIRT_SWELL, sampled, x, z)), trail: trailMask((x, z) => ground.trailDistance(x, z)), grain: grain.data, meanR: grain.meanR, meanGlint: grain.meanGlint };
}

/** A zstd compressor (the bake passes Node's `zstdCompressSync` at `SAND_ZSTD_LEVEL`): KTX2's supercompression scheme 2. */
export type Zstd = (bytes: Uint8Array) => Uint8Array;
/** The maps' zstd level (the wire is the KTX2's supercompressed level 0; decoded, it is the bake byte for byte). */
export const SAND_ZSTD_LEVEL = 19;

/**
 * A map as a single-level KTX2 (R8 or RGBA8 UNORM, linear) whose level 0 is zstd-supercompressed (scheme 2): decoded, it is
 * `data` byte for byte, which three's KTX2 loader hands the data client as the same DataTexture the old client built
 * (`look.samplers` set its wrap, filter and GPU mips), at the wire size of the old zlib streams.
 */
export function rawKtx2(size: number, channels: 1 | 4, data: Uint8Array, zstd: Zstd): Uint8Array {
  const packed = zstd(data), dfdSize = 28 + 16 * channels, at = 104 + dfdSize, out = new Uint8Array(at + packed.length), view = new DataView(out.buffer);
  out.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  // header: vkFormat, typeSize, width, height, depth, layers, faces, levels, supercompression (2: zstd), dfd, (no key/values or global data)
  [channels === 1 ? 9 : 37, 1, size, size, 0, 0, 1, 1, 2, 104, dfdSize].forEach((value, i) => { view.setUint32(12 + i * 4, value, true); });
  view.setBigUint64(80, BigInt(at), true); view.setBigUint64(88, BigInt(packed.length), true); view.setBigUint64(96, BigInt(data.length), true);
  // the basic data format descriptor: RGBSDA, BT.709 primaries, linear transfer, one byte a channel (R, G, B, A); bytesPlane0
  // stays 0, as a supercompressed level requires
  view.setUint32(104, dfdSize, true); view.setUint16(112, 2, true); view.setUint16(114, dfdSize - 4, true); out.set([1, 1, 1, 0], 116);
  for (let c = 0; c < channels; c++) { const s = 132 + c * 16; view.setUint16(s, c * 8, true); out[s + 2] = 7; out[s + 3] = c === 3 ? 15 : c; view.setUint32(s + 12, 255, true); }
  out.set(packed, at);
  return out;
}

/** The three maps as the shardfile's library files (`data/sandMaps.json` rows, `assets/<sha256>` bytes) the look's sand names. */
export function bakeSandFiles(sand: Pick<ReturnType<typeof bakeSignalSand>, 'grain' | 'trail' | 'shadow'>, zstd: Zstd): { rows: Record<'grain' | 'trail' | 'shadow', { hash: string; kind: 'ktx2'; compressed: number; decoded: number; gpu: number; triangles: number; draws: number; dependencies: string[]; critical: false }>; bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const file = (data: Uint8Array, size: number, channels: 1 | 4) => {
    const wire = rawKtx2(size, channels, data, zstd), hash = contentHash(wire);
    bytes.set(hash, wire);
    return { hash, kind: 'ktx2' as const, compressed: wire.length, ...parseKtx2(wire), dependencies: [], critical: false as const };
  };
  return { rows: { grain: file(sand.grain, GRAIN_TILE, 4), trail: file(sand.trail, SAND_MAP, 1), shadow: file(sand.shadow, SAND_MAP, 1) }, bytes };
}
