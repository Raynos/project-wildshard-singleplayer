/**
 * rockKit — candidate rock looks for Driftwood Isle (E114). The user, on the wreck and on Explore's Boulder: "Most low
 * poly rocks look like shit … way too basic. We need to try something else." The current rock (a randomly jittered
 * icosahedron: 20–80 small random facets, a green cap) reads as crumpled paper under the toon ramp, because every facet
 * lands on a random side of the two-band terminator. Three directions were built for the user to pick from; they
 * picked B (2026-09-25), so B is the default. `?rocks=now` (or `v1`) is the old look, `?rocks=a|c` the other candidates:
 *
 *   ?rocks=a   CHISELLED — a carved block: a convex polytope cut by ~24 big planes, its corners chipped, 1–2 fused
 *              shoulder blocks for silhouette. Few large facets, so each takes one clear toon band; moss on the
 *              up-facing planes only, a dark wet foot, per-plane warm/cool grey.
 *   (default)  SMOOTH PAINTED — rounded Sea of Thieves / BotW boulders with SMOOTH normals: soft polytopes (broad faces,
 *              rounded edges) with fused ledges, a dark wet foot → a lighter crown, crease / crack / contact AO, a moss
 *              cap with a tongued edge. Its own material program (flatShading off). Built to art/rocks/round-2-b-final/.
 *   ?rocks=c   LAYERED SLABS — sedimentary: 2–5 stacked chamfered slabs, each a little smaller and offset, a common
 *              dip; alternating strata greys, lit chamfers, moss on the exposed tops.
 *
 *   const look = rockLook();                                       // 'b' by default; 'current' | 'a' | 'c' by URL
 *   if (look !== 'current') {
 *     const g = rockGeometry(look, r, rng, { squash: 0.62, palette: REEF_ROCK });   // non-indexed: position, normal, color
 *     g.applyMatrix4(m);                                                               // centred on the origin, ±r·squash tall
 *     new THREE.Mesh(g, rockMaterial(sky, look));                                      // merge many first: one draw
 *   }
 *
 * Same convention as lowpolyKit's `rock()`: centred on the origin, about r wide and r·squash half-tall, so a caller keeps
 * its placement and colliders.
 */
import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../core/rng';
import type { Sky } from './Sky';
import { lowPolyMaterial } from './lowpolyKit';

export type RockLook = 'current' | 'a' | 'b' | 'c';
export type NewRockLook = Exclude<RockLook, 'current'>;

/** one-line names, for the board and the catalog */
export const ROCK_LOOK_NAMES: Record<RockLook, string> = { current: 'current (jittered icosahedron)', a: 'chiselled', b: 'smooth painted', c: 'layered slabs' };

let chosen: RockLook | null = null;
/**
 * the look this page was loaded with. B (smooth painted) is the default since the user picked it (E114, 2026-09-25);
 * `?rocks=now` (or `v1` / `current`) brings back the old jittered icosahedra, `?rocks=a|c` the other candidates
 */
export function rockLook(): RockLook {
  if (chosen !== null) return chosen;
  const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('rocks');
  chosen = v === 'now' || v === 'v1' || v === 'current' ? 'current' : v === 'a' || v === 'c' ? v : 'b';
  return chosen;
}

/** the faceted looks' (A, C) paint */
export interface RockPalette {
  /** the shade band's grey at the foot and at the crown */
  dark: string; light: string;
  /** a warm and a cool grey that single planes / strata drift toward */
  warm: string; cool: string;
  moss: string; mossLight: string;
  /** the wet line at the foot */
  wet: string;
}
/** a rock kind's paint in every look */
export interface RockPaints { faceted: RockPalette; smooth: SmoothPalette }
/** the shore's boulders (Boulders.ts, Explore's Boulder): beach granite, a shade lighter than the reef */
export const SHORE_ROCK: RockPaints = {
  faceted: { dark: '#5d6168', light: '#a6a9ad', warm: '#9b9184', cool: '#7c8591', moss: '#6f9a3e', mossLight: '#8fb850', wet: '#3f4a46' },
  smooth: {
    foot: '#2f3134', dark: '#45474c', mid: '#5f6165', light: '#7f7e7c', edge: '#918f8b', warm: '#776e63', cool: '#535b64', crease: '#2a2d33',
    moss: '#62853a', mossLight: '#8ea24f', mossDark: '#40602b', wet: '#2e3a36',
  },
};
/** the wreck's reef rocks (Wreck.ts), the cove's loose rocks, the pebbles: darker, weedier basalt */
export const REEF_ROCK: RockPaints = {
  faceted: { dark: '#3b4047', light: '#7d838b', warm: '#77706a', cool: '#5a6572', moss: '#5f8a35', mossLight: '#80aa45', wet: '#2f3d38' },
  smooth: {
    foot: '#2a2c30', dark: '#3e4045', mid: '#5a5c60', light: '#7c7b7a', edge: '#8e8c8a', warm: '#766c61', cool: '#4d555e', crease: '#25282e',
    moss: '#62853a', mossLight: '#8ea24f', mossDark: '#3d5d2a', wet: '#25312d',
  },
};

