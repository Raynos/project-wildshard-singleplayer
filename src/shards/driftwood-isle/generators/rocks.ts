/** Author-only rock sculpting. Runtime and Explorer consume the generated table. */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '@wildshard/sdk/random';
import { finishRock, type RockOpts, type RockPalette } from '../world/rockKit';
import { SHORE_ROCK, REEF_ROCK, ROCK_PROFILES, ROCK_KINDS } from './rockProfiles';

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Rebuild a table record without loading or copying an older table. */
export function sculptBakedRock(id: string, inputs: readonly number[], rng: Rng | null): THREE.BufferGeometry | null {
  if (!id.startsWith('driftwood-isle/rock:')) return null;
  const palette = [SHORE_ROCK, REEF_ROCK].find(p => id === `driftwood-isle/rock:${Object.values(p).join(',')}`);
  const [r, sq, moss, ground, detail] = inputs;
  if (palette === undefined || rng === null || inputs.length !== 5 || inputs.some(v => !Number.isFinite(v))
    || r === undefined || sq === undefined || moss === undefined || ground === undefined || detail === undefined) throw new Error('Invalid authored rock recipe');
  return smoothPainted(r, sq, moss, palette, rng, ground, detail);
}

/** Finished geometry for other author-only scene producers. */
export function authoredRockGeometry(r: number, rng: Rng, o: RockOpts = {}): THREE.BufferGeometry {
  const sq = o.squash ?? 0.7;
  return finishRock(smoothPainted(r, sq, o.moss ?? 0.8, o.palette ?? SHORE_ROCK, rng, o.ground ?? -0.3 * r * sq, o.detail ?? 0));
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
    const g = (1 - dd / c.w) ** 2 * smoothstep(-0.3, 0.1, uy) * (1 - smoothstep(0.45, 0.7, uy)) * smoothstep(-0.3, 0.2, c.along.x * ux + c.along.y * uy + c.along.z * uz);
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
  const profile = ROCK_PROFILES[kind];
  const planes: { n: THREE.Vector3; d: number }[] = [];
  const add = (x: number, y: number, z: number, d: number): void => { planes.push({ n: new THREE.Vector3(x, y, z).normalize(), d }); };
  const sides = rng.int(5, 8), off = rng.range(0, Math.PI * 2);
  for (let i = 0; i < sides; i++) {
    const a = off + (i / sides) * Math.PI * 2 + rng.range(-0.25, 0.25);
    add(Math.cos(a), rng.range(0.05, 0.42), Math.sin(a), rng.range(0.8, 0.98));
  }
  const bevels = rng.int(profile.bevels[0], profile.bevels[1]);
  for (let i = 0; i < bevels; i++) {
    const a = off + rng.range(0, Math.PI * 2), y = rng.range(profile.bevelY[0], profile.bevelY[1]);
    add(Math.cos(a), y / Math.sqrt(1 - y * y), Math.sin(a), rng.range(0.8, 0.92));
  }
  for (let i = 0; i < 3; i++) { const a = off + (i / 3) * Math.PI * 2 + 0.5; add(Math.cos(a), -0.8, Math.sin(a), 0.88); }
  add(0, -1, 0, 0.9);
  const ta = rng.range(0, Math.PI * 2);
  const tilt = rng.range(profile.tilt[0], profile.tilt[1]);
  const top = rng.range(profile.top[0], profile.top[1]);
  add(Math.cos(ta) * tilt, 1, Math.sin(ta) * tilt, top);
  const k = rng.range(profile.softness[0], profile.softness[1]);
  return { planes, k };
}

function makePiece(kind: Archetype, c: THREE.Vector3, rx: number, ry: number, rz: number, cracks: number, rng: Rng): Piece {
  const { planes, k } = piecePlanes(kind, rng), yaw = rng.range(0, Math.PI * 2);
  const cr: Crack[] = Array.from({ length: cracks }, () => {
    const n = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.25, 0.25), rng.range(-1, 1)).normalize();
    const along = new THREE.Vector3(-n.z, 0, n.x).multiplyScalar(rng.next() < 0.5 ? 1 : -1);
    return { n, o: rng.range(-0.25, 0.25), w: rng.range(0.12, 0.16), depth: rng.range(0.07, 0.1), along };
  });
  return { c, rx, ry, rz, cos: Math.cos(yaw), sin: Math.sin(yaw), planes, k, noise: valueNoise(Math.floor(rng.next() * 1e9)), amp: ROCK_PROFILES[kind].noiseAmplitude, cracks: cr };
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
const parsed = new WeakMap<RockPalette, Record<keyof RockPalette, THREE.Color>>();
function parsePalette(pal: RockPalette): Record<keyof RockPalette, THREE.Color> {
  let p = parsed.get(pal);
  if (!p) {
    const c = (s: string): THREE.Color => new THREE.Color(s);
    p = { foot: c(pal.foot), dark: c(pal.dark), mid: c(pal.mid), light: c(pal.light), edge: c(pal.edge), warm: c(pal.warm), cool: c(pal.cool), crease: c(pal.crease), moss: c(pal.moss), mossLight: c(pal.mossLight), mossDark: c(pal.mossDark), wet: c(pal.wet) };
    parsed.set(pal, p);
  }
  return p;
}

