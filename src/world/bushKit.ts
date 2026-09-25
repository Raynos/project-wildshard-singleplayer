/**
 * bushKit — candidate looks for Driftwood Isle's hibiscus bush (E116). The user, on Explore ▸ Models ▸ Hibiscus bush:
 * "super low poly and just looks like dog shit … it just needs to be done again." The current bush (2–5 jittered
 * icosahedron lobes, 20 tris a lobe on the phone, a few red icosahedron "flowers") reads as one green rock. These are
 * three directions for the user to pick from — a taste call, so the current look stays the default and each one is a URL
 * switch (the rocks' E114 twin is rockKit.ts: chiselled / smooth painted / slabs):
 *
 *   ?bush=a   LEAF CLUMP — a dark welded core wrapped in 50 (phone) / 90 broad folded leaves (6 tris each) fanning up
 *             and out, the palms' frond language at bush scale; flat-shaded on the shared lowPolyMaterial (no new
 *             program); dark inside → sunlit tips. ~350 tris a bush on the phone.
 *   ?bush=b   SCULPTED CANOPY — Sea of Thieves / BotW: 6–8 lobes welded by a smooth union into one closed cloud of a
 *             bush (an icosphere, detail 2, pushed out to the union), scalloped toward the rim, SMOOTH normals leaned
 *             toward the bush's centre so it lights as one ball, painted dark blue-green underneath → warm sunlit crown,
 *             crease shade, a hem of leaf scales hanging off the rim and a few leaves standing out of the crown (normals
 *             transferred from the canopy). Its own program (flatShading off, front faces). ~430 tris a bush.
 *   ?bush=c   LEAF CARDS — 32 (phone) / 48 alpha-cut cards painted with cel-shaded hibiscus-leaf sprays (a canvas atlas
 *             made at build time), both faces shading with the bush's ellipsoid normal so the mass lights as one
 *             volume; a dark core so nothing sees through. Alpha-tested, one texture, its own program. ~210 tris a bush.
 *
 *   Every flowering bush (the scatter's 28 %) wears 4–7 five-petal hibiscus (18 tris: rounded cupped petals, dark
 *   throat, yellow stamen; red mostly, deep red / pink / coral per bush) and 2–3 closed buds, facing out and up.
 *
 *   const look = bushLook();                                  // 'current' | 'a' | 'b' | 'c'
 *   const parts = bushParts(look, spec, groundY, rng);       // non-indexed world-space parts: position, color, aSway (+ normal, uv)
 *   new THREE.Mesh(mergeGeometries(parts), bushMaterial(sky, look));   // plus bushDepthMaterial(look) for its shadow
 *
 * Every part carries `aSway` (the M5 wind, wind.ts) rising from the ground to the crown, like the current bush.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../core/rng';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { lowPolyMaterial } from './lowpolyKit';
import { patchSway, swayByHeight, swayDepthMaterial } from './wind';

export type BushLook = 'current' | 'a' | 'b' | 'c';
export type NewBushLook = Exclude<BushLook, 'current'>;

/** one-line names, for the board and the catalog */
export const BUSH_LOOK_NAMES: Record<BushLook, string> = { current: 'current (icosahedron lobes)', a: 'leaf clump', b: 'sculpted canopy', c: 'leaf cards' };

let chosen: BushLook | null = null;
/** the look this page was loaded with: A (leaf clump) unless `?bush=b|c`, or `?bush=current` for the old lobes (the user's pick, 2026-09-25) */
export function bushLook(): BushLook {
  if (chosen !== null) return chosen;
  const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('bush');
  chosen = v === 'b' || v === 'c' || v === 'current' ? v : 'a';
  return chosen;
}

/** the bush as the scatter describes it: centre, radius (0.7–1.5 m), whether it is in flower */
export interface BushShape { x: number; z: number; r: number; flowers: boolean }

