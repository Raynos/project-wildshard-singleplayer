// Real cloth sway for the jian's red silk tassel and yellow paper talisman (lab P8 "viewmodel", E169): Verlet points in
// the viewmodel scene's space (= view space: the vm camera sits at the origin), pinned to pivots that ride the sword,
// relaxed against distance constraints a few sub-steps a frame. Both rebuild one dynamic tube / sheet geometry per
// frame (fixed topology, ~1.5 k vertices in all), drawn by the viewmodel program + its ink hull.
//
//   Tassel: pivot → a silk cord (4 points) → the knot + brass cap (rigid, placed on the chain) → 18 strands of 8 points
//           fanned round the cap, each held to its rest spread by a soft "bundle" spring that weakens down the strand.
//   Talisman: pivot → a short cord (3 points) → a 4 × 10 point sheet, pinned at its top-centre, structural + shear +
//           bend constraints, a noise breeze that ruffles it; the fu decal on both faces.
import { BufferAttribute, type BufferGeometry, DynamicDrawUsage, type Quaternion, Vector3 } from 'three';
import { CLS, Geo, type Look, v3 } from './geo';

interface Pt { p: Vector3; q: Vector3; pin: boolean }

const tmp = new Vector3();
const tmp2 = new Vector3();

function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number): number { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }

/** keep a and b at `len` apart; `wa` / `wb` = how much each may move (0 = pinned) */
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

/** write a tube along `path` into the dynamic geometry's arrays at ring offset `ring0` */
function writeTube(pos: Float32Array, nor: Float32Array, v0: number, path: readonly Vector3[], radius: (t: number) => number, segs: number): number {
  const n = path.length;
  let s = new Vector3(1, 0, 0);
  let vi = v0;
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)] ?? v3(0, 0, 0), b = path[Math.min(n - 1, i + 1)] ?? v3(0, 0, 0);
    const t = tmp2.subVectors(b, a).normalize();
    if (i === 0) {
      s = Math.abs(t.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
    }
    s.addScaledVector(t, -s.dot(t)).normalize();
    const bb = new Vector3().crossVectors(t, s);
    const r = radius(i / (n - 1));
    const c = path[i] ?? v3(0, 0, 0);
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

/** a static tube topology (rings of segs+1) written into a Geo, so the dynamic arrays share its layout */
function tubeTopology(g: Geo, rings: number, segs: number, look: Look, uvLen: number): void {
  const base = g.vertexCount;
  const z = v3(0, 0, 0), up = v3(0, 1, 0);
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k <= segs; k++) g.vert(z, up, k / segs, (i / (rings - 1)) * uvLen, look, [0, 0, 0, 0], [1, 0.5, 0.5 + 0.12 * Math.sin(k * 2.1 + i)]);
  }
  const row = segs + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < segs; k++) {
      const a = base + i * row + k, b = a + 1, c = a + row, d = c + 1;
      g.tri(a, c, b);
      g.tri(b, c, d);
    }
  }
}

export const TASSEL = { strands: 18, pts: 8, len: 0.1, cordPts: 4, cordLen: 0.03, capR: 0.0095, strandR: 0.0021 } as const;

export class Tassel {
  readonly geo: BufferGeometry;
  /** the rigid knot + cap sit on the chain: position and the chain's direction at the cap */
  readonly cap = new Vector3();
  readonly capDir = new Vector3(0, -1, 0);
  private readonly cord: Pt[] = [];
  private readonly strands: Pt[][] = [];
  private readonly spread: Vector3[] = [];
  private readonly pos: BufferAttribute;
  private readonly nor: BufferAttribute;
  private readonly hull: BufferAttribute;
  private t = 0;
  private started = false;

