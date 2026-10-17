import * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { Noise2D } from '@wildshard/engine/core/noise';
import { bakedGeometry } from '@wildshard/engine/world/geometryBake';

const UP = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();

// ── smooth primitives ───────────────────────────────────────────────────────────────────────────────

const _m = new THREE.Matrix4();
/** a smooth round pole / log from a to b, radius r0 at a → r1 at b; `segs` rings along it (for a painter that varies along the length) */
export function pole(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, sides = 7, segs = 1): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, segs, false, 0.3);
  g.applyMatrix4(_m.makeRotationFromQuaternion(_q.setFromUnitVectors(UP, d.normalize())));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** a smooth lumpy stone: an icosphere (detail 2 = 320 faces, 1 = 80) displaced by seeded noise, squashed. A shard that adds
 *  a geometry bake (./geometryBake.ts) reads the shape from it; the smooth normals are exact arithmetic, made here */
export function blob(r: number, rng: Rng, detail = 1, squash = 0.75, rough = 0.22): THREE.BufferGeometry {
  const g = bakedGeometry('engine/blob', [r, detail, squash, rough], rng, () => blobShape(r, rng, detail, squash, rough));
  g.computeVertexNormals();
  return g;
}

/** the blob's welded, displaced shape: indexed, `position` only */
function blobShape(r: number, rng: Rng, detail: number, squash: number, rough: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const merged = mergeVerticesByPos(g);
  const pos = merged.getAttribute('position');
  const ox = rng.range(0, 100), oz = rng.range(0, 100);
  const nz = new Noise2D(rng.int(1, 1e6));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + rough * (nz.get(x / r * 1.3 + ox, z / r * 1.3 + y / r + oz) * 0.75 + nz.get(x / r * 3 + oz, y / r * 3 - ox) * 0.25);
    pos.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return merged;
}

/** weld an unindexed / seam-split geometry by position (so displacement keeps it watertight and normals smooth) */
export function mergeVerticesByPos(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.getAttribute('position');
  const map = new Map<string, number>();
  const verts: number[] = [], idx: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let k = map.get(key);
    if (k === undefined) { k = verts.length / 3; verts.push(x, y, z); map.set(key, k); }
    idx.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(idx);
  if (src !== g) src.dispose();
  g.dispose();
  return out;
}

/** a lathe from a (radius, height) profile, `seg` around; smooth normals */
export function lathe(profile: [number, number][], seg: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  // LatheGeometry duplicates the seam column: weld it so the normals are smooth all the way round
  const w = mergeVerticesByPos(g);
  w.computeVertexNormals();
  return w;
}

/**
 * A surface of revolution with an arbitrary radius / height per (angle, t): `fn(theta, t) → [r, y]`, `segU` round,
 * `segV` along t ∈ [0, 1]. Indexed and seam-welded, so its normals are smooth — the felt sagging between the roof
 * ribs, the wall's panel folds. Angle 0 is +z (the same as a lathe).
 */
export function revolve(fn: (theta: number, t: number) => [number, number], segU: number, segV: number): THREE.BufferGeometry {
  const v: number[] = [], idx: number[] = [];
  for (let j = 0; j <= segV; j++) {
    const t = j / segV;
    for (let i = 0; i < segU; i++) {
      const th = (i / segU) * Math.PI * 2;
      const [r, y] = fn(th, t);
      v.push(Math.sin(th) * r, y, Math.cos(th) * r);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * segU + i, b = j * segU + ((i + 1) % segU), c = (j + 1) * segU + i, d = (j + 1) * segU + ((i + 1) % segU);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * `revolve` with texture coordinates: u = angle / 2π × `uReps` (the seam column is doubled so u runs 0 → uReps without
 * wrapping), v = t. The seam's two columns share one averaged normal, so the shading has no seam.
 */
export function revolveUV(fn: (theta: number, t: number) => [number, number], segU: number, segV: number, uReps: number): THREE.BufferGeometry {
  const v: number[] = [], uv: number[] = [], idx: number[] = [];
  const cols = segU + 1;
  for (let j = 0; j <= segV; j++) {
    const t = j / segV;
    for (let i = 0; i <= segU; i++) {
      const th = ((i % segU) / segU) * Math.PI * 2;
      const [r, y] = fn(th, t);
      v.push(Math.sin(th) * r, y, Math.cos(th) * r);
      uv.push((i / segU) * uReps, t);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  for (let j = 0; j <= segV; j++) {
    const a = j * cols, b = a + segU;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}
