/**
 * A convex-hull stand-in for a scanned mesh (PHYSICS P3, moved here from the old src/world/Props.ts for the models, E315 M2):
 * the geometry's support point in each of 162 directions (an icosphere's vertices), deduplicated — every one is a vertex
 * of the drawn hull, and 30–77 of them (median 53) trace its top to within 5 cm on 91 % of it (p95 6 cm; node probe,
 * P3), so Rapier's quickhull runs on ~50 points a copy, not the photoscan's ~1000 (the full vertex sets cost 6× the
 * build time). A model's `colliders` hands them back in its own space: `{ kind: 'hull', x: 0, y: 0, z: 0, points }`.
 */
import * as THREE from 'three';

const DIRS: number[] = (() => {
  const p = new THREE.IcosahedronGeometry(1, 2).getAttribute('position'), seen = new Set<string>(), out: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!seen.has(key)) { seen.add(key); out.push(p.getX(i), p.getY(i), p.getZ(i)); }
  }
  return out;
})();

/** the support points of `g` under `m` (x, y, z each) */
export function supportPoints(g: THREE.BufferGeometry, m: THREE.Matrix4): Float32Array {
  const pos = g.getAttribute('position'), v = new THREE.Vector3(), pts: number[] = [];
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts.push(v.x, v.y, v.z); }
  const picked = new Set<number>();
  for (let d = 0; d < DIRS.length; d += 3) {
    const dx = DIRS[d] ?? 0, dy = DIRS[d + 1] ?? 0, dz = DIRS[d + 2] ?? 0;
    let best = -Infinity, at = 0;
    for (let i = 0; i < pts.length; i += 3) { const s = (pts[i] ?? 0) * dx + (pts[i + 1] ?? 0) * dy + (pts[i + 2] ?? 0) * dz; if (s > best) { best = s; at = i; } }
    picked.add(at);
  }
  const out = new Float32Array(picked.size * 3);
  let k = 0;
  for (const i of picked) { out[k++] = pts[i] ?? 0; out[k++] = pts[i + 1] ?? 0; out[k++] = pts[i + 2] ?? 0; }
  return out;
}

/**
 * Bake a part's transform into its geometry (its own space), keeping the bounding sphere the old per-instance culling
 * used: the raw geometry's sphere under the same transform (three would re-fit it to the moved vertices).
 */
export function bakePart(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  g.computeBoundingSphere(); // from the vertices (a glTF's own bounds are its accessors' min / max)
  const sphere = (g.boundingSphere ?? new THREE.Sphere()).clone().applyMatrix4(m);
  g.applyMatrix4(m);
  g.boundingSphere = sphere;
  return g;
}
