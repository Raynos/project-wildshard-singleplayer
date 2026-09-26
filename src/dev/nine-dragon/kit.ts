// The modular kit: every built surface is a quad that knows where it sits on its face, in metres (aFace = u, v, w, h),
// so the Jiehua material can rule its edges and its window / tile / flagstone rows analytically (antialiased with
// fwidth, never a texture). Geometry is merged per region into one BufferGeometry: one program, few draw calls.
import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';

/** pattern kinds the material draws (vPat.x) */
export const K = { plain: 0, facade: 1, tiles: 2, flag: 3, bars: 4, panel: 5, net: 6, leaf: 7, cloth: 8, stone: 9 } as const;

/** edge mask bits: which face borders get a ruled ink line */
export const E = { u0: 1, u1: 2, v0: 4, v1: 8, all: 15, rims: 12, sides: 3, none: 0 } as const;

export interface Look {
  wash: number;
  kind?: number;
  row?: number;
  col?: number;
  seed?: number;
  emit?: number;
  /** edge line weight (1 = the world ruling, 2 = a ground line, 0 = none) */
  line?: number;
  wet?: number;
  edges?: number;
  /** keeps its hue in the sutra look (mineral accents) */
  accent?: boolean;
  gloss?: boolean;
  /** gold ruled line: reserved for the grapple's dragon hooks */
  gold?: boolean;
}