const col = (h: string): THREE.Color => new THREE.Color(h);
const LEAF = { deep: col('#2a5a24'), dark: col('#377a2e'), mid: col('#52a03a'), light: col('#7cc04a'), tip: col('#aad85c'), core: col('#1f3f1c') };
/** the canopy's painted ramp (b): shadow underneath → sunlit crown */
const CANOPY = { under: col('#2c5e3e'), low: col('#43893a'), mid: col('#66ad40'), high: col('#96ca4e'), crown: col('#c8e170') };
/** petal (base, tip) pairs: red, deep red, pink, coral */
const PETALS: [THREE.Color, THREE.Color][] = [
  [col('#9e1420'), col('#ec3a32')], [col('#8a0f22'), col('#d8242e')], [col('#b02a5a'), col('#f47ea0')], [col('#b4321e'), col('#f5754a')],
];
const STAMEN = col('#ffd84a'), THROAT = col('#6a0a18'), SEPAL = col('#3f7a2c');

// ── small helpers ─────────────────────────────────────────────────────────────────────────────────

/** a triangle list with one colour per vertex */
class TriList {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly nrm: number[] = [];
  readonly uv: number[] = [];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: THREE.Color, cb = ca, cc = ca): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.nrm.length > 0) g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    if (this.uv.length > 0) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

/**
 * the same triangles again with the winding reversed (a two-sided sheet on a front-face material). `flip`: the back copy
 * gets the opposite normal (a real sheet); off, both faces keep the one normal (leaves that shade as part of a volume).
 */
function twoSided(g: THREE.BufferGeometry, flip = true): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name), n = a.count, s = a.itemSize, src = a.array, arr = new Float32Array(n * s * 2);
    const sign = name === 'normal' && flip ? -1 : 1;
    arr.set(src, 0);
    const copy = (to: number, from: number): void => { for (let c = 0; c < s; c++) arr[to * s + c] = (src[from * s + c] ?? 0) * sign; };
    for (let t = 0; t < n; t += 3) { copy(n + t, t); copy(n + t + 1, t + 2); copy(n + t + 2, t + 1); }
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  g.dispose();
  return out;
}

/** a direction's lumpiness: a few random-direction sines (deterministic per bush) */
function dirNoise(rng: Rng, n = 5, freq = 3.2): (d: THREE.Vector3) => number {
  const waves: [THREE.Vector3, number, number][] = [];
  for (let i = 0; i < n; i++) waves.push([new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(), rng.range(0, Math.PI * 2), freq * rng.range(0.7, 1.4)]);
  return (d) => { let s = 0; for (const [w, ph, f] of waves) s += Math.sin(d.dot(w) * f + ph); return s / n; };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);

/** a matrix that points +y along `dir`, rolled `roll` about it, at `at` */
function aim(dir: THREE.Vector3, at: THREE.Vector3, roll: number): THREE.Matrix4 {
  _q.setFromUnitVectors(_up, dir);
  const r = new THREE.Quaternion().setFromAxisAngle(_up, roll);
  return _m.compose(at, _q.multiply(r), _s).clone();
}

/**
 * A hibiscus flower facing +y at the origin: five cupped rounded petals (base dark → tip bright, 3 tris each), a dark
 * throat, a yellow stamen column. 18 triangles.
 */
function flower(t: TriList, m: THREE.Matrix4, r: number, petal: [THREE.Color, THREE.Color], rng: Rng): void {
  const [base, tip] = petal, mid = base.clone().lerp(tip, 0.55);
  const c = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
  const spin = rng.range(0, Math.PI * 2);
  // each petal a rounded fan: the throat, two shoulders at ±40° half-way out, two lobes at ±22° at the rim (3 tris);
  // neighbours overlap a little, the rim cups up
  const P = (ang: number, rad: number, up: number): THREE.Vector3 => new THREE.Vector3(Math.cos(ang) * r * rad, r * up, Math.sin(ang) * r * rad).applyMatrix4(m);
  for (let k = 0; k < 5; k++) {
    const a = spin + (k / 5) * Math.PI * 2;
    const l = P(a - 0.7, 0.5, 0.14), rr = P(a + 0.7, 0.5, 0.14), tl = P(a - 0.38, 0.98, 0.34), tr = P(a + 0.38, 0.98, 0.34);
    t.tri(c, l, tl, THROAT, mid, tip);
    t.tri(c, tl, tr, THROAT, tip, tip);
    t.tri(c, tr, rr, THROAT, tip, mid);
  }
  const s0 = new THREE.Vector3(0, 0, 0), s1 = new THREE.Vector3(r * 0.07, r * 0.05, 0), s2 = new THREE.Vector3(-r * 0.04, r * 0.05, r * 0.06), top = new THREE.Vector3(r * 0.08, r * 0.95, r * 0.02);
  for (const v of [s0, s1, s2, top]) v.applyMatrix4(m);
  t.tri(s0, top, s1, STAMEN); t.tri(s1, top, s2, STAMEN); t.tri(s2, top, s0, STAMEN);
}

