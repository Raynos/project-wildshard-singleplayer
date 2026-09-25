/**
 * Nalati's static collision as world-registry data (NALATI-MERGE P1, AGENTS.md "Physics"): the POI, rock and dressing
 * builders emit `ColliderDesc`s beside the geometry they draw, and `registerSolid` puts each builder in the one world
 * registry (drawn, collides, and — with `model` — in Explore's catalog). Nothing here imports Rapier.
 *
 *   boxes.push({ x, z, hw, hd, rot, yBottom, yTop, surface: 'stone' });    // a P2-era box, now with what it is made of
 *   descs.push(slab(x, z, top, 0.3, hx, hz, yaw, 'planks'));                // a deck / floor as real geometry
 *   descs.push(supportHull(geometry, matrix, 'rock'));                      // a rock as the hull of what it draws
 *   descs.push(prism(x, z, y0, y1, r, 16, yaw, 'felt'));                    // a yurt, a cairn, a tor layer
 *
 * The boxes stay as data too: the weather finds the yurts in them, the camp clutter keeps clear of them. A `ghost` box
 * is data only — a hull or a prism stands in for it in the physics.
 */
import * as THREE from 'three';
import type { Collider } from '../../player/Player';
import type { Material } from '../../physics/surface';
import { boxDesc, type ColliderDesc, type ModelEntry, type PieceCategory, type WorldRegistry } from '../registry';

/** a legacy box (Player.ts `Collider`: yaw −rot, yBottom → yTop) with its material; `ghost`: data only, not solid */
export type Box = Collider & { surface?: Material; ghost?: true };

/** the highest of several floor functions at (x, z) — one `floor` for a piece whose tops are several */
export function highest(fs: readonly ((x: number, z: number) => number | undefined)[]): (x: number, z: number) => number | undefined {
  return (x, z) => {
    let best: number | undefined;
    for (const f of fs) { const v = f(x, z); if (v !== undefined && (best === undefined || v > best)) best = v; }
    return best;
  };
}

/** every solid box as a `ColliderDesc` (its own surface, else the piece's) */
export function boxDescs(boxes: readonly Box[]): ColliderDesc[] {
  const out: ColliderDesc[] = [];
  for (const b of boxes) if (b.ghost !== true) out.push(boxDesc(b, b.surface));
  return out;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();

/** a slab whose top face is at `top` (a deck, a floor, a ledge), `thick` deep, half-extents hx × hz, turned `yaw`
 *  (three's convention, as `M`), tipped by `pitch` about its own x (the same Euler order as `M`: a ramp) */
export function slab(x: number, z: number, top: number, thick: number, hx: number, hz: number, yaw: number, surface: Material, pitch = 0): ColliderDesc {
  if (pitch === 0) return { kind: 'box', x, y: top - thick / 2, z, hx, hy: thick / 2, hz, yaw, surface };
  _q.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ'));
  // the centre sits thick / 2 under the tipped top face's centre (along the slab's own up)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(_q);
  return { kind: 'box', x: x - up.x * thick / 2, y: top - up.y * thick / 2, z: z - up.z * thick / 2, hx, hy: thick / 2, hz, rot: { x: _q.x, y: _q.y, z: _q.z, w: _q.w }, surface };
}

/** a regular `sides`-gon prism from y0 up to y1, circumradius r (a yurt's wall, a cairn, one layer of a tor) */
export function prism(x: number, z: number, y0: number, y1: number, r: number, sides: number, yaw: number, surface: Material, rTop = r): ColliderDesc {
  const pts = new Float32Array(sides * 6), yc = (y0 + y1) / 2;
  for (let i = 0; i < sides; i++) {
    const a = yaw + (i / sides) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pts.set([c * r, y0 - yc, s * r, c * rTop, y1 - yc, s * rTop], i * 6);
  }
  return { kind: 'hull', x, y: yc, z, points: pts, surface };
}

/** an icosphere's unique vertices: 162 directions (detail 2), or 42 for the big crag towers (`coarse`) */
function icoDirs(detail: number): number[] {
  const p = new THREE.IcosahedronGeometry(1, detail).getAttribute('position'), seen = new Set<string>(), out: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!seen.has(key)) { seen.add(key); out.push(p.getX(i), p.getY(i), p.getZ(i)); }
  }
  return out;
}
const DIRS = icoDirs(2), DIRS_COARSE = icoDirs(1);

/**
 * The convex hull of what a geometry draws under `m` (world space), from its support point in each of 162 directions
 * (an icosphere's vertices) — every one a vertex of the drawn hull, ~50 points instead of every vertex (Props.ts's
 * recipe, P3); `coarse`: 42 directions (a crag tower tens of metres high needs no finer).
 */
