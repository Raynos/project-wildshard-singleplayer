import {
  BufferGeometry, CanvasTexture, Color, DataTexture, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter, RedFormat, SRGBColorSpace,
  type Texture, Uint32BufferAttribute, UnsignedByteType, Vector3,
} from 'three';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';

/**
 * Painted sign lettering as data (SHARD-PLATFORM M3, the sign system): real words drawn once at load into two atlases.
 *  - the MONO atlas (one R8 texture): neon tubes and lightboxes drawn in white; the hue is a per-vertex tint, so one
 *    cell serves every colour. Horizontal cells pack in rows in the top half, vertical ones in columns in the bottom.
 *  - the COLOUR atlas (sRGB): the few multi-colour pieces (plaques, paper strips, talismans, etched lines).
 * A shard declares its sign styles as rows (`SignStyleRow`): which atlas, the face's size rule, the default gain and
 * board, and the drawing as a list of canvas steps (`SignStep`) over the cell. `SignBuilder` collects every placed
 * sign as quads (the shard's sign program draws them) and reports each lit lightbox as a light.
 */

/** A length in a cell: `px` + `w` × the cell's width + `h` × its height + `u` × the glyph unit (each term optional). */
export interface SignLen { readonly px?: number; readonly w?: number; readonly h?: number; readonly u?: number }
/** A colour: a CSS colour, the spec's `color`, or the spec's `ink` (with a fallback). */
export type SignPaint = string | { readonly spec: 'color' } | { readonly spec: 'ink'; readonly fallback: string };
/** One segment of a stroked path; every coordinate a `SignLen`. */
export type SignSegment =
  | { readonly m: readonly [SignLen, SignLen] }
  | { readonly l: readonly [SignLen, SignLen] }
  | { readonly q: readonly [SignLen, SignLen, SignLen, SignLen] }
  | { readonly c: readonly [SignLen, SignLen, SignLen, SignLen, SignLen, SignLen] }
  /** an arc: centre x, y, radius, start and end angle (radians) */
  | { readonly a: readonly [SignLen, SignLen, SignLen, number, number] };
/** One drawing step over a sign's cell, in order. */
export type SignStep =
  /** fill the cell (inset on every side) */
  | { readonly op: 'fill'; readonly paint: SignPaint; readonly inset?: SignLen }
  /** the text, one glyph per cell slot: filled, or stroked when `stroke` (line width, × unit) is set */
  | { readonly op: 'glyphs'; readonly paint: SignPaint; readonly weight: number; readonly size: number; readonly font: string; readonly stroke?: number }
  /** a rectangle frame inset on every side (× unit); `radius` makes it a rounded-rect path, else a stroked rect */
  | { readonly op: 'frame'; readonly paint: SignPaint; readonly inset: number; readonly width: number; readonly radius?: number }
  /** the canvas shadow for the steps after it (`blur` × unit; 0 turns it off) */
  | { readonly op: 'shadow'; readonly color: string; readonly blur: number }
  /** one stroked path */
  | { readonly op: 'path'; readonly paint: SignPaint; readonly width: SignLen; readonly path: readonly SignSegment[] };

/** How a sign face is sized: a row of glyph cells, or a fixed face (`w` × `h` em; the colour cell `px` reference px). */
export type SignFace = { readonly kind: 'glyphs' } | { readonly kind: 'fixed'; readonly w: number; readonly h: number; readonly px: readonly [number, number] };

/** One sign style, as data. */
export interface SignStyleRow {
  /** the mono atlas (tinted per vertex, glows) or the colour atlas */
  readonly mono: boolean;
  /** routed to the attached neon calligraphy (`SignBuilder.calligraphy`) when one is set */
  readonly calligraphy?: boolean;
  /** the face's up axis: 'y' (a wall sign) or 'x' (lettering laid along a blade) */
  readonly up?: 'x' | 'y';
  readonly face?: SignFace;
  /** default glow gain and board colour */
  readonly gain: number;
  readonly board: number;
  readonly steps: readonly SignStep[];
}

