import { NINE_FLOOR_PLAN } from './floorPlan';

/** Authored placement rows shared by the runtime layout and its generators. */
export const NINE_LAYOUT_PLAN = {
  Y0: NINE_FLOOR_PLAN.datum,
  WELL: NINE_FLOOR_PLAN.well,
  PLAZA: NINE_FLOOR_PLAN.square,
  GATE: { x: 6.05, z: -24.5, posts: [0.6, 3.9, 8.2, 11.5] as const, s: 1.85 } as const,
  STREET: NINE_FLOOR_PLAN.street,
  STAIR: NINE_FLOOR_PLAN.stair,
  BANYAN: { x: 18.4, z: -22.6, r: 3.2 } as const,
  STALL: { x0: 16.3, x1: 22.1, z0: -18.4, z1: -15.2 } as const,
  HAWKER: { x0: 6.3, x1: 9.7, z0: -3.6, z1: -1.4 } as const,
  STRATA: [-245, -150, -70, 0, 70, 125, 167, 210, 240] as const,
} as const;
