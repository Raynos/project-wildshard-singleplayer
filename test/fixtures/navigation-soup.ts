import type { NavigationLayer, NavigationSettings, NavigationSoup } from '../../src/sdk/bake/navigation';

/** Retained native baker defaults, before the CPU extraction at 92603cc43. */
export const NAVIGATION_SETTINGS: NavigationSettings = {
  cellSize: 0.25, cellHeight: 0.1, tileSizeVoxels: 128,
  minRegionArea: 24, mergeRegionArea: 64, maxSimplificationError: 2,
  maxEdgeLength: 24, maxVerticesPerPoly: 6,
  detailSampleDistance: 3, detailSampleMaxError: 0.8,
};
/** Both native agent clearances exercise independent erosion and metadata order. */
export const NAVIGATION_LAYERS: NavigationLayer[] = [
  { name: 'small', radius: 0.3, height: 1.8, climb: 0.3, slope: 40 },
  { name: 'large', radius: 0.5, height: 1.8, climb: 0.3, slope: 40 },
];
/** Upward-wound native terrain diagonal, a dry-ground hole, and curved detail sampling over tile seams. */
export function navigationSoup(kind: 'flat' | 'hole' | 'hill'): NavigationSoup {
  const resolution = kind === 'flat' ? 17 : kind === 'hole' ? 49 : 81;
  const step = kind === 'flat' ? 1 : 0.5;
  const positions: number[] = [], indices: number[] = [];
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
    const height = kind === 'hill' ? Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.7 : 0;
    positions.push(x * step, height, z * step);
  }
  for (let z = 0; z < resolution - 1; z++) for (let x = 0; x < resolution - 1; x++) {
    if (kind === 'hole' && x >= 18 && x < 30 && z >= 18 && z < 30) continue;
    const a = z * resolution + x, b = a + 1, c = a + resolution, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  return { positions, indices };
}
