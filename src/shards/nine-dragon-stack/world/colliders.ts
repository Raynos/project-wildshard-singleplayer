import { NINE_FLOOR_PLAN } from '../data/floorPlan';
import { PLAZA, STAIR, STREET, Y0 } from '../layout';
import stairPlan from './stairPlan.generated.json' with { type: 'json' };
import { wellFloor } from './wellBounds';

/** how far north the street is walkable (its far part is scenery in the fragment) */
export const STREET_END = NINE_FLOOR_PLAN.fronts.streetEnd;
/** the stair-street's top landing: past the last tread, then its end wall */
export const STAIR_TOP = { x1: STAIR.x1 + 8, y: Y0 + STAIR.rise } as const;

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

function stairFloor(x: number): number {
  const { FLIGHTS, LANDINGS, TOP_Y, RUN, RISE } = stairPlan;
  if (x < STAIR.x0) return Y0;
  if (x >= STAIR.x1) return TOP_Y;
  for (const f of FLIGHTS) {
    if (x >= f.x0 && x < f.x1) return f.y0 + (Math.min(f.steps - 1, Math.floor((x - f.x0) / RUN)) + 1) * RISE;
  }
  for (const l of LANDINGS) if (x >= l.x0 && x < l.x1) return l.y;
  return TOP_Y;
}
