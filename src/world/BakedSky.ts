/**
 * The sky HDRI as a gain-mapped pair (scripts/bake-sky.mjs `encodeSky`; LOAD-PERF.md §P1.4, ask P5): a 2048×1024
 * sRGB JPEG of the colour plus an 8-bit PNG gain plane, ~0.3 MB instead of the 4–5 MB uncompressed RGBE `.hdr`.
 * Rebuilt here into the same half-float RGBA DataTexture HDRLoader returns (row 0 = the top of the image, flipY,
 * linear, no mips), so Sky.build's PMREM, background and fallbacks cannot tell the difference.
 *
 *   value = srgbToLinear(colour) × 2^(gain / 255 × GAIN_MAX)
 *
 * Both planes are decoded by the browser (createImageBitmap: off the main thread, no colour conversion); the per-pixel
 * work is one lookup in a 256 × 256 half-float table (gain × colour byte) per channel.
 */
import * as THREE from 'three';
import { PUBLIC_BYTES } from '../boot/bytes.generated';

/** log2 of the brightest value the pair holds — keep in step with scripts/bake-sky.mjs */
const GAIN_MAX = 16;

/** The pair's URLs for this HDRI when the build has them and nothing asks for the raw file (`?nobake`), else null. */
export function bakedSkyUrls(hdri: string): { color: string; gain: string } | null {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nobake')) return null;
  const color = `/assets/hdri/${hdri}_2k.sky.jpg`, gain = `/assets/hdri/${hdri}_2k.gain.png`;
  return color in PUBLIC_BYTES && gain in PUBLIC_BYTES ? { color, gain } : null;
}

let table: Uint16Array | null = null;
/** half-float of srgbToLinear(c / 255) × 2^(g / 255 × GAIN_MAX) at [g × 256 + c] */
function lut(): Uint16Array {
  if (table) return table;
  const t = new Uint16Array(65536);
  const lin = new Float32Array(256);
  for (let c = 0; c < 256; c++) { const s = c / 255; lin[c] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
  for (let g = 0; g < 256; g++) {
    const k = 2 ** ((g / 255) * GAIN_MAX);
    for (let c = 0; c < 256; c++) t[g * 256 + c] = THREE.DataUtils.toHalfFloat(Math.min(65504, (lin[c] ?? 0) * k));
  }
  table = t;
  return t;
}

async function pixels(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const bmp = await createImageBitmap(await res.blob(), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('BakedSky: no 2d canvas context');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** The HDRI as HDRLoader would have returned it, from the gain-mapped pair. */
export async function loadBakedSky(urls: { color: string; gain: string }): Promise<THREE.DataTexture> {
  const [color, gain] = await Promise.all([pixels(urls.color), pixels(urls.gain)]);
  const { width, height } = color;
  if (gain.width !== width || gain.height !== height) throw new Error(`BakedSky: plane sizes differ (${width}×${height} vs ${gain.width}×${gain.height})`);
  const t = lut();
  const c = color.data, g = gain.data;
  const out = new Uint16Array(width * height * 4);
  const one = THREE.DataUtils.toHalfFloat(1);
  for (let i = 0; i < out.length; i += 4) {
    const row = (g[i] ?? 0) * 256; // the PNG is grey: its R is the gain
    out[i] = t[row + (c[i] ?? 0)] ?? 0; out[i + 1] = t[row + (c[i + 1] ?? 0)] ?? 0; out[i + 2] = t[row + (c[i + 2] ?? 0)] ?? 0; out[i + 3] = one;
  }
  const tex = new THREE.DataTexture(out, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}