/** a closed bud pointing +y: a red 3-sided spindle over green sepals. 6 triangles. */
function bud(t: TriList, m: THREE.Matrix4, r: number, petal: [THREE.Color, THREE.Color]): void {
  const ring: THREE.Vector3[] = [], sep: THREE.Vector3[] = [];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * r * 0.32, r * 0.55, Math.sin(a) * r * 0.32).applyMatrix4(m)); sep.push(new THREE.Vector3(Math.cos(a + 1) * r * 0.36, r * 0.3, Math.sin(a + 1) * r * 0.36).applyMatrix4(m)); }
  const foot = new THREE.Vector3(0, 0, 0).applyMatrix4(m), top = new THREE.Vector3(0, r * 1.5, 0).applyMatrix4(m);
  for (let k = 0; k < 3; k++) {
    const a = ring[k], b = ring[(k + 1) % 3], s = sep[k];
    if (!a || !b || !s) continue;
    t.tri(a, b, top, petal[0], petal[0], petal[1]);
    t.tri(foot, s, a, SEPAL);
  }
}

/** where on a bush the blooms go: `n` points on the upper outer shell, facing out and a little up */
function bloomSpots(n: number, rng: Rng, shell: (d: THREE.Vector3) => number, cy: number): { at: THREE.Vector3; dir: THREE.Vector3 }[] {
  const out: { at: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const a0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < n; k++) {
    const az = a0 + (k / n) * Math.PI * 2 + rng.range(-0.35, 0.35), el = rng.range(0.1, 1.05);
    const d = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const at = d.clone().multiplyScalar(shell(d)).add(new THREE.Vector3(0, cy, 0));
    out.push({ at, dir: d.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize() });
  }
  return out;
}

function blooms(t: TriList, b: BushShape, rng: Rng, shell: (d: THREE.Vector3) => number, cy: number, out = 1.0): void {
  if (!b.flowers) return;
  const petal = PETALS[rng.next() < 0.62 ? 0 : rng.int(1, PETALS.length - 1)] ?? PETALS[0];
  if (!petal) return;
  const nf = rng.int(4, 7), nb = rng.int(2, 3);
  const spots = bloomSpots(nf + nb, rng, (d) => shell(d) * out, cy);
  spots.forEach((s, k) => {
    const m = aim(s.dir, s.at, rng.range(0, Math.PI * 2));
    if (k < nf) flower(t, m, b.r * rng.range(0.2, 0.26), petal, rng); else bud(t, m, b.r * 0.12, petal);
  });
}

/** place a local-space part (bush base at the origin) at the bush and give it the wind */
function place(g: THREE.BufferGeometry, b: BushShape, y: number, w = 0.28): THREE.BufferGeometry {
  g.translate(b.x, y, b.z);
  swayByHeight(g, w, y, y + b.r * 1.2, (b.x + b.z) * 0.37);
  return g;
}

/** a dark welded core (no gaps to see through), squashed to (rx, ry, rz) around (0, cy, 0) */
function core(t: TriList, rng: Rng, rx: number, ry: number, cy: number): void {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, TIER_CONFIG.bushDetail > 0 ? 1 : 0).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const k = 1 + rng.range(-0.12, 0.12); p.setXYZ(i, p.getX(i) * rx * k, p.getY(i) * ry * k + cy, p.getZ(i) * rx * k); }
  const ni = g.toNonIndexed(), q = ni.getAttribute('position');
  const a = new THREE.Vector3(), bb = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < q.count; i += 3) {
    a.fromBufferAttribute(q, i); bb.fromBufferAttribute(q, i + 1); c.fromBufferAttribute(q, i + 2);
    const up = (a.y + bb.y + c.y) / 3 > cy;
    t.tri(a, bb, c, up ? LEAF.dark : LEAF.core);
  }
}

// ── A: leaf clump ─────────────────────────────────────────────────────────────────────────────────

