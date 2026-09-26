// The neon calligraphy atlas: every character a sign needs is drawn once from canvas (a Kai / brush regular-script
// CJK font), then turned into two distance fields packed in one RG8 texture:
//   R — the glyph's signed distance (0.5 = the outline, > 0.5 inside), so the brush-shaped fill stays crisp at any size;
//   G — the distance to the glyph's SKELETON (Zhang–Suen thinning), so the shader can also draw each stroke as a
//       constant-width hand-bent tube with round ends (real Hong Kong neon is bent glass along the stroke's centreline).
// One cell per character, shared by every sign and colour (the colour is a vertex attribute).
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGFormat, UnsignedByteType } from 'three';

export const KAI_STACK = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", "PingFang TC", serif';

export interface GlyphRect { u0: number; v0: number; u1: number; v1: number }

const INF = 1e20;

/** Felzenszwalb & Huttenlocher's 1-D squared distance transform (in place over `f`, stride `step`) */
function edt1d(grid: Float64Array, offset: number, step: number, n: number, f: Float64Array, v: Int32Array, z: Float64Array): void {
  for (let q = 0; q < n; q++) f[q] = grid[offset + q * step] ?? INF;
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    const fq = f[q] ?? INF;
    let vk = v[k] ?? 0;
    let s = (fq + q * q - ((f[vk] ?? INF) + vk * vk)) / (2 * q - 2 * vk);
    while (s <= (z[k] ?? -INF) && k > 0) {
      k--;
      vk = v[k] ?? 0;
      s = (fq + q * q - ((f[vk] ?? INF) + vk * vk)) / (2 * q - 2 * vk);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while ((z[k + 1] ?? INF) < q) k++;
    const vk = v[k] ?? 0;
    grid[offset + q * step] = (q - vk) * (q - vk) + (f[vk] ?? INF);
  }
}

/** 2-D squared EDT of `grid` (w × h, 0 at the seeds, INF elsewhere) */
function edt(grid: Float64Array, w: number, h: number): void {
  const n = Math.max(w, h);
  const f = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
}

/** Zhang–Suen thinning of a binary image, restricted to a box (x0..x1, y0..y1 exclusive) */
function thin(img: Uint8Array, w: number, x0: number, y0: number, x1: number, y1: number): void {
  const at = (x: number, y: number): number => img[y * w + x] ?? 0;
  const del: number[] = [];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 80) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = y0 + 1; y < y1 - 1; y++) {
        for (let x = x0 + 1; x < x1 - 1; x++) {
          if (at(x, y) === 0) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if ((seq[i] ?? 0) === 0 && (seq[i + 1] ?? 0) === 1) a++;
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          del.push(y * w + x);
        }
      }
      for (const i of del) img[i] = 0;
      if (del.length > 0) changed = true;
    }
  }
}

export class GlyphAtlas {
  /** atlas px per cell, px of the font's em, and the distance-field reach in px (fill / skeleton) */
  static readonly CELL = 128;
  static readonly FONT_PX = 92;
  static readonly SPREAD = 18;
  static readonly SKEL_SPREAD = 26;
  readonly texture: DataTexture;
  readonly size: number;
  private readonly rects = new Map<string, GlyphRect>();
  /** ms spent building (canvas + both distance fields) */
  readonly buildMs: number;

  constructor(chars: readonly string[], font = KAI_STACK, weight = 700) {
    const t0 = performance.now();
    const list = [...new Set(chars)];
    const C = GlyphAtlas.CELL;
    const cols = Math.ceil(Math.sqrt(list.length));
    let size = 64;
    while (size < cols * C) size *= 2;
    this.size = size;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) throw new Error('2d canvas unavailable');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${weight} ${GlyphAtlas.FONT_PX}px ${font}`;
    list.forEach((ch, i) => {
      const cx = (i % cols) * C, cy = Math.floor(i / cols) * C;
      // CJK ideographs sit a touch high on 'middle': nudge down so the cell is centred on the ink
      ctx.fillText(ch, cx + C / 2, cy + C / 2 + GlyphAtlas.FONT_PX * 0.04);
      this.rects.set(ch, { u0: cx / size, v0: 1 - (cy + C) / size, u1: (cx + C) / size, v1: 1 - cy / size });
    });
    const px = ctx.getImageData(0, 0, size, size).data;
    const N = size * size;
    const outer = new Float64Array(N), inner = new Float64Array(N);
    const bin = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const a = (px[i * 4] ?? 0) / 255;
      bin[i] = a > 0.5 ? 1 : 0;
      if (a >= 0.999) { outer[i] = 0; inner[i] = INF; }
      else if (a <= 0.001) { outer[i] = INF; inner[i] = 0; }
      else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
    }
    edt(outer, size, size);
    edt(inner, size, size);
    // the skeleton, cell by cell (Zhang–Suen), then its distance field
    list.forEach((_, i) => {
      const cx = (i % cols) * C, cy = Math.floor(i / cols) * C;
      thin(bin, size, cx, cy, cx + C, cy + C);
    });
    const sk = new Float64Array(N);
    for (let i = 0; i < N; i++) sk[i] = bin[i] === 1 ? 0 : INF;
    edt(sk, size, size);
    const data = new Uint8Array(N * 2);
    const S = GlyphAtlas.SPREAD, SK = GlyphAtlas.SKEL_SPREAD;
    for (let y = 0; y < size; y++) {
      const dst = (size - 1 - y) * size; // canvas rows run top-down, texture rows bottom-up (no flipY on DataTexture)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const d = Math.sqrt(outer[i] ?? INF) - Math.sqrt(inner[i] ?? 0);
        data[(dst + x) * 2] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - d / (2 * S)))));
        data[(dst + x) * 2 + 1] = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, Math.sqrt(sk[i] ?? INF) / SK))));
      }
    }
    this.texture = new DataTexture(data, size, size, RGFormat, UnsignedByteType);
    this.texture.wrapS = this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 4;
    this.texture.needsUpdate = true;
    this.buildMs = performance.now() - t0;
  }

  rect(ch: string): GlyphRect {
    const r = this.rects.get(ch);
    if (r === undefined) throw new Error(`glyph atlas has no ${ch}`);
    return r;
  }
}