export interface RockOpts {
  /** vertical half-height ÷ r (default 0.7) */
  squash?: number;
  /** 0 = bare stone, 1 = a full moss cap (default 0.8) */
  moss?: number;
  palette?: RockPaints;
  /** B: where the ground (or the water line) meets the rock, in its local y — the paint's foot → crown ramp and the
   * contact AO start there (default −0.3 · r · squash) */
  ground?: number;
}

/** the material a look draws with: the shared low-poly program for the faceted looks, a smooth-shaded copy for B */
export function rockMaterial(sky: Sky, look: NewRockLook): THREE.MeshStandardMaterial {
  return look === 'b' ? lowPolyMaterial(sky, 'rock-smooth', (m) => { m.flatShading = false; m.roughness = 0.82; }) : lowPolyMaterial(sky);
}

/** true when a look carries its own smooth normals (keep them: don't merge it into a flat-shaded LowPolyKit) */
export const rockIsSmooth = (look: RockLook): boolean => look === 'b';

/** one rock of a look — non-indexed, with `position`, `normal` and `color` */
export function rockGeometry(look: NewRockLook, r: number, rng: Rng, o: RockOpts = {}): THREE.BufferGeometry {
  const sq = o.squash ?? 0.7, moss = o.moss ?? 0.8, paints = o.palette ?? SHORE_ROCK, pal = paints.faceted;
  if (look === 'a') return fit(chiselled(r, sq, moss, pal, rng), r, r * sq * 1.05, true);
  if (look === 'b') return smoothPainted(r, sq, moss, paints.smooth, rng, o.ground ?? -0.3 * r * sq);
  return fit(slabs(r, sq, moss, pal, rng), r, r * sq * 0.6, true);
}

/**
 * scale a rock to the current rock's footprint — its widest extent 2.2·r, its top `top` over the origin — so a look
 * swaps in with the same presence (the carved / slab shapes come out smaller than the jittered icosahedron they
 * replace, and sank under the reef's water line). `flat`: recompute the per-face normals afterwards.
 */
function fit(g: THREE.BufferGeometry, r: number, top: number, flat: boolean): THREE.BufferGeometry {
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (bb === null || bb.max.y <= 0) return g;
  const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), sxz = w > 0 ? (2.2 * r) / w : 1;
  g.scale(sxz, top / bb.max.y, sxz);
  if (flat) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
  return g;
}

// ── shared: colours ───────────────────────────────────────────────────────────────────────────────

const col = (s: string): THREE.Color => new THREE.Color(s);
const sstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * the stone colour at height fraction h (0 foot … 1 crown) for a surface facing up by ny, drifted toward warm (t > 0)
 * or cool (t < 0); then the moss (amount m, 0..1) and the wet foot laid over it
 */
function stone(out: THREE.Color, pal: RockPalette, h: number, ny: number, t: number, m: number): THREE.Color {
  out.copy(col(pal.dark)).lerp(col(pal.light), Math.min(1, 0.18 + h * 0.72 + Math.max(0, ny) * 0.18));
  out.lerp(col(t > 0 ? pal.warm : pal.cool), Math.min(1, Math.abs(t)) * 0.45);
  if (h < 0.22) out.lerp(col(pal.wet), (1 - h / 0.22) * 0.55);
  if (m > 0) out.lerp(col(pal.moss).lerp(col(pal.mossLight), sstep(0.6, 0.95, ny)), Math.min(1, m));
  return out;
}

/** collects flat-coloured triangles (one colour per face) and hands back a non-indexed geometry with flat normals */
class Tris {
  pos: number[] = [];
  cols: number[] = [];
  add(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, k: THREE.Color): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.cols.push(k.r, k.g, k.b);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cols, 3));
    g.computeVertexNormals();
    return g;
  }
}

const faceNormal = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 =>
  new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();

// ── A: chiselled ──────────────────────────────────────────────────────────────────────────────────

interface Plane { n: THREE.Vector3; d: number; /** warm/cool drift of this plane */ t: number }

/**
 * The polytope { x : n_i·x ≤ d_i } (all d_i > 0, so the origin is inside), as one convex polygon per plane that
 * survives, ordered counter-clockwise seen from outside. Built through the dual: the hull of the points n_i / d_i —
 * each hull triangle is a corner of the polytope (N / c for its plane N·q = c), each hull vertex a face.
 */