function leafClump(b: BushShape, y: number, rng: Rng): THREE.BufferGeometry[] {
  const r = b.r, t = new TriList();
  const cy = r * 0.4, rx = r * 0.6, ry = r * 0.46;
  core(t, rng, rx * 0.92, ry * 0.92, cy);
  const n = TIER_CONFIG.bushDetail > 0 ? 90 : 50;
  const lump = dirNoise(rng, 4, 2.5);
  const shell = (d: THREE.Vector3): number => { const e = 1 / Math.sqrt((d.x * d.x + d.z * d.z) / (rx * rx) + (d.y * d.y) / (ry * ry)); return e * (1 + lump(d) * 0.12); };
  const golden = Math.PI * (3 - Math.sqrt(5)), a0 = rng.range(0, Math.PI * 2);
  const P = new THREE.Vector3();
  const at = (m: THREE.Matrix4, x: number, yy: number, z: number): THREE.Vector3 => P.set(x, yy, z).applyMatrix4(m).clone();
  for (let i = 0; i < n; i++) {
    // an even spread over the shell (golden spiral), biased up: few leaves point at the ground
    const h = 1 - (i + 0.5) / n * 1.22, el = Math.asin(Math.max(-0.28, Math.min(1, h))) + rng.range(-0.12, 0.12), az = a0 + i * golden + rng.range(-0.2, 0.2);
    const d = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const root = d.clone().multiplyScalar(shell(d) * rng.range(0.6, 0.85)).add(new THREE.Vector3(0, cy, 0));
    // a broad pointed leaf (7 points, 6 tris) folded along its midrib, leaning out along d, lifted toward the sky
    const len = r * rng.range(0.48, 0.62), w = len * rng.range(0.52, 0.62), fold = w * 0.2, droop = len * rng.range(0.08, 0.22);
    const m = aim(d.clone().add(new THREE.Vector3(0, 0.3, 0)).normalize(), root, rng.range(-0.5, 0.5));
    const B = at(m, 0, 0, 0), L1 = at(m, -w * 0.42, len * 0.26, fold), R1 = at(m, w * 0.42, len * 0.26, fold);
    const M = at(m, 0, len * 0.5, -fold * 0.15), L2 = at(m, -w * 0.5, len * 0.6, fold * 0.8), R2 = at(m, w * 0.5, len * 0.6, fold * 0.8);
    const T = at(m, 0, len, -droop);
    // colour: deep inside / underneath → light on the sunlit crown; the tip a shade lighter than the base
    const up = (Math.sin(el) + 0.3) / 1.3, pick = rng.next(), jit = (): number => 0.92 + rng.next() * 0.16;
    const base = (up < 0.2 ? LEAF.deep : up < 0.5 ? LEAF.dark : LEAF.mid).clone().multiplyScalar(jit());
    const tipC = (up > 0.65 && pick > 0.3 ? LEAF.tip : up > 0.3 ? LEAF.light : LEAF.mid).clone().multiplyScalar(jit());
    const midC = base.clone().lerp(tipC, 0.55);
    t.tri(B, L1, M, base, midC, midC); t.tri(B, M, R1, base, midC, midC);
    t.tri(L1, L2, M, midC, midC, midC); t.tri(M, R2, R1, midC, midC, midC);
    t.tri(L2, T, M, midC, tipC, midC); t.tri(M, T, R2, midC, tipC, midC);
  }
  blooms(t, b, rng, shell, cy, 1.55);
  return [place(t.geometry(), b, y)];
}

// ── B: sculpted canopy ────────────────────────────────────────────────────────────────────────────