export function supportHull(g: THREE.BufferGeometry, m: THREE.Matrix4 | null, surface: Material, coarse = false): ColliderDesc {
  const dirs = coarse ? DIRS_COARSE : DIRS;
  const pos = g.getAttribute('position'), v = new THREE.Vector3();
  const n = pos.count, pts = new Float32Array(n * 3);
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    if (m) v.applyMatrix4(m);
    pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
    cx += v.x; cy += v.y; cz += v.z;
  }
  cx /= Math.max(1, n); cy /= Math.max(1, n); cz /= Math.max(1, n);
  const picked = new Set<number>();
  for (let d = 0; d < dirs.length; d += 3) {
    const dx = dirs[d] ?? 0, dy = dirs[d + 1] ?? 0, dz = dirs[d + 2] ?? 0;
    let best = -Infinity, at = 0;
    for (let i = 0; i < pts.length; i += 3) { const s = (pts[i] ?? 0) * dx + (pts[i + 1] ?? 0) * dy + (pts[i + 2] ?? 0) * dz; if (s > best) { best = s; at = i; } }
    picked.add(at);
  }
  const out = new Float32Array(picked.size * 3);
  let k = 0;
  for (const i of picked) { out[k++] = (pts[i] ?? 0) - cx; out[k++] = (pts[i + 1] ?? 0) - cy; out[k++] = (pts[i + 2] ?? 0) - cz; }
  return { kind: 'hull', x: cx, y: cy, z: cz, points: out, surface };
}


/** one Nalati builder into the world registry */
export interface Solid {
  id: string;
  name: string;
  category: PieceCategory;
  /** the source module an agent edits for it */
  file: string;
  /** already in the scene (a child of its builder's group): the registry is handed it for Explore only */
  object?: THREE.Object3D;
  colliders: ColliderDesc[];
  surface: Material;
  /** its floor as a function — placement and footsteps only; the player walks on `colliders` */
  floor?: (x: number, z: number) => number | undefined;
  model?: ModelEntry;
}

/**
 * Register a builder: its colliders become Rapier colliders (src/physics/pieces.ts), its floor is real geometry
 * (`solidFloor`), and with `model` it is in Explore's catalog. The object is NOT handed to the registry as the piece's
 * `object` (the scene listener would re-parent it out of its builder's group): Explore gets it through `model.object`.
 */
export function registerSolid(registry: WorldRegistry, s: Solid): void {
  const object = s.object;
  const model: ModelEntry | undefined = s.model ? { ...s.model, ...(object && !s.model.object ? { object: () => object } : {}) } : undefined;
  registry.add({
    id: s.id, name: s.name, category: s.category, file: s.file, colliders: s.colliders, surface: s.surface, solidFloor: true,
    ...(s.floor ? { floor: s.floor } : {}), ...(model ? { model } : {}),
    ...(object ? { anchor: new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()) } : {}),
  });
}

/**
 * Register many colliders as several pieces, `per` colliders each and a task apart (the phone's 30 ms per-task collider
 * budget — Pine Hollow's props do the same): `id-0`, `id-1` … The first carries the object / model / floor.
 */
export async function registerChunked(registry: WorldRegistry, s: Solid, per: number, yieldTask: () => Promise<void>): Promise<void> {
  const all = s.colliders;
  for (let i = 0, k = 0; i < all.length || k === 0; i += per, k++) {
    const first = k === 0;
    registerSolid(registry, {
      id: `${s.id}-${k}`, name: s.name, category: s.category, file: s.file, surface: s.surface, colliders: all.slice(i, i + per),
      ...(first && s.object ? { object: s.object } : {}), ...(first && s.model ? { model: s.model } : {}), ...(first && s.floor ? { floor: s.floor } : {}),
    });
    await yieldTask();
  }
}

/** a shape's hull candidates in its own space (its support points), once per geometry — then `hullAt` per copy */
export function hullCandidates(g: THREE.BufferGeometry): Float32Array {
  const h = supportHull(g, null, 'rock');
  if (h.kind !== 'hull') return new Float32Array(0);
  const out = new Float32Array(h.points.length);
  for (let i = 0; i < out.length; i += 3) { out[i] = (h.points[i] ?? 0) + h.x; out[i + 1] = (h.points[i + 1] ?? 0) + h.y; out[i + 2] = (h.points[i + 2] ?? 0) + h.z; }
  return out;
}

/** one placed copy of a shape (a dressing rock): its candidates under `m`, as a hull about the copy's origin */
export function hullAt(candidates: Float32Array, m: THREE.Matrix4, surface: Material): ColliderDesc {
  const o = new THREE.Vector3().setFromMatrixPosition(m), v = new THREE.Vector3(), pts = new Float32Array(candidates.length);
  for (let i = 0; i < pts.length; i += 3) {
    v.set(candidates[i] ?? 0, candidates[i + 1] ?? 0, candidates[i + 2] ?? 0).applyMatrix4(m).sub(o);
    pts[i] = v.x; pts[i + 1] = v.y; pts[i + 2] = v.z;
  }
  return { kind: 'hull', x: o.x, y: o.y, z: o.z, points: pts, surface };
}
