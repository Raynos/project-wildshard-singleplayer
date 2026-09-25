/**
 * The shard's navmesh (project/archive/2026-09-23-physics.md P6b): where a creature can walk, baked offline per shard by
 * scripts/bake-navmesh.mjs (navcat's recast port over the baked terrain + every static builder's ColliderDescs, the water
 * left out) into public/assets/baked/<slug>/navmesh.bin — a declared boot file (src/boot/manifest.ts, `physics`), loaded
 * in the `physics` step. Queried with navcat (pure JS, detour's queries).
 *
 * The file holds one layer per agent class (Driftwood: 0.3 m for crabs / monkeys / sailors, 0.5 m for the rest; Pine Hollow: 0.5 m);
 * a query takes the creature's radius and runs on the smallest layer that covers it (the largest when none does).
 * Points are world space; a path's y is the navmesh's (loose — ~0.8 m on hills: the creature's own ground / motor
 * decides its height). The character motor still resolves every move: the navmesh only says where to head.
 */
import * as THREE from 'three';
import {
  addTile, buildTile, createFindNearestPolyResult, createNavMesh, createSlicedNodePathQuery, DEFAULT_QUERY_FILTER, finalizeSlicedFindNodePath,
  findNearestPoly, findRandomPointAroundCircle, findStraightPath, initSlicedFindNodePath, raycast, SlicedFindNodePathStatusFlags, updateSlicedFindNodePath,
  type Box3, type NavMesh, type NavMeshPoly, type NavMeshPolyDetail, type Vec3,
} from 'navcat';
import { navmeshUrl } from './navmeshUrl';
import { frameCost } from '../core/frameCost';

export { navmeshUrl } from './navmeshUrl';

/** One agent class's mesh. */
export interface NavLayer { radius: number; height: number; climb: number; mesh: NavMesh }

interface XYZ { x: number; y: number; z: number }

const MAGIC = 0x4d4e5357; // 'WSNM' little-endian
const VERSION = 1;
const Q = 100; // detail vertices: 1 cm steps
const NEI_EXT = 248; // a one-byte neighbour ≥ this is a portal: 0x8000 | (byte − NEI_EXT)

/** Search box for snapping a point onto the mesh: ±2 m across, ±3 m up and down (a deck over the ground stays apart). */
const SNAP: Vec3 = [2, 3, 2];
/** A path search visits at most this many polys (~0.3 ms); past it the path runs to the poly nearest the goal so far. */
export const MAX_SEARCH_NODES = 1024;

class Reader {
  private at = 0;
  private readonly dv: DataView;
  constructor(buf: ArrayBuffer) { this.dv = new DataView(buf); }
  get done(): boolean { return this.at === this.dv.byteLength; }
  private need(n: number): void { if (this.at + n > this.dv.byteLength) throw new RangeError('navmesh: truncated'); }
  u8(): number { this.need(1); return this.dv.getUint8(this.at++); }
  u16(): number { this.need(2); const v = this.dv.getUint16(this.at, true); this.at += 2; return v; }
  u32(): number { this.need(4); const v = this.dv.getUint32(this.at, true); this.at += 4; return v; }
  i32(): number { this.need(4); const v = this.dv.getInt32(this.at, true); this.at += 4; return v; }
  f32(): number { this.need(4); const v = this.dv.getFloat32(this.at, true); this.at += 4; return v; }
  u8s(n: number): number[] { const out: number[] = []; for (let i = 0; i < n; i++) out.push(this.u8()); return out; }
  u16s(n: number): number[] { const out: number[] = []; for (let i = 0; i < n; i++) out.push(this.u16()); return out; }
}