function canopy(b: BushShape, y: number, rng: Rng): THREE.BufferGeometry[] {
  const r = b.r, c0 = new THREE.Vector3(0, r * 0.5, 0);
  // the lobes: a big central one, 3–5 round its shoulders, one on top
  const lobes: { c: THREE.Vector3; r: number }[] = [{ c: new THREE.Vector3(0, r * 0.48, 0), r: r * 0.52 }];
  const ns = rng.int(4, 5), a0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < ns; k++) {
    const a = a0 + (k / ns) * Math.PI * 2 + rng.range(-0.3, 0.3), d = r * rng.range(0.5, 0.6);
    lobes.push({ c: new THREE.Vector3(Math.cos(a) * d, r * rng.range(0.34, 0.52), Math.sin(a) * d), r: r * rng.range(0.4, 0.5) });
  }
  for (let k = 0; k < 2; k++) {
    const a = a0 + k * Math.PI + rng.range(-0.5, 0.5);
    lobes.push({ c: new THREE.Vector3(Math.cos(a) * r * 0.22, r * rng.range(0.78, 0.9), Math.sin(a) * r * 0.22), r: r * rng.range(0.36, 0.44) });
  }
  const scallop = dirNoise(rng, 6, 7.5), swell = dirNoise(rng, 3, 2.2);
  const k = r * 0.06; // the smooth union's blend width: small, so the lobes stay lobes
  const lobeT = (d: THREE.Vector3): number => {
    let s = 0;
    for (const l of lobes) {
      const oc = l.c.clone().sub(c0), bq = d.dot(oc), disc = bq * bq - oc.lengthSq() + l.r * l.r;
      if (disc <= 0) continue;
      const tt = bq + Math.sqrt(disc);
      if (tt > 0) s += Math.exp(tt / k);
    }
    return s > 0 ? k * Math.log(s) : r * 0.3;
  };
  // a leafy hem: the scallops grow toward the bottom rim
  const shell = (d: THREE.Vector3): number => lobeT(d) * (1 + scallop(d) * (0.04 + Math.max(0, 0.35 - d.y) * 0.08) + swell(d) * 0.05);
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.getAttribute('position'), d = new THREE.Vector3(), rad = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const tt = shell(d); rad[i] = tt;
    const v = d.clone().multiplyScalar(tt).add(c0);
    p.setXYZ(i, v.x, Math.max(v.y, -0.04 * r), v.z); // the foot sits flat on the ground
  }
  g.computeVertexNormals();
  // soften: lean each normal toward the direction from the bush's centre, so the lobes read in the silhouette and the
  // painted ramp while the light falls across the bush as one ball (the classic stylised-foliage trick)
  { const nn = g.getAttribute('normal'), v = new THREE.Vector3(), o = new THREE.Vector3();
    for (let i = 0; i < nn.count; i++) { o.fromBufferAttribute(p, i).sub(c0).normalize(); v.fromBufferAttribute(nn, i).multiplyScalar(0.45).addScaledVector(o, 0.55).normalize(); nn.setXYZ(i, v.x, v.y, v.z); } }
  // crease shade: a vertex nearer the centre than its neighbours sits in a fold between lobes
  const idx = g.getIndex(), nsum = new Float32Array(p.count), ncnt = new Float32Array(p.count);
  if (idx) for (let i = 0; i < idx.count; i += 3) for (let e = 0; e < 3; e++) {
    const a = idx.getX(i + e), bb = idx.getX(i + ((e + 1) % 3));
    nsum[a] = (nsum[a] ?? 0) + (rad[bb] ?? 0); ncnt[a] = (ncnt[a] ?? 0) + 1;
    nsum[bb] = (nsum[bb] ?? 0) + (rad[a] ?? 0); ncnt[bb] = (ncnt[bb] ?? 0) + 1;
  }
  const nrm = g.getAttribute('normal'), colors = new Float32Array(p.count * 3), c = new THREE.Color(), top = r * 1.3;
  for (let i = 0; i < p.count; i++) {
    const h = Math.min(1, Math.max(0, p.getY(i) / top)), ny = nrm.getY(i);
    const s = Math.min(1, Math.max(0, h * 0.7 + (ny * 0.5 + 0.5) * 0.45 - 0.08));
    if (s < 0.3) c.copy(CANOPY.under).lerp(CANOPY.low, s / 0.3);
    else if (s < 0.6) c.copy(CANOPY.low).lerp(CANOPY.mid, (s - 0.3) / 0.3);
    else if (s < 0.85) c.copy(CANOPY.mid).lerp(CANOPY.high, (s - 0.6) / 0.25);
    else c.copy(CANOPY.high).lerp(CANOPY.crown, Math.min(1, (s - 0.85) / 0.15));
    const cnt = ncnt[i] ?? 0, crease = cnt > 0 ? Math.max(0, ((nsum[i] ?? 0) / cnt - (rad[i] ?? 0)) / (r * 0.05)) : 0;
    c.multiplyScalar(1 - Math.min(0.35, crease * 0.18));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // drop the faces under the ground (nobody sees them)
  const body = g.toNonIndexed(), bp = body.getAttribute('position'), keep: number[] = [];
  for (let i = 0; i < bp.count; i += 3) if (Math.max(bp.getY(i), bp.getY(i + 1), bp.getY(i + 2)) > 0.02 * r) keep.push(i);
  const pruned = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const a = body.getAttribute(name), arr = new Float32Array(keep.length * 9);
    keep.forEach((i, j) => { for (let v = 0; v < 9; v++) arr[j * 9 + v] = a.array[i * 3 + v] ?? 0; });
    pruned.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  g.dispose(); body.dispose();

  // leaves on the silhouette, shaded with the canopy's normal: a frilly hem hanging off the lower rim, a few standing up
  // out of the crown
  const t = new TriList(), nTips = TIER_CONFIG.bushDetail > 0 ? 40 : 24;
  for (let i = 0; i < nTips; i++) {
    const hem = i % 4 !== 0;
    const az = a0 + i * 2.39996 + rng.range(-0.2, 0.2), el = hem ? rng.range(-0.02, 0.28) : rng.range(0.55, 1.1);
    const dd = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const at = dd.clone().multiplyScalar(shell(dd) * 0.98).add(c0);
    const len = r * (hem ? rng.range(0.28, 0.36) : rng.range(0.2, 0.26)), w = len * (hem ? 0.85 : 0.6);
    // a hem leaf hangs down the surface like a scale (its tip makes the rim's scallop); a crown leaf stands up out of it
    const down = new THREE.Vector3(0, -1, 0).addScaledVector(dd, dd.y).normalize();
    const dir = hem ? down.addScaledVector(dd, 0.35).normalize() : dd.clone().add(new THREE.Vector3(0, 0.5, 0)).normalize();
    const m = aim(dir, at, Math.atan2(dd.x, dd.z) + rng.range(-0.2, 0.2));
    const Bv = new THREE.Vector3(0, 0, 0).applyMatrix4(m), Lv = new THREE.Vector3(-w / 2, len * 0.45, 0).applyMatrix4(m), Rv = new THREE.Vector3(w / 2, len * 0.45, 0).applyMatrix4(m);
    const Mv = new THREE.Vector3(0, len * 0.5, len * 0.08).applyMatrix4(m), T = new THREE.Vector3(0, len, 0).applyMatrix4(m);
    const h = Math.min(1, Math.max(0, at.y / top)), s = h * 0.7 + (dd.y * 0.5 + 0.5) * 0.45 - 0.08;
    const cc = (s < 0.35 ? CANOPY.low : s < 0.7 ? CANOPY.mid : CANOPY.high).clone().multiplyScalar(hem ? 0.88 + rng.next() * 0.1 : 1);
    t.tri(Bv, Lv, Mv, cc); t.tri(Bv, Mv, Rv, cc); t.tri(Lv, T, Mv, cc); t.tri(Mv, T, Rv, cc);
    const n = dd.clone().add(new THREE.Vector3(0, 0.15, 0)).normalize();
    for (let v = 0; v < 12; v++) t.nrm.push(n.x, n.y, n.z);
  }
  const tips = twoSided(t.geometry(), false);
  // flowers: flat normals per petal, both sides
  const f = new TriList();
  blooms(f, b, rng, shell, c0.y, 1.03);
  const parts = [place(pruned, b, y), place(tips, b, y)];
  if (f.pos.length > 0) { const fg = f.geometry(); fg.computeVertexNormals(); parts.push(place(twoSided(fg), b, y)); }
  return parts;
}

