// Lab P1 "ink" (E169): the modular kit for the street-canyon test scene. It emits the SAME vertex contract as the
// clean room's kit (src/dev/nine-dragon/kit.ts: aFace = u, v, w, h in metres · aPat = kind, row, col, seed ·
// aMisc = emit, line weight, wet, flags · aOff = the world-aligned pattern offset), so the lab's jiehuaMaterial drops
// into the clean room unchanged. One addition: flag bits 256·512·1024·2048 mark which of a face's four borders are a
// GROUND LINE (a walkable lip: drawn heavier). The clean room's shader ignores those bits.
import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';

/** pattern kinds the material draws (vPat.x); same numbers as the clean room */
export const K = { plain: 0, facade: 1, tiles: 2, flag: 3, bars: 4, panel: 5, net: 6, leaf: 7, cloth: 8, stone: 9 } as const;

/** edge mask bits: which face borders get a ruled ink line (u0 = the u=0 border, …) */
export const E = { u0: 1, u1: 2, v0: 4, v1: 8, all: 15, rims: 12, sides: 3, none: 0 } as const;

export interface Look {
  wash: number;
  kind?: number;
  row?: number;
  col?: number;
  seed?: number;
  emit?: number;
  /** edge line weight (1 = the world ruling, 0 = none) */
  line?: number;
  wet?: number;
  edges?: number;
  /** which borders are ground lines (walkable lips), same bit layout as `edges` */
  ground?: number;
  accent?: boolean;
  gloss?: boolean;
  gold?: boolean;
}

const tc = new Color();
const vn = new Vector3(), vt = new Vector3();

export class Kit {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly face: number[] = [];
  private readonly pat: number[] = [];
  private readonly misc: number[] = [];
  private readonly off: number[] = [];
  private readonly idx: number[] = [];
  private n = 0;

  get vertexCount(): number { return this.n; }

  private vert(p: Vector3, nrm: Vector3, u: number, v: number, w: number, h: number, look: Look, uo: number, vo: number, flags: number): void {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(nrm.x, nrm.y, nrm.z);
    tc.setHex(look.wash);
    this.col.push(tc.r, tc.g, tc.b);
    this.face.push(u, v, w, h);
    this.pat.push(look.kind ?? 0, look.row ?? 3.2, look.col ?? 2.4, look.seed ?? 0);
    this.misc.push(look.emit ?? 0, look.line ?? 1, look.wet ?? 0, flags);
    this.off.push(uo, vo);
    this.n++;
  }

  private static flags(look: Look, edgesDefault: number, groundDefault: number): number {
    return (look.edges ?? edgesDefault) + (look.accent === true ? 16 : 0) + (look.gloss === true ? 32 : 0) + (look.gold === true ? 64 : 0)
      + (look.ground ?? groundDefault) * 256;
  }

  /** a quad from four corners: a=(0,0) b=(w,0) c=(w,h) d=(0,h) */
  quad4(a: Vector3, b: Vector3, c: Vector3, d: Vector3, w: number, h: number, look: Look, uo = 0, vo = 0, edgesDefault: number = E.all, groundDefault = 0): void {
    vt.subVectors(b, a);
    vn.subVectors(d, a).cross(vt).negate();
    if (vn.lengthSq() < 1e-12) vn.subVectors(c, a).cross(vt).negate();
    vn.normalize();
    const f = Kit.flags(look, edgesDefault, groundDefault);
    const i = this.n;
    this.vert(a, vn, 0, 0, w, h, look, uo, vo, f);
    this.vert(b, vn, w, 0, w, h, look, uo, vo, f);
    this.vert(c, vn, w, h, w, h, look, uo, vo, f);
    this.vert(d, vn, 0, h, w, h, look, uo, vo, f);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** a rectangle from a corner and two unit directions; the pattern offset is world-aligned */
  quad(p0: Vector3, u: Vector3, v: Vector3, w: number, h: number, look: Look, edgesDefault: number = E.all, groundDefault = 0): void {
    const a = p0.clone();
    const b = p0.clone().addScaledVector(u, w);
    const c = b.clone().addScaledVector(v, h);
    const d = p0.clone().addScaledVector(v, h);
    this.quad4(a, b, c, d, w, h, look, p0.dot(u), p0.dot(v), edgesDefault, groundDefault);
  }

  /**
   * An axis-aligned (optionally Y-rotated) box from its bottom-centre. `walk` = its top is walkable: the top face's
   * borders and the side faces' top borders become ground lines.
   */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, look: Look,
    opt: { rotY?: number; top?: Look | null; bottom?: Look | null; sides?: number; walk?: boolean } = {}): void {
    const r = opt.rotY ?? 0;
    const ax = new Vector3(Math.cos(r), 0, -Math.sin(r));
    const az = new Vector3(Math.sin(r), 0, Math.cos(r));
    const ay = new Vector3(0, 1, 0);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const c = new Vector3(x, y + hy, z);
    const corner = (a: number, b: number, d: number): Vector3 => c.clone().addScaledVector(ax, a * hx).addScaledVector(ay, b * hy).addScaledVector(az, d * hz);
    const sides = opt.sides ?? 15;
    const g = opt.walk === true ? E.v1 : 0;
    const nax = ax.clone().negate(), naz = az.clone().negate();
    if ((sides & 4) !== 0) this.quad(corner(-1, -1, 1), ax, ay, sx, sy, look, E.all, g);
    if ((sides & 8) !== 0) this.quad(corner(1, -1, -1), nax, ay, sx, sy, look, E.all, g);
    if ((sides & 1) !== 0) this.quad(corner(1, -1, 1), naz, ay, sz, sy, look, E.all, g);
    if ((sides & 2) !== 0) this.quad(corner(-1, -1, -1), az, ay, sz, sy, look, E.all, g);
    const top = opt.top === undefined ? look : opt.top;
    const bottom = opt.bottom === undefined ? look : opt.bottom;
    if (top !== null) this.quad(corner(-1, 1, 1), ax, naz, sx, sz, top, E.all, opt.walk === true ? E.all : 0);
    if (bottom !== null) this.quad(corner(-1, -1, -1), ax, az, sx, sz, bottom);
  }

