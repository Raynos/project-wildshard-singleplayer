// The fragment's collision (P0-5c, PHYSICS.md): everything walkable on Lantern Square, its street through the paifang and
// the stair-street stub, as engine-neutral ColliderDescs from the layout's plan. The floors are real boxes (their tops
// at the square's datum), the stair is dome D's `treads` (rise 0.35: the motor's autostep climbs them), and the edges
// of the fragment are walls: the building fronts (40 m), the street's and the stair's far ends. What still gets out (a
// grapple gone wrong) the def's `bounds` catches: a soft respawn on the last floor stood on. The balustrade over the Well
// (its stone and the invisible parapet 12 m up so nobody vaults into the shaft) and the props you would walk into — the
// gates' posts, the banyan's planter, the stalls, the market — are their models' own colliders, which come with their
// copies (../models/, src/engine/models/place.ts; the balustrade's since E346, models/wellBalustrade.ts).
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { PLAZA, STAIR, STREET, WELL, Y0 } from '../layout';
import { GUARD_Z0, PARAPET } from '../models/wellBalustrade';
import { stairColliders, stairFloor } from './stairstreet';
import { wellColliders, wellFloor } from './well';
import { RIM } from './well-plan';

/** how far north the street is walkable (its far part is scenery in the fragment) */
export const STREET_END = -120;
/** the stair-street's top landing: past the last tread, then its end wall */
export const STAIR_TOP = { x1: STAIR.x1 + 8, y: Y0 + STAIR.rise } as const;

/** a box from its extents (min / max corners) */
function span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: 'stone' | 'wood' | 'metal' = 'stone'): ColliderDesc {
  return { kind: 'box', x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hy: Math.abs(y1 - y0) / 2, hz: Math.abs(z1 - z0) / 2, surface };
}

/** a wall along x (at z) or along z (at x), 1 m thick, from the square's datum up `h` metres, on the far side of the line */
const WALL_H = 40, SLAB = 1.2;

/** the fragment's own collision in two pieces (their looks on the maps: floors stone, fronts rock); the balustrade over
 *  the Well and the props collide as their models (their looks on the maps: the balustrade rock, the props timber, def.ts) */
export interface FragmentColliders { floors: ColliderDesc[]; fronts: ColliderDesc[] }

/** a building front's depth behind its line (it is a solid block to the map; the player never reaches its back) */
const DEEP = 6;

/**
 * SF51-p (G184): with Debug ▸ Nine Dragon entries on, the north street is walkable on to its drawn end at STREET.z0, where
 * the north deck's lantern lift (world/lifts.ts) opens onto it between `door` (x0, x1): its floor and side walls run on,
 * the old end wall at STREET_END goes, and a wall closes the street's end beside the lift's door.
 */
export interface NorthStreet { door: readonly [number, number] }

/** the north street's carried-on floor past STREET_END (SF51-p), else undefined */
export function northStreetFloor(x: number, z: number): number | undefined {
  return x >= STREET.x0 && x <= STREET.x1 && z >= STREET.z0 && z < STREET_END - 1 ? Y0 : undefined;
}

export function fragmentColliders(north?: NorthStreet): FragmentColliders {
  const floors: ColliderDesc[] = [], fronts: ColliderDesc[] = [];
  let out = floors;
  // ── floors ──
  out.push(span(PLAZA.x0, Y0 - SLAB, PLAZA.z0, PLAZA.x1 + 0.6, Y0, PLAZA.z1 + 0.6));                  // the square
  // (carried on, the street's slab reaches 6 cm under the docked cage's floor: no seam for a foot to find)
  const streetEnd = north === undefined ? STREET_END - 1 : STREET.z0 - 0.06;
  out.push(span(STREET.x0, Y0 - SLAB, streetEnd, STREET.x1, Y0, PLAZA.z0));                            // the street north
  // the stair starts at the square's east edge (STAIR.x0 = PLAZA.x1): its first tread sits on the square's slab
  // dome D's stair-street (stairstreet.ts): 3 flights × 20 treads, two landings (the paifang's post bases on landing 2
  // are the paifang model's, E346)
  out.push(...stairColliders());
  out.push(span(STAIR.x1, STAIR_TOP.y - SLAB, STAIR.z0, STAIR_TOP.x1, STAIR_TOP.y, STAIR.z1));         // its top landing
  // the Well's south rim at the square's level (dome C's well.ts: its ledge, balustrade + parapet, the wall ends)
  out.push(...wellColliders());
  // ── the building fronts round the square (the shopfronts sit on these lines) ──
  out = fronts;
  const top = Y0 + WALL_H;
  out.push(span(PLAZA.x1 + 0.6, Y0, PLAZA.z0 - 0.6, PLAZA.x1 + DEEP, top, STAIR.z0));                   // east, north of the stair
  out.push(span(PLAZA.x1 + 0.6, Y0, STAIR.z1, PLAZA.x1 + DEEP, top, PLAZA.z1 + DEEP));                   // east, south of the stair
  out.push(span(STREET.x1, Y0, PLAZA.z0 - DEEP, PLAZA.x1 + DEEP, top, PLAZA.z0 - 0.6));                  // north, right of the gate
  out.push(span(PLAZA.x0 - 0.6, Y0, PLAZA.z1 + 0.6, PLAZA.x1 + DEEP, top, PLAZA.z1 + DEEP));             // south, behind the spawn
  // ── the street's walls and its end ──
  out.push(span(STREET.x0 - DEEP, Y0, streetEnd, STREET.x0, top, WELL.z0));                             // west, past the Well
  out.push(span(STREET.x1, Y0, streetEnd, STREET.x1 + DEEP, top, PLAZA.z0 - 0.6));                       // east
  if (north === undefined) out.push(span(STREET.x0, Y0, STREET_END - 2, STREET.x1, top, STREET_END - 1)); // the fragment's end
  else {
    // the street's drawn end, beside and over the lift's door (SF51-p)
    out.push(span(north.door[1], Y0, STREET.z0 - 1, STREET.x1, top, STREET.z0));
    out.push(span(STREET.x0, Y0 + 3.4, STREET.z0 - 1, north.door[1], top, STREET.z0));
    if (north.door[0] > STREET.x0) out.push(span(STREET.x0, Y0, STREET.z0 - 1, north.door[0], top, STREET.z0));
  }
  // ── the stair-street's walls and its top ──
  out.push(span(PLAZA.x1 + 0.6, Y0 - 1, STAIR.z0 - DEEP, STAIR_TOP.x1, STAIR_TOP.y + WALL_H, STAIR.z0));
  out.push(span(PLAZA.x1 + 0.6, Y0 - 1, STAIR.z1, STAIR_TOP.x1, STAIR_TOP.y + WALL_H, STAIR.z1 + DEEP));
  out.push(span(STAIR_TOP.x1, Y0 - 1, STAIR.z0 - DEEP, STAIR_TOP.x1 + DEEP, STAIR_TOP.y + WALL_H, STAIR.z1 + DEEP));
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
  return { floors, fronts };
}

/** Invisible upper cap of the south Well rail, and the square's parapet south of GUARD_Z0; a kinematic piece can disable
 *  them for a committed grapple from the rim only (Traversal.ts `crossesWell`). */
export function fragmentGrappleGuard(): ColliderDesc[] {
  return [
    span(WELL.x0, Y0 + 3.2, RIM.z0 - 0.1, WELL.x1, Y0 + PARAPET, RIM.z0 + 0.1),
    span(PLAZA.x0 - 0.1, Y0 + 1.12, GUARD_Z0, PLAZA.x0 + 0.1, Y0 + PARAPET, RIM.z0),
  ];
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
