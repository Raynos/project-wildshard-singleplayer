// Strand cloth (SHARD-PLATFORM M3): Verlet sway for small hanging cloth on a held item, as data rows. Points live in the
// caller's space, pinned to a pivot that rides the item, relaxed against distance constraints a few sub-steps a frame;
// each frame rewrites one dynamic geometry of fixed topology the caller built (tube rings / a sheet grid, in the order
// the rows name), so the caller's own program and outline draw it.
//
//   StrandTassel: pivot → a cord (cordPts points) → a rigid cap on the chain → `strands` strands of `pts` points fanned
//                 round the cap, each held to its rest spread by a soft bundle spring that weakens down the strand.
//   ClothSheet:   pivot → a short cord → a cols × rows sheet hung from its top-centre, structural + shear + bend
//                 constraints, a noise breeze that ruffles the lower rows more.
import { BufferAttribute, type BufferGeometry, DynamicDrawUsage, type Quaternion, Vector3 } from 'three';

/** A capsule the cloth may not enter (a fist round a grip, a forearm, a guard): segment a → b, radius r. */
export interface ClothCapsule { a: Vector3; b: Vector3; r: number }

/** A noise push as data: `(noise(t · time + i · index + j · second + offset) − 0.5) · amp · breeze`. */
export type ClothBreeze = readonly [time: number, index: number, second: number, offset: number, amp: number];

/** The dynamic attributes the cloth rewrites: its normal goes in every `normals` name, a copy in `hull`. */
export interface ClothAttributes { readonly normals: readonly string[]; readonly hull: string }

/** A tassel as data (lengths in metres, the caller's space). */
export interface StrandTasselRow {
  readonly strands: number;
  readonly pts: number;
  readonly len: number;
  readonly cordPts: number;
  readonly cordLen: number;
  /** the cap's radius: the strands' roots ring it */
  readonly capR: number;
  readonly strandR: number;
  /** the cap's length along the chain (the strands start below it) */
  readonly cap: number;
  readonly cordSegs: number;
  readonly strandSegs: number;
  readonly cordRadius: number;
  /** a strand's radius: strandR · (a − b · u) · (c + d · hash(strand)) */
  readonly strandTaper: readonly [number, number, number, number];
  readonly substeps: number;
  readonly cordDamp: number;
  readonly strandDamp: number;
  readonly cordIters: number;
  readonly strandIters: number;
  /** the bundle spring: bundle / (1 + i · bundleFall) toward a rest line widening by bundleWiden a point */
  readonly bundle: number;
  readonly bundleFall: number;
  readonly bundleWiden: number;
  /** the hanging start: the strands begin restDrop under the cord's end, widening restWiden a point */
  readonly restDrop: number;
  readonly restWiden: number;
  /** the two-apart bend constraint's stiffness */
  readonly bend: number;
  readonly cordPad: number;
  /** the root spread: angle = s / strands · 2π + (s mod 2) · twist, radius = min + vary · hash(s + seed) */
  readonly spread: readonly [twist: number, min: number, vary: number, seed: number];
  readonly breezeX: ClothBreeze;
  readonly breezeZ: ClothBreeze;
  readonly attributes: ClothAttributes;
}

/** A hanging sheet as data (lengths in metres, the caller's space). */
export interface ClothSheetRow {
  readonly cols: number;
  readonly rows: number;
  readonly w: number;
  readonly h: number;
  readonly cordPts: number;
  readonly cordLen: number;
  readonly cordSegs: number;
  readonly cordRadius: number;
  readonly substeps: number;
  readonly cordDamp: number;
  readonly sheetDamp: number;
  readonly cordIters: number;
  readonly iters: number;
  /** shear and bend stiffness: the diagonals, two rows apart, two columns apart */
  readonly shear: number;
  readonly bendRows: number;
  readonly bendCols: number;
  readonly pad: number;
  /** how the breeze grows down the sheet: (row / (rows − 1)) ** flutterPow */
  readonly flutterPow: number;
  /** the push along the item's facing (index = column, second = row) and across x (index = row) */
  readonly flutter: ClothBreeze;
  readonly sway: ClothBreeze;
  readonly attributes: ClothAttributes;
}

interface Pt { p: Vector3; q: Vector3; pin: boolean }

const tmp = new Vector3();
const tmp2 = new Vector3();
const seg = new Vector3();