// ── C: leaf cards ─────────────────────────────────────────────────────────────────────────────────

/** the atlas: 2×2 cells — three cel-shaded hibiscus-leaf sprays and one solid white cell (the core and flowers sample it) */
const ATLAS_CELLS: [number, number][] = [[0, 0], [0.5, 0], [0, 0.5]];
const WHITE_UV: [number, number] = [0.75, 0.75];
let atlas: THREE.CanvasTexture | null = null;

function leafAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const S = 512, cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('bushKit: no 2d canvas');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(S / 2 + 4, S / 2 + 4, S / 2 - 8, S / 2 - 8);
  let seed = 7;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // one leaf: a pointed oval with a serrated rim, lit upper half / shaded lower half (two flat tones), a midrib line
  const leafShape = (cx: number, cy: number, ang: number, len: number, w: number): void => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    const path = new Path2D();
    path.moveTo(0, 0);
    const teeth = 7;
    for (let s = 1; s <= teeth; s++) { const tt = s / teeth, wx = Math.sin(tt * Math.PI) ** 0.8 * w * (s % 2 ? 1.06 : 0.94); path.lineTo(tt * len, -wx); }
    path.lineTo(len * 1.08, 0);
    for (let s = teeth; s >= 1; s--) { const tt = s / teeth, wx = Math.sin(tt * Math.PI) ** 0.8 * w * (s % 2 ? 1.06 : 0.94); path.lineTo(tt * len, wx); }
    path.closePath();
    ctx.fillStyle = '#b3c2a6';                                          // the shaded half (the vertex colour greens it)
    // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- CanvasRenderingContext2D.fill(Path2D), not Array.fill
    ctx.fill(path);
    ctx.save(); ctx.clip(path); ctx.fillStyle = '#eaf3dc'; ctx.fillRect(0, -w * 1.2, len * 1.1, w * 1.2); ctx.restore(); // the lit half
    ctx.strokeStyle = '#8f9d86'; ctx.lineWidth = Math.max(1.5, w * 0.1);
    ctx.beginPath(); ctx.moveTo(w * 0.1, 0); ctx.lineTo(len * 0.95, 0); ctx.stroke();
    ctx.strokeStyle = '#7d8a74'; ctx.lineWidth = 2; ctx.stroke(path);
    ctx.restore();
  };
  for (const [u, v] of ATLAS_CELLS) {
    const ox = u * S, oy = v * S, C = S / 2;
    const bx = ox + C / 2, by = oy + C - 10;
    // a spray: 6–8 leaves fanning up from the stem at the bottom centre of the cell, the back ones first
    const n = 6 + Math.floor(rnd() * 3);
    const order = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5);
    for (const i of order) {
      const ang = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.3 + (rnd() - 0.5) * 0.25;
      const len = C * (0.36 + rnd() * 0.14), w = len * (0.26 + rnd() * 0.08);
      const st = C * (0.08 + rnd() * 0.18);
      leafShape(bx + Math.cos(ang) * st, by + Math.sin(ang) * st, ang, len, w);
    }
  }
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  atlas.flipY = false;
  return atlas;
}

