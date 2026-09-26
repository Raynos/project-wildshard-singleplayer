// Copied from the viewmodel lab (src/dev/nd-lab/viewmodel/geo.ts, round-9-lab-viewmodel) into the clean room.
// A small geometry builder for the viewmodel (lab P8 "viewmodel", E169). Every piece writes the same attribute set, so
// procedural parts and the Blender / TRELLIS GLBs (assets.ts) share one program (materials.ts) and merge per rigid group:
//   position, normal
//   uv      texture / decal coordinates (the blade etch, the talisman; a GLB's atlas)
//   color   the maps as DATA: r = ambient occlusion (1 open), g = curvature (0.5 flat, 1 convex, 0 concave crease),
//           b = albedo detail (0.5 neutral) — a procedural piece writes (1, 0.5, 0.5) unless it paints its own
//   aMat    x = material class (CLS), y = emission, z = ruled-line weight (0 = none), w = edge bits of the face rule
//           (1 u=0, 2 u=W, 4 v=0, 8 v=H)
//   aFace   (u, v, W, H) in metres across a face, for the ruled lines (the Kit's idea)
//   aNs     the MACRO normal: the program lights the big value shapes from it (a painter's light and shadow) and keeps
//           `normal` (or a normal map) for glints, rims and ink. A sculpt brings a smoothed one (the guard's COLOR_1);
//           everything else repeats its normal
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** the material classes (aMat.x); materials.ts paints by class, a GLB names them by its material names */
export const CLS = {
  brass: 1, brassDark: 2, steel: 3, lacquer: 4, leather: 5, glove: 6, cloth: 7, sleeve: 8, trim: 9, silk: 10, carbon: 11,
  glow: 12, gold: 13, paper: 14, bevel: 15, skin: 16,
} as const;
export type Cls = (typeof CLS)[keyof typeof CLS];

/** a GLB material name (SPEC.md) → class */
export const CLS_BY_NAME: Readonly<Record<string, Cls>> = {
  brass: CLS.brass, brass_dark: CLS.brassDark, steel: CLS.steel, lacquer: CLS.lacquer, leather: CLS.leather, glove: CLS.glove,
  cloth_cream: CLS.cloth, sleeve: CLS.sleeve, trim_red: CLS.trim, silk_red: CLS.silk, carbon: CLS.carbon, glow: CLS.glow,
  gold_thread: CLS.gold, paper: CLS.paper, skin: CLS.skin,
};

/** the built classes (ruled ink, steady hull); the rest are living (brushed hull) */
export const BUILT: ReadonlySet<number> = new Set([CLS.brass, CLS.brassDark, CLS.steel, CLS.lacquer, CLS.bevel, CLS.gold, CLS.carbon]);

export interface Look {
  cls: Cls;
  emit?: number;
  /** ruled-line weight (× the program's line px); 0 = none */
  line?: number;
  edges?: number;
  /** maps painted per vertex: (t along, a around) → [ao, curvature, detail] */
  maps?: (t: number, a: number) => readonly [number, number, number];
}

export const E = { none: 0, u0: 1, u1: 2, v0: 4, v1: 8, all: 15 } as const;

const v3 = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** Catmull-Rom through the points, `per` samples per span */
export function curve(pts: readonly Vector3[], per: number): Vector3[] {
  const out: Vector3[] = [];
  const n = pts.length;
  const at = (i: number): Vector3 => pts[Math.max(0, Math.min(n - 1, i))] ?? v3(0, 0, 0);
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const u = s / per, u2 = u * u, u3 = u2 * u;
      const b0 = -0.5 * u3 + u2 - 0.5 * u, b1 = 1.5 * u3 - 2.5 * u2 + 1, b2 = -1.5 * u3 + 2 * u2 + 0.5 * u, b3 = 0.5 * u3 - 0.5 * u2;
      out.push(v3(
        p0.x * b0 + p1.x * b1 + p2.x * b2 + p3.x * b3,
        p0.y * b0 + p1.y * b1 + p2.y * b2 + p3.y * b3,
        p0.z * b0 + p1.z * b1 + p2.z * b2 + p3.z * b3,
      ));
    }
  }
  out.push(at(n - 1).clone());
  return out;
}