  constructor() {
    const g = new Geo();
    const silk: Look = { cls: CLS.silk };
    const dark: Look = { cls: CLS.trim };
    tubeTopology(g, TASSEL.cordPts, 6, dark, 0.03);
    for (let s = 0; s < TASSEL.strands; s++) tubeTopology(g, TASSEL.pts, 5, s % 3 === 0 ? dark : silk, TASSEL.len);
    this.geo = g.build();
    const count = this.geo.getAttribute('position').count;
    this.pos = new BufferAttribute(new Float32Array(count * 3), 3);
    this.nor = new BufferAttribute(new Float32Array(count * 3), 3);
    this.hull = new BufferAttribute(new Float32Array(count * 3), 3);
    for (const a of [this.pos, this.nor, this.hull]) a.setUsage(DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);
    this.geo.setAttribute('normal', this.nor);
    this.geo.setAttribute('aNs', this.nor);
    this.geo.setAttribute('aHullN', this.hull);
    for (let i = 0; i < TASSEL.cordPts; i++) this.cord.push({ p: new Vector3(), q: new Vector3(), pin: i === 0 });
    for (let s = 0; s < TASSEL.strands; s++) {
      const a = (s / TASSEL.strands) * Math.PI * 2 + (s % 2) * 0.17;
      const r = 0.55 + 0.45 * hash(s + 3.3);
      this.spread.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      const pts: Pt[] = [];
      for (let i = 0; i < TASSEL.pts; i++) pts.push({ p: new Vector3(), q: new Vector3(), pin: i === 0 });
      this.strands.push(pts);
    }
  }

  /** place everything hanging straight from the pivot (first frame, or a teleport) */
  private reset(pivot: Vector3, down: Vector3): void {
    const segC = TASSEL.cordLen / (TASSEL.cordPts - 1);
    this.cord.forEach((c, i) => { c.p.copy(pivot).addScaledVector(down, segC * i); c.q.copy(c.p); });
    const capC = this.cord[TASSEL.cordPts - 1]?.p ?? pivot;
    this.strands.forEach((pts, s) => {
      const sp = this.spread[s] ?? v3(0, 0, 0);
      pts.forEach((pt, i) => {
        pt.p.copy(capC).addScaledVector(down, 0.014 + (TASSEL.len / (TASSEL.pts - 1)) * i).addScaledVector(sp, TASSEL.capR * (1 + i * 0.12));
        pt.q.copy(pt.p);
      });
    });
  }

  /**
   * One frame. `pivot` = where the cord leaves the sword (vm scene space), `swordQ` = the sword's orientation (for the
   * cap's spread frame), `gravity` = down in vm scene space (× 9.8), `breeze` 0..1.
   */
  step(dt: number, pivot: Vector3, swordQ: Quaternion, gravity: Vector3, breeze: number): void {
    const down = gravity.clone().normalize();
    if (!this.started) { this.reset(pivot, down); this.started = true; }
    this.t += dt;
    const sub = 4;
    const h = Math.min(dt, 1 / 30) / sub;
    const segC = TASSEL.cordLen / (TASSEL.cordPts - 1);
    const segS = TASSEL.len / (TASSEL.pts - 1);
    for (let it = 0; it < sub; it++) {
      const c0 = this.cord[0];
      if (c0 !== undefined) { c0.p.copy(pivot); c0.q.copy(pivot); }
      integrate(this.cord, gravity, h, 0.985);
      for (let k = 0; k < 3; k++) for (let i = 0; i < this.cord.length - 1; i++) { const a = this.cord[i], b = this.cord[i + 1]; if (a !== undefined && b !== undefined) relax(a, b, segC); }
      // the cap frame: the cord's last direction, and a side axis from the sword
      const cl = this.cord[TASSEL.cordPts - 1], cp = this.cord[TASSEL.cordPts - 2];
      if (cl === undefined || cp === undefined) return;
      this.capDir.subVectors(cl.p, cp.p).normalize();
      this.cap.copy(cl.p);
      const sx = new Vector3(1, 0, 0).applyQuaternion(swordQ);
      sx.addScaledVector(this.capDir, -sx.dot(this.capDir)).normalize();
      const sz = new Vector3().crossVectors(this.capDir, sx);
      const t = this.t;
      this.strands.forEach((pts, s) => {
        const sp = this.spread[s] ?? v3(0, 0, 0);
        const root = pts[0];
        if (root === undefined) return;
        const off = new Vector3().addScaledVector(sx, sp.x * TASSEL.capR).addScaledVector(sz, sp.z * TASSEL.capR);
        root.p.copy(cl.p).addScaledVector(this.capDir, 0.016).add(off);
        root.q.copy(root.p);
        integrate(pts, gravity, h, 0.975, (i, f) => {
          // the bundle: pull toward the strand's rest line (spread widening down the skirt), weaker toward the tips
          const rest = tmp2.copy(cl.p).addScaledVector(this.capDir, 0.016 + segS * i).addScaledVector(off, 1 + i * 0.16);
          const pt = pts[i];
          if (pt !== undefined) f.addScaledVector(rest.sub(pt.p), 220 / (1 + i * 0.9));
          // breeze: a slow noise push across the view
          f.x += (vnoise(t * 0.9 + s * 0.37) - 0.5) * 3.2 * breeze;
          f.z += (vnoise(t * 1.3 + s * 0.61 + 9) - 0.5) * 2.4 * breeze;
          return f;
        });
        for (let k = 0; k < 2; k++) {
          for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (a !== undefined && b !== undefined) relax(a, b, segS); }
          for (let i = 0; i < pts.length - 2; i++) { const a = pts[i], b = pts[i + 2]; if (a !== undefined && b !== undefined) relax(a, b, segS * 2, 0.12); }
        }
      });
    }
    // write the tubes
    const P = this.pos.array as Float32Array, N = this.nor.array as Float32Array;
    let vi = writeTube(P, N, 0, this.cord.map((c) => c.p), () => 0.0026, 6);
    this.strands.forEach((pts, s) => {
      vi = writeTube(P, N, vi, pts.map((p) => p.p), (u) => TASSEL.strandR * (1.15 - 0.5 * u) * (0.85 + 0.3 * hash(s)), 5);
    });
    (this.hull.array as Float32Array).set(N);
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
    this.hull.needsUpdate = true;
  }
}

