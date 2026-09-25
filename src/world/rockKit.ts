/**
 * rockKit — candidate rock looks for Driftwood Isle (E114). The user, on the wreck and on Explore's Boulder: "Most low
 * poly rocks look like shit … way too basic. We need to try something else." The current rock (a randomly jittered
 * icosahedron: 20–80 small random facets, a green cap) reads as crumpled paper under the toon ramp, because every facet
 * lands on a random side of the two-band terminator. These are three directions for the user to pick from — a taste
 * call, so the current look stays the default and each one is a URL switch:
 *
 *   ?rocks=a   CHISELLED — a carved block: a convex polytope cut by ~24 big planes, its corners chipped, 1–2 fused
 *              shoulder blocks for silhouette. Few large facets, so each takes one clear toon band; moss on the
 *              up-facing planes only, a dark wet foot, per-plane warm/cool grey.
 *   ?rocks=b   SMOOTH PAINTED — a rounded, soft-ledged boulder with SMOOTH normals (Sea of Thieves / BotW): fbm lumps,
 *              soft terraces, vertex-painted dark foot → light crown, crease AO from curvature, moss that follows the
 *              top with a noisy edge. Its own material program (flatShading off).
 *   ?rocks=c   LAYERED SLABS — sedimentary: 2–5 stacked chamfered slabs, each a little smaller and offset, a common
 *              dip; alternating strata greys, lit chamfers, moss on the exposed tops.
 *
 *   const look = rockLook();                                       // 'current' | 'a' | 'b' | 'c'
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
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../core/rng';
import type { Sky } from './Sky';
import { lowPolyMaterial } from './lowpolyKit';

export type RockLook = 'current' | 'a' | 'b' | 'c';
export type NewRockLook = Exclude<RockLook, 'current'>;

/** one-line names, for the board and the catalog */
export const ROCK_LOOK_NAMES: Record<RockLook, string> = { current: 'current (jittered icosahedron)', a: 'chiselled', b: 'smooth painted', c: 'layered slabs' };

let chosen: RockLook | null = null;
/** the look this page was loaded with: `?rocks=a|b|c`, anything else is the current look */
export function rockLook(): RockLook {
  if (chosen !== null) return chosen;
  const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('rocks');
  chosen = v === 'a' || v === 'b' || v === 'c' ? v : 'current';
  return chosen;
}

export interface RockPalette {
  /** the shade band's grey at the foot and at the crown */
  dark: string; light: string;
  /** a warm and a cool grey that single planes / strata drift toward */
  warm: string; cool: string;
  moss: string; mossLight: string;
  /** the wet line at the foot */
  wet: string;
}
/** the shore's boulders (Boulders.ts): pale beach granite */
export const SHORE_ROCK: RockPalette = { dark: '#5d6168', light: '#a6a9ad', warm: '#9b9184', cool: '#7c8591', moss: '#6f9a3e', mossLight: '#8fb850', wet: '#3f4a46' };
/** the wreck's reef rocks (Wreck.ts): darker, weedier basalt */
export const REEF_ROCK: RockPalette = { dark: '#3b4047', light: '#7d838b', warm: '#77706a', cool: '#5a6572', moss: '#5f8a35', mossLight: '#80aa45', wet: '#2f3d38' };

export interface RockOpts {
  /** vertical half-height ÷ r (default 0.7) */
  squash?: number;
  /** 0 = bare stone, 1 = a full moss cap (default 0.8) */
  moss?: number;
  palette?: RockPalette;
}

/** the material a look draws with: the shared low-poly program for the faceted looks, a smooth-shaded copy for B */
export function rockMaterial(sky: Sky, look: NewRockLook): THREE.MeshStandardMaterial {
  return look === 'b' ? lowPolyMaterial(sky, 'rock-smooth', (m) => { m.flatShading = false; }) : lowPolyMaterial(sky);
}

/** true when a look carries its own smooth normals (keep them: don't merge it into a flat-shaded LowPolyKit) */
export const rockIsSmooth = (look: RockLook): boolean => look === 'b';

