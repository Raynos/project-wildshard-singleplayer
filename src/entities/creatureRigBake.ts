/**
 * creatureRigBake — OFFLINE: skins a generated creature hull (public/assets/nalati/models/<name>.glb, a static
 * image-to-3D mesh, often caught mid-stride) to the procedural species' skeleton, so the species' own bones, gaits and
 * AI drive it. Run by `scripts/nalati-rig-bake.mjs` in a headless page; the result is written to
 * `<name>[.phone].rigged.glb` and the game only loads that (glbCreatures.ts). Not imported by the game.
 *
 *   const r = bakeCreatureRig(procGeometry, hullGeometry, bones, hints);   // → rest-pose skinned geometry + a report
 *
 * Both meshes are in animal space: +Z forward, +Y up, feet on y = 0. The steps:
 *   1. fit     the hull's height to the procedural mesh's, its length so its front / back leg columns land on the
 *              procedural legs'; x the mean of the two scales.
 *   2. legs    the hull below the belly is split into connected pieces; the `tail` hint box takes a hanging tail out
 *              first; each piece is a leg by its quadrant (side × front / back; a piece spanning two, per vertex).
 *   3. pose    the hull's stance is measured — each leg's axis, from the top of its piece to the hoof — and the
 *              procedural mesh is posed to it (each leg chain turned about its shoulder / hip; the same linear blend
 *              skinning the game runs), so the two meshes overlay leg for leg.
 *   4. seed    every hull vertex ON the posed procedural surface (within `seedR` × height, normals agreeing) takes the
 *              species author's weights there — a hull leg only from its own procedural leg (or the torso); a tail
 *              never from a leg; above the belly a leg's weights only near that leg along the surface;
 *   5. flood   every other hull vertex (a mane, a fluffy tail, a spread hoof) takes its nearest seed's weights measured
 *              ALONG THE HULL SURFACE (Dijkstra over the welded mesh): influence never jumps an air gap;
 *   6. smooth  a few Laplacian passes over the surface blur the flood's borders into joint blends;
 *   7. unpose  the hull is skinned back from its stance to the rest pose with its own new weights (inverse of 3), so
 *              the bind pose is the skeleton's and the game's gaits start from straight legs;
 *   8. keep the top 4 influences, normalised; smooth normals over the welded surface (no uv-seam creases).
 */
import * as THREE from 'three';
import type { BoneDef } from './species/registry';

/** per-hull hints (scripts/nalati-rig-bake.mjs), in the FITTED space (animal space, metres) */
export interface RigBakeOptions {
  /** seed radius, as a fraction of the figure height (default 0.05) */
  seedR?: number;
  /** min dot(hull normal, procedural normal) for a seed (default 0.1) */
  seedDot?: number;
  /** Laplacian smoothing passes (default 6) */
  smooth?: number;
  /** leg-column band for the length fit, fraction of the height (default 0.18) */
  legBand?: number;
  /** 'legs' (default): the hull's length stretched so its leg columns land on the species' legs; 'uniform': one
   *  scale (the height), the legs' midpoints aligned — with `retarget`, the legs then move to the hull's instead */
  fit?: 'legs' | 'uniform' | 'box';
  /** slide each leg chain (x / z) onto the hull's leg; the rig then carries its own joints (default false) */
  retarget?: boolean;
  /** the length fit ignores the hull's ground vertices behind this z (the hull's own space: a tail trailing on the
   *  ground behind the hind legs) */
  fitZMin?: number;
  /** the leg segmentation cut, as a fraction of the procedural belly's lowest point (default 0.92) */
  legCut?: number;
  /** above the cut a leg's seed must lie within geoK × (height over the cut) + 5 % H of its leg piece (default 1.4) */
  geoK?: number;
  /** a hanging tail: every vertex with |x| < x and z < z (and y < y, default the belly) is tail, never leg */
  tail?: { x: number; z: number; y?: number };
  /** the tail's chain, root first: the tail box's vertices are weighted along it by surface distance from the body */
  tailBones?: readonly string[];
  /** a midline piece is a leg only if it reaches below groundK × the cut (default 0.3) */
  groundK?: number;
  /** 'rigid' (default): the whole leg turned as one onto the hull's leg; 'chain': each joint onto its curve segment */
  legUnpose?: 'chain' | 'rigid';
  /** 'curve' (default): a leg's weights by its position along its own curve; 'proc': from the posed procedural leg */
  legWeights?: 'curve' | 'proc';
  /** the four leg chains FL FR BL BR, top joint first (default the quadruped rig's shoulder / carpus / fetlock, hip /
   *  stifle / hock); the sheep flock's legs are one bone each */
  legs?: readonly (readonly string[])[];
  /** wing chains (a bird), shoulder first: each turned rigidly about its shoulder onto the hull's wing span */
  wings?: readonly (readonly string[])[];
  /** measure the stance and un-pose it (default true) */
  unpose?: boolean;
  /** the hull's head turn (radians, + = to the animal's left); default measured from the muzzle tip */
  headYaw?: number;
  /** second-chance seeds for the torso / neck / head / tail: radius as a fraction of the height (default 0.16) */
  bodySeedR?: number;
}

export interface RigBakeReport {
  verts: number; welded: number; flipped: number; seeded: number; flooded: number; unreached: number; yCut: number; tailVerts: number;
  fit: { sx: number; sy: number; sz: number; oz: number };
  /** per leg: the stance angle turned back (degrees) and the leg's vertex count */
  legs: Record<string, { deg: number; verts: number }>;
  headDeg: number; bodySeeded: number;
  pieces: string[];
}

const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

/**
 * leg-column centres (z) of the vertices in the bottom `frac` of the height: [front, back]. A leg is a vertical column,
 * so its band vertices pile up at one z: the two densest peaks of the z histogram (a quarter of the span apart) are the
 * front and back legs — a tail lying along the ground spreads over z and never makes a peak.
 */
function legColumns(pos: ArrayLike<number>, n: number, h: number, frac: number, zMin = -Infinity): [number, number] | null {
  const zs: number[] = [];
  for (let i = 0; i < n; i++) if (at(pos, i * 3 + 1) < h * frac && at(pos, i * 3 + 2) >= zMin) zs.push(at(pos, i * 3 + 2));
  if (zs.length < 8) return null;
  let lo = Infinity, hi = -Infinity;
  for (const z of zs) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
  const span = hi - lo;
  if (span <= 1e-6) return null;
  const NB = 48, hist = new Float64Array(NB);
  for (const z of zs) { const k = Math.min(NB - 1, Math.floor(((z - lo) / span) * NB)); hist[k] = at(hist, k) + 1; }
  const sm = hist.map((_, k) => at(hist, k - 1) * 0.5 + at(hist, k) + at(hist, k + 1) * 0.5);
  let p1 = 0;
  for (let k = 1; k < NB; k++) if (at(sm, k) > at(sm, p1)) p1 = k;
  let p2 = -1;
  for (let k = 0; k < NB; k++) if (Math.abs(k - p1) >= NB / 4 && (p2 < 0 || at(sm, k) > at(sm, p2))) p2 = k;
  if (p2 < 0) return null;
  const centre = (p: number): number => {
    let s2 = 0, c = 0;
    const zc = lo + ((p + 0.5) / NB) * span;
    for (const z of zs) if (Math.abs(z - zc) < span * 0.08) { s2 += z; c++; }
    return c > 0 ? s2 / c : zc;
  };
  const a = centre(p1), b = centre(p2);
  return a > b ? [a, b] : [b, a];
}