function polytope(planes: Plane[]): { plane: Plane; poly: THREE.Vector3[] }[] {
  const pts = planes.map((p) => p.n.clone().divideScalar(p.d));
  const index = new Map<THREE.Vector3, number>();
  pts.forEach((p, i) => { index.set(p, i); });
  const hull = new ConvexHull().setFromPoints(pts);
  const polys: THREE.Vector3[][] = planes.map(() => []);
  for (const f of hull.faces) {
    if (f.constant <= 1e-9) continue;
    const corner = f.normal.clone().divideScalar(f.constant);
    let e = f.edge;
    for (let k = 0; k < 8; k++) {
      const i = index.get(e.head().point);
      if (i !== undefined) polys[i]?.push(corner);
      e = e.next;
      if (e === f.edge) break;
    }
  }
  const out: { plane: Plane; poly: THREE.Vector3[] }[] = [];
  planes.forEach((plane, i) => {
    const raw = polys[i] ?? [], poly: THREE.Vector3[] = [];
    for (const v of raw) if (!poly.some((q) => q.distanceToSquared(v) < 1e-8)) poly.push(v);
    if (poly.length < 3) return;
    const c = poly.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(poly.length);
    const u = new THREE.Vector3().subVectors(poly[0] ?? c, c).normalize(), w = new THREE.Vector3().crossVectors(plane.n, u);
    poly.sort((p, q) => Math.atan2(w.dot(new THREE.Vector3().subVectors(p, c)), u.dot(new THREE.Vector3().subVectors(p, c))) - Math.atan2(w.dot(new THREE.Vector3().subVectors(q, c)), u.dot(new THREE.Vector3().subVectors(q, c))));
    out.push({ plane, poly });
  });
  return out;
}

/** a chipped, many-planed block inside the ellipsoid (rx, ry, rz) */
function block(rx: number, ry: number, rz: number, planesN: number, chips: number, rng: Rng): { plane: Plane; poly: THREE.Vector3[] }[] {
  const reach = (n: THREE.Vector3): number => Math.hypot(rx * n.x, ry * n.y, rz * n.z);   // the ellipsoid's support
  const planes: Plane[] = [];
  const add = (n: THREE.Vector3, k: number): void => { n.normalize(); planes.push({ n, d: reach(n) * k, t: rng.range(-1, 1) }); };
  const off = rng.range(0, Math.PI * 2);
  for (let i = 0; i < planesN; i++) {
    // a Fibonacci sphere, jittered: planes all round, none bunched
    const y = 1 - ((i + 0.5) / planesN) * 2, s = Math.sqrt(1 - y * y), a = i * 2.39996 + off;
    add(new THREE.Vector3(Math.cos(a) * s + rng.range(-0.18, 0.18), y + rng.range(-0.12, 0.12), Math.sin(a) * s + rng.range(-0.18, 0.18)), rng.range(0.8, 0.95));
  }
  add(new THREE.Vector3(rng.range(-0.18, 0.18), 1, rng.range(-0.18, 0.18)), rng.range(0.78, 0.88));   // a broad, nearly flat top (the moss bed)
  add(new THREE.Vector3(0, -1, 0), 0.92);                                                           // a flat foot (buried)
  // chip the most protruding corners: each gets a small plane across it
  for (let c = 0; c < chips; c++) {
    let best: THREE.Vector3 | null = null, bs = 0;
    for (const { poly } of polytope(planes)) for (const v of poly) {
      const s = Math.hypot(v.x / rx, v.y / ry, v.z / rz);
      if (v.y > -ry * 0.6 && s > bs) { bs = s; best = v; }
    }
    if (best === null) break;
    const n = new THREE.Vector3(best.x / (rx * rx), best.y / (ry * ry), best.z / (rz * rz)).normalize();
    n.x += rng.range(-0.25, 0.25); n.z += rng.range(-0.25, 0.25); n.normalize();
    planes.push({ n, d: n.dot(best) - Math.min(rx, ry, rz) * rng.range(0.1, 0.2), t: rng.range(-1, 1) });
  }
  return polytope(planes);
}

function chiselled(r: number, sq: number, moss: number, pal: RockPalette, rng: Rng): THREE.BufferGeometry {
  const ry = r * sq, out = new Tris(), k = new THREE.Color();
  const blocks: { at: THREE.Vector3; faces: { plane: Plane; poly: THREE.Vector3[] }[] }[] = [];
  blocks.push({ at: new THREE.Vector3(), faces: block(r * rng.range(0.95, 1.1), ry, r * rng.range(0.78, 0.92), r > 0.7 ? 26 : 16, r > 0.7 ? 12 : 5, rng) });
  // shoulder blocks: a lower, smaller lump fused to one side (and a second on big rocks) — the silhouette steps
  const shoulders = r > 1.6 ? 3 : r > 0.7 ? 2 : 1;
  for (let s = 0; s < shoulders; s++) {
    const a = rng.range(0, Math.PI * 2), f = rng.range(0.38, 0.62);
    blocks.push({ at: new THREE.Vector3(Math.cos(a) * r * 0.66, -ry * (1 - f) * 0.9, Math.sin(a) * r * 0.58), faces: block(r * f * 1.05, ry * f, r * f * 0.9, 16, 5, rng) });
  }
  const mossBias = rng.range(-0.08, 0.08);
  for (const b of blocks) for (const { plane, poly } of b.faces) {
    const p0 = poly[0];
    if (p0 === undefined) continue;
    const cy = poly.reduce((s, v) => s + v.y, 0) / poly.length + b.at.y;
    const h = (cy + ry) / (2 * ry), ny = plane.n.y;
    const m = moss * sstep(0.62 + mossBias, 0.8 + mossBias, ny) * sstep(0.35, 0.6, h);
    stone(k, pal, h, ny, plane.t * 0.8, m > 0.15 ? 0.55 + m * 0.45 : 0);
    const a = p0.clone().add(b.at);
    for (let i = 1; i + 1 < poly.length; i++) {
      const v1 = poly[i], v2 = poly[i + 1];
      if (v1 === undefined || v2 === undefined) continue;
      out.add(a, v1.clone().add(b.at), v2.clone().add(b.at), k);
    }
  }
  return out.geometry();
}

