import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGFormat, UnsignedByteType } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { workSlice } from '@wildshard/engine/core/workSlice';

/**
 * A glyph distance-field atlas for lit lettering (SHARD-PLATFORM M3, the sign system): every character a shard's signs
 * need is drawn once from canvas in the shard's font, then turned into two distance fields packed in one RG8 texture:
 *   R: the glyph's signed distance (0.5 = the outline, > 0.5 inside), so a brush-shaped fill stays crisp at any size;
 *   G: the distance to the glyph's SKELETON (Zhang-Suen thinning), so a shader can also draw each stroke as a
 *      constant-width bent tube with round ends (neon glass bent along the stroke's centreline).
 * One cell per character, shared by every sign and colour (the colour is a vertex attribute). `neonText` draws from it.
 */

/** The atlas's sizes for a tier: px per cell, px of the font's em, the fill and skeleton distance reach in px. */
export interface GlyphFieldLayout { readonly cell: number; readonly fontPx: number; readonly spread: number; readonly skeletonSpread: number }

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

/** What the atlas build computes before its texture exists: its size, each glyph's cell and the packed RG8 texels. */
interface GlyphFieldBuilt { readonly size: number; readonly rects: Map<string, GlyphRect>; readonly data: Uint8Array }

/** Glyph lines (canvas rows / EDT lines) between two slice checks: each step stays far under a millisecond. */
const STEP_LINES = 16;

/** The atlas build as small steps (op-hitch23): the async factory checks the engine's work slice between them, so a grid
 *  cell that builds its signs on the road keeps drawing; the constructor runs the same steps straight through. */
function* glyphFieldSteps(chars: readonly string[], layout: GlyphFieldLayout, font: string, weight: number): Generator<void, GlyphFieldBuilt> {
  const list = [...new Set(chars)], rects = new Map<string, GlyphRect>();
  const C = layout.cell;
  const cols = Math.ceil(Math.sqrt(list.length));
  let size = 64;
  while (size < cols * C) size *= 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('2d canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${layout.fontPx}px ${font}`;
  for (const [i, ch] of list.entries()) {
    const cx = (i % cols) * C, cy = Math.floor(i / cols) * C;
    // CJK ideographs sit a touch high on 'middle': nudge down so the cell is centred on the ink
    ctx.fillText(ch, cx + C / 2, cy + C / 2 + layout.fontPx * 0.04);
    rects.set(ch, { u0: cx / size, v0: 1 - (cy + C) / size, u1: (cx + C) / size, v1: 1 - cy / size });
    if (i % 8 === 7) yield;
  }
  const N = size * size;
  const outer = new Float64Array(N), inner = new Float64Array(N);
  const bin = new Uint8Array(N);
  // read back in row bands (one whole-atlas read was a single 58 ms stretch on the desktop)
  for (let y0 = 0; y0 < size; y0 += STEP_LINES) {
    const rows = Math.min(STEP_LINES, size - y0);
    const px = ctx.getImageData(0, y0, size, rows).data;
    for (let j = 0; j < rows * size; j++) {
      const i = y0 * size + j, a = (px[j * 4] ?? 0) / 255;
      bin[i] = a > 0.5 ? 1 : 0;
      if (a >= 0.999) { outer[i] = 0; inner[i] = INF; }
      else if (a <= 0.001) { outer[i] = INF; inner[i] = 0; }
      else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
    }
    yield;
  }
  yield* edtSteps(outer, size, size);
  yield* edtSteps(inner, size, size);
  // the skeleton, cell by cell (Zhang–Suen), then its distance field
  for (let i = 0; i < list.length; i++) {
    const cx = (i % cols) * C, cy = Math.floor(i / cols) * C;
    thin(bin, size, cx, cy, cx + C, cy + C);
    yield;
  }
  const sk = new Float64Array(N);
  for (let i = 0; i < N; i++) { sk[i] = bin[i] === 1 ? 0 : INF; if (i % (STEP_LINES * size) === 0) yield; }
  yield* edtSteps(sk, size, size);
  const data = new Uint8Array(N * 2);
  const S = layout.spread, SK = layout.skeletonSpread;
  for (let y = 0; y < size; y++) {
    const dst = (size - 1 - y) * size; // canvas rows run top-down, texture rows bottom-up (no flipY on DataTexture)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const d = Math.sqrt(outer[i] ?? INF) - Math.sqrt(inner[i] ?? 0);
      data[(dst + x) * 2] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - d / (2 * S)))));
      data[(dst + x) * 2 + 1] = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, Math.sqrt(sk[i] ?? INF) / SK))));
    }
    if (y % STEP_LINES === STEP_LINES - 1) yield;
  }
  return { size, rects, data };
}

