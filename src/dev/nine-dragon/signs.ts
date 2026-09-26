// Hand-bent neon calligraphy: real words (麵 牙科 火鍋 茶 藥房 旅館 …) drawn once at load into two atlases.
//  - the MONO atlas (2048 × 4096 canvas → one R8 texture): neon tubes and lightboxes drawn in white; the neon colour is
//    a per-vertex tint, so one cell serves every colour (hundreds of signs, ~100 cells). Horizontal cells pack in rows
//    in the top half, vertical ones in columns in the bottom half.
//  - the COLOUR atlas (1024², sRGB): the few multi-colour pieces — plaques, couplets, the talisman, the blade's etch.
// The board behind a tube is vertex colour, so the neon shader glows the tubes (HDR, into the bloom) while the board
// stays a dark ink mass.
import {
  BufferGeometry, CanvasTexture, Color, DataTexture, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter, RedFormat, SRGBColorSpace,
  type Texture, Uint32BufferAttribute, UnsignedByteType, Vector3,
} from 'three';
import type { Emitter } from './emitters';
import type { Kit, Look } from './kit';
import type { NeonSigns } from './neonsigns';
import { chars } from './util';

export const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';
export const SONG = '"Noto Serif TC", "Songti TC", "STSong", "PMingLiU", serif';

export type SignStyle = 'tube' | 'box' | 'plaque' | 'paper' | 'talisman' | 'etch' | 'banner';

export interface SignSpec {
  text: string;
  /** mono styles: the neon / lightbox tint; colour styles: the character colour */
  color: string;
  vertical: boolean;
  style: SignStyle;
  /** colour styles: the ground (paper, lacquer) */
  ink?: string;
}

export interface Cell { u0: number; v0: number; u1: number; v1: number; mono: boolean }

const MW = 2048, MH = 4096, CS = 1024;
const U = 96; // px per character
const PAD = 8;

const isMono = (s: SignStyle): boolean => s === 'tube' || s === 'box';

export class SignAtlas {
  private readonly mono: HTMLCanvasElement;
  private readonly mctx: CanvasRenderingContext2D;
  private readonly colour: HTMLCanvasElement;
  private readonly cctx: CanvasRenderingContext2D;
  private hx = 0;
  private hy = 0;
  private vx = 0;
  private vy = MH / 2;
  private cx = 0;
  private cy = 0;
  private crow = 0;
  private readonly cache = new Map<string, Cell>();
  readonly monoTex: DataTexture;
  readonly colourTex: CanvasTexture;

  constructor() {
    this.mono = document.createElement('canvas');
    this.mono.width = MW;
    this.mono.height = MH;
    this.colour = document.createElement('canvas');
    this.colour.width = this.colour.height = CS;
    const m = this.mono.getContext('2d', { willReadFrequently: true });
    const c = this.colour.getContext('2d');
    if (m === null || c === null) throw new Error('2d canvas unavailable');
    this.mctx = m;
    this.cctx = c;
    m.fillStyle = '#000';
    m.fillRect(0, 0, MW, MH);
    this.monoTex = new DataTexture(new Uint8Array(4), 1, 1, RedFormat, UnsignedByteType);
    this.colourTex = new CanvasTexture(this.colour);
    this.colourTex.colorSpace = SRGBColorSpace;
    this.colourTex.minFilter = LinearMipmapLinearFilter;
    this.colourTex.anisotropy = 8;
  }

  /** after every sign is placed: copy the mono canvas's red channel into the R8 texture */
  finish(): void {
    const img = this.mctx.getImageData(0, 0, MW, MH).data;
    const r = new Uint8Array(MW * MH);
    // the canvas is top-down; the texture's v runs bottom-up (flipY is off for DataTexture)
    for (let y = 0; y < MH; y++) {
      const src = y * MW * 4, dst = (MH - 1 - y) * MW;
      for (let x = 0; x < MW; x++) r[dst + x] = img[src + x * 4] ?? 0;
    }
    this.monoTex.image = { data: r, width: MW, height: MH };
    this.monoTex.minFilter = LinearMipmapLinearFilter;
    this.monoTex.magFilter = LinearFilter;
    this.monoTex.generateMipmaps = true;
    this.monoTex.anisotropy = 8;
    this.monoTex.needsUpdate = true;
    this.colourTex.needsUpdate = true;
  }

  get textures(): { mono: Texture; colour: Texture } { return { mono: this.monoTex, colour: this.colourTex }; }

  /** debug: the mono atlas as an image */
  dump(): string { return this.mono.toDataURL('image/jpeg', 0.8); }

  private allocMono(w: number, h: number, vertical: boolean): { x: number; y: number } {
    if (vertical) {
      if (this.vy + h > MH) { this.vy = MH / 2; this.vx += w + PAD; }
      if (this.vx + w > MW) throw new Error('mono atlas (vertical) full');
      const at = { x: this.vx, y: this.vy };
      this.vy += h + PAD;
      return at;
    }
    if (this.hx + w > MW) { this.hx = 0; this.hy += h + PAD; }
    if (this.hy + h > MH / 2) throw new Error('mono atlas (horizontal) full');
    const at = { x: this.hx, y: this.hy };
    this.hx += w + PAD;
    return at;
  }

