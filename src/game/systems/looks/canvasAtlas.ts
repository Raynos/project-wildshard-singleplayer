// The canvas atlas (SHARD-PLATFORM M3): a 2D-canvas texture painted from draw steps that are data. A shard lists its
// decals (an engraved strip, a paper talisman, a label sheet) as rows; `paintCanvasAtlas` replays them on one canvas, in
// order, and returns it as a mipmapped sRGB texture. Each step is one canvas call or a small deterministic loop:
//  - `set`: any of fill / stroke style, line width / cap / join, font, text align / baseline, global alpha;
//  - `fillRect` / `strokeRect`; `save` / `restore` / `translate` / `scale` / `rotate` (angles in half turns, × π);
//  - `path`: one beginPath, its segments (M / L / A: arcs with angles × π) and a stroke or fill; with a scale `s` every
//    coordinate and radius is `s × value`, offset by `at` when given;
//  - `text`: fillText at a point;
//  - `radial`: a radial gradient (its stops) filling a rectangle;
//  - `speckle`: n seeded random marks (a Park–Miller sequence) in two styles over a rectangle (paper fibre);
//  - `grain`: n marks on a fixed stride pattern over a rectangle (a quieter fibre).
// Drawn at `scale` (the canvas `scale` times the authored size, every coordinate kept): a phone tier halves an atlas.
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

/** one path segment: move, line, or arc (centre, radius, start and end angle in half turns, and when given whether it
 *  runs counter-clockwise) */
export type CanvasSegment = readonly ['M', number, number] | readonly ['L', number, number] | readonly ['A', number, number, number, number, number] | readonly ['A', number, number, number, number, number, boolean];

/** a draw step as data */
export type CanvasStep =
  | { readonly op: 'set'; readonly fill?: string; readonly stroke?: string; readonly width?: number; readonly cap?: CanvasLineCap; readonly join?: CanvasLineJoin; readonly font?: string; readonly align?: CanvasTextAlign; readonly baseline?: CanvasTextBaseline; readonly alpha?: number }
  | { readonly op: 'fillRect' | 'strokeRect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'save' | 'restore' }
  | { readonly op: 'translate' | 'scale'; readonly x: number; readonly y: number }
  | { readonly op: 'rotate'; readonly turns: number }
  | { readonly op: 'path'; readonly segs: readonly CanvasSegment[]; readonly s?: number; readonly at?: readonly [number, number]; readonly fill?: boolean }
  | { readonly op: 'text'; readonly text: string; readonly x: number; readonly y: number }
  | { readonly op: 'radial'; readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number]; readonly stops: readonly (readonly [number, string])[]; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'speckle'; readonly n: number; readonly seed: number; readonly split: number; readonly styles: readonly [string, string]; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly mark: readonly [number, number, number, number] }
  | { readonly op: 'grain'; readonly n: number; readonly stride: readonly [number, number]; readonly mark: readonly [number, number, number, number]; readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** an atlas as data: its authored size, the draw scale (undefined: no scale call) and its steps */
export interface CanvasAtlasRow { readonly w: number; readonly h: number; readonly steps: readonly CanvasStep[] }

function set(g: CanvasRenderingContext2D, s: Extract<CanvasStep, { op: 'set' }>): void {
  if (s.fill !== undefined) g.fillStyle = s.fill;
  if (s.stroke !== undefined) g.strokeStyle = s.stroke;
  if (s.width !== undefined) g.lineWidth = s.width;
  if (s.cap !== undefined) g.lineCap = s.cap;
  if (s.join !== undefined) g.lineJoin = s.join;
  if (s.font !== undefined) g.font = s.font;
  if (s.align !== undefined) g.textAlign = s.align;
  if (s.baseline !== undefined) g.textBaseline = s.baseline;
  if (s.alpha !== undefined) g.globalAlpha = s.alpha;
}

function path(g: CanvasRenderingContext2D, p: Extract<CanvasStep, { op: 'path' }>): void {
  const k = p.s, at = p.at;
  // a coordinate: the scaled value, offset by `at` (the same arithmetic an authored `x + s * k` performs)
  const cx = (v: number): number => (k === undefined ? v : at === undefined ? k * v : at[0] + k * v);
  const cy = (v: number): number => (k === undefined ? v : at === undefined ? k * v : at[1] + k * v);
  const r = (v: number): number => (k === undefined ? v : k * v);
  g.beginPath();
  for (const seg of p.segs) {
    if (seg[0] === 'M') g.moveTo(cx(seg[1]), cy(seg[2]));
    else if (seg[0] === 'L') g.lineTo(cx(seg[1]), cy(seg[2]));
    else if (seg.length === 7) g.arc(cx(seg[1]), cy(seg[2]), r(seg[3]), Math.PI * seg[4], Math.PI * seg[5], seg[6]);
    else g.arc(cx(seg[1]), cy(seg[2]), r(seg[3]), Math.PI * seg[4], Math.PI * seg[5]);
  }
  if (p.fill === true) g.fill(); else g.stroke();
}

/** replay an atlas's steps on a 2D context (already sized and scaled) */
export function paintSteps(g: CanvasRenderingContext2D, steps: readonly CanvasStep[]): void {
  for (const s of steps) {
    switch (s.op) {
      case 'set': set(g, s); break;
      case 'fillRect': g.fillRect(s.x, s.y, s.w, s.h); break;
      case 'strokeRect': g.strokeRect(s.x, s.y, s.w, s.h); break;
      case 'save': g.save(); break;
      case 'restore': g.restore(); break;
      case 'translate': g.translate(s.x, s.y); break;
      case 'scale': g.scale(s.x, s.y); break;
      case 'rotate': g.rotate(Math.PI * s.turns); break;
      case 'path': path(g, s); break;
      case 'text': g.fillText(s.text, s.x, s.y); break;
      case 'radial': {
        const grd = g.createRadialGradient(s.from[0], s.from[1], s.from[2], s.to[0], s.to[1], s.to[2]);
        for (const [at, colour] of s.stops) grd.addColorStop(at, colour);
        g.fillStyle = grd;
        g.fillRect(s.x, s.y, s.w, s.h);
        break;
      }
      case 'speckle': {
        let q = s.seed;
        const rnd = (): number => { q = (q * 16807) % 2147483647; return q / 2147483647; };
        const [w0, w1, h0, h1] = s.mark;
        for (let i = 0; i < s.n; i++) {
          g.fillStyle = rnd() < s.split ? s.styles[0] : s.styles[1];
          g.fillRect(s.x + rnd() * s.w, s.y + rnd() * s.h, w0 + rnd() * w1, h0 + rnd() * h1);
        }
        break;
      }
      case 'grain': {
        const [w0, wm, h0, hm] = s.mark;
        for (let i = 0; i < s.n; i++) g.fillRect(s.x + ((i * s.stride[0]) % s.w), s.y + ((i * s.stride[1]) % s.h), w0 + (i % wm), h0 + (i % hm));
        break;
      }
      default: {
        const unknown: never = s;
        throw new Error(`unknown canvas step ${JSON.stringify(unknown)}`);
      }
    }
  }
}

/** paint an atlas row on a new canvas at `scale` (undefined: no scale call) and return it as a mipmapped sRGB texture */
export function paintCanvasAtlas(row: CanvasAtlasRow, scale?: number): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = row.w * (scale ?? 1);
  cv.height = row.h * (scale ?? 1);
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  if (scale !== undefined) g.scale(scale, scale); // preserve all authored UVs and drawing coordinates at any resolution
  paintSteps(g, row.steps);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return tex;
}
