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
import { WELL } from '../layout';
import { FLOOR_H } from './well-galleries';
import { dressLower } from './well-lower-life';
import { deepTemple, ghostLevels } from './well-lower-deep';
import { CROSSINGS, LOW, SPLIT, WELL_RECTS, type WallPlan, type WellPlan, bandKits, wallPlan } from './well-plan';

/** the fog sheets' heights (build.ts draws them across the shaft; each one twice, the second 5 m lower). None: the
 *  sheets read as an opaque pale floor down the shaft; the render lane's layered shaft mist does the depth fade */
export const wellSheets: { y: number; band: number; a: number }[] = [];

/** band B's floors and the ghosts under it */
const B_TOP = LOW - FLOOR_H, B_FLOORS = 12, GHOST_TOP = B_TOP - B_FLOORS * FLOOR_H, GHOST_FLOORS = 12;
/** where the walls' painted shells and the silk backstop end */
const BOTTOM = GHOST_TOP - GHOST_FLOORS * FLOOR_H - 24;

/** the temple spur: its centre, the terrace height (below the cut, above the y = 36 fog band) and its radius. Seen from
 *  the rim (mockup D's camera) it sits ~81° down, 70 % down the frame, just under the timber bridge at z −4 */
export const TEMPLE = { x: -14, z: -3, top: LOW - 15, r: 6.2 } as const;

/** the wall spans (u, floors) where a crossing lands: the dressing keeps its projections and stair towers off them */
function keepOut(name: WallPlan['name']): { y0: number; y1: number; u0: number; u1: number }[] {
  const P = wallPlan(name);
  if (P.n.z !== 0) return [];
  return CROSSINGS.filter((c) => c.ext === P.ext && c.y <= SPLIT + 0.1).map((c) => {
    const a = P.uOf(c.z - c.w / 2 - 1.6), b = P.uOf(c.z + c.w / 2 + 1.6);
    return { y0: c.y - FLOOR_H, y1: c.y, u0: Math.min(a, b), u1: Math.max(a, b) };
  });
}

/** the deepest front a projection may reach on a wall at (u, y): clear of the temple spur and its trees */
function templeCap(name: WallPlan['name']): (u: number, y: number) => number {
  const P = wallPlan(name);
  if (P.n.z !== 0) return () => 99;
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
  const KL = bandKits(ctx, 'l');
  const walls: [WallPlan['name'], number, number][] = [['south', 1811, 2], ['west', 1823, 3], ['east', 1839, 3]];
  const taper = [SPLIT, GHOST_TOP] as const;
  for (const [name, seed, stairs] of walls) {
    const P = wallPlan(name);
    const keep = keepOut(name), cap = templeCap(name);
    const a = plan.band(name, SPLIT, LOW, seed, KL, undefined, stairs);
    dressLower(ctx, a, KL, { yTop: SPLIT, yLow: LOW, taper, yNear: SPLIT - 12, seed: seed + 5000, life: 1, keep, cap });
    const b = plan.band(name, B_TOP, B_TOP - (B_FLOORS - 1) * FLOOR_H, seed + 31, KL, BOTTOM);
    dressLower(ctx, b, KL, { yTop: B_TOP, yLow: B_TOP - (B_FLOORS - 1) * FLOOR_H, taper, yNear: SPLIT - 12, seed: seed + 6000, life: 0, keep, cap });
    ghostLevels(ctx, KL.kit, { p0: P.p0, n: P.n, len: P.len, dMin: P.dMin, dMax: P.dMax, wash: P.wash, ...(P.g0 === undefined ? {} : { g0: P.g0 }), ...(P.g1 === undefined ? {} : { g1: P.g1 }) },
      GHOST_TOP, GHOST_FLOORS, 5, seed + 7000, cap);
  }
  deepTemple(ctx, KL.kit(TEMPLE.top), TEMPLE.x, TEMPLE.z, BOTTOM + 10, TEMPLE.top, TEMPLE.r);
  // the silk backstop far below (the mist is solid there): a ray that gets this far ends in silk, not the sky
  for (const r of WELL_RECTS) {
    ctx.kit(`well-l-${r.z1 > WELL.z0 + 1 ? 'deep' : 'deepx'}`).quad(new Vector3(r.x0, BOTTOM, r.z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), r.x1 - r.x0, r.z1 - r.z0, { wash: 0xa7b0bd, line: 0 });
  }
}