// ── B: smooth painted ─────────────────────────────────────────────────────────────────────────────
//
// The pick (the user, 2026-09-25: "B · smooth painted"), built to its mockup (art/rocks/round-1-directions/mockup-B.jpg):
// rounded Sea-of-Thieves / BotW boulders with clear form. Each rock is 1–3 PIECES — a main body and, on bigger rocks,
// lower shoulder blocks fused to its side (the stepped silhouette, the soft ledges). A piece is a SOFT POLYTOPE: ~16
// planes around an ellipsoid (a flat-ish top, bevels, steep sides), blended with a soft-min, so it has broad faces with
// rounded edges instead of a lumpy blob; a little fbm and 0–2 cracks on top. The paint does the rest, per vertex, on
// the final shape: a dark wet foot → a lighter warm crown measured over the part ABOVE THE GROUND (the first pass
// spread it over the buried half too, so everything you could see was the pale crown), light on the worn convex edges,
// dark in the creases and cracks, AO from the rock's own pieces and the ground, and a moss cap on the up-facing
// surfaces with a noisy tongued edge, darker at its rim.

/** the smooth look's paint (sRGB hex; lerped in linear) */
export interface SmoothPalette {
  /** the stone ramp: the wet foot → the shade → the body → the sunlit crown */
  foot: string; dark: string; mid: string; light: string;
  /** the worn convex edges */
  edge: string;
  /** broad warm / cool drifts across a rock */
  warm: string; cool: string;
  /** the tint that creases, cracks and AO fall toward */
  crease: string;
  moss: string; mossLight: string; mossDark: string;
  /** the wet line at the foot */
  wet: string;
}

/** a small seeded 3D value noise (trilinear, smoothstepped), 0..1 */
function valueNoise(seed: number): (x: number, y: number, z: number) => number {
  const hash = (i: number, j: number, k: number): number => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t: number): number => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = fade(x - i), fy = fade(y - j), fz = fade(z - k);
    const l = (a: number, b: number, t: number): number => a + (b - a) * t;
    return l(
      l(l(hash(i, j, k), hash(i + 1, j, k), fx), l(hash(i, j + 1, k), hash(i + 1, j + 1, k), fx), fy),
      l(l(hash(i, j, k + 1), hash(i + 1, j, k + 1), fx), l(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), fx), fy), fz);
  };
}

type Noise = (x: number, y: number, z: number) => number;
type Archetype = 'dome' | 'table' | 'wedge' | 'block';
interface Crack { n: THREE.Vector3; o: number; w: number; depth: number; along: THREE.Vector3 }
interface Piece {
  /** centre, radii and yaw in the rock's space */
  c: THREE.Vector3; rx: number; ry: number; rz: number; cos: number; sin: number;
  /** the soft polytope, in the piece's unit space (the ellipsoid is the unit sphere there) */
  planes: { n: THREE.Vector3; d: number }[]; k: number;
  noise: Noise; amp: number; cracks: Crack[];
}

const tScratch: number[] = [];
/** how far the piece's surface is along the unit direction (ux, uy, uz) of its unit space; `crack` gets the crack depth 0..1 */
function radial(p: Piece, ux: number, uy: number, uz: number, crack?: { v: number }): number {
  tScratch.length = 0;
  let m = Infinity;
  for (const { n, d } of p.planes) {
    const dn = n.x * ux + n.y * uy + n.z * uz;
    if (dn > 1e-3) { const t = d / dn; tScratch.push(t); if (t < m) m = t; }
  }
  if (!Number.isFinite(m)) m = 1;
  let s = 0;
  for (const t of tScratch) { const e = (t - m) / p.k; if (e < 8) s += Math.exp(-e); }
  let R = m - p.k * Math.log(Math.max(1, s));
  R *= 1 + (p.noise(ux * 1.7, uy * 1.7, uz * 1.7) * 0.65 + p.noise(ux * 3.9 + 7, uy * 3.9, uz * 3.9) * 0.35 - 0.5) * p.amp;
  let deep = 0;
  for (const c of p.cracks) {
    const dd = Math.abs(c.n.x * ux + c.n.y * uy + c.n.z * uz - c.o);
    if (dd >= c.w) continue;
    const g = (1 - dd / c.w) ** 2 * sstep(-0.3, 0.1, uy) * (1 - sstep(0.45, 0.7, uy)) * sstep(-0.3, 0.2, c.along.x * ux + c.along.y * uy + c.along.z * uz);
    R *= 1 - c.depth * g;
    deep = Math.max(deep, g);
  }
  if (crack) crack.v = deep;
  return R;
}

/** is the rock-space point inside the piece? */
function insidePiece(p: Piece, x: number, y: number, z: number): boolean {
  const dx = x - p.c.x, dz = z - p.c.z;
  const qx = (p.cos * dx + p.sin * dz) / p.rx, qy = (y - p.c.y) / p.ry, qz = (-p.sin * dx + p.cos * dz) / p.rz;
  const L = Math.hypot(qx, qy, qz);
  if (L > 1.12) return false;                                   // past the ellipsoid (+ the noise's reach): outside, no planes to test
  if (L < 0.4) return true;                                     // deep inside every archetype's planes
  return L < radial(p, qx / L, qy / L, qz / L);
}