/** push the (free) points out of every capsule; the previous position moves too, so the push is not a velocity kick */
function collide(pts: readonly Pt[], caps: readonly ClothCapsule[], pad: number): void {
  for (const pt of pts) {
    if (pt.pin) continue;
    for (const c of caps) {
      seg.subVectors(c.b, c.a);
      const L2 = seg.lengthSq();
      const h = L2 > 1e-12 ? Math.max(0, Math.min(1, tmp.subVectors(pt.p, c.a).dot(seg) / L2)) : 0;
      const q = tmp2.copy(c.a).addScaledVector(seg, h);
      const d = tmp.subVectors(pt.p, q);
      const dist = d.length(), R = c.r + pad;
      if (dist >= R || dist < 1e-9) continue;
      d.multiplyScalar((R - dist) / dist);
      pt.p.add(d);
      pt.q.add(d);
    }
  }
}

/** How deep any point sits inside any capsule (m; 0 = clear). */
export function clothPenetration(pts: readonly Vector3[], caps: readonly ClothCapsule[]): number {
  let worst = 0;
  const d = new Vector3(), q = new Vector3();
  for (const p of pts) {
    for (const c of caps) {
      d.subVectors(c.b, c.a);
      const L2 = d.lengthSq();
      const h = L2 > 1e-12 ? Math.max(0, Math.min(1, q.subVectors(p, c.a).dot(d) / L2)) : 0;
      q.copy(c.a).addScaledVector(d, h);
      worst = Math.max(worst, c.r - p.distanceTo(q));
    }
  }
  return worst;
}

/** A stable per-index hash in [0, 1). */
export function clothHash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number): number { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return clothHash(i) * (1 - u) + clothHash(i + 1) * u; }
function push(b: ClothBreeze, t: number, i: number, j: number): number { return (vnoise(t * b[0] + i * b[1] + j * b[2] + b[3]) - 0.5) * b[4]; }

/** keep a and b at `len` apart; a pinned point does not move */
function relax(a: Pt, b: Pt, len: number, k = 1): void {
  tmp.subVectors(b.p, a.p);
  const d = tmp.length();
  if (d < 1e-9) return;
  const wa = a.pin ? 0 : 1, wb = b.pin ? 0 : 1;
  if (wa + wb === 0) return;
  const diff = ((d - len) / d) * k / (wa + wb);
  a.p.addScaledVector(tmp, diff * wa);
  b.p.addScaledVector(tmp, -diff * wb);
}

function integrate(pts: Pt[], g: Vector3, dt: number, damp: number, force?: (i: number, out: Vector3) => Vector3): void {
  const f = new Vector3();
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    if (pt === undefined || pt.pin) continue;
    tmp.subVectors(pt.p, pt.q).multiplyScalar(damp);
    pt.q.copy(pt.p);
    f.copy(g);
    if (force !== undefined) force(i, f);
    pt.p.add(tmp).addScaledVector(f, dt * dt);
  }
}

function chain(pts: readonly Pt[], len: number): void {
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (a !== undefined && b !== undefined) relax(a, b, len); }
}

/** write a tube along `path` into the dynamic arrays from vertex `v0`: rings of segs + 1, (along × around) facing out */
function writeTube(pos: Float32Array, nor: Float32Array, v0: number, path: readonly Vector3[], radius: (t: number) => number, segs: number): number {
  const n = path.length;
  let s = new Vector3(1, 0, 0);
  let vi = v0;
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)] ?? new Vector3(), b = path[Math.min(n - 1, i + 1)] ?? new Vector3();
    const t = tmp2.subVectors(b, a).normalize();
    if (i === 0) {
      s = Math.abs(t.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
    }
    s.addScaledVector(t, -s.dot(t)).normalize();
    const bb = new Vector3().crossVectors(s, t);
    const r = radius(i / (n - 1));
    const c = path[i] ?? new Vector3();
    for (let k = 0; k <= segs; k++) {
      const th = (k / segs) * Math.PI * 2;
      const nx = s.x * Math.cos(th) + bb.x * Math.sin(th), ny = s.y * Math.cos(th) + bb.y * Math.sin(th), nz = s.z * Math.cos(th) + bb.z * Math.sin(th);
      pos[vi * 3] = c.x + nx * r;
      pos[vi * 3 + 1] = c.y + ny * r;
      pos[vi * 3 + 2] = c.z + nz * r;
      nor[vi * 3] = nx;
      nor[vi * 3 + 1] = ny;
      nor[vi * 3 + 2] = nz;
      vi++;
    }
  }
  return vi;
}

