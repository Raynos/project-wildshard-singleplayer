import { NINE_LAYOUT_PLAN } from '../data/layoutPlan';
import type { StallRect } from '../data/specimenDims';

const { PLAZA, STREET, STAIR, BANYAN, STALL, HAWKER, GATE } = NINE_LAYOUT_PLAN;

/** a stall's footprint about the origin (the stall models' own space, ../models/stalls.ts) */
export const centred = (r: StallRect): StallRect => {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  return { x0: r.x0 - cx, x1: r.x1 - cx, z0: r.z0 - cz, z1: r.z1 - cz };
};

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