/** a binary min-heap of (key, id) */
class Heap {
  private k: number[] = []; private v: number[] = [];
  get size(): number { return this.k.length; }
  push(key: number, id: number): void {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(id);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (at(k, p) <= key) break;
      k[i] = at(k, p); v[i] = at(v, p); i = p;
    }
    k[i] = key; v[i] = id;
  }
  /** pops the smallest: [key, id] into `out` */
  pop(out: [number, number]): void {
    const k = this.k, v = this.v;
    out[0] = at(k, 0); out[1] = at(v, 0);
    const lk = k.pop() ?? 0, lv = v.pop() ?? 0;
    const n = k.length;
    if (n === 0) return;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i, mk = lk;
      if (l < n && at(k, l) < mk) { m = l; mk = at(k, l); }
      if (r < n && at(k, r) < mk) { m = r; mk = at(k, r); }
      if (m === i) break;
      k[i] = mk; v[i] = at(v, m); i = m;
    }
    k[i] = lk; v[i] = lv;
  }
}

/** the four leg chains of the quadruped rig: FL FR BL BR (index = quadrant: bit 0 = right, bit 1 = back) */
const LEGS: readonly (readonly string[])[] = [
  ['FL_shoulder', 'FL_carpus', 'FL_fetlock'], ['FR_shoulder', 'FR_carpus', 'FR_fetlock'],
  ['BL_hip', 'BL_stifle', 'BL_hock'], ['BR_hip', 'BR_stifle', 'BR_hock'],
];
const LEG_NAMES = ['FL', 'FR', 'BL', 'BR'] as const;

/** multi-source Dijkstra over the welded surface graph from `src` (dist 0) */
function surfaceDistance(nw: number, nOff: Int32Array, nIdx: Int32Array, WP: ArrayLike<number>, isSrc: (w: number) => boolean, blocked?: (w: number, u: number) => boolean): { d: Float64Array; from: Int32Array } {
  const d = new Float64Array(nw).fill(Infinity), from = new Int32Array(nw).fill(-1);
  const hp = new Heap();
  for (let w = 0; w < nw; w++) if (isSrc(w)) { d[w] = 0; from[w] = w; hp.push(0, w); }
  const tp: [number, number] = [0, 0];
  while (hp.size > 0) {
    hp.pop(tp);
    const dd = tp[0], w = tp[1];
    if (dd > at(d, w)) continue;
    for (let o = at(nOff, w); o < at(nOff, w + 1); o++) {
      const u = at(nIdx, o);
      if (blocked?.(w, u) === true) continue;
      const nd = dd + Math.hypot(at(WP, w * 3) - at(WP, u * 3), at(WP, w * 3 + 1) - at(WP, u * 3 + 1), at(WP, w * 3 + 2) - at(WP, u * 3 + 2));
      if (nd < at(d, u)) { d[u] = nd; from[u] = at(from, w); hp.push(nd, u); }
    }
  }
  return { d, from };
}

/**
 * Skin `hull` (position / normal / uv / index) to the skeleton `bones` whose procedural mesh is `proc` (position,
 * normal, skinIndex, skinWeight in the bind pose). Returns a new geometry: the hull fitted into animal space, in the
 * skeleton's rest pose, with skinIndex / skinWeight (indices into `bones`).
 */
