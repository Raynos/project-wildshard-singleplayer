// Lantern Square's plan (metres; y = altitude in the 500 m cube, x east, z south). Looking north from the spawn: the
// Yamen Well opens on the left behind a stone balustrade, the paifang stands ahead, the banyan and the mahjong tables
// on the right, the street runs on north through the gate under a skybridge, the monorail and the Cable Deck's screens.

import { NINE_LAYOUT_PLAN } from './data/layoutPlan';

/** Lantern Square's datum (stratum 6, +125 m) */
export const Y0 = NINE_LAYOUT_PLAN.Y0;

/** the Yamen Well's shaft */
export const WELL = NINE_LAYOUT_PLAN.WELL;

/** the open plaza (the Well's balustrade is its west edge) */
export const PLAZA = NINE_LAYOUT_PLAN.PLAZA;

/** the paifang: centre x, z, bay posts */
export const GATE = NINE_LAYOUT_PLAN.GATE;

/** the street north through the gate */
export const STREET = NINE_LAYOUT_PLAN.STREET;

/** the stair-street climbing east out of the square */
export const STAIR = NINE_LAYOUT_PLAN.STAIR;

export const BANYAN = NINE_LAYOUT_PLAN.BANYAN;

/** the noodle stall (dome B: moved 0.5 m east and 0.6 m south so the earth-god shrine stands clear at the planter's south-west) */
export const STALL = NINE_LAYOUT_PLAN.STALL;

/** dome B: the small hawker stall at the spawn's right, ~11 m ahead, its counter facing south (toward the spawn) */
export const HAWKER = NINE_LAYOUT_PLAN.HAWKER;

/** the nine strata's street levels (altitude of each ring walkway in the Well) */
export const STRATA = NINE_LAYOUT_PLAN.STRATA;

/** where the player may walk (simple bounds, no physics) */
export function walkable(x: number, z: number): boolean {
  const inPlaza = x > PLAZA.x0 + 0.6 && x < PLAZA.x1 - 0.8 && z > PLAZA.z0 + 0.8 && z < PLAZA.z1 - 0.8;
  const inGate = x > STREET.x0 + 1.4 && x < STREET.x1 - 0.6 && z <= PLAZA.z0 + 0.8 && z > -120;
  const inStair = z > STAIR.z0 + 0.6 && z < STAIR.z1 - 0.6 && x >= PLAZA.x1 - 0.8 && x < STAIR.x0 + 6;
  if (!(inPlaza || inGate || inStair)) return false;
  const bx = x - BANYAN.x, bz = z - BANYAN.z;
  if (bx * bx + bz * bz < (BANYAN.r + 0.6) ** 2) return false;
  if (x > STALL.x0 - 0.5 && x < STALL.x1 + 0.5 && z > STALL.z0 - 0.5 && z < STALL.z1 + 1.4) return false;
  for (const px of GATE.posts) if (Math.abs(x - px) < 0.9 && Math.abs(z - GATE.z) < 2.0) return false; // posts + drum stones
  // dome B: the earth-god shrine and the 九龍城 stele at the planter's south-west, the stall's folding tables
  if (x > BANYAN.x - 4.2 && x < BANYAN.x - 2.2 && z > BANYAN.z + 1.6 && z < BANYAN.z + 2.9) return false;
  if (x > BANYAN.x - 4.3 && x < BANYAN.x - 3.1 && z > BANYAN.z - 1.6 && z < BANYAN.z - 0.6) return false;
  if (x > STALL.x0 + 0.6 && x < STALL.x0 + 4.8 && z > STALL.z1 + 1.8 && z < STALL.z1 + 3.1) return false;
  if (x > HAWKER.x0 - 0.3 && x < HAWKER.x1 + 0.5 && z > HAWKER.z0 - 0.3 && z < HAWKER.z1 + 0.8) return false;
  return true;
}