function leafCards(b: BushShape, y: number, rng: Rng): THREE.BufferGeometry[] {
  const r = b.r, t = new TriList();
  const cy = r * 0.45, rx = r * 0.66, ry = r * 0.52;
  const ellN = (v: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(v.x / (rx * rx), (v.y - cy) / (ry * ry), v.z / (rx * rx)).normalize();
  // the core: flat normals, the atlas's white cell
  core(t, rng, rx * 0.72, ry * 0.72, cy);
  for (let i = t.nrm.length / 3; i < t.pos.length / 3; i++) {
    const v = new THREE.Vector3(t.pos[i * 3] ?? 0, t.pos[i * 3 + 1] ?? 0, t.pos[i * 3 + 2] ?? 0), n = ellN(v);
    t.nrm.push(n.x, n.y, n.z); t.uv.push(WHITE_UV[0], WHITE_UV[1]);
  }
  const n = TIER_CONFIG.bushDetail > 0 ? 48 : 32, golden = Math.PI * (3 - Math.sqrt(5)), a0 = rng.range(0, Math.PI * 2);
  const corners = [new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(0.5, 1, 0), new THREE.Vector3(-0.5, 1, 0)];
  const cuv: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0]];
  for (let i = 0; i < n; i++) {
    const h = 1 - (i + 0.5) / n * 1.2, el = Math.asin(Math.max(-0.25, Math.min(1, h))), az = a0 + i * golden + rng.range(-0.2, 0.2);
    const d = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const root = new THREE.Vector3(d.x * rx * 0.58, cy + d.y * ry * 0.5, d.z * rx * 0.58);
    const size = r * rng.range(0.95, 1.2);
    // the card stands along d (its spray's stem at the root), turned about d so it isn't edge-on to everyone
    const m = aim(d.clone().add(new THREE.Vector3(0, 0.25, 0)).normalize(), root, rng.range(0, Math.PI));
    const cell = ATLAS_CELLS[i % ATLAS_CELLS.length] ?? [0, 0];
    const vs = corners.map((c) => c.clone().multiplyScalar(size).applyMatrix4(m));
    const up = Math.min(1, Math.max(0, (d.y + 0.25) / 1.25)), shade = 0.9 + rng.next() * 0.2;
    const cols = vs.map((v) => {
      const hh = Math.min(1, Math.max(0, v.y / (r * 1.25)));
      const s = hh * 0.6 + up * 0.4;
      return (s < 0.35 ? LEAF.dark.clone().lerp(LEAF.mid, s / 0.35) : LEAF.mid.clone().lerp(LEAF.light, Math.min(1, (s - 0.35) / 0.5))).multiplyScalar(shade);
    });
    for (const [a, bq, c] of [[0, 1, 2], [0, 2, 3]] as const) {
      const va = vs[a], vb = vs[bq], vc = vs[c], ca = cols[a], cb = cols[bq], cc = cols[c];
      if (!va || !vb || !vc || !ca || !cb || !cc) continue;
      t.tri(va, vb, vc, ca, cb, cc);
      for (const k of [a, bq, c]) {
        const v = vs[k], uv = cuv[k];
        if (!v || !uv) continue;
        const nn = ellN(v); t.nrm.push(nn.x, nn.y, nn.z);
        t.uv.push(cell[0] + (0.02 + uv[0] * 0.96) * 0.5, cell[1] + (0.02 + uv[1] * 0.96) * 0.5);
      }
    }
  }
  // both faces of each card shade with the ellipsoid's normal
  const parts = [place(twoSided(t.geometry(), false), b, y, 0.34)];
  const f = new TriList();
  blooms(f, b, rng, (dd) => 1 / Math.sqrt((dd.x * dd.x + dd.z * dd.z) / (rx * rx) + (dd.y * dd.y) / (ry * ry)), cy, 1.5);
  if (f.pos.length > 0) {
    const fg = f.geometry(); fg.computeVertexNormals();
    const cnt = fg.getAttribute('position').count, uv = new Float32Array(cnt * 2);
    for (let i = 0; i < cnt; i++) { uv[i * 2] = WHITE_UV[0]; uv[i * 2 + 1] = WHITE_UV[1]; }
    fg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    parts.push(place(twoSided(fg), b, y));
  }
  return parts;
}