/** a piece's planes and softness for an archetype */
function piecePlanes(kind: Archetype, rng: Rng): { planes: { n: THREE.Vector3; d: number }[]; k: number } {
  const planes: { n: THREE.Vector3; d: number }[] = [];
  const add = (x: number, y: number, z: number, d: number): void => { planes.push({ n: new THREE.Vector3(x, y, z).normalize(), d }); };
  const sides = rng.int(5, 8), off = rng.range(0, Math.PI * 2);
  for (let i = 0; i < sides; i++) {
    const a = off + (i / sides) * Math.PI * 2 + rng.range(-0.25, 0.25);
    add(Math.cos(a), rng.range(0.05, 0.42), Math.sin(a), rng.range(0.8, 0.98));
  }
  const bevels = kind === 'dome' ? rng.int(5, 7) : rng.int(3, 5);
  for (let i = 0; i < bevels; i++) {
    const a = off + rng.range(0, Math.PI * 2), y = kind === 'dome' ? rng.range(0.5, 0.8) : rng.range(0.45, 0.7);
    add(Math.cos(a), y / Math.sqrt(1 - y * y), Math.sin(a), rng.range(0.8, 0.92));
  }
  for (let i = 0; i < 3; i++) { const a = off + (i / 3) * Math.PI * 2 + 0.5; add(Math.cos(a), -0.8, Math.sin(a), 0.88); }
  add(0, -1, 0, 0.9);
  const ta = rng.range(0, Math.PI * 2);
  const tilt = kind === 'wedge' ? rng.range(0.32, 0.5) : kind === 'dome' ? rng.range(0, 0.15) : rng.range(0.04, 0.2);
  const top = kind === 'table' ? rng.range(0.6, 0.7) : kind === 'wedge' ? rng.range(0.72, 0.8) : kind === 'block' ? rng.range(0.74, 0.82) : rng.range(0.86, 0.94);
  add(Math.cos(ta) * tilt, 1, Math.sin(ta) * tilt, top);
  const k = kind === 'dome' ? rng.range(0.09, 0.12) : kind === 'block' ? rng.range(0.04, 0.055) : rng.range(0.05, 0.07);
  return { planes, k };
}

function makePiece(kind: Archetype, c: THREE.Vector3, rx: number, ry: number, rz: number, cracks: number, rng: Rng): Piece {
  const { planes, k } = piecePlanes(kind, rng), yaw = rng.range(0, Math.PI * 2);
  const cr: Crack[] = Array.from({ length: cracks }, () => {
    const n = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.25, 0.25), rng.range(-1, 1)).normalize();
    const along = new THREE.Vector3(-n.z, 0, n.x).multiplyScalar(rng.next() < 0.5 ? 1 : -1);
    return { n, o: rng.range(-0.25, 0.25), w: rng.range(0.12, 0.16), depth: rng.range(0.07, 0.1), along };
  });
  return { c, rx, ry, rz, cos: Math.cos(yaw), sin: Math.sin(yaw), planes, k, noise: valueNoise(Math.floor(rng.next() * 1e9)), amp: kind === 'dome' ? 0.14 : 0.1, cracks: cr };
}

/** how far B's smooth normals lean toward each triangle's own normal: 0 = fully smooth, 1 = faceted. A touch keeps the
 * painted planes of the mockup readable without going back to the crumpled-paper facets */
const FACET_HINT = 0.3;
function facetHint(g: THREE.BufferGeometry, f: number): void {
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(c, b).cross(a.sub(b)).normalize();
    for (let j = 0; j < 3; j++) { n.fromBufferAttribute(nrm, i + j).multiplyScalar(1 - f).addScaledVector(fn, f).normalize(); nrm.setXYZ(i + j, n.x, n.y, n.z); }
  }
}

/** a welded unit icosphere per detail and each vertex's neighbours — the same topology for every rock, so built once */
const icoCache = new Map<number, { g: THREE.BufferGeometry; nb: number[][] }>();
function unitIco(detail: number): { g: THREE.BufferGeometry; nb: number[][] } {
  const hit = icoCache.get(detail);
  if (hit) return { g: hit.g.clone(), nb: hit.nb };
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  ico.dispose();
  const count = g.getAttribute('position').count, idx = g.getIndex(), sets = Array.from({ length: count }, () => new Set<number>());
  if (idx) for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    sets[a]?.add(b).add(c); sets[b]?.add(a).add(c); sets[c]?.add(a).add(b);
  }
  const nb = sets.map((st) => Array.from(st));
  icoCache.set(detail, { g, nb });
  return { g: g.clone(), nb };
}

