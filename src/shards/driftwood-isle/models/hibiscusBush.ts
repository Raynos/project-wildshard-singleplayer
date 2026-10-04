/**
 * The hibiscus bush (E306 / E315 M1: a model on the contract, src/engine/models/model.ts; it was src/world/bushKit.ts) —
 * Driftwood Isle's LEAF CLUMP the user picked (E116, 2026-09-25): a dark welded core wrapped in 50 (phone) / 90 broad
 * folded leaves (6 tris each) fanning up and out, the palms' frond language at bush scale; flat-shaded on the shared
 * lowPolyMaterial (no program of its own); dark inside → sunlit tips. ~350 tris a bush on the phone.
 *
 *   Every flowering bush (the scatter's 28 %) wears 4–7 five-petal hibiscus (18 tris: rounded cupped petals, dark
 *   throat, yellow stamen; red mostly, deep red / pink / coral per bush) and 2–3 closed buds, facing out and up.
 *
 * Built in its own space, its base at the origin: one non-indexed part (position, color, flat normals, aSway). Every
 * copy has its own shape from the placement group's rng stream (the old Bushes.build loop's, so the move is exact);
 * `aSway` (the M5 wind, wind.ts) rises from the ground to the crown, its phase set by the world from where the bush
 * stands (src/shards/driftwood-isle/world/Bushes.ts). No colliders: you walk through bushes.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel } from '@wildshard/engine/models/model';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayByHeight, swayDepthMaterial } from '@wildshard/engine/world/wind';
import { islandKnobs } from '../tiers';

/** one bush: its radius (0.7–1.5 m), whether it is in flower, and its sway's phase (the world's: from where it stands) */
export interface HibiscusBushParams { readonly r: number; readonly flowers: boolean; readonly phase: number }

const col = (h: string): THREE.Color => new THREE.Color(h);
const LEAF = { deep: col('#2a5a24'), dark: col('#377a2e'), mid: col('#52a03a'), light: col('#7cc04a'), tip: col('#aad85c'), core: col('#1f3f1c') };
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
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: THREE.Color, cb = ca, cc = ca): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
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

function blooms(t: TriList, b: HibiscusBushParams, rng: Rng, shell: (d: THREE.Vector3) => number, cy: number, out: number): void {
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

/** give a part (bush base at the origin) the wind: the weight rises from the ground to 1.2 radii up */
function windy(g: THREE.BufferGeometry, b: HibiscusBushParams): THREE.BufferGeometry {
  swayByHeight(g, 0.28, 0, b.r * 1.2, b.phase);
  return g;
}

/** a dark welded core (no gaps to see through), squashed to (rx, ry, rz) around (0, cy, 0) */
function core(t: TriList, rng: Rng, rx: number, ry: number, cy: number): void {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, islandKnobs().bushDetail > 0 ? 1 : 0).deleteAttribute('normal').deleteAttribute('uv'));
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

// ── the leaf clump ───────────────────────────────────────────────────────────────────────────────

function leafClump(b: HibiscusBushParams, rng: Rng): THREE.BufferGeometry {
  const r = b.r, t = new TriList();
  const cy = r * 0.4, rx = r * 0.6, ry = r * 0.46;
  core(t, rng, rx * 0.92, ry * 0.92, cy);
  const n = islandKnobs().bushDetail > 0 ? 90 : 50;
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
  const g = windy(t.geometry(), b);
  g.computeVertexNormals(); // flat per-face normals (the E112 shadow flip reads them)
  return g;
}

// ── the model ─────────────────────────────────────────────────────────────────────────────────────

export const hibiscusBush = defineModel<HibiscusBushParams>({
  id: 'driftwood-isle/hibiscus-bush', name: 'Hibiscus bush', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/hibiscusBush.ts',
  defaults: { r: 1.3, flowers: true, phase: 0 },
  variants: [
    { id: 'flowering', label: 'In flower', params: {} },
    { id: 'leaf', label: 'Leaf only', params: { flowers: false } },
    { id: 'small', label: 'Small', params: { r: 0.8 } },
  ],
  seed: 0x5ea1 ^ 0xb5 ^ 0xe116,
  // the shared kit material (no program of its own) and the swaying shadow pass; the shadows are the tier's call
  build: (ctx, p, rng) => [{ geometry: leafClump(p, rng), material: lowPolyMaterial(ctx.sky), castShadow: islandKnobs().bushShadows, receiveShadow: true, customDepthMaterial: swayDepthMaterial() }],
});
