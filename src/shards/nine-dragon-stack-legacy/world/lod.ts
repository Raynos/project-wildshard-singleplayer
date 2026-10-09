// (E283, Jake's pick) the distance LODs' shared pieces: how big a pixel is on the phone frame, and a simplified
// copy of a sculpted mesh (meshoptimizer) whose error stays under a given size.
//
// Why: the phone's GPU shades a 2 × 2 quad of pixels for every triangle it rasterises, however small. At the worst
// Nine Dragon poses ~300 k triangles on screen cover less than a pixel each, so the expensive architecture program runs
// several times per pixel they cover. A copy with fewer, bigger triangles, drawn only where its error is under a pixel,
// looks the same and costs a fraction.
import { BufferGeometry, Uint32BufferAttribute } from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

/** metres a pixel spans per metre of distance on Jake's phone frame (portrait: 78° of FOV over 1624 buffer px) */
export const PX_PER_M = (2 * Math.tan((78 / 2) * (Math.PI / 180))) / 1624;

/** a sculpt's LOD error where it starts, in pixels of that frame (E283: the lion's, the Fei Zhua hook's) */
export const SCULPT_PX = 0.7;

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
