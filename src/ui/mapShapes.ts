/**
 * The built world as flat map shapes (E130): the registered pieces a shard's `ChunkDef.map` names, reduced to their collider
 * footprints in world XZ — the minimap's terrain layer and the full map's zoom tiles draw them (src/ui/Minimap.ts
 * `paintRegion`). Nothing is hand-placed: a piece moves, the map follows on the next repaint.
 *
 *   const shapes = mapShapes(getActiveChunk().map, activeRegistry().pieces);   // once per layer paint
 *   shapes.polys / shapes.dots                                                    // world metres, with a bbox each
 *   mapWants(def, piece.id)                                                       // should a newly added piece repaint the map
 */
import type { ChunkMapDef, MapLook } from '../chunks/ChunkDef';
import type { ColliderDesc, Piece } from '../world/registry';

/** a footprint: a convex outline (x, z pairs) in one look */
export interface MapPoly { look: Exclude<MapLook, 'dot'>; pts: number[]; x0: number; z0: number; x1: number; z1: number }
/** a tree crown: centre + radius, metres */
export interface MapDot { x: number; z: number; r: number }
export interface MapShapes { polys: MapPoly[]; dots: MapDot[] }

const matches = (id: string, pattern: string): boolean => (pattern.endsWith('*') ? id.startsWith(pattern.slice(0, -1)) : id === pattern);
/** the look the def gives this piece id, if any */
export function mapLook(def: ChunkMapDef | undefined, id: string): MapLook | undefined {
  return def?.pieces?.find((g) => g.ids.some((p) => matches(id, p)))?.look;
}
export const mapWants = (def: ChunkMapDef | undefined, id: string): boolean => mapLook(def, id) !== undefined;

type ToWorld = (x: number, y: number, z: number) => [number, number];

/** rotate (x, y, z) by the unit quaternion q */
function rotQ(q: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number): [number, number, number] {
  // v' = v + w·t + q × t, t = 2 (q × v)
  const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
  return [x + q.w * tx + (q.y * tz - q.z * ty), y + q.w * ty + (q.z * tx - q.x * tz), z + q.w * tz + (q.x * ty - q.y * tx)];
}

/** the convex hull of (x, z) pairs (monotone chain), as a flat pair list */
function hull(p: [number, number][]): number[] {
  if (p.length < 3) return p.flat();
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], hi: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2] ?? q, lo[lo.length - 1] ?? q, q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i] ?? [0, 0]; while (hi.length >= 2 && cross(hi[hi.length - 2] ?? q, hi[hi.length - 1] ?? q, q) <= 0) hi.pop(); hi.push(q); }
  lo.pop(); hi.pop();
  return [...lo, ...hi].flat();
}

/** one collider's footprint in world XZ (null: no area worth drawing — a trimesh) */
function footprint(c: ColliderDesc, w: ToWorld): [number, number][] | null {
  if (c.kind === 'treads') {
    const dx = c.to.x - c.from.x, dz = c.to.z - c.from.z, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * c.width / 2, nz = (dx / l) * c.width / 2;
    return [w(c.from.x + nx, c.from.y, c.from.z + nz), w(c.to.x + nx, c.to.y, c.to.z + nz), w(c.to.x - nx, c.to.y, c.to.z - nz), w(c.from.x - nx, c.from.y, c.from.z - nz)];
  }
  const local = (lx: number, ly: number, lz: number): [number, number] => {
    if (c.rot) { const [rx, ry, rz] = rotQ(c.rot, lx, ly, lz); return w(c.x + rx, c.y + ry, c.z + rz); }
    const a = c.yaw ?? 0, cs = Math.cos(a), sn = Math.sin(a); // three's Ry(yaw): x' = x cos + z sin, z' = −x sin + z cos
    return w(c.x + lx * cs + lz * sn, c.y + ly, c.z - lx * sn + lz * cs);
  };
  if (c.kind === 'box') {
    const out: [number, number][] = [];
    for (const sx of [-1, 1]) for (const sy of c.rot ? [-1, 1] : [0]) for (const sz of [-1, 1]) out.push(local(sx * c.hx, sy * c.hy, sz * c.hz));
    return out;
  }
  if (c.kind === 'hull') {
    const out: [number, number][] = [];
    for (let i = 0; i + 2 < c.points.length; i += 3) out.push(local(c.points[i] ?? 0, c.points[i + 1] ?? 0, c.points[i + 2] ?? 0));
    return out;
  }
  if (c.kind === 'ball' || c.kind === 'capsule') {
    const out: [number, number][] = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push(local(Math.cos(a) * c.radius, 0, Math.sin(a) * c.radius)); }
    return out;
  }
  return null;
}

/** the def's pieces as map shapes, read from the registry now */
export function mapShapes(def: ChunkMapDef | undefined, pieces: readonly Piece[]): MapShapes {
  const polys: MapPoly[] = [], dots: MapDot[] = [];
  if (!def?.pieces) return { polys, dots };
  for (const p of pieces) {
    const look = mapLook(def, p.id);
    if (look === undefined || !p.colliders) continue;
    // a following piece's colliders are in its object's frame (the boat on the swell): through its world matrix
    const e = p.follows?.matrixWorld.elements;
    const w: ToWorld = e ? (x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[2] * x + e[6] * y + e[10] * z + e[14]] : (x, _y, z) => [x, z];
    for (const c of p.colliders) {
      if (look === 'dot') {
        if (c.kind === 'treads') continue;
        const [x, z] = w(c.x, c.y, c.z);
        dots.push({ x, z, r: 1.6 });
        continue;
      }
      const f = footprint(c, w);
      if (!f || f.length < 3) continue;
      const pts = hull(f);
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { const x = pts[i] ?? 0, z = pts[i + 1] ?? 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      polys.push({ look, pts, x0, z0, x1, z1 });
    }
  }
  return { polys, dots };
}
