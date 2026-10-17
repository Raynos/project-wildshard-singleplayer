import * as THREE from 'three';
import { Rng } from '@wildshard/engine/core/rng';
// ── the rock pieces ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One piece: `w` wide (local x), `d` deep (local z), `h` tall, standing on y = 0. Rings of `sides` jittered points
 * taper toward a crown split into 1–3 teeth; `ledges` rings step inward (a flat tread). `lean` tips the stack along x.
 */
export function piece(rng: Rng, w: number, d: number, h: number, sides: number, ledges: number, lean: number, narrow = 0.55, toothH = 0.12): THREE.BufferGeometry {
  const rings: { y: number; pts: [number, number][] }[] = [];
  const levels = Math.max(3, Math.round(h / 3.2));
  const ledgeAt = new Set<number>();
  for (let i = 0; i < ledges; i++) ledgeAt.add(rng.int(1, levels - 2));
  const phase = rng.range(0, Math.PI * 2);
  const radii = Array.from({ length: sides }, () => rng.range(0.72, 1.12));
  let ox = 0, oz = 0, taper = 1;
  for (let k = 0; k <= levels; k++) {
    const t = k / levels;
    const y = t * h * (k === 0 ? 1 : rng.range(0.94, 1.04));
    taper = Math.max(0.12, (1 - t ** 1.25 * narrow) * (k > 0 ? rng.range(0.9, 1.04) : 1));
    ox += lean * (h / levels) + rng.range(-0.12, 0.12) * w * 0.1;
    oz += rng.range(-0.12, 0.12) * d * 0.1;
    const ring = (s: number): [number, number][] => radii.map((r, i) => {
      const a = phase + (i / sides) * Math.PI * 2 + rng.range(-0.18, 0.18);
      const rr = r * s * rng.range(0.9, 1.08);
      return [ox + Math.cos(a) * (w / 2) * rr, oz + Math.sin(a) * (d / 2) * rr];
    });
    rings.push({ y: Math.min(y, h), pts: ring(taper) });
    // a stratum: the stack steps in, leaving a flat tread for the snow
    if (ledgeAt.has(k) && k < levels) rings.push({ y: Math.min(y, h) + 0.05, pts: ring(taper * rng.range(0.7, 0.82)) });
  }
  const pos: number[] = [];
  const tri = (a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple): void => { pos.push(...a, ...b, ...c); };
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1];
    if (!A || !B) continue;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a0 = A.pts[i], a1 = A.pts[j], b0 = B.pts[i], b1 = B.pts[j];
      if (!a0 || !a1 || !b0 || !b1) continue;
      tri([a0[0], A.y, a0[1]], [b0[0], B.y, b0[1]], [a1[0], A.y, a1[1]]);
      tri([a1[0], A.y, a1[1]], [b0[0], B.y, b0[1]], [b1[0], B.y, b1[1]]);
    }
  }
  // the crown: 1–3 teeth along the long axis, each a point over a slice of the top ring
  const top = rings[rings.length - 1];
  if (top) {
    const teeth = w > d * 1.6 ? rng.int(2, 3) : rng.int(1, 2);
    const cx = top.pts.reduce((s, p) => s + p[0], 0) / sides, cz = top.pts.reduce((s, p) => s + p[1], 0) / sides;
    const peaks: THREE.Vector3Tuple[] = [];
    for (let t = 0; t < teeth; t++) {
      const u = teeth === 1 ? 0 : (t / (teeth - 1) - 0.5) * 0.9;
      peaks.push([cx + u * w * taper, top.y + rng.range(0.3, 1) * Math.min(h, 12) * toothH * (1 - Math.abs(u) * 0.6), cz + rng.range(-0.1, 0.1) * d * taper]);
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const p0 = top.pts[i], p1 = top.pts[j];
      if (!p0 || !p1) continue;
      // the tooth nearest this edge's midpoint along x
      const mx = (p0[0] + p1[0]) / 2;
      let best = peaks[0];
      for (const p of peaks) if (best && Math.abs(p[0] - mx) < Math.abs(best[0] - mx)) best = p;
      if (best) tri([p0[0], top.y, p0[1]], best, [p1[0], top.y, p1[1]]);
    }
    // the gaps between the teeth
    for (let t = 0; t + 1 < peaks.length; t++) {
      const a = peaks[t], b = peaks[t + 1];
      if (!a || !b) continue;
      const lowY = top.y + 0.05;
      tri(a, [(a[0] + b[0]) / 2, lowY, cz + d * taper * 0.4], b);
      tri(b, [(a[0] + b[0]) / 2, lowY, cz - d * taper * 0.4], a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed: flat facets
  return g;
}

// ── the three kinds: each draws its shape's choices from the stream, then the piece ───────────────────────────────

/** a fin on a crest: a broad castellated tower, `w` along the ridge */
export function finGeometry(rng: Rng, w: number, d: number, h: number): THREE.BufferGeometry {
  return piece(rng, w, d, h, rng.int(5, 7), rng.int(1, 2), rng.range(-0.05, 0.05), 0.42, 0.18);
}

/** a rib against a steep face: `len` down the fall line, its top slanting down it with the face (`grad`: rise per metre) */
export function ribGeometry(rng: Rng, thick: number, len: number, h: number, grad: number): THREE.BufferGeometry {
  const rib = piece(rng, thick, len, h, rng.int(5, 6), rng.int(1, 2), 0, 0.3, 0.08);
  rib.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, -grad * 0.55, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  rib.computeVertexNormals();
  return rib;
}

/** a broken tower on a steep shoulder, `sz` across */
export function towerGeometry(rng: Rng, sz: number, h: number): THREE.BufferGeometry {
  return piece(rng, sz, sz * rng.range(0.6, 0.9), h, rng.int(5, 7), rng.int(1, 2), rng.range(-0.04, 0.04), 0.35, 0.15);
}

export type CragKind = 'fin' | 'rib' | 'tower';

/** one of each for the Explorer: a mid-size piece in the rock's own grey */
export function specimen(kind: CragKind): THREE.BufferGeometry {
  const rng = new Rng(0xc4a9);
  const g = kind === 'fin' ? finGeometry(rng, 10, 5.5, 14) : kind === 'rib' ? ribGeometry(rng, 5, 8, 12, 1) : towerGeometry(rng, 6, 9);
  const n = g.getAttribute('position').count, cols = new Float32Array(n * 3).fill(0.35);
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