/** 2-D squared EDT of `grid` (w × h, 0 at the seeds, INF elsewhere), as steps of `STEP_LINES` lines */
function* edtSteps(grid: Float64Array, w: number, h: number): Generator<void, void> {
  const n = Math.max(w, h);
  const f = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  for (let x = 0; x < w; x++) { edt1d(grid, x, w, h, f, v, z); if (x % STEP_LINES === STEP_LINES - 1) yield; }
  for (let y = 0; y < h; y++) { edt1d(grid, y * w, 1, w, f, v, z); if (y % STEP_LINES === STEP_LINES - 1) yield; }
}

/** Atlases `GlyphField.prepare` computed ahead, by `fieldKey`, until a constructor takes one. */
const PREPARED = new Map<string, GlyphFieldBuilt>();
const fieldKey = (chars: readonly string[], layout: GlyphFieldLayout, font: string, weight: number): string =>
  JSON.stringify([[...new Set(chars)].join(''), layout.cell, layout.fontPx, layout.spread, layout.skeletonSpread, font, weight]);

export class GlyphField {
  /** atlas px per cell, px of the font's em, and the distance-field reach in px (fill / skeleton) */
  readonly layout: GlyphFieldLayout;
  readonly texture: DataTexture;
  readonly size: number;
  private readonly rects: Map<string, GlyphRect>;

  /** Compute an atlas ahead, sliced at the engine's work slice, for the next matching constructor to take (a world build
   *  that may run in play, a grid cell admitted on the road, calls this before its synchronous build; op-hitch23). The
   *  font must already be loaded. A prepared atlas no constructor takes is dropped with `owner`. */
  static async prepare(chars: readonly string[], layout: GlyphFieldLayout, font: string, weight = 700, owner?: Pick<Scope, 'onDispose'>): Promise<void> {
    const key = fieldKey(chars, layout, font, weight);
    if (PREPARED.has(key)) return;
    const steps = glyphFieldSteps(chars, layout, font, weight), slice = workSlice();
    for (;;) {
      const step = steps.next();
      if (step.done === true) { PREPARED.set(key, step.value); owner?.onDispose(() => { PREPARED.delete(key); }); return; }
      if (slice.due()) await slice.yield();
    }
  }

  /** Build the atlas, or take the one `prepare` computed for the same arguments. */
  constructor(chars: readonly string[], layout: GlyphFieldLayout, font: string, weight = 700) {
    this.layout = layout;
    const key = fieldKey(chars, layout, font, weight);
    let result = PREPARED.get(key);
    PREPARED.delete(key);
    if (result === undefined) {
      const steps = glyphFieldSteps(chars, layout, font, weight);
      for (let step = steps.next(); ; step = steps.next()) if (step.done === true) { result = step.value; break; }
    }
    this.size = result.size;
    this.rects = result.rects;
    this.texture = new DataTexture(result.data, result.size, result.size, RGFormat, UnsignedByteType);
    this.texture.wrapS = this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 4;
    this.texture.needsUpdate = true;
  }

  rect(ch: string): GlyphRect {
    const r = this.rects.get(ch);
    if (r === undefined) throw new Error(`glyph atlas has no ${ch}`);
    return r;
  }
}
