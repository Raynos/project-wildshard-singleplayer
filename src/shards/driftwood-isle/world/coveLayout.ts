/** One authored layout and floor law for the offline mesh and live collision owner. */
import { WORLD_DROP } from './sea';

export interface CaveBounds { x: number; z: number; r: number; yMin: number; yMax: number }
export interface CoveAnchor { x: number; y: number; z: number; yaw: number }
export interface CoveSpec {
  pools: { x: number; z: number; r: number }[];
  /** where the crab groups sit (a pool each) */
  crabSites: { x: number; z: number }[];
  /** the cascade: top and foot of the fall (world), width */
  fall: { top: [number, number]; foot: [number, number]; width: number };
  /** the sea cave: the middle of the mouth, the yaw of the interior (local +z), width / height of the antechamber, depth to the back wall */
  cave: { x: number; z: number; yaw: number; w: number; h: number; depth: number };
  caveBounds: CaveBounds;
}

// cave layout (local metres, lz = 0 at the mouth)
export const ANTE = { z1: 5.2, hw: 2.8, ceil: 3.8 };
export const PASS = { z0: 5.2, z1: 6.4, hw: 1.25, ceil: 2.9 };
export const ALC = { z0: 6.4, hw: 2.0, ceil: 3.4 };
export const RAMP = { z0: 5.8, z1: 6.8 };
/** PHYSICS P4: the ramp's collision treads (see `colliderDescs`): 4 × 0.375 m, centred on the drawn ramp's middle, 5 cm clear of the sluice leaf */
export const STEPS = { z0: 5.65, z1: 7.15 };
/** the antechamber and alcove floors: authored over the +0.8 m waterline, lowered with the whole world by G164's drop
 *  (world/sea.ts) like the terrain they are cut into */
export const ANTE_FLOOR = 1.2 - WORLD_DROP, ALC_FLOOR = 2.2 - WORLD_DROP;
/**
 * PHYSICS P4: the baked terrain rises through the cave floor from lz ≈ 5 and stands over the alcove floor from lz ≈ 7,
 * so the physics heightfield is pushed under the cave inside this rectangle (local, from the mouth). It starts 1 m in
 * (the grid row at the mouth keeps its height: the beach walks straight onto the floor slab) and ends past the back
 * wall; ±4.2 m takes every grid column whose triangles reach the floor. `BACKFILL` walls off the triangles that climb
 * back out of the cut behind the back wall (one grid cell, ~2 m, past its far edge).
 */
export const CUT = { hw: 4.2, z0: 1.0, z1: 10.2, below: ANTE_FLOOR - 0.6 };
export const BACKFILL = { hw: CUT.hw + 2.0, z1: CUT.z1 + 2.0 };

  /** the cave's floor under local lz (the antechamber, the ramp through the passage, the raised alcove) */
export function coveFloorAt(lz: number): number {
    if (lz < RAMP.z0) return ANTE_FLOOR;
    if (lz > RAMP.z1) return ALC_FLOOR;
    return ANTE_FLOOR + ((lz - RAMP.z0) / (RAMP.z1 - RAMP.z0)) * (ALC_FLOOR - ANTE_FLOOR);
  }
export function coveHalfWidth(lz: number): number { return lz < PASS.z0 ? ANTE.hw : lz < PASS.z1 ? PASS.hw : ALC.hw; }
export function coveCeil(lz: number): number { return lz < PASS.z0 ? ANTE.ceil : lz < PASS.z1 ? PASS.ceil : ALC.ceil; }

export function coveWorld(cave: CoveSpec['cave'], lx: number, lz: number): [number, number] {
  const cs = Math.cos(cave.yaw), sn = Math.sin(cave.yaw);
  return [cave.x + lx * cs + lz * sn, cave.z - lx * sn + lz * cs];
}
/** Numeric layout identity, independent of object property order. */
export function coveSpecKey(spec: CoveSpec): string {
  const { cave: c, caveBounds: b, fall: f } = spec;
  return [spec.pools.length, ...spec.pools.flatMap(p => [p.x, p.z, p.r]),
    spec.crabSites.length, ...spec.crabSites.flatMap(p => [p.x, p.z]),
    ...f.top, ...f.foot, f.width, c.x, c.z, c.yaw, c.w, c.h, c.depth,
    b.x, b.z, b.r, b.yMin, b.yMax].join(',');
}
  /** the island layout: pools on the cove flats, the cascade down the crag, the sea cave in the notch at the crag foot */
export function islandCoveSpec(): CoveSpec {
    const cave = { x: 142, z: 14.5, yaw: 0, w: ANTE.hw * 2, h: ANTE.ceil, depth: 8.8 };
    const mid = cave.depth * 0.5;
    return {
      pools: [
        { x: 130, z: 4, r: 2.3 }, { x: 134.5, z: 8.5, r: 1.5 }, { x: 126.5, z: 7, r: 1.2 },
        { x: 133, z: -8, r: 2.1 }, { x: 128, z: -13, r: 1.4 }, { x: 137.5, z: -3.5, r: 1.1 },
      ],
      crabSites: [{ x: 130, z: 5 }, { x: 132, z: -9 }],
      fall: { top: [120.5, 24.5], foot: [127.5, 18], width: 1.7 },
      cave,
      caveBounds: { x: cave.x + Math.sin(cave.yaw) * mid, z: cave.z + Math.cos(cave.yaw) * mid, r: 5.2, yMin: ANTE_FLOOR - 0.4, yMax: ANTE_FLOOR + 4.5 },
    };
  }
