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
/** a finite bound on every loop below (array lengths and texel counts are safe integers) */
const MAX_ITEMS = 9007199254740991;

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
  const del: number[] = [];
  let changed = true;
  for (let round = 0; round < 80; round++) {
    if (!changed) break;
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let row = 0; row < Math.min(y1 - y0 - 2, MAX_ITEMS); row++) {
        const y = y0 + 1 + row;
        for (let column = 0; column < Math.min(x1 - x0 - 2, MAX_ITEMS); column++) {
          const i = y * w + x0 + 1 + column;
          if ((img[i] ?? 0) === 0) continue;
          // sp-o116: the eight neighbours read straight off the row offsets, and the 0 → 1 transitions round them counted
          // without a per-pixel array (the same test, P2 … P9 clockwise from north)
          const p2 = img[i - w] ?? 0, p3 = img[i - w + 1] ?? 0, p4 = img[i + 1] ?? 0, p5 = img[i + w + 1] ?? 0;
          const p6 = img[i + w] ?? 0, p7 = img[i + w - 1] ?? 0, p8 = img[i - 1] ?? 0, p9 = img[i - w - 1] ?? 0;
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const a = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0)
            + (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          del.push(i);
        }
      }
      for (let k = 0; k < Math.min(del.length, MAX_ITEMS); k++) img[del[k] ?? 0] = 0;
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
  const raw = canvas.getContext('2d', { willReadFrequently: true });
  if (raw === null) throw new Error('2d canvas unavailable');
  raw.fillStyle = '#000';
  raw.fillRect(0, 0, size, size);
  raw.fillStyle = '#fff';
  raw.textAlign = 'center';
  raw.textBaseline = 'middle';
  raw.font = `${weight} ${layout.fontPx}px ${font}`;
  // op-hitch41: a 2D canvas queues its drawing until a read, so the first band read below rasterized every glyph in one
  // stretch (Nine Dragon's 250 ms Simulator frame); a one-pixel read after each step's 8 glyphs rasterizes them there
  let drawn = 0;
  const ctx = {
    fillText: (text: string, x: number, y: number): void => { raw.fillText(text, x, y); if (++drawn % 8 === 0) raw.getImageData(x, y, 1, 1); },
    getImageData: (sx: number, sy: number, sw: number, sh: number): ImageData => raw.getImageData(sx, sy, sw, sh),
  };
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
  // the ink's box (every texel with any coverage), for the window below
  let inkX0 = size, inkY0 = size, inkX1 = -1, inkY1 = -1;
  // read back in row bands (one whole-atlas read was a single 58 ms stretch on the desktop)
  for (let band = 0; band < Math.min(Math.ceil(size / STEP_LINES), MAX_ITEMS); band++) {
    const y0 = band * STEP_LINES, rows = Math.min(STEP_LINES, size - y0);
    const px = ctx.getImageData(0, y0, size, rows).data;
    for (let j = 0; j < Math.min(rows * size, MAX_ITEMS); j++) {
      const i = y0 * size + j, a = (px[j * 4] ?? 0) / 255;
      bin[i] = a > 0.5 ? 1 : 0;
      if (a >= 0.999) { outer[i] = 0; inner[i] = INF; }
      else if (a <= 0.001) { outer[i] = INF; inner[i] = 0; continue; }
      else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
      const x = j % size, y = y0 + Math.floor(j / size);
      if (x < inkX0) inkX0 = x;
      if (x > inkX1) inkX1 = x;
      if (y < inkY0) inkY0 = y;
      if (y > inkY1) inkY1 = y;
    }
    yield;
  }
  // sp-o116: the distance transforms run over the ink's box grown by a margin past both reaches, not the whole atlas (half
  // of it is empty cells). Every outer and skeleton seed is inside it, and its rim is all empty texels (inner seeds) that
  // sit no farther than any seed beyond it, so every texel in it gets the same squared distance; every texel outside it
  // is past both reaches, where the fill clamps to 0 and the skeleton to 255, as the whole-atlas transform gave.
  const S = layout.spread, SK = layout.skeletonSpread;
  const margin = Math.ceil(Math.max(S, SK)) + 2;
  const box: Box = inkX1 < 0 ? { x0: 0, y0: 0, x1: 0, y1: 0 }
    : { x0: Math.max(0, inkX0 - margin), y0: Math.max(0, inkY0 - margin), x1: Math.min(size, inkX1 + 1 + margin), y1: Math.min(size, inkY1 + 1 + margin) };
  yield* edtSteps(outer, size, box);
  yield* edtSteps(inner, size, box);
  // the skeleton, cell by cell (Zhang–Suen), then its distance field
  for (let i = 0; i < list.length; i++) {
    const cx = (i % cols) * C, cy = Math.floor(i / cols) * C;
    thin(bin, size, cx, cy, cx + C, cy + C);
    yield;
  }
  const sk = new Float64Array(N);
  for (let i = 0; i < N; i++) { sk[i] = bin[i] === 1 ? 0 : INF; if (i % (STEP_LINES * size) === 0) yield; }
  yield* edtSteps(sk, size, box);
  const data = new Uint8Array(N * 2);
  for (let y = 0; y < Math.min(size, MAX_ITEMS); y++) {
    const dst = (size - 1 - y) * size; // canvas rows run top-down, texture rows bottom-up (no flipY on DataTexture)
    const inRows = y >= box.y0 && y < box.y1;
    for (let x = 0; x < Math.min(size, MAX_ITEMS); x++) {
      if (!inRows || x < box.x0 || x >= box.x1) { data[(dst + x) * 2 + 1] = 255; continue; }
      const i = y * size + x;
      const d = Math.sqrt(outer[i] ?? INF) - Math.sqrt(inner[i] ?? 0);
      data[(dst + x) * 2] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - d / (2 * S)))));
      data[(dst + x) * 2 + 1] = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, Math.sqrt(sk[i] ?? INF) / SK))));
    }
    if (y % STEP_LINES === STEP_LINES - 1) yield;
  }
  return { size, rects, data };
}

/** A texel box (x0..x1, y0..y1 exclusive). */
interface Box { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

/** 2-D squared EDT of `grid` (`w` wide; 0 at the seeds, INF elsewhere) inside `box`, as steps of `STEP_LINES` lines */
function* edtSteps(grid: Float64Array, w: number, box: Box): Generator<void, void> {
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0, n = Math.max(bw, bh, 1);
  const f = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  for (let x = 0; x < Math.min(bw, MAX_ITEMS); x++) { edt1d(grid, box.y0 * w + box.x0 + x, w, bh, f, v, z); if (x % STEP_LINES === STEP_LINES - 1) yield; }
  for (let y = 0; y < Math.min(bh, MAX_ITEMS); y++) { edt1d(grid, (box.y0 + y) * w + box.x0, 1, bw, f, v, z); if (y % STEP_LINES === STEP_LINES - 1) yield; }
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