/** one rock of a look — non-indexed, with `position`, `normal` and `color` */
export function rockGeometry(look: NewRockLook, r: number, rng: Rng, o: RockOpts = {}): THREE.BufferGeometry {
  const sq = o.squash ?? 0.7, moss = o.moss ?? 0.8, pal = o.palette ?? SHORE_ROCK;
  if (look === 'a') return fit(chiselled(r, sq, moss, pal, rng), r, r * sq * 1.05, true);
  if (look === 'b') return smoothPainted(r, sq, moss, pal, rng);
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

function smoothPainted(r: number, sq: number, moss: number, pal: RockPalette, rng: Rng): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, r >= 2 ? 4 : r >= 0.9 ? 3 : 2);   // 500 · 320 · 180 tris
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  ico.dispose();
  const noise = valueNoise(Math.floor(rng.next() * 1e9)), o = rng.range(0, 50);
  const fbm = (x: number, y: number, z: number): number => noise(x + o, y, z) * 0.62 + noise(x * 2.1, y * 2.1 + o, z * 2.1) * 0.38;
  const rx = r * rng.range(0.95, 1.12), ry = r * sq, rz = r * rng.range(0.8, 0.95);
  const pos = g.getAttribute('position'), v = new THREE.Vector3();
  const step = ry * rng.range(0.42, 0.6);                                        // the soft ledges' spacing
  // 1–2 cracks: grooves along great circles through the rock (mostly upright), fading out toward the foot
  const cracks = Array.from({ length: r > 0.9 ? rng.int(1, 2) : 1 }, () => ({ n: new THREE.Vector3(rng.range(-1, 1), rng.range(-0.3, 0.3), rng.range(-1, 1)).normalize(), w: rng.range(0.08, 0.12), depth: rng.range(0.14, 0.2) }));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let k = 0.76 + fbm(v.x * 1.3, v.y * 1.3, v.z * 1.3) * 0.48;
    for (const c of cracks) { const dd = Math.abs(v.dot(c.n)); if (dd < c.w) k -= c.depth * (1 - dd / c.w) ** 2 * sstep(-0.7, -0.2, v.y); }
    let x = v.x * rx * k, y = v.y * ry * k, z = v.z * rz * k;
    // soft terraces: pull y toward the nearest ledge, and pull the wall in a touch just under each lip
    const t = (y + ry) / step, f = Math.floor(t), frac = t - f;
    const ty = (f + sstep(0.25, 0.75, frac)) * step - ry;
    const lip = 1 - 0.08 * Math.sin(frac * Math.PI) * sstep(-0.5, 0.2, v.y);
    y = y * 0.5 + ty * 0.5; x *= lip; z *= lip;
    y = Math.max(y, -ry * 0.82);                                                 // a flat foot
    pos.setXYZ(i, x, y, z);
  }
  fit(g, r, ry * 1.05, false);   // before the normals: they are computed on the final shape
  g.computeVertexNormals();
  // crease AO: a vertex sunk below the mean of its neighbours (along its normal) is in a crease
  const idx = g.getIndex();
  const nb: Set<number>[] = Array.from({ length: pos.count }, () => new Set<number>());
  if (idx) for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    nb[a]?.add(b).add(c); nb[b]?.add(a).add(c); nb[c]?.add(a).add(b);
  }
  const nrm = g.getAttribute('normal'), cols = new Float32Array(pos.count * 3), k = new THREE.Color(), n = new THREE.Vector3(), mean = new THREE.Vector3(), q = new THREE.Vector3();
  const drift = valueNoise(Math.floor(rng.next() * 1e9)), mossEdge = valueNoise(Math.floor(rng.next() * 1e9));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
    mean.set(0, 0, 0);
    const set = nb[i] ?? new Set<number>();
    for (const j of set) mean.add(q.fromBufferAttribute(pos, j));
    if (set.size > 0) mean.divideScalar(set.size);
    const crease = Math.max(0, n.dot(q.subVectors(mean, v)) / (r * 0.12));
    const h = (v.y + ry) / (2 * ry);
    const t = (drift(v.x * 0.9 / r, v.y * 0.9 / r, v.z * 0.9 / r) - 0.5) * 2.2;
    const edge = (mossEdge(v.x * 2.4 / r, v.y * 2.4 / r, v.z * 2.4 / r) - 0.5) * 0.3;
    const m = moss * sstep(0.5 + edge, 0.72 + edge, n.y) * sstep(0.3, 0.55, h);
    stone(k, pal, h, n.y, t, m);
    k.multiplyScalar(1 - Math.min(0.45, crease * 0.5));
    cols[i * 3] = k.r; cols[i * 3 + 1] = k.g; cols[i * 3 + 2] = k.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const out = g.toNonIndexed();
  g.dispose();
  return out;
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