function readLayer(r: Reader): NavLayer {
  const radius = r.f32(), height = r.f32(), climb = r.f32(), cellSize = r.f32(), cellHeight = r.f32();
  const mesh = createNavMesh();
  mesh.origin = [r.f32(), r.f32(), r.f32()];
  mesh.tileWidth = mesh.tileHeight = r.f32();
  const tiles = r.u32();
  for (let t = 0; t < tiles; t++) {
    const tileX = r.i32(), tileY = r.i32();
    const bounds: Box3 = [r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32()];
    const nv = r.u16(), np = r.u16(), nd = r.u16();
    // polygon vertices sit on the voxel grid: x / z in cells, y in cell heights, above the tile's min corner
    const gx = r.u8s(nv), gz = r.u8s(nv), gy = r.u16s(nv);
    const vertices: number[] = [];
    for (let i = 0; i < nv; i++) vertices.push(bounds[0] + (gx[i] ?? 0) * cellSize, bounds[1] + (gy[i] ?? 0) * cellHeight, bounds[2] + (gz[i] ?? 0) * cellSize);
    const counts = r.u8s(np), areas = r.u8s(np), flags = r.u8s(np);
    const total = counts.reduce((a, b) => a + b, 0);
    const idx = nv <= 256 ? r.u8s(total) : r.u16s(total);
    const neis = np < NEI_EXT ? r.u8s(total).map((n) => (n >= NEI_EXT ? 0x8000 | (n - NEI_EXT) : n)) : r.u16s(total);
    const polys: NavMeshPoly[] = [];
    let k = 0;
    for (let p = 0; p < np; p++) {
      const n = counts[p] ?? 0;
      polys.push({ vertices: idx.slice(k, k + n), neis: neis.slice(k, k + n), flags: flags[p] ?? 0, area: areas[p] ?? 0 });
      k += n;
    }
    const detailVerts = r.u8s(np), detailTris = r.u8s(np);
    const detailVertices: number[] = [];
    for (let i = 0; i < nd * 3; i++) detailVertices.push((bounds[i % 3] ?? 0) + r.u16() / Q);
    // a poly with its own height samples brings its triangles; one without is fanned from its vertices (as
    // navcat's polysToTileDetailMesh does)
    const detailMeshes: NavMeshPolyDetail[] = [], detailTriangles: number[] = [];
    let vb = 0;
    for (let p = 0; p < np; p++) {
      const dv = detailVerts[p] ?? 0, stored = detailTris[p] ?? 0, n = counts[p] ?? 0;
      const trianglesBase = detailTriangles.length / 4;
      if (stored > 0) detailTriangles.push(...r.u8s(stored * 4));
      else for (let j = 2; j < n; j++) detailTriangles.push(0, j - 1, j, (1 << 2) | (j === 2 ? 1 : 0) | (j === n - 1 ? 1 << 4 : 0));
      detailMeshes.push({ verticesBase: vb, verticesCount: dv, trianglesBase, trianglesCount: detailTriangles.length / 4 - trianglesBase });
      vb += dv;
    }
    addTile(mesh, buildTile({ bounds, vertices, polys, detailMeshes, detailVertices, detailTriangles, tileX, tileY, tileLayer: 0, cellSize, cellHeight, walkableHeight: height, walkableRadius: radius, walkableClimb: climb }));
  }
  return { radius, height, climb, mesh };
}

const toVec3 = (p: XYZ, out: Vec3): Vec3 => { out[0] = p.x; out[1] = p.y; out[2] = p.z; return out; };

export class Navmesh {
  /** by radius, smallest first */
  readonly layers: readonly NavLayer[];
  /** query cost, for the perf meter / bench: calls and total ms since load (or the last `resetStats`) */
  readonly stats = { queries: 0, ms: 0 };
  private readonly nearest = createFindNearestPolyResult();
  private readonly nearest2 = createFindNearestPolyResult();
  private readonly query = createSlicedNodePathQuery();
  private readonly a: Vec3 = [0, 0, 0];
  private readonly b: Vec3 = [0, 0, 0];

  constructor(layers: NavLayer[], readonly bytes = 0) {
    if (layers.length === 0) throw new Error('Navmesh: no layers');
    this.layers = [...layers].sort((x, y) => x.radius - y.radius);
  }