  private allocColour(w: number, h: number): { x: number; y: number } {
    if (this.cx + w > CS) { this.cx = 0; this.cy += this.crow + PAD; this.crow = 0; }
    if (this.cy + h > CS) throw new Error('colour atlas full');
    const at = { x: this.cx, y: this.cy };
    this.cx += w + PAD;
    this.crow = Math.max(this.crow, h);
    return at;
  }

  get(spec: SignSpec): Cell {
    const mono = isMono(spec.style);
    const key = mono ? `${spec.style}|${spec.text}|${spec.vertical ? 'v' : 'h'}` : `${spec.style}|${spec.text}|${spec.color}|${spec.vertical ? 'v' : 'h'}|${spec.ink ?? ''}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const cell = mono ? this.drawMono(spec) : this.drawColour(spec);
    this.cache.set(key, cell);
    return cell;
  }

  private layout(spec: SignSpec, u: number): { w: number; h: number; pos: (i: number) => [number, number]; chars: string[] } {
    const cs = chars(spec.text);
    const n = cs.length;
    const w = spec.vertical ? Math.round(u * 1.36) : Math.round(u * (n + 0.62));
    const h = spec.vertical ? Math.round(u * (n + 0.62)) : Math.round(u * 1.36);
    return { w, h, chars: cs, pos: (i) => (spec.vertical ? [w / 2, u * (0.81 + i)] : [u * (0.81 + i), h / 2]) };
  }

  private drawMono(spec: SignSpec): Cell {
    const ctx = this.mctx;
    const { w, h, chars: glyphList, pos } = this.layout(spec, U);
    const { x, y } = this.allocMono(w, h, spec.vertical);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyphs = (font: string, style: string): void => {
      ctx.font = font;
      ctx.fillStyle = style;
      glyphList.forEach((ch, i) => { const [px, py] = pos(i); ctx.fillText(ch, px, py + U * 0.04); });
    };
    const frame = (inset: number, lw: number, r: number, style: string): void => {
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, r);
      ctx.stroke();
    };
    if (spec.style === 'tube') {
      // the halo soaks out of the tube, the tube itself is near white; the tint comes from the vertex
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = U * 0.07;
      glyphs(`900 ${U * 0.84}px ${KAI}`, '#9a9a9a');
      frame(U * 0.1, U * 0.035, U * 0.08, '#d0d0d0');
      ctx.shadowBlur = 0;
      glyphs(`900 ${U * 0.84}px ${KAI}`, '#ffffff');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = U * 0.035;
      glyphList.forEach((ch, i) => { const [px, py] = pos(i); ctx.strokeText(ch, px, py + U * 0.04); });
      frame(U * 0.1, U * 0.014, U * 0.08, '#ffffff');
    } else {
      // a lightbox: the tinted panel glows, the characters are the dark board showing through
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(U * 0.06, U * 0.06, w - U * 0.12, h - U * 0.12);
      glyphs(`900 ${U * 0.8}px ${SONG}`, '#000000');
      frame(U * 0.15, U * 0.03, 0, '#000000');
    }
    ctx.restore();
    return { u0: x / MW, v0: 1 - (y + h) / MH, u1: (x + w) / MW, v1: 1 - y / MH, mono: true };
  }

  private drawColour(spec: SignSpec): Cell {
    const ctx = this.cctx;
    const isEtch = spec.style === 'etch';
    const u = 72;
    const lay = this.layout(spec, u);
    const w = isEtch ? 1000 : lay.w, h = isEtch ? 80 : lay.h;
    const { x, y } = this.allocColour(w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyphs = (font: string): void => {
      ctx.font = font;
      lay.chars.forEach((ch, i) => { const [px, py] = lay.pos(i); ctx.fillText(ch, px, py + u * 0.04); });
    };
    const frame = (inset: number, lw: number): void => {
      ctx.lineWidth = lw;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    };
    if (spec.style === 'plaque') {
      ctx.fillStyle = spec.ink ?? '#15110e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = spec.color;
      ctx.strokeStyle = spec.color;
      glyphs(`900 ${u * 0.78}px ${SONG}`);
      frame(u * 0.08, u * 0.05);
      frame(u * 0.16, u * 0.015);
    } else if (spec.style === 'paper' || spec.style === 'banner') {
      ctx.fillStyle = spec.ink ?? '#b8321f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = spec.color;
      glyphs(`700 ${u * 0.78}px ${KAI}`);
      if (spec.style === 'banner') { ctx.strokeStyle = spec.color; frame(u * 0.08, u * 0.02); }
    } else if (spec.style === 'talisman') {
      ctx.fillStyle = '#e9c65a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b3261a';
      ctx.strokeStyle = '#b3261a';
      glyphs(`700 ${u * 0.7}px ${KAI}`);
      ctx.lineWidth = u * 0.03;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const yy = h * (0.08 + i * 0.2);
        ctx.moveTo(w * 0.12, yy);
        ctx.bezierCurveTo(w * 0.4, yy - u * 0.2, w * 0.6, yy + u * 0.2, w * 0.88, yy);
      }
      ctx.stroke();
      frame(u * 0.06, u * 0.03);
    } else {
      // etch: cloud scrolls (祥云) and a circuit line along a blade, silver on nothing
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20, h * 0.5);
      ctx.lineTo(w - 20, h * 0.5);
      ctx.moveTo(40, h * 0.28);
      ctx.lineTo(w * 0.45, h * 0.28);
      ctx.lineTo(w * 0.5, h * 0.4);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const ccx = 90 + i * 128, ccy = h * (i % 2 === 0 ? 0.64 : 0.38);
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(ccx + k * 20, ccy, 13 - k * 3, Math.PI * (0.2 + k * 0.1), Math.PI * (1.9 - k * 0.1));
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(ccx - 28, ccy + 14);
        ctx.quadraticCurveTo(ccx + 18, ccy + 24, ccx + 64, ccy + 10);
        ctx.stroke();
      }
    }
    ctx.restore();
    return { u0: x / CS, v0: 1 - (y + h) / CS, u1: (x + w) / CS, v1: 1 - y / CS, mono: false };
  }
}

export interface SignPlace {
  /** centre of the sign face */
  at: Vector3;
  /** the direction the text faces */
  normal: Vector3;
  /** character height in metres */
  size: number;
  spec: SignSpec;
  gain?: number;
  flicker?: number;
  /** both faces (a blade sign hanging out from a wall) */
  blade?: boolean;
  board?: number;
  fogK?: number;
}

/** neon quad modes (aNeon.w) */
const MODE = { mono: 0, solid: 1, blink: 2, colour: 3 } as const;

/** collects sign quads (neon program) and their boards / brackets (Jiehua program) */
export class SignBuilder {
  private readonly pos: number[] = [];
  private readonly uv: number[] = [];
  private readonly col: number[] = [];
  private readonly tint: number[] = [];
  private readonly neon: number[] = [];
  private readonly idx: number[] = [];
  private n = 0;
  /** every lit lightbox (the streak cards and the spill read these; tube signs report through NeonSigns) */
  readonly lights: Emitter[] = [];
  /** when set, 'tube' signs are drawn as SDF neon calligraphy (neonsigns.ts) instead of atlas quads */
  calligraphy: NeonSigns | null = null;

  constructor(readonly atlas: SignAtlas) {}

  private quad(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, cell: Cell | null, board: Color, tint: Color, neon: readonly [number, number, number, number]): void {
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

  /** place a sign; its board (and nothing else) goes into `kit` */
  place(p: SignPlace, kit: Kit | null): { w: number; h: number } {
    if (p.spec.style === 'tube' && this.calligraphy !== null) {
      return this.calligraphy.add({ text: p.spec.text, color: p.spec.color, vertical: p.spec.vertical, em: p.size, at: p.at, facing: p.normal,
        twoSided: p.blade === true, gain: ((p.gain ?? 4.4) / 4.4) * 4.2, flicker: p.flicker ?? 0 });
    }
    const cell = this.atlas.get(p.spec);
    const n = chars(p.spec.text).length;
    const isV = p.spec.vertical;
    const etch = p.spec.style === 'etch';
    const h = etch ? p.size : isV ? p.size * (n + 0.62) : p.size * 1.36;
    const w = etch ? p.size * 12.5 : isV ? p.size * 1.36 : p.size * (n + 0.62);
    const upv = etch ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(upv, p.normal).normalize();
    const mono = cell.mono;
    const board = new Color(p.board ?? (p.spec.style === 'tube' ? 0x17191e : 0x1d1f25));
    const gain = p.gain ?? (p.spec.style === 'tube' ? 4.4 : p.spec.style === 'box' ? 2.2 : p.spec.style === 'plaque' ? 1.5 : 1.0);
    const fogK = p.fogK ?? (gain > 1.5 ? 0.5 : 1.0);
    const tint = new Color(mono ? p.spec.color : 0xffffff);
    const nv: [number, number, number, number] = [gain, p.flicker ?? 0, fogK, mono ? MODE.mono : MODE.colour];
    const eps = 0.065;
    this.quad(p.at.clone().addScaledVector(p.normal, eps), right, upv, w, h, cell, board, tint, nv);
    if (p.blade === true) {
      const back = p.normal.clone().negate();
      const rb = new Vector3().crossVectors(upv, back).normalize();
      this.quad(p.at.clone().addScaledVector(back, eps), rb, upv, w, h, cell, board, tint, nv);
    }
    if (mono && gain > 1.5) this.lights.push({ at: p.at.clone(), color: new Color(p.spec.color), w, h, power: 0.7, spill: 0.25 });
    if (kit !== null) {
      const look: Look = { wash: 0x24262c, line: 1 };
      const depth = p.blade === true ? 0.12 : 0.1;
      const c = p.at.clone();
      if (p.blade !== true) c.addScaledVector(p.normal, -depth / 2 + 0.01);
      kit.boxAxes(c, right, upv, p.normal.clone(), w / 2 + 0.05, h / 2 + 0.05, depth / 2, look);
    }
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
