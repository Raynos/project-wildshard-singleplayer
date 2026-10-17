/** Explicit original renderer queries and authored exclusion rows, without active levels or engine services. */
import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

/** Queries the original crag recipe uses; heights and normals come from the retained renderer lattice. */
export interface CragGround {
  heightAt: NativeTerrainSource['heightAt']; normalAt: NativeTerrainSource['normalAt'];
  trailDistance: (x: number, z: number) => number; cabinMask: (x: number, z: number) => number;
}
const trails = [LAYOUT.S_ROAD, LAYOUT.N_ROAD, LAYOUT.W_ROAD, LAYOUT.E_ROAD, ...Object.values(LAYOUT.SPURS)];
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
function segmentSquared(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az, l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? clamp((wx * vx + wz * vz) / l2, 0, 1) : 0;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return dx * dx + dz * dz;
}
/** Retain the native field's operation order and final square root, with no terrain resampling. */
export function pineCragQueries(source: NativeTerrainSource): CragGround {
  return {
    heightAt: source.heightAt, normalAt: source.normalAt,
    trailDistance: pineTrailDistance,
    cabinMask: (x, z) => {
      let mask = 0;
      for (const cabin of LAYOUT.CABIN_SITES) {
        const distance = Math.hypot(x - cabin.x, z - cabin.z), t = clamp((distance - 22) / (11 - 22), 0, 1);
        mask = Math.max(mask, t * t * (3 - 2 * t));
      }
      return mask;
    },
  };
}

/** Original analytic trail query used by authored crags and herd anchors. */
export function pineTrailDistance(x: number, z: number): number {
  let distance = Infinity;
  for (const poly of trails) for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    if (a !== undefined && b !== undefined) distance = Math.min(distance, segmentSquared(x, z, a[0], a[1], b[0], b[1]));
  }
  return Math.sqrt(distance);
}