  /** a thin box between two points (beams, poles, rails, cables): `w` × `h` cross-section */
  beam(a: Vector3, b: Vector3, w: number, h: number, look: Look): void {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const side = new Vector3().crossVectors(dir, new Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-6) side.crossVectors(dir, new Vector3(1, 0, 0));
    side.normalize();
    const up = new Vector3().crossVectors(side, dir).normalize();
    const hw = w / 2, hh = h / 2;
    const P = (s: number, t: number, e: 0 | 1): Vector3 => (e === 0 ? a : b).clone().addScaledVector(side, s * hw).addScaledVector(up, t * hh);
    // four long faces, the long axis is v so the ruling runs along it
    const faces: [number, number, number, number][] = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]];
    for (const [s0, t0, s1, t1] of faces) {
      const wd = Math.hypot((s1 - s0) * hw, (t1 - t0) * hh);
      this.quad4(P(s1, t1, 0), P(s0, t0, 0), P(s0, t0, 1), P(s1, t1, 1), wd, len, look);
    }
    this.quad4(P(1, -1, 1), P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), w, h, look);
    this.quad4(P(-1, -1, 0), P(1, -1, 0), P(1, 1, 0), P(-1, 1, 0), w, h, look);
  }

  /** a triangle with no ruled edges of its own (gables, roof ends) */
  tri(a: Vector3, b: Vector3, c: Vector3, look: Look): void {
    vt.subVectors(b, a);
    vn.subVectors(c, a).cross(vt).negate().normalize();
    const f = Kit.flags(look, E.none, 0);
    const i = this.n;
    this.vert(a, vn, 0.5, 0.5, 1, 1, look, a.x, a.y, f);
    this.vert(b, vn, 0.5, 0.5, 1, 1, look, a.x, a.y, f);
    this.vert(c, vn, 0.5, 0.5, 1, 1, look, a.x, a.y, f);
    this.idx.push(i, i + 1, i + 2);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aFace', new Float32BufferAttribute(this.face, 4));
    g.setAttribute('aPat', new Float32BufferAttribute(this.pat, 4));
    g.setAttribute('aMisc', new Float32BufferAttribute(this.misc, 4));
    g.setAttribute('aOff', new Float32BufferAttribute(this.off, 2));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Technique B (barycentric): the same geometry, de-indexed, with `aBary` per corner. A quad's two triangles share
 * the a–c diagonal; that component is pushed to 1e3 so it never draws. Real borders keep 0 at the far corner.
 */
export function toBary(src: BufferGeometry): BufferGeometry {
  const idx = src.getIndex();
  if (idx === null) throw new Error('toBary wants an indexed kit geometry');
  const g = src.toNonIndexed();
  const face = src.getAttribute('aFace');
  const n = idx.count;
  const bary = new Float32Array(n * 3);
  for (let t = 0; t < n; t += 3) {
    const i0 = idx.getX(t), i2 = idx.getX(t + 2);
    // a kit quad pushes (i, i+1, i+2) then (i, i+2, i+3); a lone tri is (i, i+1, i+2) with u=v=0.5 everywhere
    const isTri = face.getX(i0) === 0.5 && face.getY(i0) === 0.5 && face.getZ(i0) === 1;
    const second = i2 === i0 + 3;
    // first tri (a,b,c): the diagonal is c–a, opposite b → component 1; second tri (a,c,d): diagonal a–c, opposite
    // d → component 2; a lone tri has no ruled borders at all
    const mask = isTri ? [1e3, 1e3, 1e3] : second ? [0, 0, 1e3] : [0, 1e3, 0];
    for (let k = 0; k < 3; k++) {
      const o = (t + k) * 3;
      bary[o] = (k === 0 ? 1 : 0) + (mask[0] ?? 0);
      bary[o + 1] = (k === 1 ? 1 : 0) + (mask[1] ?? 0);
      bary[o + 2] = (k === 2 ? 1 : 0) + (mask[2] ?? 0);
    }
  }
  g.setAttribute('aBary', new Float32BufferAttribute(bary, 3));
  return g;
}
