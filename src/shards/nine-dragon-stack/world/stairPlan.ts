// The stair-street's plan and physics (dome D / C1, E169), the runtime half of the stair (../generators/stairstreet.ts and
// stairstreet-upper.ts build its look at layout time, baked: ./layoutBake.ts): three flights of 20 steps, two 4 m landings,
// the top landing, the paifang's place, the tower faces either side; `stairColliders()` (rise 0.35 ≤ 0.35, tread
// 0.667 ≥ 0.36, PHYSICS.md) and `stairFloor(x)`, which ./colliders.ts takes, and the constants build.ts's stair streaks read.
import { PLAZA, STAIR, Y0 } from '../layout';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

// ── the plan: three flights of 20 steps, two 4 m landings, the top landing ──

export const RISE = STAIR.rise / 60;
const LANDING = 4;
export const RUN = (STAIR.x1 - STAIR.x0 - 2 * LANDING) / 60;
export interface Flight { x0: number; x1: number; y0: number; steps: number }
export const FLIGHTS: readonly Flight[] = [0, 1, 2].map((i) => {
  const x0 = STAIR.x0 + i * (20 * RUN + LANDING);
  return { x0, x1: x0 + 20 * RUN, y0: Y0 + i * 20 * RISE, steps: 20 };
});
export const LANDINGS: readonly { x0: number; x1: number; y: number }[] = [0, 1].map((i) => {
  const f = FLIGHTS[i];
  const x0 = f === undefined ? 0 : f.x1;
  return { x0, x1: x0 + LANDING, y: Y0 + (i + 1) * 20 * RISE };
});
/** the top landing (its far end is the fragment's wall, colliders.ts STAIR_TOP) and the scenery street beyond it */
export const TOP_Y = Y0 + STAIR.rise;
/** the paifang on the second landing, spanning the stair (its front faces down the stair, west) */
const L2 = LANDINGS[1] ?? { x0: 0, x1: 0, y: 0 };
/** (E281: wide and a little lower, as mockup C and C2·5 draw it — a 6.2 m centre bay, the outer posts on the terraces;
 *  it was 3.5 m between 10 m posts, a slot) */
export const STAIR_GATE = { x: (L2.x0 + L2.x1) / 2, y: L2.y, z: (STAIR.z0 + STAIR.z1) / 2, s: 1.3, posts: [-5.6, -3.1, 3.1, 5.6] } as const;
/** the street between the tower faces past the square's towers (the stair is the middle 8 m; terraces either side) */
export const FACE_N = STAIR.z0 - 3, FACE_S = STAIR.z1 + 3;
/** the square's east towers flank the stair's first 12 m (their end faces on the stair's edges, base at Y0 + 5): C1 / C2's
 *  boundary */
export const SQ_BACK = PLAZA.x1 + 12.6;
/** …but the two corner towers at the stair stand only SQ_DEPTH deep (towers.ts wallRun openDepth): behind them, from
 *  SQ_CORNER to SQ_BACK, the stair's low pavilions on raised terraces with their towers set back (mockup C's foot) */
export const SQ_DEPTH = 6;
export const SQ_CORNER = PLAZA.x1 + 0.6 + SQ_DEPTH;
/** the scenery street past the top landing ends here */
export const FAR_X = 102;

/** the floor under x along the stair-street (the tread tops; Y0 before the foot, the top landing after) */
export function stairFloor(x: number): number {
  if (x < STAIR.x0) return Y0;
  if (x >= STAIR.x1) return TOP_Y;
  for (const f of FLIGHTS) {
    if (x >= f.x0 && x < f.x1) return f.y0 + (Math.min(f.steps - 1, Math.floor((x - f.x0) / RUN)) + 1) * RISE;
  }
  for (const l of LANDINGS) if (x >= l.x0 && x < l.x1) return l.y;
  return TOP_Y;
}

/** the stair's physics: three `treads` flights and the two landing slabs (the paifang's four post bases with their drum
 *  stones collide as the paifang model's own, placed with its copy on landing 2: models/paifang.ts, E346) */
export function stairColliders(): ColliderDesc[] {
  const zc = (STAIR.z0 + STAIR.z1) / 2, w = STAIR.z1 - STAIR.z0;
  const out: ColliderDesc[] = FLIGHTS.map((f) => ({
    kind: 'treads', from: { x: f.x0, y: f.y0, z: zc }, to: { x: f.x1, y: f.y0 + f.steps * RISE, z: zc }, width: w, count: f.steps, surface: 'stone',
  }));
  for (const l of LANDINGS) out.push({ kind: 'box', x: (l.x0 + l.x1) / 2, y: l.y - 0.6, z: zc, hx: (l.x1 - l.x0) / 2, hy: 0.6, hz: w / 2, surface: 'stone' });
  return out;
}
