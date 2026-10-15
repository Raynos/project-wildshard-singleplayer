/** The cover splat's triangle facts, used only by the build-time cover producers (groundCover.ts, islandCover.ts). */

/** One triangle of cover for a generator's splat: centre (x, z), ground (top) and upright (side) areas, colour. */
export interface CoverTri { x: number; z: number; top: number; side: number; r: number; g: number; b: number }

/**
 * A triangle's ground area (its XZ projection) and its upright cross-section (the mean of its XY and ZY projections: a
 * plant stands at any yaw), as CoverTri.top / side.
 */
export function triAreas(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): { top: number; side: number } {
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  return { top: Math.abs(ny) / 2, side: (Math.abs(nx) + Math.abs(nz)) / 4 };
}