/** A sign's words and style. */
export interface SignSpec<S extends string = string> {
  readonly text: string;
  /** mono styles: the neon / lightbox tint; colour styles: the character colour */
  readonly color: string;
  readonly vertical: boolean;
  readonly style: S;
  /** colour styles: the ground (paper, lacquer) */
  readonly ink?: string;
}

/** The atlases' sizes for a tier: mono and colour canvases, the mono glyph unit and padding, the colour unit and scale. */
export interface SignAtlasLayout {
  readonly mw: number; readonly mh: number; readonly cw: number; readonly ch: number; readonly unit: number; readonly pad: number;
  readonly colourUnit: number;
  /** a fixed face's colour cell is its reference px × this (its steps are drawn in reference px) */
  readonly colourScale: number;
}

export interface SignCell { readonly u0: number; readonly v0: number; readonly u1: number; readonly v1: number; readonly mono: boolean }

/** the characters of a sign's text */
const glyphsOf = (s: string): string[] => Array.from(s);

function rowOf<S extends string>(styles: Readonly<Record<S, SignStyleRow>>, style: S): SignStyleRow {
  return styles[style];
}

export class SignAtlas<S extends string = string> {
  private readonly mono: HTMLCanvasElement;
  private readonly mctx: CanvasRenderingContext2D;
  private readonly colour: HTMLCanvasElement;
  private readonly cctx: CanvasRenderingContext2D;
  private hx = 0;
  private hy = 0;
  private vx = 0;
  private vy = 0;
  private cx = 0;
  private cy = 0;
  private crow = 0;
  private readonly cache = new Map<string, SignCell>();
  readonly monoTex: DataTexture;
  readonly colourTex: CanvasTexture;

  constructor(readonly styles: Readonly<Record<S, SignStyleRow>>, private readonly sizing: SignAtlasLayout, private readonly label: string) {
    this.vy = this.sizing.mh / 2;
    this.mono = document.createElement('canvas');
    this.mono.width = this.sizing.mw;
    this.mono.height = this.sizing.mh;
    this.colour = document.createElement('canvas');
    this.colour.width = this.sizing.cw;
    this.colour.height = this.sizing.ch;
    const m = this.mono.getContext('2d', { willReadFrequently: true });
    const c = this.colour.getContext('2d');
    if (m === null || c === null) throw new Error('2d canvas unavailable');
    this.mctx = m;
    this.cctx = c;
    m.fillStyle = '#000';
    m.fillRect(0, 0, this.sizing.mw, this.sizing.mh);
    this.monoTex = new DataTexture(new Uint8Array(4), 1, 1, RedFormat, UnsignedByteType);
    this.colourTex = new CanvasTexture(this.colour);
    this.colourTex.colorSpace = SRGBColorSpace;
    this.colourTex.minFilter = LinearMipmapLinearFilter;
    this.colourTex.anisotropy = 8;
  }

  row(style: S): SignStyleRow { return rowOf(this.styles, style); }

  /** after every sign is placed: copy the mono canvas's red channel into the R8 texture */
  finish(): void {
    const img = this.mctx.getImageData(0, 0, this.sizing.mw, this.sizing.mh).data;
    const r = new Uint8Array(this.sizing.mw * this.sizing.mh);
    // the canvas is top-down; the texture's v runs bottom-up (flipY is off for DataTexture)
    for (let y = 0; y < this.sizing.mh; y++) {
      const src = y * this.sizing.mw * 4, dst = (this.sizing.mh - 1 - y) * this.sizing.mw;
      for (let x = 0; x < this.sizing.mw; x++) r[dst + x] = img[src + x * 4] ?? 0;
    }
    this.monoTex.image = { data: r, width: this.sizing.mw, height: this.sizing.mh };
    this.monoTex.minFilter = LinearMipmapLinearFilter;
    this.monoTex.magFilter = LinearFilter;
    this.monoTex.generateMipmaps = true;
    this.monoTex.anisotropy = 8;
    this.monoTex.needsUpdate = true;
    this.colourTex.needsUpdate = true;
    // (E264) the atlas is finished once: its canvases and the mono copy are on the GPU after the first draw. The mono
    // canvas goes now (its red channel is copied above); the colour canvas and the R8 array once uploaded. A word a
    // specimen asks for later must be one already drawn
    this.mono.width = 1;
    this.mono.height = 1;
    gpuOnlyTexture(this.monoTex, this.label);
    gpuOnlyTexture(this.colourTex, this.label);
  }

