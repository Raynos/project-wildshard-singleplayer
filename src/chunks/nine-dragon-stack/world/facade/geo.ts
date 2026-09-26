// Copied from the facade lab (src/dev/nd-lab/facade/geo.ts, round-7-lab-facade) into the clean room.
// The facade kit's geometry builder. Every face is a quad that knows where it sits on itself in metres (aFace = u, v,
// w, h) and which way its u runs (aTan), so the Jiehua program rules its edges at a constant pixel width with fwidth —
// and keeps doing so when an instance is scaled non-uniformly (the vertex shader rescales aFace by the instance's
// stretch along aTan and along normal × aTan). One layout for merged and instanced geometry alike.
import { BufferGeometry, Color, Float32BufferAttribute, type Matrix4, Matrix3, Uint32BufferAttribute, Vector3 } from 'three';

/** pattern kinds the material draws (aPat.x) */
export const K = {
  plain: 0, wall: 1, tiles: 2, bars: 3, cloth: 4, leaf: 5, ac: 6, slats: 7, pipe: 8, sign: 9, panel: 10, painted: 11,
} as const;

/** edge mask bits: which borders of a face get a ruled ink line */
export const E = { u0: 1, u1: 2, v0: 4, v1: 8, all: 15, rims: 12, sides: 3, none: 0 } as const;

export interface Look {
  /** the flat wash (sRGB hex) */
  wash: number;
  kind?: number;
  /** pattern parameters (metres): bars → bar pitch / rail pitch, wall → floor height / seam pitch, cloth → stripe */
  p1?: number;
  p2?: number;
  emit?: number;
  /** ruled line weight: 1 = the world ruling, 1.8 = a ledge you could stand on, 0 = none */
  line?: number;
  edges?: number;
  /** the wash at the face's top edge (a graded ink wash: baked AO under a balcony, a neon spill) */
  washTop?: number;
}

export const X = new Vector3(1, 0, 0);
export const Y = new Vector3(0, 1, 0);
export const Z = new Vector3(0, 0, 1);

const tc = new Color();
const vn = new Vector3(), vt = new Vector3(), vs = new Vector3();

