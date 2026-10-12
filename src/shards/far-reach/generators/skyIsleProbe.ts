import { BackSide, FrontSide, Matrix4, Raycaster, Vector3, type BufferAttribute, type BufferGeometry, type Mesh } from 'three';

/**
 * A probe's straight-down rays without walking every triangle (rt3-crossing2). Three's Mesh.raycast tests all of a model's
 * triangles for each ray: 49 rays a model (twice: the isles and the keels) and one per pine cost Sky Reach's entry a 4.8 s
 * task at 4x CPU. This bins the triangles by their x / z extent once (per position version) and runs three's own
 * ray-triangle test, in index order, on the triangles under the ray: the nearest hit's height, as
 * `new Raycaster(origin, down).intersectObject(probe, false)[0]?.point.y` returns it (a vertical ray meets only triangles
 * whose x / z extent holds it). Any other ray or a moved probe takes three's raycast.
 */
interface DownGrid { readonly version: number; readonly x0: number; readonly z0: number; readonly step: number; readonly cells: readonly (number[] | undefined)[] }
const DOWN_GRID = 64;
const downGrids = new WeakMap<BufferGeometry, DownGrid>();
const downA = new Vector3(), downB = new Vector3(), downC = new Vector3(), downHit = new Vector3(), downRay = new Raycaster(), DOWN = new Vector3(0, -1, 0), IDENTITY = new Matrix4();
function downRange(geometry: BufferGeometry): { readonly start: number; readonly end: number; readonly corner: (i: number) => number } {
  const index = geometry.getIndex(), count = index === null ? geometry.getAttribute('position').count : index.count, range = geometry.drawRange;
  return { start: Math.max(0, range.start), end: Math.min(count, range.start + range.count), corner: index === null ? (i) => i : (i) => index.getX(i) };
}
function downGrid(geometry: BufferGeometry): DownGrid {
  const p = geometry.getAttribute('position') as BufferAttribute, held = downGrids.get(geometry);
  if (held !== undefined && held.version === p.version) return held;
  const { start, end, corner } = downRange(geometry);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = start; i < end; i++) { const v = corner(i), x = p.getX(v), z = p.getZ(v); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const step = Math.max(x1 - x0, z1 - z0, 1e-6) / DOWN_GRID, cells = Array.from<number[] | undefined>({ length: DOWN_GRID * DOWN_GRID });
  const cell = (v: number, o: number): number => Math.min(DOWN_GRID - 1, Math.max(0, Math.floor((v - o) / step)));
  for (let i = start; i + 2 < end; i += 3) {
    const a = corner(i), b = corner(i + 1), c = corner(i + 2);
    const ax = p.getX(a), bx = p.getX(b), cx = p.getX(c), az = p.getZ(a), bz = p.getZ(b), cz = p.getZ(c);
    const i0 = cell(Math.min(ax, bx, cx), x0), i1 = cell(Math.max(ax, bx, cx), x0), k0 = cell(Math.min(az, bz, cz), z0), k1 = cell(Math.max(az, bz, cz), z0);
    for (let k = k0; k <= k1; k++) for (let j = i0; j <= i1; j++) { const at = k * DOWN_GRID + j; (cells[at] ??= []).push(i); }
  }
  const grid = { version: p.version, x0, z0, step, cells };
  downGrids.set(geometry, grid);
  return grid;
}
/** The height of the first hit of a ray from `origin` straight down onto `probe` (undefined: a miss). */
export function skyIsleHitDown(probe: Mesh, origin: Vector3): number | undefined {
  const geometry = probe.geometry, material = probe.material;
  downRay.set(origin, DOWN);
  if (Array.isArray(material) || !probe.matrixWorld.equals(IDENTITY) || probe.morphTargetInfluences !== undefined) return downRay.intersectObject(probe, false)[0]?.point.y;
  // three's early-outs, in its order: the bounding sphere (computed if absent), then the box if the geometry has one
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere === null || !downRay.ray.intersectsSphere(sphere) || (geometry.boundingBox !== null && !downRay.ray.intersectsBox(geometry.boundingBox))) return undefined;
  const grid = downGrid(geometry), p = geometry.getAttribute('position') as BufferAttribute, { corner } = downRange(geometry);
  const j = Math.floor((origin.x - grid.x0) / grid.step), k = Math.floor((origin.z - grid.z0) / grid.step);
  if (j < 0 || k < 0 || j >= DOWN_GRID || k >= DOWN_GRID) {
    // past the outermost cell edge only by the clamp's rounding: three's walk decides
    if (origin.x < grid.x0 || origin.z < grid.z0 || origin.x > grid.x0 + grid.step * DOWN_GRID || origin.z > grid.z0 + grid.step * DOWN_GRID) return undefined;
    return downRay.intersectObject(probe, false)[0]?.point.y;
  }
  const backface = material.side === FrontSide, flip = material.side === BackSide;
  let best = Infinity, y: number | undefined;
  for (const i of grid.cells[k * DOWN_GRID + j] ?? []) {
    downA.fromBufferAttribute(p, corner(i)); downB.fromBufferAttribute(p, corner(i + 1)); downC.fromBufferAttribute(p, corner(i + 2));
    const hit = flip ? downRay.ray.intersectTriangle(downC, downB, downA, true, downHit) : downRay.ray.intersectTriangle(downA, downB, downC, backface, downHit);
    if (hit === null) continue;
    const distance = origin.distanceTo(hit);
    if (distance < best) { best = distance; y = hit.y; }
  }
  return y;
}