export function bakeCreatureRig(proc: THREE.BufferGeometry, hull: THREE.BufferGeometry, bones: readonly BoneDef[], opts: RigBakeOptions = {}): { geometry: THREE.BufferGeometry; bones: BoneDef[]; report: RigBakeReport } {
  const seedR = opts.seedR ?? 0.05, seedDot = opts.seedDot ?? 0.1, passes = opts.smooth ?? 6, band = opts.legBand ?? 0.18, geoK = opts.geoK ?? 1.0;
  const nB = bones.length;
  const boneIdx = new Map(bones.map((b, i) => [b.name, i] as const));
  const pp = proc.getAttribute('position'), pn = proc.getAttribute('normal'), pi = proc.getAttribute('skinIndex'), pw = proc.getAttribute('skinWeight');
  const np = pp.count;
  const P = new Float32Array(np * 3), PN = new Float32Array(np * 3);
  for (let i = 0; i < np; i++) {
    P[i * 3] = pp.getX(i); P[i * 3 + 1] = pp.getY(i); P[i * 3 + 2] = pp.getZ(i);
    PN[i * 3] = pn.getX(i); PN[i * 3 + 1] = pn.getY(i); PN[i * 3 + 2] = pn.getZ(i);
  }

  // ── 1: fit ──
  const g = hull.clone();
  const G0 = g.getAttribute('position');
  const ng = G0.count;
  let hP = 0, hG = 0;
  for (let i = 0; i < np; i++) hP = Math.max(hP, at(P, i * 3 + 1));
  for (let i = 0; i < ng; i++) hG = Math.max(hG, G0.getY(i));
  let sy = hG > 0 ? hP / hG : 1;
  const G0a = new Float32Array(ng * 3);
  for (let i = 0; i < ng; i++) { G0a[i * 3] = G0.getX(i); G0a[i * 3 + 1] = G0.getY(i); G0a[i * 3 + 2] = G0.getZ(i); }
  const legsP = legColumns(P, np, hP, band), legsG = legColumns(G0a, ng, hG, band, opts.fitZMin);
  let sz = sy, oz = 0;
  if (legsP && legsG) {
    const spanG = legsG[0] - legsG[1], spanP = legsP[0] - legsP[1];
    if (opts.fit === 'uniform') oz = (legsP[0] + legsP[1]) / 2 - ((legsG[0] + legsG[1]) / 2) * sz;   // legs' midpoints meet
    else if (spanG > 1e-3 && spanP > 1e-3) { sz = spanP / spanG; oz = legsP[0] - legsG[0] * sz; }
  }
  let sx = (sy + sz) / 2, ox = 0, oy = 0;
  if (opts.fit === 'box') {
    // a bird / anything not standing on y = 0: one scale by the wingspan (x), the bounding boxes' centres meet
    const bp = new THREE.Box3(), bg = new THREE.Box3(), v = new THREE.Vector3();
    for (let i = 0; i < np; i++) bp.expandByPoint(v.set(at(P, i * 3), at(P, i * 3 + 1), at(P, i * 3 + 2)));
    for (let i = 0; i < ng; i++) bg.expandByPoint(v.set(at(G0a, i * 3), at(G0a, i * 3 + 1), at(G0a, i * 3 + 2)));
    const k = (bp.max.x - bp.min.x) / Math.max(1e-6, bg.max.x - bg.min.x);
    sx = sy = sz = k;
    const cp = bp.getCenter(new THREE.Vector3()), cg = bg.getCenter(new THREE.Vector3());
    ox = cp.x - cg.x * k; oy = cp.y - cg.y * k; oz = cp.z - cg.z * k;
  }
  g.scale(sx, sy, sz);
  g.translate(ox, oy, oz);
  g.computeVertexNormals();
  const H = opts.fit === 'box' ? Math.max(1e-3, (() => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < np; i++) { lo = Math.min(lo, at(P, i * 3)); hi = Math.max(hi, at(P, i * 3)); } return (hi - lo) * 0.4; })()) : hP;

  // ── weld (uv seams split the hull's vertices; the surface graph needs them joined) ──
  const gp = g.getAttribute('position'), gn = g.getAttribute('normal');
  const weldOf = new Int32Array(ng);
  const wmap = new Map<string, number>();
  const WPl: number[] = [], WNl: number[] = [];
  const q = 1e-5 * Math.max(1, H);
  for (let i = 0; i < ng; i++) {
    const k = `${Math.round(gp.getX(i) / q)},${Math.round(gp.getY(i) / q)},${Math.round(gp.getZ(i) / q)}`;
    let w = wmap.get(k);
    if (w === undefined) { w = WPl.length / 3; wmap.set(k, w); WPl.push(gp.getX(i), gp.getY(i), gp.getZ(i)); WNl.push(0, 0, 0); }
    weldOf[i] = w;
    WNl[w * 3] = at(WNl, w * 3) + gn.getX(i); WNl[w * 3 + 1] = at(WNl, w * 3 + 1) + gn.getY(i); WNl[w * 3 + 2] = at(WNl, w * 3 + 2) + gn.getZ(i);
  }
  const nw = WPl.length / 3;
  const WP = Float64Array.from(WPl), WN = Float64Array.from(WNl);
  for (let w = 0; w < nw; w++) {
    const l = Math.hypot(at(WN, w * 3), at(WN, w * 3 + 1), at(WN, w * 3 + 2)) || 1;
    WN[w * 3] = at(WN, w * 3) / l; WN[w * 3 + 1] = at(WN, w * 3 + 1) / l; WN[w * 3 + 2] = at(WN, w * 3 + 2) / l;
  }
  const idx = g.getIndex();
  const tri: number[] = idx ? Array.from(idx.array) : Array.from({ length: ng }, (_, i) => i);
  // one winding for the whole surface: an image-to-3D crust mixes flipped flakes in (culled, they read as holes and
  // shade dark). Across every manifold edge a neighbour must run the shared edge the other way; each connected
  // piece is then turned outward by its signed volume
  let flipped = 0;
  {
    const nt = Math.floor(tri.length / 3);
    const edgeTris = new Map<string, number[]>();
    const wv = (t: number, k: number): number => at(weldOf, at(tri, t * 3 + k));
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const a = wv(t, k), b = wv(t, (k + 1) % 3);
      if (a === b) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let l = edgeTris.get(key); if (!l) { l = []; edgeTris.set(key, l); } l.push(t);
    }
    const flip = new Uint8Array(nt), seen = new Uint8Array(nt);
    /** does triangle t (with its flip) run a → b? */
    const runs = (t: number, a: number, b: number): boolean => {
      for (let k = 0; k < 3; k++) if (wv(t, k) === a && wv(t, (k + 1) % 3) === b) return flip[t] === 0;
      return flip[t] === 1;
    };
    for (let t0 = 0; t0 < nt; t0++) {
      if (seen[t0] === 1) continue;
      const comp: number[] = [t0]; seen[t0] = 1;
      for (let h = 0; h < comp.length; h++) {
        const t = at(comp, h);
        for (let k = 0; k < 3; k++) {
          const a = wv(t, k), b = wv(t, (k + 1) % 3);
          if (a === b) continue;
          const l = edgeTris.get(a < b ? `${a},${b}` : `${b},${a}`);
          if (l?.length !== 2) continue;                          // open or non-manifold: no constraint
          const u = l[0] === t ? at(l, 1) : at(l, 0);
          if (seen[u] === 1) continue;
          const ab = runs(t, a, b) ? [a, b] : [b, a];             // t (as flipped) runs ab[0] → ab[1]
          if (runs(u, ab[0] ?? a, ab[1] ?? b)) flip[u] = 1;       // u must run it the other way
          seen[u] = 1; comp.push(u);
        }
      }
      let vol = 0;
      for (const t of comp) {
        let a = wv(t, 0), b = wv(t, 1);
        const c = wv(t, 2);
        if (flip[t] === 1) { const s2 = a; a = b; b = s2; }
        const ax = at(WPl, a * 3), ay = at(WPl, a * 3 + 1), az = at(WPl, a * 3 + 2), bx = at(WPl, b * 3), by = at(WPl, b * 3 + 1), bz = at(WPl, b * 3 + 2), cx = at(WPl, c * 3), cy = at(WPl, c * 3 + 1), cz = at(WPl, c * 3 + 2);
        vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
      }
      if (vol < 0) for (const t of comp) flip[t] = flip[t] === 1 ? 0 : 1;
    }
    for (let t = 0; t < nt; t++) if (flip[t] === 1) { const s2 = at(tri, t * 3 + 1); tri[t * 3 + 1] = at(tri, t * 3 + 2); tri[t * 3 + 2] = s2; flipped++; }
    if (flipped > 0 && idx) { g.setIndex(tri); g.computeVertexNormals(); }
    // the welded normals again, from the one winding
    WN.fill(0);
    const gn2 = g.getAttribute('normal');
    for (let i = 0; i < ng; i++) { const w = at(weldOf, i); WN[w * 3] = at(WN, w * 3) + gn2.getX(i); WN[w * 3 + 1] = at(WN, w * 3 + 1) + gn2.getY(i); WN[w * 3 + 2] = at(WN, w * 3 + 2) + gn2.getZ(i); }
    for (let w = 0; w < nw; w++) {
      const l = Math.hypot(at(WN, w * 3), at(WN, w * 3 + 1), at(WN, w * 3 + 2)) || 1;
      WN[w * 3] = at(WN, w * 3) / l; WN[w * 3 + 1] = at(WN, w * 3 + 1) / l; WN[w * 3 + 2] = at(WN, w * 3 + 2) / l;
    }
  }
  const nbrSets: Set<number>[] = Array.from({ length: nw }, () => new Set<number>());
  for (let t = 0; t + 2 < tri.length; t += 3) {
    const a = at(weldOf, at(tri, t)), b = at(weldOf, at(tri, t + 1)), c = at(weldOf, at(tri, t + 2));
    if (a !== b) { nbrSets[a]?.add(b); nbrSets[b]?.add(a); }
    if (b !== c) { nbrSets[b]?.add(c); nbrSets[c]?.add(b); }
    if (a !== c) { nbrSets[a]?.add(c); nbrSets[c]?.add(a); }
  }
  const nOff = new Int32Array(nw + 1);
  for (let w = 0; w < nw; w++) nOff[w + 1] = at(nOff, w) + (nbrSets[w]?.size ?? 0);
  const nIdx = new Int32Array(at(nOff, nw));
  for (let w = 0; w < nw; w++) { let o = at(nOff, w); for (const u of nbrSets[w] ?? []) nIdx[o++] = u; }

  // ── 2: legs ──
  const legIds = (opts.legs ?? LEGS).map((chain) => chain.map((n) => boneIdx.get(n)).filter((i): i is number => i !== undefined));
  /** 0..3 = the leg chain holding ≥ 50 % of procedural vertex i, −1 none */
  const procChain = new Int8Array(np).fill(-1);
  const torso = new Set([boneIdx.get('body'), boneIdx.get('belly')].filter((i): i is number => i !== undefined));
  let belly = Infinity;
  for (let i = 0; i < np; i++) {
    let tw = 0;
    for (let c = 0; c < 4; c++) if (torso.has(pi.getComponent(i, c))) tw += pw.getComponent(i, c);
    if (tw >= 0.5) belly = Math.min(belly, at(P, i * 3 + 1));
    for (let L = 0; L < 4; L++) {
      let lw = 0;
      for (let c = 0; c < 4; c++) if ((legIds[L] ?? []).includes(pi.getComponent(i, c))) lw += pw.getComponent(i, c);
      if (lw >= 0.5) { procChain[i] = L; break; }
    }
  }
  const yCut = Number.isFinite(belly) ? belly * (opts.legCut ?? 0.92) : H * 0.4;
  const zMid = legsP ? (legsP[0] + legsP[1]) / 2 : 0;
  const tail = opts.tail;
  const inTail = (w: number): boolean => tail !== undefined && Math.abs(at(WP, w * 3)) < tail.x && at(WP, w * 3 + 2) < tail.z && at(WP, w * 3 + 1) < (tail.y ?? belly);
  /** per welded vertex: 0..3 leg, 4 = tail, 5 = the rest (above the cut) */
  const part = new Uint8Array(nw).fill(5);
  let tailVerts = 0;
  for (let w = 0; w < nw; w++) if (inTail(w)) { part[w] = 4; tailVerts++; }
  const comp = new Int32Array(nw).fill(-1);
  const pieces: string[] = [];
  const quad = (w: number): number => (at(WP, w * 3) < 0 ? 1 : 0) + (at(WP, w * 3 + 2) < zMid ? 2 : 0);
  let nPieces = 0;
  const grounded = new Map<number, boolean>();
  let sxm = 0, nxm = 0;   // the procedural legs' mean |x| below the cut
  for (let i = 0; i < np; i++) if (at(procChain, i) >= 0 && at(P, i * 3 + 1) < yCut) { sxm += Math.abs(at(P, i * 3)); nxm++; }
  const halfSpread = nxm > 0 ? sxm / nxm : H * 0.1;
  const noLegs = legIds.every((l) => l.length === 0);   // a bird: nothing below the belly is a leg piece
  for (let w0 = 0; w0 < nw; w0++) {
    if (noLegs || at(WP, w0 * 3 + 1) >= yCut || at(comp, w0) >= 0 || part[w0] === 4) continue;
    const id = nPieces++;
    const list = [w0]; comp[w0] = id;
    for (let h = 0; h < list.length; h++) {
      const w = at(list, h);
      for (let o = at(nOff, w); o < at(nOff, w + 1); o++) {
        const u = at(nIdx, o);
        if (at(comp, u) < 0 && part[u] !== 4 && at(WP, u * 3 + 1) < yCut) { comp[u] = id; list.push(u); }
      }
    }
    // a piece that doesn't reach the ground AND hangs on the midline (a chest ruff, a hanging belly) is no leg: it is
    // weighted like the body over it. Off the midline it is a leg's (a thigh sagging under the cut)
    let yMin = Infinity, cxm = 0;
    for (const w of list) { yMin = Math.min(yMin, at(WP, w * 3 + 1)); cxm += at(WP, w * 3); }
    cxm /= list.length;
    grounded.set(id, yMin <= yCut * (opts.groundK ?? 0.3));
    if (yMin > yCut * (opts.groundK ?? 0.3) && Math.abs(cxm) < halfSpread * 0.35) { if (list.length >= 20) pieces.push(`${list.length} midline`); continue; }
    const cnt = [0, 0, 0, 0];
    for (const w of list) { const qd = quad(w); cnt[qd] = at(cnt, qd) + 1; }
    const dom = cnt.indexOf(Math.max(...cnt));
    const whole = at(cnt, dom) >= list.length * 0.75;
    for (const w of list) part[w] = whole ? dom : quad(w);
    let czm = 0; for (const w of list) czm += at(WP, w * 3 + 2);
    if (list.length >= 20) pieces.push(`${list.length}@${cxm.toFixed(2)},${(czm / list.length).toFixed(2)}${whole ? `→${LEG_NAMES[dom] ?? '?'}` : ' split'}`);
  }

  // how far each hull vertex is from each leg piece ALONG THE SURFACE
  const legGeo0 = [0, 1, 2, 3].map((L) => surfaceDistance(nw, nOff, nIdx, WP, (w) => part[w] === L).d);

  // ── 3: pose ──
  const unpose = opts.unpose ?? true;
  // the head: a hull caught with its head turned (the muzzle off the midline) has it turned back geometrically — a
  // rigid turn about 'neck1' for the head, fading out down the neck (by reach along the head's direction), before
  // anything is matched, so the head seeds from the procedural head
  const neckB = boneIdx.get('neck1');
  let headYaw = 0;
  if (unpose && neckB !== undefined) {
    const pv = bones[neckB]?.pos ?? [0, 0, 0];
    const hb = bones[boneIdx.get('head') ?? neckB]?.pos ?? pv;
    // the muzzle: the head-height vertices (below the ears) that reach furthest from 'neck1' horizontally
    const tipOf = (pos: ArrayLike<number>, n: number): number | null => {
      const cand: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const y = at(pos, i * 3 + 1), dz = at(pos, i * 3 + 2) - pv[2], dx = at(pos, i * 3) - pv[0];
        if (y < hb[1] - H * 0.15 || y > hb[1] + H * 0.04 || dz < -H * 0.05) continue;
        cand.push([Math.hypot(dx, dz), i]);
      }
      if (cand.length < 5) return null;
      cand.sort((p, q2) => q2[0] - p[0]);
      let tx = 0, tz = 0;
      const k = Math.max(3, Math.round(cand.length * 0.02));
      for (let j = 0; j < k; j++) { const i = cand[j]?.[1] ?? 0; tx += at(pos, i * 3) - pv[0]; tz += at(pos, i * 3 + 2) - pv[2]; }
      return Math.atan2(tx, tz);
    };
    const yG = tipOf(WP, nw), yP = tipOf(P, np);
    headYaw = opts.headYaw ?? (yG !== null && yP !== null ? yG - yP : 0);
    if (Math.abs(headYaw) > 0.03) {
      const reach = Math.hypot(hb[0] - pv[0], hb[2] - pv[2]) + H * 0.05;
      const dx0 = Math.sin(yG ?? headYaw), dz0 = Math.cos(yG ?? headYaw);
      for (let w = 0; w < nw; w++) {
        const y = at(WP, w * 3 + 1);
        if (y < pv[1] - H * 0.2) continue;
        const rx = at(WP, w * 3) - pv[0], rz = at(WP, w * 3 + 2) - pv[2];
        const along = rx * dx0 + rz * dz0;                           // reach toward the (turned) head
        // the whole head turns (both ears, the far cheek): by horizontal reach from the pivot, in its front half
        const f = THREE.MathUtils.smoothstep(Math.hypot(rx, rz), reach * 0.3, reach * 0.75) * THREE.MathUtils.smoothstep(along, -H * 0.08, H * 0.02)
          * THREE.MathUtils.smoothstep(y, pv[1] - H * 0.2, pv[1] - H * 0.05);
        if (f <= 0) continue;
        const a = -headYaw * f, c = Math.cos(a), s2 = Math.sin(a);
        WP[w * 3] = pv[0] + rx * c + rz * s2; WP[w * 3 + 2] = pv[2] - rx * s2 + rz * c;
        const nx = at(WN, w * 3), nz = at(WN, w * 3 + 2);
        WN[w * 3] = nx * c + nz * s2; WN[w * 3 + 2] = -nx * s2 + nz * c;
      }
    }
  }

  // the legs: each hull leg's centre curve (band centroids by surface distance from the top of its piece, so a folded
  // leg is followed round its bend) gives three segment directions — upper, cannon, pastern / paw — at the same arc
  // fractions as the procedural chain's joints; the chain is turned joint by joint onto them (world rotations Q0..Q2)
  const boneQ: (THREE.Quaternion | null)[] = Array.from({ length: nB }, () => null);
  const boneRest: THREE.Vector3[] = bones.map((b) => new THREE.Vector3(...b.pos));
  const bonePosed: THREE.Vector3[] = bones.map((b) => new THREE.Vector3(...b.pos));
  /** the skeleton the hull is bound to: the species' bones, a retargeted leg slid (x / z) onto the hull's leg */
  const boneBind: THREE.Vector3[] = bones.map((b) => new THREE.Vector3(...b.pos));
  const legs: RigBakeReport['legs'] = {};
  /** per leg, the curve parameter of its vertices: surface distance from the top of the piece (∞ = unreached), the
   *  arc fractions of the joints below the cut and the bones they start — the leg's weights come from these */
  const legCurve: ({ gd: Float64Array; tMax: number; uAt: number[]; bonesBelow: number[] } | null)[] = [null, null, null, null];
  const BANDS = 10;
  for (let L = 0; L < 4; L++) {
    const ids = legIds[L] ?? [];
    const name = LEG_NAMES[L] ?? `${L}`;
    let vc = 0; for (let w = 0; w < nw; w++) if (part[w] === L) vc++;
    legs[name] = { deg: 0, verts: vc };
    if (!unpose || ids.length === 0 || vc < 12) continue;
    const Js = ids.map((b) => boneRest[b] ?? new THREE.Vector3());
    const J0 = Js[0] ?? new THREE.Vector3();
    // the hull curve
    // the leg's main piece (specks and stray bits of the same quadrant would bend the curve)
    const compCount = new Map<number, number>();
    for (let w = 0; w < nw; w++) if (part[w] === L && grounded.get(at(comp, w)) === true) compCount.set(at(comp, w), (compCount.get(at(comp, w)) ?? 0) + 1);
    let mainComp = -1, mainN = 0;
    for (const [c, n] of compCount) if (n > mainN) { mainN = n; mainComp = c; }
    const main = (w: number): boolean => part[w] === L && at(comp, w) === mainComp;
    // the curve runs from the main piece's top through the whole leg — a folded leg's paw, cut off as its own piece,
    // is reached round the fold (the surface just above the cut, near the leg)
    const inLeg = (w: number): boolean => part[w] === L || (part[w] === 5 && at(WP, w * 3 + 1) < yCut * 1.6 && at(legGeo0[L] ?? [], w) < H * 0.12);
    const top = (w: number): boolean => main(w) && at(WP, w * 3 + 1) > yCut * 0.85;
    const gd = new Float64Array(nw).fill(Infinity);
    {
      const hp = new Heap(); const tp: [number, number] = [0, 0];
      for (let w = 0; w < nw; w++) if (top(w)) { gd[w] = 0; hp.push(0, w); }
      while (hp.size > 0) {
        hp.pop(tp);
        const dd = tp[0], w = tp[1];
        if (dd > at(gd, w)) continue;
        for (let o = at(nOff, w); o < at(nOff, w + 1); o++) {
          const u = at(nIdx, o);
          if (!inLeg(u)) continue;
          const nd = dd + Math.hypot(at(WP, w * 3) - at(WP, u * 3), at(WP, w * 3 + 1) - at(WP, u * 3 + 1), at(WP, w * 3 + 2) - at(WP, u * 3 + 2));
          if (nd < at(gd, u)) { gd[u] = nd; hp.push(nd, u); }
        }
      }
    }
    let tMax = 0;
    for (let w = 0; w < nw; w++) if (part[w] === L && Number.isFinite(at(gd, w))) tMax = Math.max(tMax, at(gd, w));
    if (tMax <= 0) continue;
    const bandC = Array.from({ length: BANDS }, () => new THREE.Vector4());
    for (let w = 0; w < nw; w++) {
      if (part[w] !== L) continue;
      const t = at(gd, w);
      if (!Number.isFinite(t)) continue;
      const k = Math.min(BANDS - 1, Math.floor((t / tMax) * BANDS));
      const c = bandC[k];
      if (c) { c.x += at(WP, w * 3); c.y += at(WP, w * 3 + 1); c.z += at(WP, w * 3 + 2); c.w += 1; }
    }
    const curve: THREE.Vector3[] = [];
    for (const c of bandC) if (c.w > 0) curve.push(new THREE.Vector3(c.x / c.w, c.y / c.w, c.z / c.w));
    if (curve.length < 4) continue;
    const curveAt = (u: number): THREE.Vector3 => {
      const f = Math.min(curve.length - 1.0001, Math.max(0, u * (curve.length - 1)));
      const i = Math.floor(f);
      const a = curve[i] ?? new THREE.Vector3(), b = curve[i + 1] ?? a;
      return a.clone().lerp(b, f - i);
    };
    // the procedural chain J0 → … → Jn → the ground under Jn, cut where the hull's pieces start (yCut): the joints
    // below the cut sit at the same arc fractions on the hull's curve. A bone whose segment is wholly above the cut
    // keeps the rest pose; 'rigid' turns the leg below the cut as one onto the curve; 'chain' turns each segment onto
    // its stretch of the curve, the last (the pastern / paw) following the one above it
    const N = Js.length, Jn = Js[N - 1] ?? J0;
    const pts = [...Js, new THREE.Vector3(Jn.x, 0, Jn.z)];
    let kc = -1;
    for (let k = 0; k < N; k++) if ((pts[k]?.y ?? 0) >= yCut && (pts[k + 1]?.y ?? 0) < yCut) { kc = k; break; }
    if (kc < 0 || (N > 1 && kc > N - 2)) continue;
    const pa = pts[kc] ?? J0, pb = pts[kc + 1] ?? J0;
    const C0 = pa.clone().lerp(pb, (pa.y - yCut) / Math.max(1e-6, pa.y - pb.y));
    // retarget: the whole chain slid (x / z) so it stands in the hull's leg — for a hull whose legs sit elsewhere than
    // the species' (a shorter back); the rig carries the moved joints
    const c0 = curveAt(0);
    const shift = opts.retarget === true ? new THREE.Vector3(c0.x - C0.x, 0, c0.z - C0.z) : new THREE.Vector3();
    const lens = [C0.distanceTo(pb)];
    for (let k = kc + 1; k < N; k++) lens.push((pts[k] ?? J0).distanceTo(pts[k + 1] ?? J0));
    const lt = lens.reduce((s3, x) => s3 + x, 0);
    if (lt <= 0) continue;
    const uAt: number[] = [0];                                   // arc fraction at C0, then at each joint below it
    for (const l of lens) uAt.push((uAt[uAt.length - 1] ?? 0) + l / lt);
    const Qs: THREE.Quaternion[] = Js.map(() => new THREE.Quaternion());
    let acc = new THREE.Quaternion();
    for (let k = kc; k < N; k++) {
      const j = k - kc;
      const d = (pts[k + 1] ?? J0).clone().sub(pts[k] ?? J0);
      if (opts.legUnpose !== 'chain') {
        // the whole leg turned as one, from the cut to the hoof
        if (k === kc) {
          const e = curveAt(1).sub(curveAt(0)), dd = new THREE.Vector3(Jn.x, 0, Jn.z).sub(C0);
          if (e.lengthSq() > 1e-8 && dd.lengthSq() > 1e-8) acc = new THREE.Quaternion().setFromUnitVectors(dd.normalize(), e.normalize());
        }
      } else if (k < N - 1 || N === 1) {
        const e = curveAt(uAt[j + 1] ?? 1).sub(curveAt(uAt[j] ?? 0));
        if (e.lengthSq() > 1e-8 && d.lengthSq() > 1e-8) acc = new THREE.Quaternion().setFromUnitVectors(d.clone().applyQuaternion(acc).normalize(), e.normalize()).multiply(acc);
      }
      Qs[k] = acc.clone();
    }
    let Pk = J0.clone().add(shift);
    ids.forEach((b, k) => {
      boneQ[b] = Qs[k] ?? null;
      boneBind[b]?.copy(Js[k] ?? J0).add(shift);
      if (k === 0) bonePosed[b]?.copy(Pk);
      if (k > 0) { Pk = Pk.clone().add((Js[k] ?? J0).clone().sub(Js[k - 1] ?? J0).applyQuaternion(Qs[k - 1] ?? new THREE.Quaternion())); bonePosed[b]?.copy(Pk); }
    });
    legCurve[L] = { gd, tMax, uAt, bonesBelow: ids.slice(kc) };
    const ang = (qq: THREE.Quaternion): number => (2 * Math.acos(Math.min(1, Math.abs(qq.w))) * 180) / Math.PI;
    legs[name] = { deg: Math.round(Math.max(...Qs.map(ang)) * 10) / 10, verts: vc };
  }
  // the wings (a bird): each wing's span — shoulder to the centroid of its outer half — measured on both meshes; the
  // chain turned rigidly about the shoulder onto the hull's (a hull caught with its wings raised is flattened back)
  for (const chain of opts.wings ?? []) {
    const ids = chain.map((n) => boneIdx.get(n)).filter((i): i is number => i !== undefined);
    const sh = boneRest[ids[0] ?? -1];
    if (!unpose || ids.length === 0 || !sh) continue;
    const side = Math.sign(sh.x) || 1;
    const outer = (pos: ArrayLike<number>, n: number, ok: (i: number) => boolean): THREE.Vector3 | null => {
      let reach = 0;
      for (let i = 0; i < n; i++) if (ok(i)) reach = Math.max(reach, (at(pos, i * 3) - sh.x) * side);
      const c = new THREE.Vector3(); let k = 0;
      for (let i = 0; i < n; i++) if (ok(i) && (at(pos, i * 3) - sh.x) * side > reach * 0.5) { c.x += at(pos, i * 3); c.y += at(pos, i * 3 + 1); c.z += at(pos, i * 3 + 2); k++; }
      return k > 3 ? c.divideScalar(k).sub(sh).normalize() : null;
    };
    const dP = outer(P, np, (i) => { let wt = 0; for (let c = 0; c < 4; c++) if (ids.includes(pi.getComponent(i, c))) wt += pw.getComponent(i, c); return wt >= 0.5; });
    const dG = outer(WP, nw, (w) => (at(WP, w * 3) - sh.x) * side > 0);
    if (!dP || !dG) continue;
    const qW = new THREE.Quaternion().setFromUnitVectors(dP, dG);
    for (const b of ids) { boneQ[b] = qW.clone(); bonePosed[b]?.copy((boneRest[b] ?? sh).clone().sub(sh).applyQuaternion(qW).add(sh)); }
    legs[chain[0] ?? 'wing'] = { deg: Math.round((2 * Math.acos(Math.min(1, Math.abs(qW.w))) * 1800) / Math.PI) / 10, verts: 0 };
  }
  const _q = new THREE.Quaternion(), _o = new THREE.Vector3(), _acc = new THREE.Vector3(), _nacc = new THREE.Vector3();
  /** bone b's stance transform (the species' rest → the hull's stance): posed_b + Q_b (v − rest_b); the inverse goes
   *  to the bind skeleton (bind_b + Q_b⁻¹ (v − posed_b)); identity for the bones the hull doesn't move */
  const stance = (b: number, x: number, y: number, z: number, out: THREE.Vector3, inverse: boolean, dir = false): THREE.Vector3 => {
    out.set(x, y, z);
    const qb = boneQ[b], r = boneRest[b], p = bonePosed[b], rb = boneBind[b];
    if (!qb || !r || !p || !rb) return out;
    if (inverse) {
      if (!dir) out.sub(p);
      out.applyQuaternion(_q.copy(qb).invert());
      if (!dir) out.add(rb);
    } else {
      if (!dir) out.sub(r);
      out.applyQuaternion(qb);
      if (!dir) out.add(p);
    }
    return out;
  };

  // the posed procedural mesh (positions + normals), by its own weights
  const PP = new Float64Array(np * 3), PPN = new Float64Array(np * 3);
  for (let i = 0; i < np; i++) {
    _acc.set(0, 0, 0); _nacc.set(0, 0, 0);
    for (let c = 0; c < 4; c++) {
      const bw = pw.getComponent(i, c);
      if (bw <= 0) continue;
      const b = pi.getComponent(i, c);
      _acc.addScaledVector(stance(b, at(P, i * 3), at(P, i * 3 + 1), at(P, i * 3 + 2), _o, false), bw);
      _nacc.addScaledVector(stance(b, at(PN, i * 3), at(PN, i * 3 + 1), at(PN, i * 3 + 2), _o, false, true), bw);
    }
    _nacc.normalize();
    PP[i * 3] = _acc.x; PP[i * 3 + 1] = _acc.y; PP[i * 3 + 2] = _acc.z;
    PPN[i * 3] = _nacc.x; PPN[i * 3 + 1] = _nacc.y; PPN[i * 3 + 2] = _nacc.z;
  }

  // ── 4: seeds ──
  // above the cut a leg's weights are only taken near that leg's piece along the surface (≈ straight up the leg):
  // a tail hanging beside a thigh, the belly between the legs, never take a leg's weights
  const legGeo = legGeo0;
  const cell = Math.max(0.02, H * 0.04);
  const grid = new Map<string, number[]>();
  for (let i = 0; i < np; i++) {
    const k = `${Math.floor(at(PP, i * 3) / cell)},${Math.floor(at(PP, i * 3 + 1) / cell)},${Math.floor(at(PP, i * 3 + 2) / cell)}`;
    let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(i);
  }
  const W = new Float32Array(nw * nB);        // dense weights per welded vertex
  const seeded = new Uint8Array(nw);
  const R = seedR * H, R2 = R * R;
  const reach = Math.ceil(R / cell);
  const K = 5;
  const bi = new Int32Array(K), bd = new Float64Array(K);
  let nSeeded = 0;
  // the tail box: weighted along the tail by surface distance from where it leaves the body (tailBones, root first)
  const tailIds = (opts.tailBones ?? []).map((n) => boneIdx.get(n)).filter((i): i is number => i !== undefined);
  let tailGd: Float64Array | null = null, tailMax = 0;
  if (tailIds.length > 0) {
    const edge = (w: number): boolean => { if (part[w] !== 4) return false; for (let o = at(nOff, w); o < at(nOff, w + 1); o++) if (part[at(nIdx, o)] !== 4) return true; return false; };
    tailGd = surfaceDistance(nw, nOff, nIdx, WP, edge, (w, u) => part[w] !== 4 || part[u] !== 4).d;
    for (let w = 0; w < nw; w++) if (part[w] === 4 && Number.isFinite(at(tailGd, w))) tailMax = Math.max(tailMax, at(tailGd, w));
  }
  for (let w = 0; w < nw; w++) {
    const x = at(WP, w * 3), y = at(WP, w * 3 + 1), z = at(WP, w * 3 + 2);
    if (tailGd && tailMax > 0 && part[w] === 4 && Number.isFinite(at(tailGd, w))) {
      const u = at(tailGd, w) / tailMax, n = tailIds.length, f = Math.min(n - 1, u * n);
      const j = Math.floor(f), k = f - j;
      const b0 = at(tailIds, j), b1 = at(tailIds, Math.min(n - 1, j + 1));
      // the first stretch still leans on the body (it grows out of the rump)
      const wb = (1 - Math.min(1, u * 4)) * 0.5;
      W[w * nB + b0] = at(W, w * nB + b0) + (1 - k) * (1 - wb);
      W[w * nB + b1] = at(W, w * nB + b1) + k * (1 - wb);
      W[w * nB + (boneIdx.get('body') ?? 0)] = at(W, w * nB + (boneIdx.get('body') ?? 0)) + wb;
      seeded[w] = 1; nSeeded++;
      continue;
    }
    const nx = at(WN, w * 3), ny = at(WN, w * 3 + 1), nz = at(WN, w * 3 + 2);
    const pt = at(part, w);
    // a leg: weighted by where it is along its own curve (the segment's bone, blended across each joint) — the leg's
    // shape decides, not how well the procedural leg overlays it
    const lc = pt < 4 && opts.legWeights !== 'proc' ? legCurve[pt] : null;
    if (lc && Number.isFinite(at(lc.gd, w))) {
      const u = at(lc.gd, w) / lc.tMax, bl = lc.bonesBelow, beta = 0.06;
      for (let j = 0; j < bl.length; j++) {
        const a = j === 0 ? -1 : at(lc.uAt, j), b = j === bl.length - 1 ? 2 : at(lc.uAt, j + 1);
        const wj = THREE.MathUtils.smoothstep(u, a - beta, a + beta) * (1 - THREE.MathUtils.smoothstep(u, b - beta, b + beta));
        if (wj > 0) W[w * nB + at(bl, j)] = at(W, w * nB + at(bl, j)) + wj;
      }
      let tot = 0; for (let b = 0; b < nB; b++) tot += at(W, w * nB + b);
      if (tot > 0) { for (let b = 0; b < nB; b++) W[w * nB + b] = at(W, w * nB + b) / tot; seeded[w] = 1; nSeeded++; continue; }
    }
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    bi.fill(-1); bd.fill(Infinity);
    for (let a = cx - reach; a <= cx + reach; a++) for (let b = cy - reach; b <= cy + reach; b++) for (let c = cz - reach; c <= cz + reach; c++) {
      const l = grid.get(`${a},${b},${c}`);
      if (!l) continue;
      for (const i of l) {
        const d = (at(PP, i * 3) - x) ** 2 + (at(PP, i * 3 + 1) - y) ** 2 + (at(PP, i * 3 + 2) - z) ** 2;
        if (d > R2 || d >= at(bd, K - 1)) continue;
        if (at(PPN, i * 3) * nx + at(PPN, i * 3 + 1) * ny + at(PPN, i * 3 + 2) * nz < seedDot) continue;
        const ch = at(procChain, i);
        if (pt < 4 ? ch >= 0 && ch !== pt : pt === 4 ? ch >= 0 : ch >= 0 && at(legGeo[ch] ?? [], w) > Math.max(0, y - yCut) * geoK + H * 0.05) continue;
        let j = K - 1;
        while (j > 0 && at(bd, j - 1) > d) { bd[j] = at(bd, j - 1); bi[j] = at(bi, j - 1); j--; }
        bd[j] = d; bi[j] = i;
      }
    }
    if (at(bi, 0) < 0) continue;
    let tot = 0;
    for (let j = 0; j < K; j++) {
      const i = at(bi, j);
      if (i < 0) continue;
      const k = 1 / (at(bd, j) + (H * 0.01) ** 2);
      for (let c = 0; c < 4; c++) {
        const bw = pw.getComponent(i, c);
        if (bw <= 0) continue;
        const b = pi.getComponent(i, c);
        W[w * nB + b] = at(W, w * nB + b) + bw * k;
        tot += bw * k;
      }
    }
    if (tot <= 0) continue;
    for (let b = 0; b < nB; b++) W[w * nB + b] = at(W, w * nB + b) / tot;
    seeded[w] = 1; nSeeded++;
  }

  // second chance, the torso / neck / head / tail only: a hull bulkier than the procedural mesh (a thick coat, a deeper
  // chest) sits further off its surface — the nearest non-leg procedural vertex within bodySeedR, normals agreeing
  const R2b = ((opts.bodySeedR ?? 0.16) * H) ** 2, reachB = Math.ceil(Math.sqrt(R2b) / cell);
  let bodySeeded = 0;
  for (let w = 0; w < nw; w++) {
    if (seeded[w] === 1 || at(part, w) < 4) continue;
    const x = at(WP, w * 3), y = at(WP, w * 3 + 1), z = at(WP, w * 3 + 2);
    const nx = at(WN, w * 3), ny = at(WN, w * 3 + 1), nz = at(WN, w * 3 + 2);
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let best = -1, bestD = R2b;
    for (let a = cx - reachB; a <= cx + reachB; a++) for (let b = cy - reachB; b <= cy + reachB; b++) for (let c = cz - reachB; c <= cz + reachB; c++) {
      const l = grid.get(`${a},${b},${c}`);
      if (!l) continue;
      for (const i of l) {
        if (at(procChain, i) >= 0) continue;
        const d = (at(PP, i * 3) - x) ** 2 + (at(PP, i * 3 + 1) - y) ** 2 + (at(PP, i * 3 + 2) - z) ** 2;
        if (d >= bestD) continue;
        if (at(PPN, i * 3) * nx + at(PPN, i * 3 + 1) * ny + at(PPN, i * 3 + 2) * nz < 0.4) continue;
        best = i; bestD = d;
      }
    }
    if (best < 0) continue;
    let tot = 0;
    for (let c = 0; c < 4; c++) { const bw = pw.getComponent(best, c); if (bw <= 0) continue; const b = pi.getComponent(best, c); W[w * nB + b] = at(W, w * nB + b) + bw; tot += bw; }
    if (tot <= 0) continue;
    for (let b = 0; b < nB; b++) W[w * nB + b] = at(W, w * nB + b) / tot;
    seeded[w] = 1; bodySeeded++;
  }

  // ── 5: flood — the rest take their nearest seed's weights, measured along the surface ──
  // a tail and a leg touching (a tail hanging onto a hock, curled round a paw) are cut apart: no flood, no smoothing
  // across a tail–leg edge
  const barrier = (w: number, u: number): boolean => { const a = at(part, w), b = at(part, u); return (a === 4 && b < 4) || (b === 4 && a < 4); };
  const fl = surfaceDistance(nw, nOff, nIdx, WP, (w) => seeded[w] === 1, barrier);
  let flooded = 0, unreached = 0;
  const bodyB = boneIdx.get('body') ?? 0;
  for (let w = 0; w < nw; w++) {
    if (seeded[w] === 1) continue;
    const s = at(fl.from, w);
    if (s < 0) { W[w * nB + bodyB] = 1; unreached++; continue; }   // an island no seed reaches: the body
    for (let b = 0; b < nB; b++) W[w * nB + b] = at(W, s * nB + b);
    flooded++;
  }

  // ── 6: smooth — Laplacian passes over the surface (seeds move less) ──
  const tmp = new Float32Array(nB);
  for (let p = 0; p < passes; p++) {
    for (let w = 0; w < nw; w++) {
      const o0 = at(nOff, w), o1 = at(nOff, w + 1);
      if (o1 === o0) continue;
      tmp.fill(0);
      let cnt = 0;
      for (let o = o0; o < o1; o++) { const u = at(nIdx, o); if (barrier(w, u)) continue; cnt++; for (let b = 0; b < nB; b++) tmp[b] = at(tmp, b) + at(W, u * nB + b); }
      if (cnt === 0) continue;
      const k = seeded[w] === 1 ? 0.35 : 0.8, inv = 1 / cnt;
      for (let b = 0; b < nB; b++) W[w * nB + b] = at(W, w * nB + b) * (1 - k) + at(tmp, b) * inv * k;
    }
  }

  // ── 7: unpose — the hull skinned from its stance back to the rest pose with its new weights ──
  if (unpose) {
    for (let w = 0; w < nw; w++) {
      _acc.set(0, 0, 0);
      let tot = 0;
      for (let b = 0; b < nB; b++) {
        const bw = at(W, w * nB + b);
        if (bw <= 1e-5) continue;
        _acc.addScaledVector(stance(b, at(WP, w * 3), at(WP, w * 3 + 1), at(WP, w * 3 + 2), _o, true), bw);
        tot += bw;
      }
      if (tot > 0) { WP[w * 3] = _acc.x / tot; WP[w * 3 + 1] = _acc.y / tot; WP[w * 3 + 2] = _acc.z / tot; }
    }
  }

  // ── 8: normals over the welded surface, then per (unwelded) vertex: top 4 influences, normalised ──
  WN.fill(0);
  for (let t = 0; t + 2 < tri.length; t += 3) {
    const a = at(weldOf, at(tri, t)), b = at(weldOf, at(tri, t + 1)), c = at(weldOf, at(tri, t + 2));
    const ux = at(WP, b * 3) - at(WP, a * 3), uy = at(WP, b * 3 + 1) - at(WP, a * 3 + 1), uz = at(WP, b * 3 + 2) - at(WP, a * 3 + 2);
    const vx = at(WP, c * 3) - at(WP, a * 3), vy = at(WP, c * 3 + 1) - at(WP, a * 3 + 1), vz = at(WP, c * 3 + 2) - at(WP, a * 3 + 2);
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;   // area-weighted
    for (const v of [a, b, c]) { WN[v * 3] = at(WN, v * 3) + fx; WN[v * 3 + 1] = at(WN, v * 3 + 1) + fy; WN[v * 3 + 2] = at(WN, v * 3 + 2) + fz; }
  }
  const skinIndex = new Uint16Array(ng * 4), skinWeight = new Float32Array(ng * 4);
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
  const order: number[] = [];
  for (let i = 0; i < ng; i++) {
    const w = at(weldOf, i);
    pos.setXYZ(i, at(WP, w * 3), at(WP, w * 3 + 1), at(WP, w * 3 + 2));
    const nl = Math.hypot(at(WN, w * 3), at(WN, w * 3 + 1), at(WN, w * 3 + 2)) || 1;
    nrm.setXYZ(i, at(WN, w * 3) / nl, at(WN, w * 3 + 1) / nl, at(WN, w * 3 + 2) / nl);
    order.length = 0;
    for (let b = 0; b < nB; b++) if (at(W, w * nB + b) > 1e-4) order.push(b);
    order.sort((a, b) => at(W, w * nB + b) - at(W, w * nB + a));
    let sum = 0;
    for (let c = 0; c < 4 && c < order.length; c++) sum += at(W, w * nB + at(order, c));
    if (sum <= 0) { skinIndex[i * 4] = bodyB; skinWeight[i * 4] = 1; continue; }
    for (let c = 0; c < 4 && c < order.length; c++) { const b = at(order, c); skinIndex[i * 4 + c] = b; skinWeight[i * 4 + c] = at(W, w * nB + b) / sum; }
  }
  pos.needsUpdate = true; nrm.needsUpdate = true;
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return {
    geometry: g,
    bones: bones.map((b, i) => ({ name: b.name, parent: b.parent, pos: [boneBind[i]?.x ?? b.pos[0], boneBind[i]?.y ?? b.pos[1], boneBind[i]?.z ?? b.pos[2]] })),
    report: { verts: ng, welded: nw, flipped, seeded: nSeeded, flooded, unreached, yCut, tailVerts, fit: { sx, sy, sz, oz }, legs, pieces, headDeg: Math.round(headYaw * 1800 / Math.PI) / 10, bodySeeded },
  };
}
