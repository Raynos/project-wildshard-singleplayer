import { Vector3 } from 'three';
import type { ColliderDesc, Shape } from '@dimforge/rapier3d-simd';
import type { Rapier } from './rapier';

/** A bounded convex point cloud, never an AABB or an inflated substitute. Units are shape-local metres. */
export interface ConvexBodyRecipe { readonly points: readonly (readonly [number, number, number])[] }
/** Revalidate typed inputs before native allocation. Same per-hull limits as rigid compound collision. */
export function validateConvexPoints(points: unknown): asserts points is ConvexBodyRecipe['points'] {
  if (!Array.isArray(points) || points.length < 4 || points.length > 128) throw new Error('Invalid convex point count');
  for (const point of points) if (!Array.isArray(point) || point.length !== 3
  || Array.from(point).some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 20)) throw new Error('Invalid convex point');
}
/** Native hull construction shared by live and compound bodies. Refuses non-volumetric clouds. */
export function prepareConvexHull(R: Rapier, points: ConvexBodyRecipe['points'], scale = 1): ColliderDesc {
  validateConvexPoints(points);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid convex scale');
  const vertices = new Float32Array(points.flatMap(point => point.map(n => n * scale)));
  if (vertices.some(n => !Number.isFinite(n))) throw new Error('Unsafe scaled convex points');
  // Rapier owns the convex construction. Refuse non-volumetric point sets before its native hull builder.
  const origin = points[0];
  if (origin === undefined) throw new Error('Empty convex hull');
  const base = new Vector3(...origin), axis = new Vector3(), normal = new Vector3(), delta = new Vector3(), cross = new Vector3();
  for (const point of points) { delta.fromArray(point).sub(base); if (delta.lengthSq() > axis.lengthSq()) axis.copy(delta); }
  for (const point of points) { cross.crossVectors(axis, delta.fromArray(point).sub(base)); if (cross.lengthSq() > normal.lengthSq()) normal.copy(cross); }
  const volume = points.some(point => Math.abs(normal.dot(delta.fromArray(point).sub(base))) > 1e-9);
  if (!volume) throw new Error('Degenerate convex hull');
  const desc = R.ColliderDesc.convexHull(vertices);
  if (desc === null) throw new Error('Invalid convex hull');
  return desc;
}

/** Exact canonical convex vertex identity for snapshot reconnection, independent of native vertex ordering.
 * The temporary native hull is freed immediately; no world collider or controller is allocated. */
export function matchesConvexHull(R: Rapier, actual: Shape, expected: Shape): boolean {
  if (!(actual instanceof R.ConvexPolyhedron)) return false;
  // fromRawShape owns and frees its RawShape in its own finally block.
  const canonical = R.Shape.fromRawShape(expected.intoRaw());
  if (!(canonical instanceof R.ConvexPolyhedron)) return false;
  const vertices = (shape: InstanceType<Rapier['ConvexPolyhedron']>): string[] => {
    const rows: string[] = [];
    for (let i = 0; i < shape.vertices.length; i += 3) rows.push(`${shape.vertices[i]},${shape.vertices[i + 1]},${shape.vertices[i + 2]}`);
    return rows.sort();
  };
  return JSON.stringify(vertices(actual)) === JSON.stringify(vertices(canonical));
}