  get textures(): { mono: Texture; colour: Texture } { return { mono: this.monoTex, colour: this.colourTex }; }

  /** debug: the mono atlas as an image (before finish(): after it the canvas is gone, E264) */
  dump(): string { return this.mono.toDataURL('image/jpeg', 0.8); }

  private allocMono(w: number, h: number, vertical: boolean): { x: number; y: number } {
    if (vertical) {
      if (this.vy + h > this.sizing.mh) { this.vy = this.sizing.mh / 2; this.vx += w + this.sizing.pad; }
      if (this.vx + w > this.sizing.mw) throw new Error('mono atlas (vertical) full');
      const at = { x: this.vx, y: this.vy };
      this.vy += h + this.sizing.pad;
      return at;
    }
    if (this.hx + w > this.sizing.mw) { this.hx = 0; this.hy += h + this.sizing.pad; }
    if (this.hy + h > this.sizing.mh / 2) throw new Error('mono atlas (horizontal) full');
    const at = { x: this.hx, y: this.hy };
    this.hx += w + this.sizing.pad;
    return at;
  }

  private allocColour(w: number, h: number): { x: number; y: number } {
    if (this.cx + w > this.sizing.cw) { this.cx = 0; this.cy += this.crow + this.sizing.pad; this.crow = 0; }
    if (this.cy + h > this.sizing.ch) throw new Error('colour atlas full');
    const at = { x: this.cx, y: this.cy };
    this.cx += w + this.sizing.pad;
    this.crow = Math.max(this.crow, h);
    return at;
  }