const tc = new Color();
const va = new Vector3(), vb = new Vector3(), vc = new Vector3(), vd = new Vector3(), vn = new Vector3(), vt = new Vector3();

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

  private static flags(look: Look, edgesDefault: number): number {
    const edges = look.edges ?? edgesDefault;
    // a weight ≥ 1.8 marks a walkable lip: its borders are drawn as the heavier ground line (bits 256…2048)
    const ground = (look.line ?? 1) >= 1.8 ? edges * 256 : 0;
    return edges + (look.accent === true ? 16 : 0) + (look.gloss === true ? 32 : 0) + (look.gold === true ? 64 : 0) + ground;
  }

  /** a quad from four corners: a=(0,0) b=(w,0) c=(w,h) d=(0,h); the normal is (b-a)×(d-a) */
  quad4(a: Vector3, b: Vector3, c: Vector3, d: Vector3, w: number, h: number, look: Look, uo = 0, vo = 0, edgesDefault: number = E.all): void {
    vt.subVectors(b, a);
    vn.subVectors(d, a).cross(vt).negate();
    if (vn.lengthSq() < 1e-12) vn.subVectors(c, a).cross(vt).negate();
    vn.normalize();
    const f = Kit.flags(look, edgesDefault);
    const i = this.n;
    this.vert(a, vn, 0, 0, w, h, look, uo, vo, f);
    this.vert(b, vn, w, 0, w, h, look, uo, vo, f);
    this.vert(c, vn, w, h, w, h, look, uo, vo, f);
    this.vert(d, vn, 0, h, w, h, look, uo, vo, f);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** a rectangle from a corner and two unit directions; the pattern offset is world-aligned (dot(p, u), dot(p, v)) */
  quad(p0: Vector3, u: Vector3, v: Vector3, w: number, h: number, look: Look, edgesDefault: number = E.all): void {
    va.copy(p0);
    vb.copy(p0).addScaledVector(u, w);
    vc.copy(vb).addScaledVector(v, h);
    vd.copy(p0).addScaledVector(v, h);
    const a = va.clone(), b = vb.clone(), c = vc.clone(), d = vd.clone();
    this.quad4(a, b, c, d, w, h, look, p0.dot(u), p0.dot(v), edgesDefault);
  }

  /** a triangle with no ruled edges of its own (caps, roof gables) */
  tri(a: Vector3, b: Vector3, c: Vector3, look: Look): void {
    vt.subVectors(b, a);
    vn.subVectors(c, a).cross(vt).negate().normalize();
    const f = Kit.flags(look, E.none);
    const i = this.n;
    this.vert(a, vn, 0.5, 0.5, 1, 1, look, a.x, a.y, f);
    this.vert(b, vn, 0.5, 0.5, 1, 1, look, a.x, a.y, f);
    this.vert(c, vn, 0.5, 0.5, 1, 1, look, a.x, a.y, f);
    this.idx.push(i, i + 1, i + 2);
  }

  /**
   * A box from its centre and three orthonormal axes. `sides` masks the side faces (1 +x, 2 -x, 4 +z, 8 -z),
   * `top` / `bottom` override (or with null drop) the caps.
   */
  boxAxes(c: Vector3, ax: Vector3, ay: Vector3, az: Vector3, hx: number, hy: number, hz: number, look: Look,
    opt: { top?: Look | null; bottom?: Look | null; sides?: number } = {}): void {
    const sides = opt.sides ?? 15;
    const p = new Vector3();
    const corner = (sx: number, sy: number, sz: number): Vector3 => p.copy(c).addScaledVector(ax, sx * hx).addScaledVector(ay, sy * hy).addScaledVector(az, sz * hz);
    const nax = ax.clone().negate(), naz = az.clone().negate();
    if ((sides & 4) !== 0) this.quad(corner(-1, -1, 1).clone(), ax, ay, 2 * hx, 2 * hy, look);
    if ((sides & 8) !== 0) this.quad(corner(1, -1, -1).clone(), nax, ay, 2 * hx, 2 * hy, look);
    if ((sides & 1) !== 0) this.quad(corner(1, -1, 1).clone(), naz, ay, 2 * hz, 2 * hy, look);
    if ((sides & 2) !== 0) this.quad(corner(-1, -1, -1).clone(), az, ay, 2 * hz, 2 * hy, look);
    const top = opt.top === undefined ? look : opt.top;
    const bottom = opt.bottom === undefined ? look : opt.bottom;
    if (top !== null) this.quad(corner(-1, 1, 1).clone(), ax, naz, 2 * hx, 2 * hz, top);
    if (bottom !== null) this.quad(corner(-1, -1, -1).clone(), ax, az, 2 * hx, 2 * hz, bottom);
  }

  /** an axis-aligned (optionally Y-rotated) box from its bottom-centre */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, look: Look,
    opt: { rotY?: number; top?: Look | null; bottom?: Look | null; sides?: number } = {}): void {
    const r = opt.rotY ?? 0;
    const ax = new Vector3(Math.cos(r), 0, -Math.sin(r));
    const az = new Vector3(Math.sin(r), 0, Math.cos(r));
    this.boxAxes(new Vector3(x, y + sy / 2, z), ax, new Vector3(0, 1, 0), az, sx / 2, sy / 2, sz / 2, look, opt);
  }

  /** a thin box between two points (beams, poles, pipes, cables): `w` × `h` cross-section */
  beam(a: Vector3, b: Vector3, w: number, h: number, look: Look, up: Vector3 = new Vector3(0, 1, 0)): void {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const side = new Vector3().crossVectors(dir, up);
    if (side.lengthSq() < 1e-6) side.crossVectors(dir, new Vector3(1, 0, 0));
    side.normalize();
    const nup = new Vector3().crossVectors(side, dir).normalize();
    const c = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    // the long axis is local y so the ruling runs along it
    this.boxAxes(c, side, dir, nup, w / 2, len / 2, h / 2, look);
  }

  /** a tapered cylinder / cone; sides are ruled only at the rims (a jiehua column has no facet lines) */
  cyl(x: number, y: number, z: number, r0: number, r1: number, h: number, segs: number, look: Look,
    opt: { caps?: boolean; edges?: number; a0?: number; a1?: number } = {}): void {
    const a0 = opt.a0 ?? 0, a1 = opt.a1 ?? Math.PI * 2;
    const lk: Look = { ...look, edges: opt.edges ?? look.edges ?? E.rims };
    const slant = Math.hypot(h, r0 - r1);
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segs, t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const pa = new Vector3(x + r0 * c1, y, z + r0 * s1);
      const pb = new Vector3(x + r0 * c0, y, z + r0 * s0);
      const pc = new Vector3(x + r1 * c0, y + h, z + r1 * s0);
      const pd = new Vector3(x + r1 * c1, y + h, z + r1 * s1);
      const w = Math.hypot(pa.x - pb.x, pa.z - pb.z);
      this.quad4(pa, pb, pc, pd, Math.max(w, 1e-3), slant, lk, (i * w), y);
    }
    if (opt.caps !== false) {
      const top = new Vector3(x, y + h, z), bot = new Vector3(x, y, z);
      for (let i = 0; i < segs; i++) {
        const t0 = a0 + ((a1 - a0) * i) / segs, t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
        if (r1 > 1e-4) this.tri(top, new Vector3(x + r1 * Math.cos(t1), y + h, z + r1 * Math.sin(t1)), new Vector3(x + r1 * Math.cos(t0), y + h, z + r1 * Math.sin(t0)), look);
        if (r0 > 1e-4) this.tri(bot, new Vector3(x + r0 * Math.cos(t0), y, z + r0 * Math.sin(t0)), new Vector3(x + r0 * Math.cos(t1), y, z + r0 * Math.sin(t1)), look);
      }
    }
  }

  /** a tapered round limb between two points (tree trunks, roots, branches, horns) */
  limb(a: Vector3, b: Vector3, r0: number, r1: number, segs: number, look: Look, edges: number = E.none, smoothN = false): void {
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const s = new Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).normalize();
    const t = new Vector3().crossVectors(s, dir).normalize();
    const ring = (p: Vector3, r: number, ang: number): Vector3 => p.clone().addScaledVector(s, Math.cos(ang) * r).addScaledVector(t, Math.sin(ang) * r);
    const lk: Look = { ...look, edges };
    for (let i = 0; i < segs; i++) {
      const t0 = (i / segs) * Math.PI * 2, t1 = ((i + 1) / segs) * Math.PI * 2;
      const pa = ring(a, r0, t1), pb = ring(a, r0, t0), pc = ring(b, r1, t0), pd = ring(b, r1, t1);
      this.quad4(pa, pb, pc, pd, Math.max(pa.distanceTo(pb), 1e-3), len, lk, 0, 0);
      if (smoothN) {
        const nrm = (ang: number): Vector3 => new Vector3().addScaledVector(s, Math.cos(ang)).addScaledVector(t, Math.sin(ang)).addScaledVector(dir, (r0 - r1) / len).normalize();
        const base = this.nor.length - 12;
        [nrm(t1), nrm(t0), nrm(t0), nrm(t1)].forEach((nv, j) => { this.nor[base + j * 3] = nv.x; this.nor[base + j * 3 + 1] = nv.y; this.nor[base + j * 3 + 2] = nv.z; });
      }
    }
  }

  /** a lathe from a profile of (radius, y) pairs; ribs (u edges) are ruled when `ribs` */
  lathe(x: number, y: number, z: number, profile: readonly (readonly [number, number])[], segs: number, look: Look, ribs = true, rimEvery = 0): void {
    for (let j = 0; j + 1 < profile.length; j++) {
      const pr0 = profile[j], pr1 = profile[j + 1];
      if (pr0 === undefined || pr1 === undefined) continue;
      const [r0, y0] = pr0, [r1, y1] = pr1;
      const slant = Math.hypot(y1 - y0, r1 - r0);
      const rim = rimEvery > 0 && (j % rimEvery === 0 || j === profile.length - 2);
      const edges = (ribs ? E.sides : 0) | (rim ? E.v0 : 0) | (j === profile.length - 2 ? E.v1 : 0);
      for (let i = 0; i < segs; i++) {
        const t0 = (Math.PI * 2 * i) / segs, t1 = (Math.PI * 2 * (i + 1)) / segs;
        const pa = new Vector3(x + r0 * Math.cos(t1), y + y0, z + r0 * Math.sin(t1));
        const pb = new Vector3(x + r0 * Math.cos(t0), y + y0, z + r0 * Math.sin(t0));
        const pc = new Vector3(x + r1 * Math.cos(t0), y + y1, z + r1 * Math.sin(t0));
        const pd = new Vector3(x + r1 * Math.cos(t1), y + y1, z + r1 * Math.sin(t1));
        const w = Math.max(Math.hypot(pa.x - pb.x, pa.z - pb.z), Math.hypot(pc.x - pd.x, pc.z - pd.z), 1e-3);
        this.quad4(pa, pb, pc, pd, w, Math.max(slant, 1e-3), { ...look, edges }, 0, y0);
      }
    }
  }

  /** append a three.js geometry (e.g. an icosahedron blob), transformed, with no ruled edges */
  blob(positions: ArrayLike<number>, index: ArrayLike<number> | null, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, look: Look, smoothN = false): void {
    const count = index === null ? positions.length / 3 : index.length;
    const at = (k: number): Vector3 => {
      const i = index === null ? k : (index[k] ?? 0);
      return new Vector3(cx + (positions[i * 3] ?? 0) * sx, cy + (positions[i * 3 + 1] ?? 0) * sy, cz + (positions[i * 3 + 2] ?? 0) * sz);
    };
    const nAt = (k: number): Vector3 => {
      const i = index === null ? k : (index[k] ?? 0);
      return new Vector3((positions[i * 3] ?? 0) / sx, (positions[i * 3 + 1] ?? 0) / sy, (positions[i * 3 + 2] ?? 0) / sz).normalize();
    };
    for (let k = 0; k + 2 < count; k += 3) {
      this.tri(at(k), at(k + 1), at(k + 2), look);
      if (smoothN) {
        const base = this.nor.length - 9;
        [nAt(k), nAt(k + 1), nAt(k + 2)].forEach((nv, j) => { this.nor[base + j * 3] = nv.x; this.nor[base + j * 3 + 1] = nv.y; this.nor[base + j * 3 + 2] = nv.z; });
      }
    }
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
    // baked neon spill (emitters.ts bakeSpill overwrites it for the static kits)
    g.setAttribute('aSpill', new Float32BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
