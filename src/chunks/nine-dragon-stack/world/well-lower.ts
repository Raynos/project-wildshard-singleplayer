// The Yamen Well's lower levels (dome D2, E169; dome C's first cut): the main shaft from SPLIT (~30 m under the
// square) down through the fragment's cut into the mist — what the view down from the rim (mockup D) looks into. No
// floor: galleries and the rooms built out in front of them go on level after level, the gap between the walls
// narrowing with depth, until the silk takes them.
//   band A     SPLIT … LOW: the three walls' gallery bands (the plan's profiles: every crossing lands on them) with
//              stair flights, dressed by well-lower-life.ts — rooms and blocks built out past the fronts, red-railed
//              verandas (some half a floor up), switchback stair towers, lit shopfronts on the street floors,
//              lanterns, people, laundry, plants, cages, blade signs and drain pipes, thinning with depth,
//   band B     LOW − 3 … LOW − 36: the same gallery bands without their life (so bridges can land on them too),
//              mostly blocks built far out (the narrowing gap), lanterns, lit rooms,
//   the ghosts well-lower-deep.ts: 12 more floors as deck slabs and lit rooms (6 tris a run) into the silk,
//   the temple the rock spur rising out of the depth with the temple the view straight down ends on,
//   the walls  painted shells to far below, and a silk backstop under everything (no visible floor).
import { Vector3 } from 'three';
import { FLOOR_H } from './well-galleries';
import { dressLower } from './well-lower-life';
import { deepTemple, ghostLevels } from './well-lower-deep';
import { type BandKits, CROSSINGS, LOW, SPLIT, WELL_RECTS, type WallPlan, type WellPlan, wallPlan } from './well-plan';

/** the fog sheets' heights (build.ts draws them across the shaft; each one twice, the second 5 m lower). None: the
 *  sheets read as an opaque pale floor down the shaft; the render lane's layered shaft mist does the depth fade */
export const wellSheets: { y: number; band: number; a: number }[] = [];

/** band B's floors and the ghosts under it */
const B_TOP = LOW - FLOOR_H, B_FLOORS = 12, GHOST_TOP = B_TOP - B_FLOORS * FLOOR_H, GHOST_FLOORS = 12;
/** where the walls' painted shells and the silk backstop end */
const BOTTOM = GHOST_TOP - GHOST_FLOORS * FLOOR_H - 24;

/** the lane's kits (its budget: 10 draws): the upper floors, everything from LOW + 9 down (drawn only within DEEP_FAR m of
 *  the camera: the rim and the shaft see it, the stair and the street north don't) and the galleries' barred railings */
const UP_KIT = 'well-l-up', DEEP_KIT = 'well-l-deep', DEEP_FAR = 95;
const lowerKits = (ctx: WellPlan['ctx']): BandKits => ({ kit: (y) => ctx.kit(y >= LOW + 9 ? UP_KIT : DEEP_KIT), alpha: () => ctx.alpha('well-l-a') });

/** the temple spur: its centre, the terrace height and its radius. Seen from mockup D's camera it sits ~62° down, 55 %
 *  down the frame, above the balustrade's rail (steeper than ~73° the rail hides it) and 79 m under the eye (the silk
 *  leaves it ~40 % and its lanterns more); the steel crossing at z −24 (+56) passes 8 m over its terrace, the stone one
 *  at z −38 (+41) and the timber one at z −20 (+32) clear of the spur (z −35…−25). Centred on the gap between the deep
 *  west galleries and the shallower east ones */
export const TEMPLE = { x: -13.5, z: -30, top: LOW - 11, r: 4.6 } as const;

/** the lower galleries' depths: the near band's (well-rim.ts) carried on down, so the canyon's walls run on unbroken
 *  from the rim through SPLIT into the depth (the south wall keeps the plan's) */
const DEPTHS: Partial<Record<WallPlan['name'], { dMin: number; dMax: number }>> = { west: { dMin: 6.2, dMax: 8.2 }, east: { dMin: 5.2, dMax: 7 } };