  get(spec: SignSpec<S>): SignCell {
    const mono = this.row(spec.style).mono;
    const key = mono ? `${spec.style}|${spec.text}|${spec.vertical ? 'v' : 'h'}` : `${spec.style}|${spec.text}|${spec.color}|${spec.vertical ? 'v' : 'h'}|${spec.ink ?? ''}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const cell = mono ? this.drawMono(spec) : this.drawColour(spec);
    this.cache.set(key, cell);
    return cell;
  }

  private layout(spec: SignSpec<S>, u: number): { w: number; h: number; pos: (i: number) => [number, number]; chars: string[] } {
    const cs = glyphsOf(spec.text);
    const n = cs.length;
    const w = spec.vertical ? Math.round(u * 1.36) : Math.round(u * (n + 0.62));
    const h = spec.vertical ? Math.round(u * (n + 0.62)) : Math.round(u * 1.36);
    return { w, h, chars: cs, pos: (i) => (spec.vertical ? [w / 2, u * (0.81 + i)] : [u * (0.81 + i), h / 2]) };
  }

  /** run a style's steps over a cell `w` × `h` (glyph unit `u`; the text laid out by `lay`) */
  private paint(ctx: CanvasRenderingContext2D, spec: SignSpec<S>, steps: readonly SignStep[], w: number, h: number, u: number, lay: ReturnType<SignAtlas<S>['layout']>): void {
    const len = (l: SignLen): number => (l.w ?? 0) * w + (l.h ?? 0) * h + (l.u ?? 0) * u + (l.px ?? 0);
    const colour = (p: SignPaint): string => (typeof p === 'string' ? p : p.spec === 'color' ? spec.color : spec.ink ?? p.fallback);
    for (const step of steps) {
      if (step.op === 'fill') {
        ctx.fillStyle = colour(step.paint);
        if (step.inset === undefined) ctx.fillRect(0, 0, w, h);
        else { const i = len(step.inset); ctx.fillRect(i, i, w - i * 2, h - i * 2); }
      } else if (step.op === 'glyphs') {
        ctx.font = `${step.weight} ${u * step.size}px ${step.font}`;
        if (step.stroke === undefined) {
          ctx.fillStyle = colour(step.paint);
          lay.chars.forEach((ch, i) => { const [px, py] = lay.pos(i); ctx.fillText(ch, px, py + u * 0.04); });
        } else {
          ctx.strokeStyle = colour(step.paint);
          ctx.lineWidth = u * step.stroke;
          lay.chars.forEach((ch, i) => { const [px, py] = lay.pos(i); ctx.strokeText(ch, px, py + u * 0.04); });
        }
      } else if (step.op === 'frame') {
        const inset = u * step.inset;
        ctx.strokeStyle = colour(step.paint);
        ctx.lineWidth = u * step.width;
        if (step.radius === undefined) ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
        else {
          ctx.beginPath();
          ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, u * step.radius);
          ctx.stroke();
        }
      } else if (step.op === 'shadow') {
        ctx.shadowColor = step.color;
        ctx.shadowBlur = u * step.blur;
      } else {
        ctx.strokeStyle = colour(step.paint);
        ctx.lineWidth = len(step.width);
        ctx.beginPath();
        for (const s of step.path) {
          if ('m' in s) ctx.moveTo(len(s.m[0]), len(s.m[1]));
          else if ('l' in s) ctx.lineTo(len(s.l[0]), len(s.l[1]));
          else if ('q' in s) ctx.quadraticCurveTo(len(s.q[0]), len(s.q[1]), len(s.q[2]), len(s.q[3]));
          else if ('c' in s) ctx.bezierCurveTo(len(s.c[0]), len(s.c[1]), len(s.c[2]), len(s.c[3]), len(s.c[4]), len(s.c[5]));
          else ctx.arc(len(s.a[0]), len(s.a[1]), len(s.a[2]), s.a[3], s.a[4]);
        }
        ctx.stroke();
      }
    }
  }

  private drawMono(spec: SignSpec<S>): SignCell {
    const ctx = this.mctx;
    const lay = this.layout(spec, this.sizing.unit);
    const { w, h } = lay;
    const { x, y } = this.allocMono(w, h, spec.vertical);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.paint(ctx, spec, this.row(spec.style).steps, w, h, this.sizing.unit, lay);
    ctx.restore();
    return { u0: x / this.sizing.mw, v0: 1 - (y + h) / this.sizing.mh, u1: (x + w) / this.sizing.mw, v1: 1 - y / this.sizing.mh, mono: true };
  }

  private drawColour(spec: SignSpec<S>): SignCell {
    const ctx = this.cctx;
    const row = this.row(spec.style);
    const u = this.sizing.colourUnit;
    const lay = this.layout(spec, u);
    const fixed = row.face?.kind === 'fixed' ? row.face : null;
    const scale = this.sizing.colourScale;
    const w = fixed === null ? lay.w : fixed.px[0] * scale, h = fixed === null ? lay.h : fixed.px[1] * scale;
    const { x, y } = this.allocColour(w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // a fixed face's steps are drawn in its reference px
    if (fixed !== null && scale !== 1) ctx.scale(scale, scale);
    this.paint(ctx, spec, row.steps, fixed === null ? w : fixed.px[0], fixed === null ? h : fixed.px[1], u, lay);
    ctx.restore();
    return { u0: x / this.sizing.cw, v0: 1 - (y + h) / this.sizing.ch, u1: (x + w) / this.sizing.cw, v1: 1 - y / this.sizing.ch, mono: false };
  }
}

/** A sign to hang. */
export interface SignPlace<S extends string = string> {
  /** centre of the sign face */
  readonly at: Vector3;
  /** the direction the text faces */
  readonly normal: Vector3;
  /** character height in metres */
  readonly size: number;
  readonly spec: SignSpec<S>;
  readonly gain?: number;
  readonly flicker?: number;
  /** both faces (a blade sign hanging out from a wall) */
  readonly blade?: boolean;
  readonly board?: number;
  readonly fogK?: number;
  /** calligraphy signs: how much of the fog the neon cuts through (`NeonTextDef.clear`) */
  readonly clear?: number;
}

/** a sign `SignBuilder.place` drew: where it hangs, what it says, its face size, and whether the calligraphy drew it */
export interface PlacedSign<S extends string = string> { readonly p: SignPlace<S>; readonly w: number; readonly h: number; readonly neon: boolean }

/** A lit face a sign reports (reflection cards, light spill). */
export interface SignLight {
  readonly at: Vector3;
  /** linear colour */
  readonly color: Color;
  readonly w: number;
  readonly h: number;
  readonly power: number;
  readonly spill: number;
}

/** The box behind a sign's face (its board): centre, axes and half sizes. */
export interface SignBoardBox { readonly c: Vector3; readonly right: Vector3; readonly up: Vector3; readonly normal: Vector3; readonly hx: number; readonly hy: number; readonly hz: number }

/** Where a sign's board goes: a shard's kit or batch. */
export type SignBoardSink = (box: SignBoardBox) => void;

/** The neon calligraphy a builder may route calligraphy styles to (`NeonText`). */
export interface SignCalligraphy {
  /** its full glow gain: a sign's gain over its style's default scales it */
  readonly gain: number;
  add: (def: { text: string; color: string; vertical: boolean; em: number; at: Vector3; facing: Vector3; twoSided: boolean; gain: number; flicker: number; clear: number }) => { w: number; h: number };
}

const upOf = (row: SignStyleRow): Vector3 => (row.up === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0));

/** a sign's face size (m): a row of glyph cells, or the style's fixed face */
export function signSize<S extends string>(row: SignStyleRow, p: SignPlace<S>): { w: number; h: number } {
  const n = glyphsOf(p.spec.text).length;
  const isV = p.spec.vertical;
  const fixed = row.face?.kind === 'fixed' ? row.face : null;
  const h = fixed !== null ? p.size * fixed.h : isV ? p.size * (n + 0.62) : p.size * 1.36;
  const w = fixed !== null ? p.size * fixed.w : isV ? p.size * 1.36 : p.size * (n + 0.62);
  return { w, h };
}

/** a sign's board: a dark box behind its face (both faces for a blade) */
export function signBoardBox<S extends string>(row: SignStyleRow, p: SignPlace<S>, w: number, h: number): SignBoardBox {
  const up = upOf(row);
  const right = new Vector3().crossVectors(up, p.normal).normalize();
  const depth = p.blade === true ? 0.12 : 0.1;
  const c = p.at.clone();
  if (p.blade !== true) c.addScaledVector(p.normal, -depth / 2 + 0.01);
  return { c, right, up, normal: p.normal.clone(), hx: w / 2 + 0.05, hy: h / 2 + 0.05, hz: depth / 2 };
}

/** sign quad modes (aNeon.w) */
const MODE = { mono: 0, solid: 1, blink: 2, colour: 3 } as const;

/**
 * Collects sign quads (position, uv, board colour, aTint, aNeon = gain, flicker, fog k, mode) for the shard's sign
 * program, and hands each board to the sink `place` is given.
 */
export class SignBuilder<S extends string = string> {
  private readonly pos: number[] = [];
  private readonly uv: number[] = [];
  private readonly col: number[] = [];
  private readonly tint: number[] = [];
  private readonly neon: number[] = [];
  private readonly idx: number[] = [];
  private n = 0;
  /** every lit lightbox (calligraphy signs report through their own system) */
  readonly lights: SignLight[] = [];
  /** when set, calligraphy styles are drawn by it instead of atlas quads */
  calligraphy: SignCalligraphy | null = null;
  /** every sign `place` drew, in order */
  readonly placed: PlacedSign<S>[] = [];

  constructor(readonly atlas: SignAtlas<S>) {}

  private quad(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, cell: SignCell | null, board: Color, tint: Color, neon: readonly [number, number, number, number]): void {
    const hw = w / 2, hh = h / 2;
    const u0 = cell?.u0 ?? 0, v0 = cell?.v0 ?? 0, u1 = cell?.u1 ?? 0, v1 = cell?.v1 ?? 0;
    const corners: readonly [number, number, number, number][] = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    const i = this.n;
    for (const [sx, sy, u, v] of corners) {
      const p = c.clone().addScaledVector(right, sx * hw).addScaledVector(up, sy * hh);
      this.pos.push(p.x, p.y, p.z);
      this.uv.push(u, v);
      this.col.push(board.r, board.g, board.b);
      this.tint.push(tint.r, tint.g, tint.b);
      this.neon.push(neon[0], neon[1], neon[2], neon[3]);
      this.n++;
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** a solid emissive quad (tube light, window glow) or a blinking beacon */
  light(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, color: number, gain: number, mode: 1 | 2 = 1, seed = 0): void {
    const col = new Color(color);
    this.quad(c, right, up, w, h, null, new Color(0), col, [gain, seed, 0.5, mode === 2 ? MODE.blink : MODE.solid]);
  }

  /** a neon tube along a segment, facing `facing` (both sides) */
  tube(a: Vector3, b: Vector3, facing: Vector3, width: number, color: number, gain: number, flicker = 0): void {
    const d = new Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-3) return;
    d.divideScalar(len);
    const up = new Vector3().crossVectors(facing, d).normalize();
    const c = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    const col = new Color(color);
    this.quad(c, d, up, len, width, null, new Color(0), col, [gain, flicker, 0.5, MODE.solid]);
    this.quad(c, d.clone().negate(), up, len, width, null, new Color(0), col, [gain, flicker, 0.5, MODE.solid]);
  }

  /** place a sign; its board (and nothing else) goes to `board` */
  place(p: SignPlace<S>, board: SignBoardSink | null): { w: number; h: number } {
    const row = this.atlas.row(p.spec.style);
    const defaultGain = row.gain;
    if (row.calligraphy === true && this.calligraphy !== null) {
      const size = this.calligraphy.add({ text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, em: p.size, at: p.at, facing: p.normal,
        twoSided: p.blade === true, gain: ((p.gain ?? defaultGain) / defaultGain) * this.calligraphy.gain, flicker: p.flicker ?? 0, clear: p.clear ?? 0 });
      this.placed.push({ p: { ...p, at: p.at.clone(), normal: p.normal.clone() }, ...size, neon: true });
      return size;
    }
    const cell = this.atlas.get(p.spec);
    const { w, h } = signSize(row, p);
    const upv = upOf(row);
    const right = new Vector3().crossVectors(upv, p.normal).normalize();
    const mono = cell.mono;
    const boardColour = new Color(p.board ?? row.board);
    const gain = p.gain ?? defaultGain;
    const fogK = p.fogK ?? (gain > 1.5 ? 0.5 : 1.0);
    const tint = new Color(mono ? p.spec.color : 0xffffff);
    const nv: [number, number, number, number] = [gain, p.flicker ?? 0, fogK, mono ? MODE.mono : MODE.colour];
    const eps = 0.065;
    this.quad(p.at.clone().addScaledVector(p.normal, eps), right, upv, w, h, cell, boardColour, tint, nv);
    if (p.blade === true) {
      const back = p.normal.clone().negate();
      const rb = new Vector3().crossVectors(upv, back).normalize();
      this.quad(p.at.clone().addScaledVector(back, eps), rb, upv, w, h, cell, boardColour, tint, nv);
    }
    if (mono && gain > 1.5) this.lights.push({ at: p.at.clone(), color: new Color(p.spec.color), w, h, power: 0.7, spill: 0.25 });
    if (board !== null) board(signBoardBox(row, p, w, h));
    this.placed.push({ p: { ...p, at: p.at.clone(), normal: p.normal.clone() }, w, h, neon: false });
    return { w, h };
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aTint', new Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aNeon', new Float32BufferAttribute(this.neon, 4));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
