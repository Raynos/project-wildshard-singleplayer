// The Yamen Well's footprint and collision (dome C, E169), the runtime half of the Well (../generators/well.ts and its
// region builders lay it out at build time, baked: ./layoutBake.ts): the shaft, its run north and the far run, the south
// rim, the gondola's cable; the rim's colliders and floor (./colliders.ts), and the two records the layout fills that the
// page keeps — the crossings' colliders and the fog sheets' heights.
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { WELL, Y0 } from '../layout';

/** the canyon's run north under the Cable Deck (its ceiling is the deck's sky screen at +155 m) */
export const EXT = { x0: WELL.x0, x1: -12, z0: -104, z1: WELL.z0 } as const;

/** (F4, round 2) the run north goes on past the Cable Deck's edge, open to the sky: its far walls at the far LOD
 *  (well-mid.ts farRun), so from the rim the canyon recedes ~200 m into the silk to the far gate */
export const FAR = { x0: EXT.x0, x1: EXT.x1, z0: -190, z1: EXT.z0 } as const;

/** the south rim: the ledge at the square's datum the mockup B / D cameras stand on, its balustrade at z0 */
export const RIM = { z0: 11.2, z1: WELL.z1 } as const;

/** the box the shaft's silk mist fills (look/style.ts uShaft) and the rectangles its fog sheets span */
export const SHAFT = { x0: WELL.x0, z0: FAR.z0, x1: WELL.x1, z1: WELL.z1 } as const;

export const WELL_RECTS = [
  { x0: WELL.x0, z0: WELL.z0, x1: WELL.x1, z1: WELL.z1 },
  { x0: EXT.x0, z0: EXT.z0, x1: EXT.x1, z1: EXT.z1 },
  { x0: FAR.x0, z0: FAR.z0, x1: FAR.x1, z1: FAR.z1 },
] as const;

/** the gondola's cable runs along x at this z, y (build.ts slides the cabin between x0 + 5 and x1 − 5) */
export const CABLE = { z: -12, y: Y0 - 16, x0: WELL.x0, x1: WELL.x1 } as const;

/** a box collider from its extents */
function span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): ColliderDesc {
  return { kind: 'box', x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hy: Math.abs(y1 - y0) / 2, hz: Math.abs(z1 - z0) / 2, surface: 'stone' };
}

/**
 * The rim's collision (for the port lead's colliders.ts): the south ledge's floor at the datum, its balustrade and an
 * invisible parapet to +3.2 m (nobody vaults into the shaft), the wall at its west end and the building face behind
 * it. The ledge meets the square's balustrade line at x = 0: the square's own parapet there has to open over
 * z RIM.z0…RIM.z1 for the ledge to be reachable. Nothing below the rim is walkable in the fragment.
 */
export function wellColliders(): ColliderDesc[] {
  return [
    span(WELL.x0, Y0 - 0.7, RIM.z0, WELL.x1, Y0, RIM.z1),
    span(WELL.x0, Y0, RIM.z0 - 0.25, WELL.x1, Y0 + 1.12, RIM.z0 + 0.35),
    span(WELL.x0, Y0 + 1.12, RIM.z0 - 0.1, WELL.x1, Y0 + 3.2, RIM.z0 + 0.1),
    span(WELL.x0 - 1, Y0, RIM.z0 - 0.25, WELL.x0, Y0 + 40, RIM.z1),
    span(WELL.x0, Y0, RIM.z1, WELL.x1, Y0 + 40, RIM.z1 + 1),
  ];
}

/** the rim ledge's floor under (x, z), or undefined */
export function wellFloor(x: number, z: number): number | undefined {
  return x >= WELL.x0 && x <= WELL.x1 && z >= RIM.z0 && z <= RIM.z1 ? Y0 : undefined;
}

export const CROSSING_COLLIDERS: ColliderDesc[] = [];
/** the crossings' collision (deck slabs following each deck, rail walls, the far run's walls; the gate bridges' paifang posts are the paifang model's, E346); filled by the layout's `buildWell` (../generators/well.ts) */
export function crossingColliders(): readonly ColliderDesc[] { return CROSSING_COLLIDERS; }
/** the crossings' collision as the layout bake recorded it (world/layoutBake.ts), in place of `buildWell`'s */
export function restoreCrossingColliders(list: readonly ColliderDesc[]): void { CROSSING_COLLIDERS.length = 0; CROSSING_COLLIDERS.push(...list); }

/** the fog sheets' heights (build.ts draws them across the shaft; each one twice, the second 5 m lower). None: the
 *  sheets read as an opaque pale floor down the shaft; the render lane's layered shaft mist does the depth fade */
export const wellSheets: { y: number; band: number; a: number }[] = [];