export const TALISMAN = { cols: 4, rows: 10, w: 0.042, h: 0.118, cordPts: 3, cordLen: 0.024 } as const;

export class Talisman {
  readonly geo: BufferGeometry;
  readonly cordGeo: BufferGeometry;
  private readonly cord: Pt[] = [];
  private readonly sheet: Pt[] = [];
  private readonly pos: BufferAttribute;
  private readonly nor: BufferAttribute;
  private readonly hull: BufferAttribute;
  private readonly cpos: BufferAttribute;
  private readonly cnor: BufferAttribute;
  private readonly chull: BufferAttribute;
  private t = 0;
  private started = false;

  constructor() {
    const { cols, rows } = TALISMAN;
    const g = new Geo();
    const paper: Look = { cls: CLS.paper };
    const z = v3(0, 0, 0), n = v3(0, 0, 1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.vert(z, n, c / (cols - 1), 1 - r / (rows - 1), paper);
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        g.tri(a, d, b);
        g.tri(b, d, e);
      }
    }
    this.geo = g.build();
    const cnt = this.geo.getAttribute('position').count;
    this.pos = new BufferAttribute(new Float32Array(cnt * 3), 3);
    this.nor = new BufferAttribute(new Float32Array(cnt * 3), 3);
    this.hull = new BufferAttribute(new Float32Array(cnt * 3), 3);
    for (const a of [this.pos, this.nor, this.hull]) a.setUsage(DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);
    this.geo.setAttribute('normal', this.nor);
    this.geo.setAttribute('aNs', this.nor);
    this.geo.setAttribute('aHullN', this.hull);
    const cg = new Geo();
    tubeTopology(cg, TALISMAN.cordPts + 1, 5, { cls: CLS.trim }, 0.03);
    this.cordGeo = cg.build();
    const cc = this.cordGeo.getAttribute('position').count;
    this.cpos = new BufferAttribute(new Float32Array(cc * 3), 3);
    this.cnor = new BufferAttribute(new Float32Array(cc * 3), 3);
    this.chull = new BufferAttribute(new Float32Array(cc * 3), 3);
    for (const a of [this.cpos, this.cnor, this.chull]) a.setUsage(DynamicDrawUsage);
    this.cordGeo.setAttribute('position', this.cpos);
    this.cordGeo.setAttribute('normal', this.cnor);
    this.cordGeo.setAttribute('aNs', this.cnor);
    this.cordGeo.setAttribute('aHullN', this.chull);
    for (let i = 0; i < TALISMAN.cordPts; i++) this.cord.push({ p: new Vector3(), q: new Vector3(), pin: i === 0 });
    for (let i = 0; i < rows * cols; i++) this.sheet.push({ p: new Vector3(), q: new Vector3(), pin: false });
  }

  private reset(pivot: Vector3, down: Vector3, side: Vector3): void {
    const { cols, rows, w, h, cordPts, cordLen } = TALISMAN;
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

  step(dt: number, pivot: Vector3, swordQ: Quaternion, gravity: Vector3, breeze: number): void {
    const { cols, rows, w, h, cordPts, cordLen } = TALISMAN;
    const down = gravity.clone().normalize();
    // the sheet faces the eye: its width runs along the sword's flat (x), kept perpendicular to gravity
    const side = new Vector3(1, 0, 0).applyQuaternion(swordQ);
    side.addScaledVector(down, -side.dot(down)).normalize();
    if (!this.started) { this.reset(pivot, down, side); this.started = true; }
    this.t += dt;
    const sub = 4;
    const hh = Math.min(dt, 1 / 30) / sub;
    const dx = w / (cols - 1), dy = h / (rows - 1), dc = cordLen / (cordPts - 1);
    const t = this.t;
    for (let it = 0; it < sub; it++) {
      const c0 = this.cord[0];
      if (c0 !== undefined) { c0.p.copy(pivot); c0.q.copy(pivot); }
      integrate(this.cord, gravity, hh, 0.98);
      for (let k = 0; k < 2; k++) for (let i = 0; i < this.cord.length - 1; i++) { const a = this.cord[i], b = this.cord[i + 1]; if (a !== undefined && b !== undefined) relax(a, b, dc); }
      // the sheet's two top-middle points hang from the cord end (a paper talisman tied through a hole)
      const end = this.cord[cordPts - 1];
      if (end === undefined) return;
      integrate(this.sheet, gravity, hh, 0.965, (i, f) => {
        const r = Math.floor(i / cols), c = i % cols;
        // flutter: the breeze ruffles the lower rows more
        const k = (r / (rows - 1)) ** 1.2;
        f.addScaledVector(new Vector3(0, 0, 1).applyQuaternion(swordQ), (vnoise(t * 2.3 + c * 0.7 + r * 0.31) - 0.5) * 9 * k * breeze);
        f.x += (vnoise(t * 1.1 + r * 0.2) - 0.5) * 3 * k * breeze;
        return f;
      });
      const topL = this.sheet[Math.floor((cols - 1) / 2)], topR = this.sheet[Math.ceil((cols - 1) / 2)];
      if (topL !== undefined && topR !== undefined) {
        topL.p.copy(end.p).addScaledVector(side, -dx * 0.5);
        topR.p.copy(end.p).addScaledVector(side, dx * 0.5);
      }
      for (let k = 0; k < 3; k++) {
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
            if (diag !== undefined) relax(a, diag, Math.hypot(dx, dy), 0.6);
            if (diag2 !== undefined) relax(a, diag2, Math.hypot(dx, dy), 0.6);
            // paper is stiff: bend constraints across two cells
            if (below2 !== undefined) relax(a, below2, dy * 2, 0.5);
            if (right2 !== undefined) relax(a, right2, dx * 2, 0.7);
          }
        }
        if (topL !== undefined && topR !== undefined) {
          topL.p.copy(end.p).addScaledVector(side, -dx * 0.5);
          topR.p.copy(end.p).addScaledVector(side, dx * 0.5);
        }
      }
    }
    // write the sheet: positions + per-point normals from the grid neighbours
    const P = this.pos.array as Float32Array, N = this.nor.array as Float32Array;
    const at = (r: number, c: number): Vector3 => this.sheet[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))]?.p ?? v3(0, 0, 0);
    const toward = new Vector3(0, 0, 1).applyQuaternion(swordQ);
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
    (this.hull.array as Float32Array).set(N);
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
    this.hull.needsUpdate = true;
    const topMid = new Vector3().addVectors(at(0, 1), at(0, 2)).multiplyScalar(0.5);
    const path = [...this.cord.map((c) => c.p), topMid];
    writeTube(this.cpos.array as Float32Array, this.cnor.array as Float32Array, 0, path, () => 0.0014, 5);
    (this.chull.array as Float32Array).set(this.cnor.array);
    this.cpos.needsUpdate = true;
    this.cnor.needsUpdate = true;
    this.chull.needsUpdate = true;
  }
}