/** the dynamic position / normal / hull attributes of a caller-built geometry */
class Dynamic {
  readonly pos: BufferAttribute;
  readonly nor: BufferAttribute;
  readonly hull: BufferAttribute;
  constructor(geo: BufferGeometry, attributes: ClothAttributes) {
    const count = geo.getAttribute('position').count;
    this.pos = new BufferAttribute(new Float32Array(count * 3), 3);
    this.nor = new BufferAttribute(new Float32Array(count * 3), 3);
    this.hull = new BufferAttribute(new Float32Array(count * 3), 3);
    for (const a of [this.pos, this.nor, this.hull]) a.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', this.pos);
    for (const name of attributes.normals) geo.setAttribute(name, this.nor);
    geo.setAttribute(attributes.hull, this.hull);
  }
  get P(): Float32Array { return this.pos.array as Float32Array; }
  get N(): Float32Array { return this.nor.array as Float32Array; }
  done(): void {
    (this.hull.array as Float32Array).set(this.N);
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
    this.hull.needsUpdate = true;
  }
}

/** A tassel on a held item: its geometry's vertices are the cord's tube (cordPts rings of cordSegs + 1) and then each
 *  strand's tube (pts rings of strandSegs + 1), as the caller built them. */
export class StrandTassel {
  readonly geo: BufferGeometry;
  /** the rigid knot + cap sit on the chain: position and the chain's direction at the cap */
  readonly cap = new Vector3();
  readonly capDir = new Vector3(0, -1, 0);
  private readonly row: StrandTasselRow;
  private readonly cord: Pt[] = [];
  private readonly strands: Pt[][] = [];
  private readonly spread: Vector3[] = [];
  private readonly dyn: Dynamic;
  private t = 0;
  private started = false;

  constructor(row: StrandTasselRow, geo: BufferGeometry) {
    this.row = row;
    this.geo = geo;
    this.dyn = new Dynamic(geo, row.attributes);
    const [twist, min, vary, seed] = row.spread;
    for (let i = 0; i < row.cordPts; i++) this.cord.push({ p: new Vector3(), q: new Vector3(), pin: i === 0 });
    for (let s = 0; s < row.strands; s++) {
      const a = (s / row.strands) * Math.PI * 2 + (s % 2) * twist;
      const r = min + vary * clothHash(s + seed);
      this.spread.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      const pts: Pt[] = [];
      for (let i = 0; i < row.pts; i++) pts.push({ p: new Vector3(), q: new Vector3(), pin: i === 0 });
      this.strands.push(pts);
    }
  }

  /** every simulated point (a gate's cloth check) */
  points(): Vector3[] { return [...this.cord, ...this.strands.flat()].filter((c) => !c.pin).map((c) => c.p); }

  /** place everything hanging straight from the pivot (first frame, or a teleport) */
  private reset(pivot: Vector3, down: Vector3): void {
    const R = this.row;
    const segC = R.cordLen / (R.cordPts - 1);
    this.cord.forEach((c, i) => { c.p.copy(pivot).addScaledVector(down, segC * i); c.q.copy(c.p); });
    const capC = this.cord[R.cordPts - 1]?.p ?? pivot;
    this.strands.forEach((pts, s) => {
      const sp = this.spread[s] ?? new Vector3();
      pts.forEach((pt, i) => {
        pt.p.copy(capC).addScaledVector(down, R.restDrop + (R.len / (R.pts - 1)) * i).addScaledVector(sp, R.capR * (1 + i * R.restWiden));
        pt.q.copy(pt.p);
      });
    });
  }