export interface SweepOpt {
  /** squash of the section along the frame's second axis (1 round, 0.3 a blade) */
  flat?: number;
  /** seeds the frame: the squash axis starts perpendicular to the path and `up` */
  up?: Vector3;
  /** turns the section (radians at t = 1) */
  twist?: number;
  capStart?: boolean;
  capEnd?: boolean;
  /** section offset: (t, angle) → extra radius (m), for ridges, braids, folds */
  bump?: (t: number, a: number) => number;
  /** per-row frame: the squash axis becomes perpendicular to the path and this vector at row i (a flat cord on a
   *  helix: pass the radial direction, and the cord lies flat on the surface; parallel transport would twist it) */
  upAt?: (i: number) => Vector3;
}

export class Geo {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly col: number[] = [];
  private readonly mat: number[] = [];
  private readonly face: number[] = [];
  private readonly ns: number[] = [];
  private readonly idx: number[] = [];
  private n = 0;

  get vertexCount(): number { return this.n; }

  vert(p: Vector3, nrm: Vector3, u: number, v: number, look: Look, face: readonly [number, number, number, number] = [0, 0, 0, 0], maps: readonly [number, number, number] = [1, 0.5, 0.5]): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(nrm.x, nrm.y, nrm.z);
    this.ns.push(nrm.x, nrm.y, nrm.z);
    this.uv.push(u, v);
    this.col.push(maps[0], maps[1], maps[2]);
    this.mat.push(look.cls, look.emit ?? 0, look.line ?? 0, look.edges ?? 0);
    this.face.push(face[0], face[1], face[2], face[3]);
    return this.n++;
  }

  tri(a: number, b: number, c: number): void { this.idx.push(a, b, c); }

  /** a flat quad p0 p1 p2 p3 (counter-clockwise seen from the front), ruled by `look.edges` */
  quad(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, look: Look, uvs: readonly [number, number, number, number] = [0, 0, 1, 1]): void {
    const nrm = new Vector3().subVectors(p1, p0).cross(new Vector3().subVectors(p3, p0)).normalize();
    const W = p0.distanceTo(p1), H = p0.distanceTo(p3);
    const [u0, v0, u1, v1] = uvs;
    const a = this.vert(p0, nrm, u0, v0, look, [0, 0, W, H]);
    const b = this.vert(p1, nrm, u1, v0, look, [W, 0, W, H]);
    const c = this.vert(p2, nrm, u1, v1, look, [W, H, W, H]);
    const d = this.vert(p3, nrm, u0, v1, look, [0, H, W, H]);
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  /**
   * A tube swept along `path`, radius r(t, a) (t 0..1 along, a 0..1 around), `segs` sides, smooth normals from the
   * section (a bump changes the radius; its normals come from finite differences). uv = (a, arc length); aFace =
   * (a·circumference, arc length, circumference, total length).
   */
  sweep(path: readonly Vector3[], r: (t: number, a: number) => number, segs: number, look: Look, opt: SweepOpt = {}): void {
    const m = path.length;
    if (m < 2) return;
    const flat = opt.flat ?? 1;
    const lens: number[] = [0];
    for (let i = 1; i < m; i++) lens.push((lens[i - 1] ?? 0) + (path[i - 1] ?? v3(0, 0, 0)).distanceTo(path[i] ?? v3(0, 0, 0)));
    const total = Math.max(lens[m - 1] ?? 0, 1e-6);
    const tang: Vector3[] = [];
    for (let i = 0; i < m; i++) {
      const a = path[Math.max(0, i - 1)] ?? v3(0, 0, 0), b = path[Math.min(m - 1, i + 1)] ?? v3(0, 0, 0);
      tang.push(new Vector3().subVectors(b, a).normalize());
    }
    const t0 = tang[0] ?? v3(0, 1, 0);
    const up0 = opt.up ?? (Math.abs(t0.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0));
    let s = new Vector3().crossVectors(t0, up0).normalize();
    let b = new Vector3().crossVectors(s, t0).normalize();
    const rows: { c: Vector3; s: Vector3; b: Vector3; t: Vector3 }[] = [];
    for (let i = 0; i < m; i++) {
      const t = tang[i] ?? t0;
      if (opt.upAt !== undefined) {
        s = new Vector3().crossVectors(t, opt.upAt(i)).normalize();
        b = new Vector3().crossVectors(s, t).normalize();
      } else if (i > 0) {
        // parallel transport: remove the component along the new tangent
        s = s.clone().addScaledVector(t, -s.dot(t)).normalize();
        b = new Vector3().crossVectors(s, t).normalize();
      }
      const tw = (opt.twist ?? 0) * ((lens[i] ?? 0) / total);
      const cs = Math.cos(tw), sn = Math.sin(tw);
      rows.push({ c: path[i] ?? v3(0, 0, 0), s: s.clone().multiplyScalar(cs).addScaledVector(b, sn), b: b.clone().multiplyScalar(cs).addScaledVector(s, -sn), t });
    }
    const base = this.n;
    const circ = 2 * Math.PI * r(0.5, 0);
    const point = (i: number, k: number, out: Vector3): Vector3 => {
      const row = rows[i] ?? rows[0];
      if (row === undefined) return out.set(0, 0, 0);
      const tt = (lens[i] ?? 0) / total, a = k / segs, th = a * Math.PI * 2;
      const rr = r(tt, a) + (opt.bump === undefined ? 0 : opt.bump(tt, a));
      return out.copy(row.c).addScaledVector(row.s, Math.cos(th) * rr).addScaledVector(row.b, Math.sin(th) * rr * flat);
    };
    const pA = new Vector3(), pB = new Vector3(), pC = new Vector3(), pD = new Vector3(), pE = new Vector3();
    for (let i = 0; i < m; i++) {
      const tt = (lens[i] ?? 0) / total;
      for (let k = 0; k <= segs; k++) {
        const a = k / segs;
        point(i, k, pA);
        // normal from finite differences around and along (handles flat sections and bumps)
        point(i, (k + 1) % (segs + 1) === 0 ? 1 : k + 1, pB);
        point(i, k === 0 ? segs - 1 : k - 1, pC);
        point(Math.min(m - 1, i + 1), k, pD);
        point(Math.max(0, i - 1), k, pE);
        const around = new Vector3().subVectors(pB, pC);
        const along = new Vector3().subVectors(pD, pE);
        if (along.lengthSq() < 1e-14) along.copy(rows[i]?.t ?? t0);
        const nrm = new Vector3().crossVectors(around, along).normalize();
        const rowC = rows[i]?.c ?? v3(0, 0, 0);
        if (nrm.dot(new Vector3().subVectors(pA, rowC)) < 0) nrm.negate();
        const maps = look.maps === undefined ? undefined : look.maps(tt, a);
        this.vert(pA.clone(), nrm, a, lens[i] ?? 0, look, [a * circ, lens[i] ?? 0, circ, total], maps);
      }
    }
    const row = segs + 1;
    for (let i = 0; i < m - 1; i++) {
      for (let k = 0; k < segs; k++) {
        const a = base + i * row + k, bb = a + 1, c = a + row, d = c + 1;
        this.tri(a, c, bb);
        this.tri(bb, c, d);
      }
    }
    const cap = (i: number, flip: boolean): void => {
      const rw = rows[i];
      if (rw === undefined) return;
      const nrm = rw.t.clone().multiplyScalar(flip ? 1 : -1);
      const ci = this.vert(rw.c, nrm, 0.5, 0.5, look);
      const ring: number[] = [];
      for (let k = 0; k <= segs; k++) ring.push(this.vert(point(i, k, pA).clone(), nrm, 0.5, 0.5, look));
      for (let k = 0; k < segs; k++) {
        const r0 = ring[k] ?? ci, r1 = ring[k + 1] ?? ci;
        if (flip) this.tri(ci, r0, r1);
        else this.tri(ci, r1, r0);
      }
    };
    if (opt.capStart === true) cap(0, false);
    if (opt.capEnd === true) cap(m - 1, true);
  }

  /** a lathe about the local +y axis at (x, y, z): profile [radius, height][], `segs` around */
  lathe(x: number, y: number, z: number, prof: readonly (readonly [number, number])[], segs: number, look: Look): void {
    const path = prof.map(([, h]) => v3(x, y + h, z));
    const radii = prof.map(([rr]) => rr);
    // a lathe is a sweep along +y whose radius follows the profile per row
    const n = prof.length;
    this.sweep(path, (t) => {
      const f = t * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i;
      return (radii[i] ?? 0) * (1 - u) + (radii[i + 1] ?? 0) * u;
    }, segs, look, { up: v3(0, 0, 1) });
  }

  /** an ellipsoid on axes X Y Z with radii, `bump(dir)` scaling the radius */
  ellipsoid(c: Vector3, X: Vector3, Y: Vector3, Z: Vector3, rx: number, ry: number, rz: number, look: Look, bump?: (d: Vector3) => number, seg = 16): void {
    const rings = Math.max(6, Math.round(seg * 0.75));
    const base = this.n;
    const d = new Vector3();
    for (let i = 0; i <= rings; i++) {
      const th = (i / rings) * Math.PI;
      for (let k = 0; k <= seg; k++) {
        const ph = (k / seg) * Math.PI * 2;
        d.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
        const f = bump === undefined ? 1 : bump(d);
        const p = c.clone().addScaledVector(X, d.x * rx * f).addScaledVector(Y, d.y * ry * f).addScaledVector(Z, d.z * rz * f);
        const nrm = new Vector3().addScaledVector(X, d.x / rx).addScaledVector(Y, d.y / ry).addScaledVector(Z, d.z / rz).normalize();
        this.vert(p, nrm, k / seg, i / rings, look);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < seg; k++) {
        const a = base + i * (seg + 1) + k, b = a + 1, cc = a + seg + 1, dd = cc + 1;
        this.tri(a, b, cc);
        this.tri(b, dd, cc);
      }
    }
  }

  /** raw arrays in (a GLB's triangles), every vertex with the given class / maps */
  mesh(pos: ArrayLike<number>, nrm: ArrayLike<number>, uv: ArrayLike<number> | null, maps: ArrayLike<number> | null, cls: ArrayLike<number>, idx: ArrayLike<number>, ns: ArrayLike<number> | null = null): void {
    const base = this.n;
    const count = pos.length / 3;
    for (let i = 0; i < count; i++) {
      this.pos.push(pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0);
      this.nor.push(nrm[i * 3] ?? 0, nrm[i * 3 + 1] ?? 1, nrm[i * 3 + 2] ?? 0);
      const src = ns ?? nrm;
      this.ns.push(src[i * 3] ?? 0, src[i * 3 + 1] ?? 1, src[i * 3 + 2] ?? 0);
      this.uv.push(uv === null ? 0 : (uv[i * 2] ?? 0), uv === null ? 0 : (uv[i * 2 + 1] ?? 0));
      this.col.push(maps === null ? 1 : (maps[i * 3] ?? 1), maps === null ? 0.5 : (maps[i * 3 + 1] ?? 0.5), maps === null ? 0.5 : (maps[i * 3 + 2] ?? 0.5));
      const c = cls[i] ?? CLS.brass;
      this.mat.push(c, c === CLS.glow ? 3 : 0, 0, 0);
      this.face.push(0, 0, 0, 0);
      this.n++;
    }
    for (let i = 0; i < idx.length; i++) this.idx.push(base + (idx[i] ?? 0));
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new Float32BufferAttribute(this.mat, 4));
    g.setAttribute('aFace', new Float32BufferAttribute(this.face, 4));
    g.setAttribute('aNs', new Float32BufferAttribute(this.ns, 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    return g;
  }
}

/** merge Geo-built geometries (same attribute set) into one */
export function merge(gs: readonly BufferGeometry[]): BufferGeometry {
  return mergeGeometries([...gs], false);
}

export { v3 };