  /** The smallest layer whose radius covers `agentRadius`; the largest when none does. */
  layerFor(agentRadius: number): NavLayer {
    const all = this.layers, last = all[all.length - 1];
    if (last === undefined) throw new Error('Navmesh: no layers');
    return all.find((l) => l.radius >= agentRadius - 1e-3) ?? last;
  }

  resetStats(): void { this.stats.queries = 0; this.stats.ms = 0; }

  /**
   * A walkable route from `from` to `to` for a creature of `agentRadius`: the string-pulled corners, `from`'s snapped
   * point first and the goal (or, when the goal can't be reached or the search ran past MAX_SEARCH_NODES, the reachable
   * point nearest it) last. Written into `out` (reused vectors); null when `from` is nowhere near the mesh.
   */
  findPath(from: XYZ, to: XYZ, agentRadius: number, out: THREE.Vector3[] = [], maxNodes = MAX_SEARCH_NODES): THREE.Vector3[] | null {
    const t0 = performance.now();
    try {
      const { mesh } = this.layerFor(agentRadius);
      const s = findNearestPoly(this.nearest, mesh, toVec3(from, this.a), SNAP, DEFAULT_QUERY_FILTER);
      if (!s.success) return null;
      const e = findNearestPoly(this.nearest2, mesh, toVec3(to, this.b), SNAP, DEFAULT_QUERY_FILTER);
      const endRef = e.success ? e.nodeRef : s.nodeRef, endPos = e.success ? e.position : s.position;
      initSlicedFindNodePath(mesh, this.query, s.nodeRef, endRef, s.position, endPos, DEFAULT_QUERY_FILTER);
      updateSlicedFindNodePath(mesh, this.query, maxNodes);
      const nodes = finalizeSlicedFindNodePath(mesh, this.query);
      if ((nodes.status & SlicedFindNodePathStatusFlags.SUCCESS) === 0 || nodes.path.length === 0) return null;
      // the goal off the mesh: head for where it would be (findStraightPath clamps it to the last poly)
      const straight = findStraightPath(mesh, s.position, e.success ? endPos : toVec3(to, this.b), nodes.path);
      if (!straight.success) return null;
      straight.path.forEach((pt, i) => { out[i] = (out[i] ?? new THREE.Vector3()).set(pt.position[0], pt.position[1], pt.position[2]); });
      out.length = straight.path.length;
      return out;
    } finally { this.count(t0); }
  }

  /** The nearest walkable point to `p` (within ±2 m across, ±3 m vertically) for a creature of `agentRadius`, or null. */
  closestWalkable(p: XYZ, agentRadius = 0, out = new THREE.Vector3()): THREE.Vector3 | null {
    const t0 = performance.now();
    try {
      const r = findNearestPoly(this.nearest, this.layerFor(agentRadius).mesh, toVec3(p, this.a), SNAP, DEFAULT_QUERY_FILTER);
      return r.success ? out.set(r.position[0], r.position[1], r.position[2]) : null;
    } finally { this.count(t0); }
  }

  /**
   * A random walkable point about `radius` from `p` and reachable from it (the polys searched are connected to `p`'s),
   * for a creature of `agentRadius` — a wander target. Null when `p` is off the mesh.
   * navcat bounds the polys it searches, not the point: in open ground one big poly can put the point 2× `radius` away
   * (E143's thinner forest: 46 m for 20 asked), so up to 4 draws, the first within 1.5 × `radius`, else the nearest.
   */
  randomPointNear(p: XYZ, radius: number, agentRadius = 0, rand: () => number = Math.random, out = new THREE.Vector3()): THREE.Vector3 | null {
    const t0 = performance.now();
    try {
      const { mesh } = this.layerFor(agentRadius);
      const s = findNearestPoly(this.nearest, mesh, toVec3(p, this.a), SNAP, DEFAULT_QUERY_FILTER);
      if (!s.success) return null;
      let best = Infinity;
      for (let i = 0; i < 4 && best > radius * 1.5; i++) {
        const r = findRandomPointAroundCircle(mesh, s.nodeRef, s.position, radius, DEFAULT_QUERY_FILTER, rand);
        if (!r.success) continue;
        const d = Math.hypot(r.position[0] - s.position[0], r.position[2] - s.position[2]);
        if (d < best) { best = d; out.set(r.position[0], r.position[1], r.position[2]); }
      }
      return best < Infinity ? out : null;
    } finally { this.count(t0); }
  }