  /**
   * One frame. `pivot` = where the cord leaves the item, `itemQ` = the item's orientation (the cap's spread frame),
   * `gravity` = down (× 9.8), `breeze` 0..1, `caps` the colliders.
   */
  step(dt: number, pivot: Vector3, itemQ: Quaternion, gravity: Vector3, breeze: number, caps: readonly ClothCapsule[] = []): void {
    const R = this.row;
    const down = gravity.clone().normalize();
    if (!this.started) { this.reset(pivot, down); this.started = true; }
    this.t += dt;
    const sub = R.substeps;
    const h = Math.min(dt, 1 / 30) / sub;
    const segC = R.cordLen / (R.cordPts - 1);
    const segS = R.len / (R.pts - 1);
    for (let it = 0; it < sub; it++) {
      const c0 = this.cord[0];
      if (c0 !== undefined) { c0.p.copy(pivot); c0.q.copy(pivot); }
      integrate(this.cord, gravity, h, R.cordDamp);
      for (let k = 0; k < R.cordIters; k++) chain(this.cord, segC);
      // the cap frame: the cord's last direction, and a side axis from the item
      const cl = this.cord[R.cordPts - 1], cp = this.cord[R.cordPts - 2];
      if (cl === undefined || cp === undefined) return;
      this.capDir.subVectors(cl.p, cp.p).normalize();
      this.cap.copy(cl.p);
      const sx = new Vector3(1, 0, 0).applyQuaternion(itemQ);
      sx.addScaledVector(this.capDir, -sx.dot(this.capDir)).normalize();
      const sz = new Vector3().crossVectors(this.capDir, sx);
      const t = this.t;
      this.strands.forEach((pts, s) => {
        const sp = this.spread[s] ?? new Vector3();
        const root = pts[0];
        if (root === undefined) return;
        const off = new Vector3().addScaledVector(sx, sp.x * R.capR).addScaledVector(sz, sp.z * R.capR);
        root.p.copy(cl.p).addScaledVector(this.capDir, R.cap).add(off);
        root.q.copy(root.p);
        integrate(pts, gravity, h, R.strandDamp, (i, f) => {
          // the bundle: pull toward the strand's rest line (spread widening down the skirt), weaker toward the tips
          const rest = tmp2.copy(cl.p).addScaledVector(this.capDir, R.cap + segS * i).addScaledVector(off, 1 + i * R.bundleWiden);
          const pt = pts[i];
          if (pt !== undefined) f.addScaledVector(rest.sub(pt.p), R.bundle / (1 + i * R.bundleFall));
          f.x += push(R.breezeX, t, s, 0) * breeze;
          f.z += push(R.breezeZ, t, s, 0) * breeze;
          return f;
        });
        for (let k = 0; k < R.strandIters; k++) {
          chain(pts, segS);
          for (let i = 0; i < pts.length - 2; i++) { const a = pts[i], b = pts[i + 2]; if (a !== undefined && b !== undefined) relax(a, b, segS * 2, R.bend); }
          collide(pts, caps, R.strandR);
        }
      });
      collide(this.cord, caps, R.cordPad);
    }
    // write the tubes
    const P = this.dyn.P, N = this.dyn.N;
    const [ta, tb, tc, td] = R.strandTaper;
    let vi = writeTube(P, N, 0, this.cord.map((c) => c.p), () => R.cordRadius, R.cordSegs);
    this.strands.forEach((pts, s) => {
      vi = writeTube(P, N, vi, pts.map((p) => p.p), (u) => R.strandR * (ta - tb * u) * (tc + td * clothHash(s)), R.strandSegs);
    });
    this.dyn.done();
  }
}

/** A sheet hung from a cord on a held item: `geo`'s vertices are the cols × rows grid row by row; `cordGeo`'s the cord's
 *  tube (cordPts + 1 rings of cordSegs + 1, the last ring at the sheet's top centre). */
export class ClothSheet {
  readonly geo: BufferGeometry;
  readonly cordGeo: BufferGeometry;
  private readonly row: ClothSheetRow;
  private readonly cord: Pt[] = [];
  private readonly sheet: Pt[] = [];
  private readonly dyn: Dynamic;
  private readonly cdyn: Dynamic;
  private t = 0;
  private started = false;

  constructor(row: ClothSheetRow, geo: BufferGeometry, cordGeo: BufferGeometry) {
    this.row = row;
    this.geo = geo;
    this.dyn = new Dynamic(geo, row.attributes);
    this.cordGeo = cordGeo;
    this.cdyn = new Dynamic(cordGeo, row.attributes);
    for (let i = 0; i < row.cordPts; i++) this.cord.push({ p: new Vector3(), q: new Vector3(), pin: i === 0 });
    for (let i = 0; i < row.rows * row.cols; i++) this.sheet.push({ p: new Vector3(), q: new Vector3(), pin: false });
  }

  /** every simulated point (a gate's cloth check) */
  points(): Vector3[] { return this.sheet.filter((c) => !c.pin).map((c) => c.p); }

