// Mesh LODs (SHARD-PLATFORM M3): how big a pixel is on the reference phone frame, and a simplified copy of a sculpted mesh
// (meshoptimizer) whose error stays under a given size.
//
// Why: the phone's GPU shades a 2 × 2 quad of pixels for every triangle it rasterises, however small. Hundreds of
// thousands of sub-pixel triangles run the fragment program several times per pixel they cover. A copy with fewer,
// bigger triangles, drawn only where its error is under a pixel, looks the same and costs a fraction.
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

/** metres a pixel spans per metre of distance on the reference phone frame (portrait: 78° of FOV over 1624 buffer px) */
export const PX_PER_M = (2 * Math.tan((78 / 2) * (Math.PI / 180))) / 1624;

/** meshoptimizer's simplifier, loaded (false where it cannot run: the LODs then keep every level at full detail) */
export async function lodReady(): Promise<boolean> {
  try {
    await MeshoptSimplifier.ready;
    return MeshoptSimplifier.supported;
  } catch { return false; }
}

/**
 * A simplified copy of `geo` (call after `lodReady()` said yes): a new index over the SAME vertex attributes (shared, no
 * copy), as few triangles as keep the surface within `error` (the geometry's own units) of the original. The faces are
 * welded by position first (a sculpt's flat-shaded corners each carry their own vertex: unwelded, every edge is a border
 * and nothing collapses); a welded corner keeps the attributes of the first vertex at its point. Instanced attributes are
 * not copied. `minRatio` caps how far it goes.
 */
export function simplifiedCopy(geo: BufferGeometry, error: number, minRatio = 0.01): BufferGeometry {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const unique: number[] = [];
  const first: number[] = [];
  const at = new Map<string, number>();
  const toU = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x},${y},${z}`;
    let u = at.get(key);
    if (u === undefined) { u = first.length; at.set(key, u); first.push(i); unique.push(x, y, z); }
    toU[i] = u;
  }
  const src = geo.getIndex();
  const count = src === null ? n : src.count;
  const tris: number[] = [];
  for (let t = 0; t + 2 < count; t += 3) {
    const a = toU[src === null ? t : src.getX(t)] ?? 0, b = toU[src === null ? t + 1 : src.getX(t + 1)] ?? 0, c = toU[src === null ? t + 2 : src.getX(t + 2)] ?? 0;
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  const index = Uint32Array.from(tris);
  const target = Math.max(3, Math.floor((index.length * minRatio) / 3) * 3);
  const [out] = MeshoptSimplifier.simplify(index, Float32Array.from(unique), 3, target, error, ['ErrorAbsolute']);
  const g = new BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) if (!('isInstancedBufferAttribute' in a)) g.setAttribute(name, a);
  g.setIndex(new Uint32BufferAttribute(Uint32Array.from(out, (u) => first[u] ?? 0), 1));
  g.boundingSphere = geo.boundingSphere?.clone() ?? null;
  if (g.boundingSphere === null) g.computeBoundingSphere();
  return g;
}

/** the triangles in a geometry */
export function triCount(geo: BufferGeometry): number {
  return (geo.index !== null ? geo.index.count : geo.getAttribute('position').count) / 3;
}

/**
 * A far LOD by vertex clustering: every vertex snaps to the first vertex of its grid cell (`cell` metres), triangles that
 * collapse drop out, unused vertices are compacted away. Every attribute of the kept vertices survives (colour and every custom
 * attribute), so the far copy draws with the same program. The cell grows until the
 * figure is at most `maxTris` triangles.
 */
export function clusterLod(src: BufferGeometry, maxTris: number): BufferGeometry {
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  const idx: ArrayLike<number> = index === null ? Array.from({ length: pos.count }, (_, i) => i) : index.array;
  let cell = 0.05, keep: number[] = [];
  for (let pass = 0; pass < 12; pass++) {
    const rep = new Map<string, number>();
    const map = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const key = `${Math.floor(pos.getX(i) / cell)},${Math.floor(pos.getY(i) / cell)},${Math.floor(pos.getZ(i) / cell)}`;
      const r = rep.get(key);
      if (r === undefined) { rep.set(key, i); map[i] = i; } else map[i] = r;
    }
    keep = [];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = map[idx[t] ?? 0] ?? 0, b = map[idx[t + 1] ?? 0] ?? 0, c = map[idx[t + 2] ?? 0] ?? 0;
      if (a !== b && b !== c && a !== c) keep.push(a, b, c);
    }
    if (keep.length / 3 <= maxTris) break;
    cell *= 1.25;
  }
  // compact
  const remap = new Map<number, number>();
  const order: number[] = [];
  const out: number[] = [];
  for (const v of keep) {
    let n = remap.get(v);
    if (n === undefined) { n = order.length; remap.set(v, n); order.push(v); }
    out.push(n);
  }
  const g = src.clone();
  for (const name of Object.keys(src.attributes)) {
    const a = src.getAttribute(name);
    const arr = new Float32Array(order.length * a.itemSize);
    order.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(v, c); });
    g.setAttribute(name, new Float32BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(new Uint32BufferAttribute(out, 1));
  g.computeBoundingSphere();
  return g;
}
