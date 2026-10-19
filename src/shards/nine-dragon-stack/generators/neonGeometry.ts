import { BufferAttribute, BufferGeometry, Color, DataUtils, Float16BufferAttribute, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';

interface SignLight { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }
interface GlyphField { readonly layout: { cell: number; fontPx: number }; readonly rect: (ch: string) => { u0: number; v0: number; u1: number; v1: number } }
export interface NeonTextDef {
  text: string;
  /** neon hue, sRGB hex */
  color: string;
  vertical: boolean;
  /** character height, metres */
  em: number;
  /** board centre */
  at: Vector3;
  /** the front face's normal */
  facing: Vector3;
  twoSided?: boolean;
  gain?: number;
  flicker?: number;
  /** 0..1: how much of the fog the neon cuts through (0: the tubes fade as √ of the fog, 1: not at all): a hero sign
   *  that must read at full strength through the mist */
  clear?: number;
}

const MODE = { face: 0, side: 1 } as const;

class Batch {
  readonly pos: number[] = [];
  readonly a2: number[] = [];
  readonly b2: number[] = [];
  readonly tint: number[] = [];
  readonly p: number[] = [];
  readonly idx: number[] = [];
  n = 0;

  quad(c: Vector3, right: Vector3, up: Vector3, hw: number, hh: number, uv: readonly [number, number, number, number], b: readonly [number, number], quadLocal: boolean, tint: Color, p: readonly [number, number, number, number]): void {
    const i = this.n;
    const [u0, v0, u1, v1] = uv;
    const corners: readonly (readonly [number, number, number, number])[] = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
    for (const [sx, sy, u, v] of corners) {
      const q = c.clone().addScaledVector(right, sx * hw).addScaledVector(up, sy * hh);
      this.pos.push(q.x, q.y, q.z);
      this.a2.push(u, v);
      if (quadLocal) this.b2.push(sx, sy);
      else this.b2.push(b[0], b[1]);
      this.tint.push(tint.r, tint.g, tint.b);
      this.p.push(p[0], p[1], p[2], p[3]);
      this.n++;
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** an oriented box; the ±n faces get the face uv (0..1) and p's mode, the rest `sideMode` */
  box(c: Vector3, x: Vector3, y: Vector3, n: Vector3, hx: number, hy: number, hz: number, tint: Color, p: readonly [number, number, number, number], sideMode: number, twoFaced: boolean): void {
    const full = [0, 0, 1, 1] as const;
    const sideP = [p[0], p[1], sideMode, p[3]] as const;
    this.quad(c.clone().addScaledVector(n, hz), x, y, hx, hy, full, [hx * 2, hy * 2], false, tint, p);
    this.quad(c.clone().addScaledVector(n, -hz), x.clone().negate(), y, hx, hy, full, [hx * 2, hy * 2], false, tint, twoFaced ? p : sideP);
    this.quad(c.clone().addScaledVector(x, hx), n.clone().negate(), y, hz, hy, full, [hz * 2, hy * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(x, -hx), n, y, hz, hy, full, [hz * 2, hy * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(y, hy), x, n.clone().negate(), hx, hz, full, [hx * 2, hz * 2], false, tint, sideP);
    this.quad(c.clone().addScaledVector(y, -hy), x, n, hx, hz, full, [hx * 2, hz * 2], false, tint, sideP);
  }

  geometry(names: readonly [string, string]): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute(names[0], new Float32BufferAttribute(this.a2, 2));
    // (E281 round 2, memory: the board size / quad corner and the params as half floats, the tint as bytes — 36
    // bytes a vertex instead of 56; the programs read the same values, a vec3 tint takes the first three of four)
    const half = (a: number[]): Uint16Array => { const o = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = DataUtils.toHalfFloat(a[i] ?? 0); return o; };
    const tint = new Uint8Array(this.n * 4);
    for (let i = 0; i < this.n; i++) for (let k = 0; k < 3; k++) tint[i * 4 + k] = Math.round(Math.min(1, Math.max(0, this.tint[i * 3 + k] ?? 0)) * 255);
    g.setAttribute(names[1], new Float16BufferAttribute(half(this.b2), 2));
    g.setAttribute('aTint', new BufferAttribute(tint, 4, true));
    g.setAttribute('aP', new Float16BufferAttribute(half(this.p), 4));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export class NeonText {
  private readonly boards = new Batch();
  private readonly tubes = new Batch();
  readonly emitters: SignLight[] = [];
  /** the boards' look ('nine-neon-board') and the tubes' ('nine-neon-tube', additive) */


  /** `fullGain`: the look's full glow gain */
  constructor(private readonly fullGain: number, private readonly atlas: GlyphField) {}

  /** the board's outer size for a sign (so callers can hang brackets) */
  static size(text: string, em: number, vertical: boolean): { w: number; h: number } {
    const n = Array.from(text).length;
    return { w: vertical ? em * 1.42 : em * (n + 0.62), h: vertical ? em * (n + 0.58) : em * 1.42 };
  }

  /** the look's full glow gain */
  get gain(): number { return this.fullGain; }

  add(def: NeonTextDef): { w: number; h: number } {
    const { w, h, at, f, tint, gain } = this.draw(def, this.boards, this.tubes);
    const k = (1.4 * gain) / this.fullGain;
    this.emitters.push({ at: at.clone().addScaledVector(f, 0.09 / 2), color: tint.clone(), w, h, power: k, spill: 0.3 * k });
    return { w, h };
  }

  /**
   * One sign alone, its board and its tubes as two geometries (a sign model's specimen), drawn by `boardMat` and
   * `tubeMat` over this atlas (its characters must be in it)
   */
  one(def: NeonTextDef): { boards: BufferGeometry; tubes: BufferGeometry } {
    const boards = new Batch(), tubes = new Batch();
    this.draw(def, boards, tubes);
    return { boards: boards.geometry(['aUv', 'aSize']), tubes: tubes.geometry(['aAtlas', 'aQ']) };
  }

  private draw(def: NeonTextDef, boards: Batch, tubes: Batch): { w: number; h: number; at: Vector3; f: Vector3; tint: Color; gain: number } {
    const cs = Array.from(def.text);
    const em = def.em;
    const { w, h } = NeonText.size(def.text, em, def.vertical);
    const up = new Vector3(0, 1, 0);
    const f = def.facing.clone().setY(0).normalize();
    const right = new Vector3().crossVectors(up, f).normalize();
    const depth = 0.09;
    const at = def.at.clone();
    const tint = new Color(def.color);
    const gain = def.gain ?? this.fullGain;
    const seed = def.flicker ?? 0;
    const two = def.twoSided === true;
    const clear = Math.min(1, Math.max(0, def.clear ?? 0));
    boards.box(at, right, up, f, w / 2, h / 2, depth / 2, tint, [gain, seed, MODE.face, clear], MODE.side, two);
    const cellEm = this.atlas.layout.cell / this.atlas.layout.fontPx;
    for (const side of two ? [1, -1] : [1]) {
      const fn = f.clone().multiplyScalar(side);
      const r = new Vector3().crossVectors(up, fn).normalize();
      const c0 = at.clone().addScaledVector(fn, depth / 2 + 0.012);
      cs.forEach((ch, i) => {
        const g = this.atlas.rect(ch);
        const off = def.vertical ? new Vector3().addScaledVector(up, h / 2 - em * (0.79 + i)) : new Vector3().addScaledVector(r, -w / 2 + em * (0.81 + i));
        tubes.quad(c0.clone().add(off), r, up, (em * cellEm) / 2, (em * cellEm) / 2, [g.u0, g.v0, g.u1, g.v1], [0, 0], true, tint, [gain, seed, clear, 0]);
      });
    }
    return { w, h, at, f, tint, gain };
  }

  build(): { boards: BufferGeometry; tubes: BufferGeometry } {
    return { boards: this.boards.geometry(['aUv', 'aSize']), tubes: this.tubes.geometry(['aAtlas', 'aQ']) };
  }
}
