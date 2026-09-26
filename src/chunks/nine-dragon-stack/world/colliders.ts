// The fragment's collision (P0-5c, PHYSICS.md): everything walkable on Lantern Square, its street through the paifang and
// the stair-street stub, as engine-neutral ColliderDescs from the layout's plan. The floors are real boxes (their tops
// at the square's datum), the stair is dome D's `treads` (rise 0.35: the motor's autostep climbs them), and the edges
// of the fragment are walls: the building fronts (40 m), the balustrades over the Well (with an invisible parapet 12 m
// up so nobody vaults into the shaft), the street's and the stair's far ends. What still gets out (a grapple gone wrong)
// the def's `bounds` catches: a soft respawn on the last floor stood on. The props you would walk into — the gate's
// posts, the banyan's planter, the stalls — are boxes of their footprints.
import type { ColliderDesc } from '../../../world/registry';
import { BANYAN, GATE, HAWKER, PLAZA, STAIR, STALL, STREET, WELL, Y0 } from '../layout';
import { stairColliders, stairFloor } from './stairstreet';
import { stairUpperColliders } from './stairstreet-upper';
import { RIM, wellColliders, wellFloor } from './well';

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
/** the invisible parapets over the Well reach this high above the floor (out of reach of every jump, on foot or board) */
const PARAPET = 12;

/** the fragment's collision in four pieces (their looks on the maps: floors stone, fronts rock, edges rock, props timber) */
export interface FragmentColliders { floors: ColliderDesc[]; fronts: ColliderDesc[]; edges: ColliderDesc[]; props: ColliderDesc[] }

/** a building front's depth behind its line (it is a solid block to the map; the player never reaches its back) */
const DEEP = 6;

export function fragmentColliders(): FragmentColliders {
  const floors: ColliderDesc[] = [], fronts: ColliderDesc[] = [], edges: ColliderDesc[] = [], props: ColliderDesc[] = [];
  let out = floors;
  // ── floors ──
  out.push(span(PLAZA.x0, Y0 - SLAB, PLAZA.z0, PLAZA.x1 + 0.6, Y0, PLAZA.z1 + 0.6));                  // the square
  out.push(span(STREET.x0, Y0 - SLAB, STREET_END - 1, STREET.x1, Y0, PLAZA.z0));                       // the street north
  // the stair starts at the square's east edge (STAIR.x0 = PLAZA.x1): its first tread sits on the square's slab
  // dome D's stair-street (stairstreet.ts): 3 flights × 20 treads, two landings, the paifang's post bases on landing 2
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
  out.push(span(STREET.x0 - DEEP, Y0, STREET_END - 1, STREET.x0, top, WELL.z0));                         // west, past the Well
  out.push(span(STREET.x1, Y0, STREET_END - 1, STREET.x1 + DEEP, top, PLAZA.z0 - 0.6));                   // east
  out.push(span(STREET.x0, Y0, STREET_END - 2, STREET.x1, top, STREET_END - 1));                       // the fragment's end
  // ── the stair-street's walls and its top ──
  out.push(span(PLAZA.x1 + 0.6, Y0 - 1, STAIR.z0 - DEEP, STAIR_TOP.x1, STAIR_TOP.y + WALL_H, STAIR.z0));
  out.push(span(PLAZA.x1 + 0.6, Y0 - 1, STAIR.z1, STAIR_TOP.x1, STAIR_TOP.y + WALL_H, STAIR.z1 + DEEP));
  out.push(span(STAIR_TOP.x1, Y0 - 1, STAIR.z0 - DEEP, STAIR_TOP.x1 + DEEP, STAIR_TOP.y + WALL_H, STAIR.z1 + DEEP));
  // ── the balustrades over the Well: the stone (1.12 m) and an invisible parapet PARAPET m over the floor, above any jump
  // (a jump + double jump lifts the feet ~2.9 m; from the balustrade's top, a prop's or the board's, ~5 m) ──
  out = edges;
  out.push(span(PLAZA.x0 - 0.1, Y0, WELL.z0, PLAZA.x0 + 0.5, Y0 + 1.12, PLAZA.z1 + 0.6));
  // the square's and the street's, except where the Well's south rim ledge meets the square (a hop over the stone
  // onto the rim, where mockup B stands; the rim is walled on its other three sides)
  out.push(span(PLAZA.x0 - 0.1, Y0 + 1.12, WELL.z0, PLAZA.x0 + 0.1, Y0 + PARAPET, RIM.z0));
  out.push(span(PLAZA.x0 - 0.1, Y0 + 1.12, RIM.z1, PLAZA.x0 + 0.1, Y0 + PARAPET, PLAZA.z1 + 0.6));
  // the rim's own (dome C's stone and 3.2 m parapet, well.ts wellColliders), carried up to the same height
  out.push(span(WELL.x0, Y0 + 1.12, RIM.z0 - 0.1, WELL.x1, Y0 + PARAPET, RIM.z0 + 0.1));
  // ── props you would walk into ──
  out = props;
  // (the gate's lion pair and their pedestals are gone: dome B took them out, style-A and the A2 targets have none)
  for (const px of GATE.posts) out.push(span(px - 0.45, Y0, GATE.z - 0.45, px + 0.45, Y0 + 7, GATE.z + 0.45, 'wood'));
  // the stair-street landings' planters (dome C2's)
  out.push(...stairUpperColliders());
  // the banyan's round planter as an octagonal prism
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = BANYAN.r + 0.3;
    pts.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * r, 1.0, Math.sin(a) * r);
  }
  out.push({ kind: 'hull', x: BANYAN.x, y: Y0, z: BANYAN.z, points: new Float32Array(pts), surface: 'stone' });
  out.push(span(BANYAN.x - 4.2, Y0, BANYAN.z + 1.6, BANYAN.x - 2.2, Y0 + 1.8, BANYAN.z + 2.9));         // the earth-god shrine
  out.push(span(BANYAN.x - 4.3, Y0, BANYAN.z - 1.6, BANYAN.x - 3.1, Y0 + 2.2, BANYAN.z - 0.6));         // the 九龍城 stele
  out.push(span(STALL.x0, Y0, STALL.z0, STALL.x1, Y0 + 3.2, STALL.z1 + 0.6, 'wood'));                    // the noodle stall
  out.push(span(HAWKER.x0, Y0, HAWKER.z0, HAWKER.x1, Y0 + 2.4, HAWKER.z1, 'wood'));                      // the hawker stall
  return { floors, fronts, edges, props };
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