const lerpC = (out: THREE.Color, c: THREE.Color, t: number): THREE.Color => out.lerp(c, Math.min(1, Math.max(0, t)));
/** a palette's colours parsed once (Color.set(hex) per vertex was a fifth of the build) */
const parsed = new WeakMap<SmoothPalette, Record<keyof SmoothPalette, THREE.Color>>();
function parsePalette(pal: SmoothPalette): Record<keyof SmoothPalette, THREE.Color> {
  let p = parsed.get(pal);
  if (!p) {
    const c = (s: string): THREE.Color => new THREE.Color(s);
    p = { foot: c(pal.foot), dark: c(pal.dark), mid: c(pal.mid), light: c(pal.light), edge: c(pal.edge), warm: c(pal.warm), cool: c(pal.cool), crease: c(pal.crease), moss: c(pal.moss), mossLight: c(pal.mossLight), mossDark: c(pal.mossDark), wet: c(pal.wet) };
    parsed.set(pal, p);
  }
  return p;
}

function smoothPainted(r: number, sq: number, moss: number, palette: SmoothPalette, rng: Rng, ground: number): THREE.BufferGeometry {
  const pal = parsePalette(palette);
  const pebble = r < 0.3;
  const kinds: Archetype[] = ['dome', 'table', 'wedge', 'block', 'table', 'block'];
  const kind = pebble ? (rng.next() < 0.5 ? 'dome' : 'block') : rng.pick(kinds);
  const ry = r * sq * (kind === 'table' ? 0.88 : kind === 'dome' ? 1.04 : 1);
  const gr = ground;                                                               // the ground plane (rock space)
  const main = makePiece(kind, new THREE.Vector3(), r * rng.range(0.95, 1.08), ry, r * rng.range(0.8, 0.95), pebble || r < 0.7 ? 0 : r > 1.3 ? rng.int(1, 2) : rng.int(0, 1), rng);
  const pieces: Piece[] = [main];
  // shoulders: lower blocks fused to the side — the silhouette steps down, a ledge shows
  const nSh = pebble ? 0 : r > 1.6 ? rng.int(1, 2) : r > 0.7 ? (rng.next() < 0.65 ? 1 : 0) : (rng.next() < 0.3 ? 1 : 0);
  const H = ry - gr;
  const a0 = rng.range(0, Math.PI * 2);
  for (let s = 0; s < nSh; s++) {
    const a = a0 + s * rng.range(1.8, 3.2), f = rng.range(0.42, 0.62);
    // a ledge: wider and flatter than the body, its top a third to a half of the way up
    const sry = ry * f * rng.range(0.55, 0.75), sx = main.rx * rng.range(0.5, 0.66), sz = main.rz * rng.range(0.5, 0.66);
    const cy = gr + H * rng.range(0.32, 0.5) - sry * 0.8;
    pieces.push(makePiece(rng.next() < 0.6 ? 'table' : 'block', new THREE.Vector3(Math.cos(a) * sx, cy, Math.sin(a) * sz), r * f * 1.25, sry, r * f * 1.05, 0, rng));
  }
  if (r > 1.5 && rng.next() < 0.35) {
    const a = rng.range(0, Math.PI * 2), f = rng.range(0.38, 0.5);
    pieces.push(makePiece('dome', new THREE.Vector3(Math.cos(a) * main.rx * 0.3, ry * 0.62, Math.sin(a) * main.rz * 0.3), r * f, ry * f * 0.9, r * f * 0.85, 0, rng));
  }
  const footY = gr - Math.max(0.05, (ry + gr) * 0.5);   // the flat foot, buried under the ground line
  // ── the meshes (one welded icosphere per piece, pushed out to its surface) ──
  const meshes: { g: THREE.BufferGeometry; nb: number[][]; crack: Float32Array; piece: Piece }[] = [];
  const u = new THREE.Vector3(), cv = { v: 0 };
  pieces.forEach((p, pi) => {
    const detail = pebble ? (r < 0.16 ? 0 : 1) : pi === 0 ? (r >= 1.1 ? 4 : r >= 0.6 ? 3 : 2) : (r >= 2 ? 2 : 1);   // 80 · 180 · 320 · 500 tris
    const { g, nb } = unitIco(detail);
    const pos = g.getAttribute('position'), crack = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      u.fromBufferAttribute(pos, i).normalize();
      const R = radial(p, u.x, u.y, u.z, cv);
      crack[i] = cv.v;
      const lx = u.x * R * p.rx, ly = u.y * R * p.ry, lz = u.z * R * p.rz;
      pos.setXYZ(i, p.c.x + p.cos * lx - p.sin * lz, Math.max(footY, p.c.y + ly), p.c.z + p.sin * lx + p.cos * lz);
    }
    meshes.push({ g, nb, crack, piece: p });
  });
  // ── fit: the widest extent 2.2·r and the top ry·1.05 over the origin, like the rocks it replaces (the pieces follow) ──
  const bb = new THREE.Box3();
  for (const { g } of meshes) { g.computeBoundingBox(); if (g.boundingBox) bb.union(g.boundingBox); }
  const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), sxz = w > 0 ? (2.2 * r) / w : 1, sy = bb.max.y > 0 ? (r * sq * 0.92) / bb.max.y : 1;
  for (const { g, piece: p } of meshes) {
    g.scale(sxz, sy, sxz);
    p.c.set(p.c.x * sxz, p.c.y * sy, p.c.z * sxz); p.rx *= sxz; p.rz *= sxz; p.ry *= sy;
    g.computeVertexNormals();
  }
  const topY = r * sq * 0.92;
  const inside = (x: number, y: number, z: number): boolean => y < gr || pieces.some((p) => insidePiece(p, x, y, z));
  // ── the paint ──
  const drift = valueNoise(Math.floor(rng.next() * 1e9)), mottle = valueNoise(Math.floor(rng.next() * 1e9)), edgeN = valueNoise(Math.floor(rng.next() * 1e9));
  const mossThr = 0.98 - moss * 0.5;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), mean = new THREE.Vector3(), q = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), d = new THREE.Vector3();
  const k = new THREE.Color(), mc = new THREE.Color();
  const out: THREE.BufferGeometry[] = [];
  for (const { g, nb, crack } of meshes) {
    const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
      // curvature × r: ~1 on a sphere of radius r, ~0 on a face, ≫ 1 on a rounded edge, < 0 in a crease
      mean.set(0, 0, 0);
      let e2 = 0;
      const ring = nb[i] ?? [];
      for (const j of ring) { q.fromBufferAttribute(pos, j); mean.add(q); e2 += q.distanceToSquared(v); }
      let curv = 0;
      if (ring.length > 0) { mean.divideScalar(ring.length); e2 /= ring.length; curv = (2 * n.dot(q.subVectors(v, mean)) / Math.max(1e-6, e2)) * r; }
      // AO: the normal and four tilted rays, near and far, against every piece and the ground
      t1.set(n.y, -n.x, 0); if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0); t1.normalize(); t2.crossVectors(n, t1);
      // AO: a short ray along the normal and four tilted ones a little further, against every piece and the ground
      let occ = 0;
      for (let s = 0; s < 5; s++) {
        d.copy(n);
        if (s === 1) d.addScaledVector(t1, 0.9); else if (s === 2) d.addScaledVector(t1, -0.9); else if (s === 3) d.addScaledVector(t2, 0.9); else if (s === 4) d.addScaledVector(t2, -0.9);
        d.normalize().multiplyScalar((s === 0 ? 0.16 : 0.3) * Math.min(r, 2.2)).add(v);
        if (inside(d.x, d.y, d.z)) occ += s === 0 ? 0.3 : 0.175;
      }
      const ao = occ;
      const h = Math.min(1, Math.max(0, (v.y - gr) / Math.max(1e-3, topY - gr))), up = Math.max(0, n.y);
      // the stone: the ramp foot → dark → body → crown, lit a little more where it faces up
      const t = Math.min(1, Math.max(0, h * 0.8 + up * 0.3 - 0.12));
      k.copy(pal.foot);
      lerpC(k, pal.dark, sstep(0, 0.3, t));
      lerpC(k, pal.mid, sstep(0.25, 0.62, t));
      lerpC(k, pal.light, sstep(0.6, 1, t));
      const dr = (drift(v.x * 0.55 / r, v.y * 0.55 / r, v.z * 0.55 / r) - 0.5) * 2.4;
      lerpC(k, dr > 0 ? pal.warm : pal.cool, Math.abs(dr) * 0.32);
      k.multiplyScalar(0.92 + mottle(v.x * 2.6 / r, v.y * 2.6 / r, v.z * 2.6 / r) * 0.16);
      k.multiplyScalar(0.74 + 0.26 * sstep(-0.35, 0.85, n.y));                  // a painted top light: the walls a shade darker than the crown
      lerpC(k, pal.edge, sstep(2.5, 6, curv) * 0.4 * sstep(0.3, 0.6, h) * (0.35 + 0.65 * up));   // worn convex edges
      lerpC(k, pal.wet, (1 - sstep(0, 0.16, h)) * 0.6);                        // the wet line
      // moss: on what faces up, with a tongued noisy edge that reaches further down in places
      const en = (edgeN(v.x * 1.3 / r, v.y * 1.3 / r, v.z * 1.3 / r) - 0.5) * 0.75;
      const m = moss > 0 ? sstep(mossThr - 0.14, mossThr + 0.14, up + en) * sstep(0.32, 0.6, h + en * 0.35) : 0;
      if (m > 0) {
        mc.copy(pal.mossDark);
        lerpC(mc, pal.moss, sstep(0.35, 0.85, up));
        lerpC(mc, pal.mossLight, sstep(0.35, 0.85, mottle(v.x * 1.8 / r + 3, v.y * 1.8 / r, v.z * 1.8 / r)) * 0.9 * up);
        mc.multiplyScalar(1 - 0.22 * (1 - Math.abs(2 * m - 1)));                // a darker rim where the moss thins out
        k.lerp(mc, m);
      }
      // darkness last: cracks, creases, AO (cool, not black)
      const cr = crack[i] ?? 0, crease = sstep(0.4, 3.5, -curv);
      lerpC(k, pal.crease, cr * 0.7 + crease * 0.35 + ao * 0.35);
      k.multiplyScalar((1 - cr * 0.45) * (1 - crease * 0.28) * (1 - ao * 0.5));
      cols[i * 3] = k.r; cols[i * 3 + 1] = k.g; cols[i * 3 + 2] = k.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ni = g.toNonIndexed();
    g.dispose();
    facetHint(ni, FACET_HINT);
    out.push(ni);
  }
  if (out.length === 1) { const only = out[0]; if (only) return only; }
  const merged = mergeGeometries(out, false);
  for (const g of out) g.dispose();
  return merged;
}

