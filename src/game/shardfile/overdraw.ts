import type { GlbVertex } from './glbTriangles';

/** Advisory colour-pass raster work; primitive bounds and instance copies are conservatively stacked. */
export interface OverdrawEstimate {
  /** Sum of projected primitive layers, before occlusion or frustum culling. */
  layers: number;
  /** Alpha-blended layers cannot benefit from opaque early depth rejection. */
  blendedLayers: number;
  /** Alpha-tested layers still shade fragments that may be discarded. */
  maskedLayers: number;
  /** Three orthographic axes, not a measured camera or a phone performance claim. */
  basis: 'primitive-bounds';
}

/** Actual projected triangle area divided by its primitive's projected bounding rectangle; O(1) working storage. */
export function projectedLayerCoverage(triangles: Iterable<readonly GlbVertex[]>): number {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], area = [0, 0, 0];
  let count = 0;
  for (const triangle of triangles) {
    if (++count > 400_000 || triangle.length !== 3) throw new Error('overdraw triangle cap or shape');
    const [a, b, c] = triangle; if (a === undefined || b === undefined || c === undefined) throw new Error('overdraw triangle shape');
    for (const vertex of triangle) {
      const coordinates = [vertex.x, vertex.y, vertex.z];
      for (let i = 0; i < 3; i++) {
        const value = coordinates[i]; if (value === undefined || !Number.isFinite(value)) throw new Error('nonfinite overdraw geometry');
        min[i] = Math.min(min[i] ?? Infinity, value); max[i] = Math.max(max[i] ?? -Infinity, value);
      }
    }
    const u = [b.x - a.x, b.y - a.y, b.z - a.z], v = [c.x - a.x, c.y - a.y, c.z - a.z];
    for (const [axis, i, j] of [[0, 1, 2], [1, 0, 2], [2, 0, 1]] as const) {
      area[axis] = (area[axis] ?? 0) + Math.abs((u[i] ?? 0) * (v[j] ?? 0) - (u[j] ?? 0) * (v[i] ?? 0)) / 2;
    }
  }
  let layers = 0;
  for (const [axis, i, j] of [[0, 1, 2], [1, 0, 2], [2, 0, 1]] as const) {
    const rectangle = ((max[i] ?? 0) - (min[i] ?? 0)) * ((max[j] ?? 0) - (min[j] ?? 0));
    if (rectangle > 0) layers = Math.max(layers, (area[axis] ?? 0) / rectangle);
  }
  if (!Number.isFinite(layers)) throw new Error('nonfinite overdraw estimate');
  return layers;
}