export class Builder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private face: number[] = [];
  private tan: number[] = [];
  private pat: number[] = [];
  private misc: number[] = [];
  private idx: number[] = [];
  private n = 0;

  get vertexCount(): number { return this.n; }
  get triangleCount(): number { return this.idx.length / 3; }

  private vert(p: Vector3, nrm: Vector3, tan: Vector3, u: number, v: number, w: number, h: number, look: Look, edges: number, top = false): void {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(nrm.x, nrm.y, nrm.z);
    tc.setHex(top && look.washTop !== undefined ? look.washTop : look.wash);
    this.col.push(tc.r, tc.g, tc.b);
    this.face.push(u, v, w, h);
    this.tan.push(tan.x, tan.y, tan.z);
    this.pat.push(look.kind ?? K.plain, look.p1 ?? 0, look.p2 ?? 0, look.edges ?? edges);
    this.misc.push(look.emit ?? 0, look.line ?? 1);
    this.n++;
  }

  /** a quad from four corners: a=(0,0) b=(w,0) c=(w,h) d=(0,h); normal = (b-a) × (d-a) */
  quad4(a: Vector3, b: Vector3, c: Vector3, d: Vector3, w: number, h: number, look: Look, edges: number = E.all): void {
    vt.subVectors(b, a);
    vn.crossVectors(vt, vs.subVectors(d, a));
    if (vn.lengthSq() < 1e-12) vn.crossVectors(vt, vs.subVectors(c, a));
    vn.normalize();
    if (vt.lengthSq() < 1e-12) vt.subVectors(c, d);
    vt.normalize();
    const i = this.n;
    this.vert(a, vn, vt, 0, 0, w, h, look, edges);
    this.vert(b, vn, vt, w, 0, w, h, look, edges);
    this.vert(c, vn, vt, w, h, w, h, look, edges, true);
    this.vert(d, vn, vt, 0, h, w, h, look, edges, true);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** a rectangle from a corner and two unit directions (normal = u × v) */
  quad(p0: Vector3, u: Vector3, v: Vector3, w: number, h: number, look: Look, edges: number = E.all): void {
    const b = p0.clone().addScaledVector(u, w);
    const c = b.clone().addScaledVector(v, h);
    const d = p0.clone().addScaledVector(v, h);
    this.quad4(p0.clone(), b, c, d, w, h, look, edges);
  }

  /** a triangle with no ruled edges of its own (caps, gables) */
  tri(a: Vector3, b: Vector3, c: Vector3, look: Look): void {
    vt.subVectors(b, a);
    vn.crossVectors(vt, vs.subVectors(c, a)).normalize();
    vt.normalize();
    const i = this.n;
    this.vert(a, vn, vt, 0.5, 0.5, 1, 1, look, E.none);
    this.vert(b, vn, vt, 0.5, 0.5, 1, 1, look, E.none);
    this.vert(c, vn, vt, 0.5, 0.5, 1, 1, look, E.none);
    this.idx.push(i, i + 1, i + 2);
  }

  /**
   * A box from its centre and three orthonormal axes. `sides` masks the side faces (1 +x, 2 -x, 4 +z, 8 -z);
   * `top` / `bottom` override (or with null drop) the caps.
   */
  boxAxes(c: Vector3, ax: Vector3, ay: Vector3, az: Vector3, hx: number, hy: number, hz: number, look: Look,
    opt: { top?: Look | null; bottom?: Look | null; sides?: number } = {}): void {
    const sides = opt.sides ?? 15;
    const at = (sx: number, sy: number, sz: number): Vector3 => c.clone().addScaledVector(ax, sx * hx).addScaledVector(ay, sy * hy).addScaledVector(az, sz * hz);
    const nax = ax.clone().negate(), naz = az.clone().negate();
    if ((sides & 4) !== 0) this.quad(at(-1, -1, 1), ax, ay, 2 * hx, 2 * hy, look);
    if ((sides & 8) !== 0) this.quad(at(1, -1, -1), nax, ay, 2 * hx, 2 * hy, look);
    if ((sides & 1) !== 0) this.quad(at(1, -1, 1), naz, ay, 2 * hz, 2 * hy, look);
    if ((sides & 2) !== 0) this.quad(at(-1, -1, -1), az, ay, 2 * hz, 2 * hy, look);
    const top = opt.top === undefined ? look : opt.top;
    const bottom = opt.bottom === undefined ? look : opt.bottom;
    if (top !== null) this.quad(at(-1, 1, 1), ax, naz, 2 * hx, 2 * hz, top);
    if (bottom !== null) this.quad(at(-1, -1, -1), ax, az, 2 * hx, 2 * hz, bottom);
  }

  /** an axis-aligned box from its bottom-centre (x, y, z) and size */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, look: Look,
    opt: { top?: Look | null; bottom?: Look | null; sides?: number } = {}): void {
    this.boxAxes(new Vector3(x, y + sy / 2, z), X, Y, Z, sx / 2, sy / 2, sz / 2, look, opt);
  }

  /** a thin box between two points (rails, poles, brackets, cables): w × h cross-section, ruled along its length */
  beam(a: Vector3, b: Vector3, w: number, h: number, look: Look, up: Vector3 = Y): void {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const side = new Vector3().crossVectors(dir, up);
    if (side.lengthSq() < 1e-6) side.crossVectors(dir, X);
    side.normalize();
    const nup = new Vector3().crossVectors(side, dir).normalize();
    const c = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    this.boxAxes(c, side, dir, nup, w / 2, len / 2, h / 2, look);
  }

  /**
   * A flat bar (railing / grille bar, real geometry, 4 tris): a strip `w` wide from a to b, facing ±`n` — two
   * back-to-back quads so it reads from inside a balcony too. Its long edges are ruled, so it draws as an ink bar.
   */
  flatBar(a: Vector3, b: Vector3, w: number, n: Vector3, look: Look): void {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const side = new Vector3().crossVectors(dir, n).normalize();
    const p0 = a.clone().addScaledVector(side, -w / 2);
    this.quad(p0, side, dir, w, len, look, E.sides);
    this.quad(p0.clone().addScaledVector(side, w), side.clone().negate(), dir, w, len, look, E.sides);
  }

  /** a tapered vertical cylinder; sides ruled only at the rims (a jiehua pipe has no facet lines) */
  cyl(x: number, y: number, z: number, r0: number, r1: number, h: number, segs: number, look: Look,
    opt: { caps?: boolean; edges?: number } = {}): void {
    const lk: Look = { ...look, edges: opt.edges ?? look.edges ?? E.rims };
    const slant = Math.hypot(h, r0 - r1);
    for (let i = 0; i < segs; i++) {
      const t0 = (Math.PI * 2 * i) / segs, t1 = (Math.PI * 2 * (i + 1)) / segs;
      const pa = new Vector3(x + r0 * Math.cos(t1), y, z + r0 * Math.sin(t1));
      const pb = new Vector3(x + r0 * Math.cos(t0), y, z + r0 * Math.sin(t0));
      const pc = new Vector3(x + r1 * Math.cos(t0), y + h, z + r1 * Math.sin(t0));
      const pd = new Vector3(x + r1 * Math.cos(t1), y + h, z + r1 * Math.sin(t1));
      this.quad4(pa, pb, pc, pd, Math.max(pa.distanceTo(pb), 1e-3), slant, lk);
      // smooth normals so the two-band light draws a round body, not facets
      const base = this.nor.length - 12;
      const nrm = (t: number): [number, number, number] => [Math.cos(t), (r0 - r1) / Math.max(h, 1e-3), Math.sin(t)];
      [nrm(t1), nrm(t0), nrm(t0), nrm(t1)].forEach((v, j) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        this.nor[base + j * 3] = v[0] / l; this.nor[base + j * 3 + 1] = v[1] / l; this.nor[base + j * 3 + 2] = v[2] / l;
      });
    }
    if (opt.caps !== false) {
      const top = new Vector3(x, y + h, z), bot = new Vector3(x, y, z);
      for (let i = 0; i < segs; i++) {
        const t0 = (Math.PI * 2 * i) / segs, t1 = (Math.PI * 2 * (i + 1)) / segs;
        if (r1 > 1e-4) this.tri(top, new Vector3(x + r1 * Math.cos(t1), y + h, z + r1 * Math.sin(t1)), new Vector3(x + r1 * Math.cos(t0), y + h, z + r1 * Math.sin(t0)), look);
        if (r0 > 1e-4) this.tri(bot, new Vector3(x + r0 * Math.cos(t0), y, z + r0 * Math.sin(t0)), new Vector3(x + r0 * Math.cos(t1), y, z + r0 * Math.sin(t1)), look);
      }
    }
  }

  /** append a triangle soup (e.g. an icosahedron), transformed, with no ruled edges of its own */
  blob(positions: ArrayLike<number>, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, look: Look): void {
    const at = (k: number): Vector3 => new Vector3(cx + (positions[k * 3] ?? 0) * sx, cy + (positions[k * 3 + 1] ?? 0) * sy, cz + (positions[k * 3 + 2] ?? 0) * sz);
    const count = positions.length / 3;
    for (let k = 0; k + 2 < count; k += 3) this.tri(at(k), at(k + 1), at(k + 2), look);
  }

  /** append another builder's geometry through a matrix (bakes an instance into a merged batch; aFace keeps metres) */
  append(o: Builder, m: Matrix4, tint: Color | null = null): void {
    const nm = new Matrix3().getNormalMatrix(m);
    const m3 = new Matrix3().setFromMatrix4(m);
    const p = new Vector3(), q = new Vector3(), t = new Vector3(), vd = new Vector3(), tw = new Vector3();
    const base = this.n;
    for (let i = 0; i < o.n; i++) {
      p.fromArray(o.pos, i * 3).applyMatrix4(m);
      q.fromArray(o.nor, i * 3);
      t.fromArray(o.tan, i * 3);
      vd.crossVectors(q, t);
      tw.copy(t).applyMatrix3(m3);
      const su = tw.length();
      tw.divideScalar(Math.max(su, 1e-6));
      const sv = vd.applyMatrix3(m3).length();
      q.applyMatrix3(nm).normalize();
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(q.x, q.y, q.z);
      const r = o.col[i * 3] ?? 0, g = o.col[i * 3 + 1] ?? 0, b = o.col[i * 3 + 2] ?? 0;
      if (tint === null) this.col.push(r, g, b); else this.col.push(r * tint.r, g * tint.g, b * tint.b);
      this.face.push((o.face[i * 4] ?? 0) * su, (o.face[i * 4 + 1] ?? 0) * sv, (o.face[i * 4 + 2] ?? 0) * su, (o.face[i * 4 + 3] ?? 0) * sv);
      this.tan.push(tw.x, tw.y, tw.z);
      for (let k = 0; k < 4; k++) this.pat.push(o.pat[i * 4 + k] ?? 0);
      this.misc.push(o.misc[i * 2] ?? 0, o.misc[i * 2 + 1] ?? 0);
      this.n++;
    }
    for (const ix of o.idx) this.idx.push(ix + base);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aFace', new Float32BufferAttribute(this.face, 4));
    g.setAttribute('aTan', new Float32BufferAttribute(this.tan, 3));
    g.setAttribute('aPat', new Float32BufferAttribute(this.pat, 4));
    g.setAttribute('aMisc', new Float32BufferAttribute(this.misc, 2));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