// ── C: layered slabs ──────────────────────────────────────────────────────────────────────────────

function slabs(r: number, sq: number, moss: number, pal: RockPalette, rng: Rng): THREE.BufferGeometry {
  const ry = r * sq, out = new Tris(), k = new THREE.Color();
  const n = r > 1.5 ? rng.int(4, 6) : r > 0.7 ? rng.int(3, 4) : rng.int(2, 3);
  const sides = r > 1.5 ? 11 : r > 0.7 ? 9 : 7;
  // the layers' thicknesses, stretched over −ry … +0.5·ry: a slab rock is wider and flatter than a boulder
  const th = Array.from({ length: n }, () => rng.range(0.5, 1.5)), sum = th.reduce((s, x) => s + x, 0);
  const dipX = rng.range(-0.16, 0.16), dipZ = rng.range(-0.16, 0.16);   // the bedding's common tilt
  const shape: [number, number][] = Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 + rng.range(-0.22, 0.22);
    return [Math.cos(a), Math.sin(a)];
  });
  const warm = rng.next() < 0.5 ? 1 : -1;
  let y0 = -ry;
  for (let s = 0; s < n; s++) {
    const t = ((th[s] ?? 1) / sum) * 1.5 * ry, y1 = y0 + t;
    const shrink = (1 - 0.5 * (s / Math.max(1, n - 1)) ** 1.2) * rng.range(0.84, 1.06);
    const cx = rng.range(-0.14, 0.14) * r, cz = rng.range(-0.14, 0.14) * r, yaw = rng.range(-0.4, 0.4);
    const cs = Math.cos(yaw), sn = Math.sin(yaw), ch = Math.min(t * 0.38, r * 0.16);
    const ring = (y: number, inset: number, jitter: number[]): THREE.Vector3[] => shape.map(([ux, uz], i) => {
      const rr = r * shrink * (jitter[i] ?? 1) - inset, x = ux * rr * 1.2, z = uz * rr * 0.95;
      const wx = cx + x * cs - z * sn, wz = cz + x * sn + z * cs;
      return new THREE.Vector3(wx, y + wx * dipX + wz * dipZ, wz);
    });
    const raw = shape.map(() => rng.range(0.72, 1.1));   // smoothed with its neighbours: broken outlines, no spikes or notches
    const jit = raw.map((j, i) => (j * 2 + (raw[(i + 1) % sides] ?? j) + (raw[(i + sides - 1) % sides] ?? j)) / 4);
    const bot = ring(y0, ch * 0.25, jit), mid = ring(y1 - ch, 0, jit), top = ring(y1, ch, jit.map((j) => j * rng.range(0.94, 1.02)));
    const h = (y1 - ch * 0.5 + ry) / (1.5 * ry), stripe = (s % 2 === 0 ? 1 : -1) * warm * rng.range(0.5, 1);
    const isTop = s === n - 1;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const b0 = bot[i], b1 = bot[j], m0 = mid[i], m1 = mid[j], t0 = top[i], t1 = top[j];
      if (!b0 || !b1 || !m0 || !m1 || !t0 || !t1) continue;
      // the wall: this layer's strata grey, a darker band low on the bottom layer (wet)
      const wn = faceNormal(b0, m1, b1);
      stone(k, pal, (y0 + t * 0.4 + ry) / (1.5 * ry), wn.y, stripe, 0).multiplyScalar(0.92 + rng.next() * 0.1);
      out.add(b0, m1, b1, k); out.add(b0, m0, m1, k);
      // the chamfer: catches the light, moss creeping over it on the exposed rims
      const cn = faceNormal(m0, t1, m1);
      stone(k, pal, h + 0.08, Math.max(cn.y, 0.35), stripe * 0.5, moss * (isTop ? 0.45 : 0.25) * sstep(0.35, 0.7, h) * (rng.next() < 0.6 ? 1 : 0));
      out.add(m0, t1, m1, k); out.add(m0, t0, t1, k);
    }
    // the top: moss on the crown, a lighter weathered shelf (with patchy moss) where a layer shows past the next
    const c = top.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(sides);
    stone(k, pal, h + 0.15, 1, stripe * 0.3, isTop ? moss * 0.95 : moss * (rng.next() < 0.5 ? 0.7 : 0.15));
    for (let i = 0; i < sides; i++) { const a = top[i], b = top[(i + 1) % sides]; if (a && b) out.add(c, b, a, k); }
    // the underside (only seen at the foot of an overhang)
    const cb = bot.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(sides);
    stone(k, pal, 0, -1, 0, 0);
    for (let i = 0; i < sides; i++) { const a = bot[i], b = bot[(i + 1) % sides]; if (a && b) out.add(cb, a, b, k); }
    y0 = y1 - t * 0.06;   // the next layer sits a hair into this one (no light leak between them)
  }
  return out.geometry();
}