  /**
   * How far a creature of `agentRadius` can walk from `p` along the bearing `yaw` (three's: +z at 0, +x at π/2) within
   * `dist` m, over the navmesh: `clear` 1 = the whole way, else the fraction to the wall it meets (a hole round a yurt,
   * a fence, the water's edge, ground past 40°) and that wall's normal (xz). Null when `p` is off the mesh.
   */
  clearAhead(p: XYZ, yaw: number, dist: number, agentRadius = 0): { clear: number; normalX: number; normalZ: number } | null {
    const t0 = performance.now();
    try {
      const { mesh } = this.layerFor(agentRadius);
      const s = findNearestPoly(this.nearest, mesh, toVec3(p, this.a), SNAP, DEFAULT_QUERY_FILTER);
      if (!s.success) return null;
      const b = this.b;
      b[0] = s.position[0] + Math.sin(yaw) * dist; b[1] = s.position[1]; b[2] = s.position[2] + Math.cos(yaw) * dist;
      const r = raycast(mesh, s.nodeRef, s.position, b, DEFAULT_QUERY_FILTER);
      if (r.t >= 1) return { clear: 1, normalX: 0, normalZ: 0 };
      return { clear: Math.max(0, r.t), normalX: r.hitNormal[0], normalZ: r.hitNormal[2] };
    } finally { this.count(t0); }
  }

  private count(t0: number): void { const ms = performance.now() - t0; this.stats.queries++; this.stats.ms += ms; frameCost.nav(ms); }
}

/** Parse a navmesh.bin (scripts/bake-navmesh.mjs's format); null when it isn't one of this version. */
export function parseNavmesh(buf: ArrayBuffer): Navmesh | null {
  try {
    const r = new Reader(buf);
    if (r.u32() !== MAGIC || r.u32() !== VERSION) return null;
    const n = r.u32(), layers: NavLayer[] = [];
    for (let i = 0; i < n; i++) layers.push(readLayer(r));
    return r.done && layers.length > 0 ? new Navmesh(layers, buf.byteLength) : null;
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
}

let active: { slug: string; navmesh: Navmesh } | null = null;

/** The loaded shard's navmesh — null before the `physics` step, for a shard the build has none for, or in node tests. */
export function activeNavmesh(): Navmesh | null { return active?.navmesh ?? null; }

/** Set (or clear) the active navmesh — node tests, or a shard switch. */
export function setActiveNavmesh(slug: string, navmesh: Navmesh | null): void { active = navmesh ? { slug, navmesh } : null; }

/**
 * Fetch and parse `slug`'s navmesh and make it the active one (the `physics` step; the file is a declared boot file, so
 * the loading bar counts it and the service worker caches it). Resolves null — a warning, never a failure — when the
 * build has none or it doesn't parse: the creatures then steer as they did before the navmesh.
 */
export async function loadNavmesh(slug: string): Promise<Navmesh | null> {
  if (active?.slug === slug) return active.navmesh;
  const url = navmeshUrl(slug);
  if (url === null) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const navmesh = parseNavmesh(await res.arrayBuffer());
    if (navmesh === null) throw new Error('not a navmesh.bin of this version');
    setActiveNavmesh(slug, navmesh);
    return navmesh;
  } catch (e) {
    console.warn(`[navmesh] ${slug}: not loaded (${(e as Error).message}); creatures steer without it`);
    return null;
  }
}
