// The fragment's collision (P0-5c, PHYSICS.md): everything walkable on Lantern Square, its street through the paifang and
// the stair-street stub, as engine-neutral ColliderDescs from the layout's plan. The floors are real boxes (their tops
// at the square's datum), the stair is dome D's `treads` (rise 0.35: the motor's autostep climbs them), and the edges
// of the fragment are walls: the building fronts (40 m), the street's and the stair's far ends. What still gets out (a
// grapple gone wrong) the def's `bounds` catches: a soft respawn on the last floor stood on. The balustrade over the Well
// (its stone and the invisible parapet 12 m up so nobody vaults into the shaft) and the props you would walk into — the
// gates' posts, the banyan's planter, the stalls, the market — are their models' own colliders, which come with their
// copies (../models/, src/engine/models/place.ts; the balustrade's since E346, models/wellBalustrade.ts).
import { floorBoxes, frontBoxes } from './boxRows';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { PLAZA, STAIR, STREET, Y0 } from '../layout';
import { stairColliders, stairFloor } from './stairPlan';
import { wellColliders, wellFloor } from './wellBounds';
import { squareFloor } from './floorRows';

/** how far north the street is walkable (its far part is scenery in the fragment) */
export const STREET_END = NINE_FLOOR_PLAN.fronts.streetEnd;
/** the stair-street's top landing: past the last tread, then its end wall */
export const STAIR_TOP = { x1: STAIR.x1 + 8, y: Y0 + STAIR.rise } as const;

/** the fragment's own collision in two pieces (their looks on the maps: floors stone, fronts rock); the balustrade over
 *  the Well and the props collide as their models (their looks on the maps: the balustrade rock, the props timber, def.ts) */
export interface FragmentColliders {
  floors: ColliderDesc[]; fronts: ColliderDesc[];
  /** SF8c (G224): the square's slab, one of `floors` (the same object): the world installs it under its declared id */
  readonly square: ColliderDesc;
}

export function fragmentColliders(): FragmentColliders {
  const floors: ColliderDesc[] = [], fronts: ColliderDesc[] = frontBoxes();
  const out = floors;
  // ── floors ──
  const square = squareFloor();
  out.push(square);                                                                                     // the square
  out.push(...floorBoxes('street'));                             // the street north
  // the stair starts at the square's east edge (STAIR.x0 = PLAZA.x1): its first tread sits on the square's slab
  // dome D's stair-street (stairstreet.ts): 3 flights × 20 treads, two landings (the paifang's post bases on landing 2
  // are the paifang model's, E346)
  out.push(...stairColliders());
  out.push(...floorBoxes('stairTop'));         // its top landing
  // the Well's south rim at the square's level (dome C's well.ts: its ledge, balustrade + parapet, the wall ends)
  out.push(...wellColliders());
  // ── the building fronts round the square (the shopfronts sit on these lines; each collides from SHOP proud of its line,
  // where the shopfronts' pillars and counters stand, generators/facades.ts, so nobody, and no camera, walks into them) ──
  // Front shapes are compiled from generators/fronts.ts; this runtime owns fresh descriptor objects.
  // ── the balustrade over the Well — the stone (1.12 m) and an invisible parapet PARAPET m over the floor, above any jump
  // (a jump + double jump lifts the feet ~2.9 m; from the balustrade's top, a prop's or the board's, ~5 m), except where
  // the Well's south rim ledge meets the square (a hop over the stone onto the rim, where mockup B stands) — is the
  // balustrade model's own (models/wellBalustrade.ts, E346). The rim's own (dome C's stone and 3.2 m parapet) are
  // well.ts wellColliders'. The south rim's tall cap, and the square's parapet from GUARD_Z0 to the rim, are registered
  // separately as a kinematic grapple guard (index.ts): they open only during an actual Fei Zhua pull. The stone under
  // them stays solid.
  // ── props you would walk into: every one collides as its model, placed with its copies (E315: the paifang's posts,
  // the banyan's planter, the shrine, the stele, the stalls, the market's booths, parasol tables and pavilions, the
  // stair-street landings' planters — models/, src/engine/models/place.ts) ──
  return { floors, fronts, square };
}

/** Invisible upper cap of the south Well rail, and the square's parapet south of GUARD_Z0; a kinematic piece can disable
 *  them for a committed grapple from the rim only (Traversal.ts `crossesWell`). */
export function fragmentGrappleGuard(): ColliderDesc[] {
  return floorBoxes('guard');
}

/** the floor under (x, z) where the player can stand (placement, footsteps), or undefined off the fragment */
export function fragmentFloor(x: number, z: number): number | undefined {
  const inPlaza = x >= PLAZA.x0 && x <= PLAZA.x1 + 0.6 && z >= PLAZA.z0 && z <= PLAZA.z1 + 0.6;
  const inStreet = x >= STREET.x0 && x <= STREET.x1 && z >= STREET_END && z <= PLAZA.z0;
  if (inPlaza || inStreet) return Y0;
  const rim = wellFloor(x, z);
  if (rim !== undefined) return rim;
  if (z >= STAIR.z0 && z <= STAIR.z1) {
    if (x >= STAIR.x0 && x < STAIR.x1) return stairFloor(x);
    if (x >= STAIR.x1 && x <= STAIR_TOP.x1) return STAIR_TOP.y;
  }
  return undefined;
}