  private reset(pivot: Vector3, down: Vector3, side: Vector3): void {
    const { cols, rows, w, h, cordPts, cordLen } = this.row;
    this.cord.forEach((c, i) => { c.p.copy(pivot).addScaledVector(down, (cordLen / (cordPts - 1)) * i); c.q.copy(c.p); });
    const top = pivot.clone().addScaledVector(down, cordLen);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = this.sheet[r * cols + c];
        if (pt === undefined) continue;
        pt.p.copy(top).addScaledVector(down, (h / (rows - 1)) * r).addScaledVector(side, (c / (cols - 1) - 0.5) * w);
        pt.q.copy(pt.p);
      }
    }
  }

  /** One frame; the arguments as StrandTassel.step. The sheet faces the eye: its width runs along the item's x. */
  step(dt: number, pivot: Vector3, itemQ: Quaternion, gravity: Vector3, breeze: number, caps: readonly ClothCapsule[] = []): void {
    const R = this.row;
    const { cols, rows, w, h, cordPts, cordLen } = R;
    const down = gravity.clone().normalize();
    const side = new Vector3(1, 0, 0).applyQuaternion(itemQ);
    side.addScaledVector(down, -side.dot(down)).normalize();
    if (!this.started) { this.reset(pivot, down, side); this.started = true; }
    this.t += dt;
    const sub = R.substeps;
    const hh = Math.min(dt, 1 / 30) / sub;
    const dx = w / (cols - 1), dy = h / (rows - 1), dc = cordLen / (cordPts - 1);
    const t = this.t;
    const midL = Math.floor((cols - 1) / 2), midR = Math.ceil((cols - 1) / 2);
    for (let it = 0; it < sub; it++) {
      const c0 = this.cord[0];
      if (c0 !== undefined) { c0.p.copy(pivot); c0.q.copy(pivot); }
      integrate(this.cord, gravity, hh, R.cordDamp);
      for (let k = 0; k < R.cordIters; k++) chain(this.cord, dc);
      // the sheet's two top-middle points hang from the cord end (tied through a hole)
      const end = this.cord[cordPts - 1];
      if (end === undefined) return;
      integrate(this.sheet, gravity, hh, R.sheetDamp, (i, f) => {
        const r = Math.floor(i / cols), c = i % cols;
        const k = (r / (rows - 1)) ** R.flutterPow;
        f.addScaledVector(new Vector3(0, 0, 1).applyQuaternion(itemQ), push(R.flutter, t, c, r) * k * breeze);
        f.x += push(R.sway, t, r, 0) * k * breeze;
        return f;
      });
      const topL = this.sheet[midL], topR = this.sheet[midR];
      if (topL !== undefined && topR !== undefined) {
        topL.p.copy(end.p).addScaledVector(side, -dx * 0.5);
        topR.p.copy(end.p).addScaledVector(side, dx * 0.5);
      }
      for (let k = 0; k < R.iters; k++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const a = this.sheet[r * cols + c];
            if (a === undefined) continue;
            const right = c < cols - 1 ? this.sheet[r * cols + c + 1] : undefined;
            const below = r < rows - 1 ? this.sheet[(r + 1) * cols + c] : undefined;
            const diag = c < cols - 1 && r < rows - 1 ? this.sheet[(r + 1) * cols + c + 1] : undefined;
            const diag2 = c > 0 && r < rows - 1 ? this.sheet[(r + 1) * cols + c - 1] : undefined;
            const below2 = r < rows - 2 ? this.sheet[(r + 2) * cols + c] : undefined;
            const right2 = c < cols - 2 ? this.sheet[r * cols + c + 2] : undefined;
            if (right !== undefined) relax(a, right, dx);
            if (below !== undefined) relax(a, below, dy);
            if (diag !== undefined) relax(a, diag, Math.hypot(dx, dy), R.shear);
            if (diag2 !== undefined) relax(a, diag2, Math.hypot(dx, dy), R.shear);
            if (below2 !== undefined) relax(a, below2, dy * 2, R.bendRows);
            if (right2 !== undefined) relax(a, right2, dx * 2, R.bendCols);
          }
        }
        collide(this.sheet, caps, R.pad);
        if (topL !== undefined && topR !== undefined) {
          topL.p.copy(end.p).addScaledVector(side, -dx * 0.5);
          topR.p.copy(end.p).addScaledVector(side, dx * 0.5);
        }
      }
    }
    // write the sheet: positions + per-point normals from the grid neighbours, turned toward the item's facing
    const P = this.dyn.P, N = this.dyn.N;
    const at = (r: number, c: number): Vector3 => this.sheet[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))]?.p ?? new Vector3();
    const toward = new Vector3(0, 0, 1).applyQuaternion(itemQ);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const p = at(r, c);
        P[i * 3] = p.x;
        P[i * 3 + 1] = p.y;
        P[i * 3 + 2] = p.z;
        const du = tmp.subVectors(at(r, c + 1), at(r, c - 1));
        const dv = tmp2.subVectors(at(r - 1, c), at(r + 1, c));
        const nn = new Vector3().crossVectors(du, dv).normalize();
        if (nn.dot(toward) < 0) nn.negate();
        N[i * 3] = nn.x;
        N[i * 3 + 1] = nn.y;
        N[i * 3 + 2] = nn.z;
      }
    }
    this.dyn.done();
    const topMid = new Vector3().addVectors(at(0, midL), at(0, midR)).multiplyScalar(0.5);
    const path = [...this.cord.map((c) => c.p), topMid];
    writeTube(this.cdyn.P, this.cdyn.N, 0, path, () => R.cordRadius, R.cordSegs);
    this.cdyn.done();
  }
}