/** the wall spans (u, floors) where a crossing lands: the dressing keeps its projections and stair towers off them */
function keepOut(name: WallPlan['name']): { y0: number; y1: number; u0: number; u1: number }[] {
  const P = wallPlan(name);
  // the south wall under mockup D's camera (x −17…−4): no stair tower, nothing built out (the view straight down)
  if (P.n.z !== 0) return [{ y0: -200, y1: SPLIT, u0: P.p0.x + 4, u1: P.p0.x + 17 }];
  return CROSSINGS.filter((c) => c.ext === P.ext && c.y <= SPLIT + 0.1).map((c) => {
    const a = P.uOf(c.z - c.w / 2 - 1.6), b = P.uOf(c.z + c.w / 2 + 1.6);
    return { y0: c.y - FLOOR_H, y1: c.y, u0: Math.min(a, b), u1: Math.max(a, b) };
  });
}

/** the deepest front a projection may reach on a wall at (u, y): clear of the temple spur and its trees */
function templeCap(name: WallPlan['name']): (u: number, y: number) => number {
  const P = wallPlan(name);
  // the south wall under mockup D's camera (x −17…−4, the plan's void down to SPLIT) builds nothing out below it either:
  // the view straight down over the balustrade stays open to the temple
  if (P.n.z !== 0) return (u) => (P.p0.x - u >= -17 && P.p0.x - u <= -4 ? 0 : 99);
  return (u, y) => {
    if (y > TEMPLE.top + 6 || y < BOTTOM + 10) return 99;
    // the wall's u → world z; the spur's reach toward this wall (it widens toward its foot)
    const z = P.p0.z + (P.n.x > 0 ? -u : u);
    if (Math.abs(z - TEMPLE.z) > TEMPLE.r * 1.3 + 1.5) return 99;
    const face = P.n.x > 0 ? TEMPLE.x - P.p0.x : P.p0.x - TEMPLE.x;
    return face - TEMPLE.r * 1.2 - 0.8;
  };
}

export function buildLower(plan: WellPlan): void {
  const ctx = plan.ctx;
  const KL = lowerKits(ctx);
  ctx.far(DEEP_KIT, DEEP_FAR);
  const walls: [WallPlan['name'], number, number][] = [['south', 1811, 2], ['west', 1823, 3], ['east', 1839, 3]];
  const taper = [SPLIT, GHOST_TOP] as const;
  for (const [name, seed, stairs] of walls) {
    const P = wallPlan(name);
    const keep = keepOut(name), cap = templeCap(name);
    const depths = DEPTHS[name];
    const opt = depths === undefined ? {} : { depths };
    const a = plan.band(name, SPLIT, LOW, seed, KL, undefined, stairs, opt);
    dressLower(ctx, a, KL, { yTop: SPLIT, yLow: LOW, taper, yNear: SPLIT - 12, seed: seed + 5000, life: 1, keep, cap });
    const b = plan.band(name, B_TOP, B_TOP - (B_FLOORS - 1) * FLOOR_H, seed + 31, KL, BOTTOM, 0, opt);
    dressLower(ctx, b, KL, { yTop: B_TOP, yLow: B_TOP - (B_FLOORS - 1) * FLOOR_H, taper, yNear: SPLIT - 12, seed: seed + 6000, life: 0, keep, cap });
    ghostLevels(ctx, KL.kit, { p0: P.p0, n: P.n, len: P.len, dMin: depths?.dMin ?? P.dMin, dMax: depths?.dMax ?? P.dMax, wash: P.wash, ...(P.g0 === undefined ? {} : { g0: P.g0 }), ...(P.g1 === undefined ? {} : { g1: P.g1 }) },
      GHOST_TOP, GHOST_FLOORS, 2.5, seed + 7000, cap);
  }
  deepTemple(ctx, KL.kit(TEMPLE.top), TEMPLE.x, TEMPLE.z, BOTTOM + 10, TEMPLE.top, TEMPLE.r);
  // the silk backstop far below (the mist is solid there): a ray that gets this far ends in silk, not the sky
  for (const r of WELL_RECTS) {
    ctx.kit(DEEP_KIT).quad(new Vector3(r.x0, BOTTOM, r.z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), r.x1 - r.x0, r.z1 - r.z0, { wash: 0xa7b0bd, line: 0 });
  }
}
