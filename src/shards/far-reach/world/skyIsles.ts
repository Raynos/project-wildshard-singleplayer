import { SKY_ISLES, type SkyIsle } from '../data/skyIsles';

/** Whether a sky isle's footprint stands inside a cube of half width `half`. */
export const inCube = (s: SkyIsle, half: number): boolean => Math.abs(s.x) + s.r <= half && Math.abs(s.z) + s.r <= half;
/**
 * G99 (every shard is a 500 × 500 × 500 cube): the sky isles whose footprint (centre ± rim radius) stands inside the cube.
 * Standalone (`cube` null) every isle builds, the same array; in a grid cell (`ctx.cube`) the five past the cell edge (o2,
 * n1, n2, n3 on the horizon past the crown, b4 across the south edge) leave the world, the falls and the far proxy, so
 * nothing of Sky Reach hangs over the road or a neighbour.
 */
export function skyIslesIn(cube: { readonly half: number } | null): readonly SkyIsle[] {
  return cube === null ? SKY_ISLES : SKY_ISLES.filter((s) => inCube(s, cube.half));
}
