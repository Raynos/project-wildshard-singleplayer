// The Yamen Well (dome C, E169), the partial shard's cut: its rim at the square's datum (+125 m) and the upper galleries
// down to ~+60 m, dissolving into silk mist below. Not a sheer square shaft: a NARROW CANYON (round-6 mockups B and D).
// The shaft keeps its footprint by the square (x −28…0, z −44…16) and runs on north under the Cable Deck as a 16 m
// slot (x −28…−12, z −104…−44) whose ceiling is the deck's sky screen, so the view along it from the south rim
// recedes 115 m into the mist. Both long walls carry stacked timber verandas and concrete walkways 2–6 m deep
// (well-galleries.ts), so the open gap reads 10–18 m; bridges, catwalks and a gate bridge cross it at many levels,
// sagging nets hang between the gallery fronts, the red gondola runs on its cable between two stations
// (well-bridges.ts). Neon blade signs hang out into the canyon and face the rim; lanterns, laundry, people everywhere.
// The regions are built by their own files so each can be owned on its own (well-plan.ts: the shared plan):
// well-rim.ts (the rim + the near galleries), well-mid.ts (the run north + every crossing), well-lower.ts (below SPLIT).
import type { ColliderDesc } from '../../../world/registry';
import type { Ctx } from './ctx';
import { WELL, Y0 } from '../layout';
import { buildRim } from './well-rim';
import { buildMid } from './well-mid';
import { buildLower } from './well-lower';
import { RIM, WELL_RECTS, WellPlan } from './well-plan';

export { CABLE, EXT, RIM, SHAFT, WELL_RECTS } from './well-plan';
export { wellSheets } from './well-lower';
/** the gondola's cabin (dome B2's detailed one; build.ts hangs it on the cable) */
export { gondolaCabin as gondolaKit } from './well-bridges';


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

/** build the Well: the rim and near galleries, the lower levels, then the mid-shaft (its crossings tie into both) */
export function buildWell(ctx: Ctx): void {
  const plan = new WellPlan(ctx);
  buildRim(plan);
  buildLower(plan);
  buildMid(plan);
  for (const r of WELL_RECTS) ctx.map.push({ ...r, kind: 'well' });
}
