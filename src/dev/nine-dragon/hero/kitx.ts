// Copied from the hero lab (src/dev/nd-lab/hero/kitx.ts, round-7-lab-hero) into the clean room.
// KitX (lab P4 "hero"): smooth, curved pieces the ruled Kit can't make — swept tubes with a shaped cross-section
// (talons, horns, roots, cords, tassel strands, cloth wraps), deformed ellipsoids (heads, clumps, knuckles) and raw
// triangle meshes (a TRELLIS GLB). It writes the SAME attributes as the Kit (position, normal, color, aFace, aPat,
// aMisc, aOff), so both merge into one geometry, one program, one draw call (`merge`).
import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** the same Look the Kit takes (wash colour, pattern kind + params, emit, line weight, edge bits) */
export interface XLook {
  wash: number;
  kind?: number;
  row?: number;
  col?: number;
  seed?: number;
  emit?: number;
  line?: number;
  wet?: number;
  edges?: number;
  accent?: boolean;
  gloss?: boolean;
  /** an explicit painted surface (paint.ts SURF; 0 / unset = by kind), flag bits × 4096 */
  surf?: number;
}

const tc = new Color();

export class KitX {
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

  private vert(p: Vector3, nrm: Vector3, u: number, v: number, w: number, h: number, look: XLook, shade = 1): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(nrm.x, nrm.y, nrm.z);
    tc.setHex(look.wash);
    this.col.push(tc.r * shade, tc.g * shade, tc.b * shade);
    this.face.push(u, v, w, h);
    this.pat.push(look.kind ?? 0, look.row ?? 0, look.col ?? 0, look.seed ?? 0);
    const flags = (look.edges ?? 0) + (look.accent === true ? 16 : 0) + (look.gloss === true ? 32 : 0) + (look.surf ?? 0) * 4096;
    this.misc.push(look.emit ?? 0, look.line ?? 1, look.wet ?? 0, flags);
    this.off.push(0, 0);
    return this.n++;
  }

  /**
   * A tube swept along `path`, radius `r(t)` (t = 0..1 along the path), with `segs` sides. `flat` squashes the
   * cross-section along the frame's second axis (1 = round, 0.3 = a blade), `twist` turns that axis (radians at t=1).
   * Normals are smooth; aFace = (arc length around, length along, circumference, total length) in metres.
   * `up` seeds the frame (the squash axis starts perpendicular to both the path and `up`).
   */
  sweep(path: readonly Vector3[], r: (t: number) => number, segs: number, look: XLook, opt: { flat?: number; up?: Vector3; twist?: number; capStart?: boolean; capEnd?: boolean; shade?: (t: number, a: number) => number } = {}): void {
    const m = path.length;
    if (m < 2) return;
    const flat = opt.flat ?? 1;
    const lens: number[] = [0];
    for (let i = 1; i < m; i++) {
      const a = path[i - 1], b = path[i];
      lens.push((lens[i - 1] ?? 0) + (a !== undefined && b !== undefined ? a.distanceTo(b) : 0));
    }
    const total = Math.max(lens[m - 1] ?? 0, 1e-5);
    // parallel-transport frames
    const tang: Vector3[] = [];
    for (let i = 0; i < m; i++) {
      const a = path[Math.max(0, i - 1)] ?? new Vector3(), b = path[Math.min(m - 1, i + 1)] ?? new Vector3();
      tang.push(new Vector3().subVectors(b, a).normalize());
    }
    const t0 = tang[0] ?? new Vector3(0, 1, 0);
    const up0 = opt.up ?? (Math.abs(t0.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0));
    let s = new Vector3().crossVectors(t0, up0).normalize();
    let b = new Vector3().crossVectors(s, t0).normalize();
    const base = this.n;
    for (let i = 0; i < m; i++) {
      const t = tang[i] ?? t0;
      if (i > 0) {
        // rotate the previous frame onto the new tangent
        const prev = tang[i - 1] ?? t0;
        const axis = new Vector3().crossVectors(prev, t);
        const sin = axis.length();
        if (sin > 1e-6) {
          const ang = Math.atan2(sin, prev.dot(t));
          axis.divideScalar(sin);
          s = s.applyAxisAngle(axis, ang);
          b = b.applyAxisAngle(axis, ang);
        }
      }
      const tt = (lens[i] ?? 0) / total;
      const tw = (opt.twist ?? 0) * tt;
      const cs = Math.cos(tw), sn = Math.sin(tw);
      const S = s.clone().multiplyScalar(cs).addScaledVector(b, sn);
      const B = b.clone().multiplyScalar(cs).addScaledVector(s, -sn);
      const rad = r(tt);
      const p = path[i] ?? new Vector3();
      const circ = Math.PI * 2 * rad * (1 + flat) * 0.5;
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const q = p.clone().addScaledVector(S, ca * rad).addScaledVector(B, sa * rad * flat);
        const nn = S.clone().multiplyScalar(ca * flat).addScaledVector(B, sa).normalize();
        const shade = opt.shade === undefined ? 1 : opt.shade(tt, a);
        this.vert(q, nn, (j / segs) * circ, lens[i] ?? 0, Math.max(circ, 1e-4), total, look, shade);
      }
    }
    for (let i = 0; i + 1 < m; i++) {
      for (let j = 0; j < segs; j++) {
        const a = base + i * (segs + 1) + j, c = a + segs + 1;
        this.idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
    const cap = (i: number, flip: boolean): void => {
      const p = path[i] ?? new Vector3();
      const t = (tang[i] ?? t0).clone().multiplyScalar(flip ? -1 : 1);
      const rad = r(i === 0 ? 0 : 1);
      if (rad < 1e-5) return;
      const c = this.vert(p, t, 0, 0, 1, 1, look);
      const ring = base + i * (segs + 1);
      for (let j = 0; j < segs; j++) {
        if (flip) this.idx.push(c, ring + j, ring + j + 1);
        else this.idx.push(c, ring + j + 1, ring + j);
      }
    };
    if (opt.capStart === true) cap(0, true);
    if (opt.capEnd === true) cap(m - 1, false);
  }

  /** a smooth ellipsoid (lat-long), displaced radially by `bump(dir)` (1 = none), in a frame (ax, ay, az) at `c` */
  ellipsoid(c: Vector3, ax: Vector3, ay: Vector3, az: Vector3, rx: number, ry: number, rz: number, look: XLook, bump: (d: Vector3) => number = () => 1, lat = 8, lon = 12): void {
    const base = this.n;
    const d = new Vector3();
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const ph = (j / lon) * Math.PI * 2;
        d.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
        const k = bump(d);
        const p = c.clone().addScaledVector(ax, d.x * rx * k).addScaledVector(ay, d.y * ry * k).addScaledVector(az, d.z * rz * k);
        const nn = new Vector3().addScaledVector(ax, d.x / rx).addScaledVector(ay, d.y / ry).addScaledVector(az, d.z / rz).normalize();
        this.vert(p, nn, (j / lon) * Math.PI * 2 * Math.max(rx, rz), (i / lat) * Math.PI * ry, Math.PI * 2 * Math.max(rx, rz), Math.PI * ry, look);
      }
    }
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = base + i * (lon + 1) + j, b = a + lon + 1;
        this.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  /** a flat quad (both faces), aFace = metres across/along: paper talismans, ribbons */
  card(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, look: XLook): void {
    const nrm = new Vector3().crossVectors(right, up).normalize();
    for (const side of [1, -1]) {
      const r = right.clone().multiplyScalar(side);
      const nn = nrm.clone().multiplyScalar(side);
      const p0 = c.clone().addScaledVector(r, -w / 2).addScaledVector(up, -h / 2);
      const i = this.vert(p0, nn, 0, 0, w, h, look);
      this.vert(p0.clone().addScaledVector(r, w), nn, w, 0, w, h, look);
      this.vert(p0.clone().addScaledVector(r, w).addScaledVector(up, h), nn, w, h, w, h, look);
      this.vert(p0.clone().addScaledVector(up, h), nn, 0, h, w, h, look);
      this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
  }

  /** raw triangles (a converted GLB): positions + normals + per-vertex colours, all transformed already */
  mesh(pos: ArrayLike<number>, nrm: ArrayLike<number>, colors: ArrayLike<number> | null, index: ArrayLike<number> | null, look: XLook): void {
    const base = this.n;
    const count = pos.length / 3;
    const p = new Vector3(), nn = new Vector3();
    for (let i = 0; i < count; i++) {
      p.set(pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0);
      nn.set(nrm[i * 3] ?? 0, nrm[i * 3 + 1] ?? 1, nrm[i * 3 + 2] ?? 0);
      this.vert(p, nn, 0.5, 0.5, 1, 1, look);
      if (colors !== null) {
        const o = this.col.length - 3;
        this.col[o] = colors[i * 3] ?? 1;
        this.col[o + 1] = colors[i * 3 + 1] ?? 1;
        this.col[o + 2] = colors[i * 3 + 2] ?? 1;
      }
    }
    if (index === null) for (let i = 0; i < count; i++) this.idx.push(base + i);
    else for (let i = 0; i < index.length; i++) this.idx.push(base + (index[i] ?? 0));
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
    g.setAttribute('aSpill', new Float32BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** merge Kit and KitX geometries (same attribute set) into one */
export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries([...parts], false);
  g.computeBoundingSphere();
  return g;
}

/** a Catmull-Rom-ish smooth path through control points, `n` samples per span */
export function curve(ctrl: readonly Vector3[], n = 6): Vector3[] {
  const out: Vector3[] = [];
  const at = (i: number): Vector3 => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))] ?? new Vector3();
  for (let i = 0; i + 1 < ctrl.length; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push(new Vector3(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      ));
    }
  }
  out.push(at(ctrl.length - 1).clone());
  return out;
}