/** the rock's pieces, welded and painted: indexed, with `position` and `color` (finishRock makes the drawn rock) */
function smoothPainted(r: number, sq: number, moss: number, palette: RockPalette, rng: Rng, ground: number, lod: number): THREE.BufferGeometry {
  const pal = parsePalette(palette);
  const pebble = r < 0.3;
  const kinds = ROCK_KINDS;
  const kind = pebble ? (rng.next() < 0.5 ? 'dome' : 'block') : rng.pick(kinds);
  const ry = r * sq * ROCK_PROFILES[kind].heightScale;
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
    const detail = Math.max(0, (pebble ? (r < 0.16 ? 0 : 1) : pi === 0 ? (r >= 1.1 ? 4 : r >= 0.6 ? 3 : 2) : (r >= 2 ? 2 : 1)) + lod);   // 20 · 80 · 180 · 320 · 500 tris
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
      lerpC(k, pal.dark, smoothstep(0, 0.3, t));
      lerpC(k, pal.mid, smoothstep(0.25, 0.62, t));
      lerpC(k, pal.light, smoothstep(0.6, 1, t));
      const dr = (drift(v.x * 0.55 / r, v.y * 0.55 / r, v.z * 0.55 / r) - 0.5) * 2.4;
      lerpC(k, dr > 0 ? pal.warm : pal.cool, Math.abs(dr) * 0.32);
      k.multiplyScalar(0.92 + mottle(v.x * 2.6 / r, v.y * 2.6 / r, v.z * 2.6 / r) * 0.16);
      k.multiplyScalar(0.74 + 0.26 * smoothstep(-0.35, 0.85, n.y));                  // a painted top light: the walls a shade darker than the crown
      lerpC(k, pal.edge, smoothstep(2.5, 6, curv) * 0.4 * smoothstep(0.3, 0.6, h) * (0.35 + 0.65 * up));   // worn convex edges
      lerpC(k, pal.wet, (1 - smoothstep(0, 0.16, h)) * 0.6);                        // the wet line
      // moss: on what faces up, with a tongued noisy edge that reaches further down in places
      const en = (edgeN(v.x * 1.3 / r, v.y * 1.3 / r, v.z * 1.3 / r) - 0.5) * 0.75;
      const m = moss > 0 ? smoothstep(mossThr - 0.14, mossThr + 0.14, up + en) * smoothstep(0.32, 0.6, h + en * 0.35) : 0;
      if (m > 0) {
        mc.copy(pal.mossDark);
        lerpC(mc, pal.moss, smoothstep(0.35, 0.85, up));
        lerpC(mc, pal.mossLight, smoothstep(0.35, 0.85, mottle(v.x * 1.8 / r + 3, v.y * 1.8 / r, v.z * 1.8 / r)) * 0.9 * up);
        mc.multiplyScalar(1 - 0.22 * (1 - Math.abs(2 * m - 1)));                // a darker rim where the moss thins out
        k.lerp(mc, m);
      }
      // darkness last: cracks, creases, AO (cool, not black)
      const cr = crack[i] ?? 0, crease = smoothstep(0.4, 3.5, -curv);
      lerpC(k, pal.crease, cr * 0.7 + crease * 0.35 + ao * 0.35);
      k.multiplyScalar((1 - cr * 0.45) * (1 - crease * 0.28) * (1 - ao * 0.5));
      cols[i * 3] = k.r; cols[i * 3 + 1] = k.g; cols[i * 3 + 2] = k.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('normal');   // finishRock computes them again from the same positions and index (the same bits)
    out.push(g);
  }
  if (out.length === 1) { const only = out[0]; if (only) return only; }
  const merged = mergeGeometries(out, false);
  for (const g of out) g.dispose();
  return merged;
}