// ── entry points ──────────────────────────────────────────────────────────────────────────────────

/** one bush in a new look, as world-space non-indexed parts (same attributes within a look, so they merge) */
export function bushParts(look: NewBushLook, b: BushShape, groundY: number, rng: Rng): THREE.BufferGeometry[] {
  const parts = look === 'a' ? leafClump(b, groundY, rng) : look === 'b' ? canopy(b, groundY, rng) : leafCards(b, groundY, rng);
  if (look === 'a') for (const g of parts) g.computeVertexNormals(); // flat per-face normals (the E112 shadow flip reads them)
  return parts;
}

/** the look's material: a (flat) shares the kit's material; b and c are their own programs */
export function bushMaterial(sky: Sky, look: NewBushLook): THREE.MeshStandardMaterial {
  if (look === 'a') return lowPolyMaterial(sky);
  if (look === 'b') return lowPolyMaterial(sky, 'bush-smooth', (m) => { m.flatShading = false; m.side = THREE.FrontSide; });
  return lowPolyMaterial(sky, 'bush-cards', (m) => { m.flatShading = false; m.side = THREE.FrontSide; m.map = leafAtlas(); m.alphaTest = 0.5; m.roughness = 0.8; });
}

let cardDepth: THREE.MeshDepthMaterial | null = null;
/** the shadow-pass material: the cards cut their leaves out of the shadow too */
export function bushDepthMaterial(look: NewBushLook): THREE.Material {
  if (look !== 'c') return swayDepthMaterial();
  if (cardDepth) return cardDepth;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide, map: leafAtlas(), alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => patchSway(sh);
  m.customProgramCacheKey = () => 'bush-cards-depth';
  cardDepth = m;
  return m;
}
