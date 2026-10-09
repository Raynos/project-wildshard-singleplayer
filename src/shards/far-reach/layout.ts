import { KNOLLS, ROOST, ROPE_SAG, APOTHEM, type Isle, type Knoll, type SPIRES } from './data/layout';

/**
 * The maths over Sky Reach's coordinates (`data/layout.ts` holds the coordinates themselves, as pure data: a data module
 * exports no functions, test/row-data.test.ts): a rope bridge's sag, the rises' heights, an island top's apothem and
 * rim, a Roost spire's foot.
 */

/**
 * A rope bridge's sag (E399, the council: 'a short level bridge'; the mockups' rope bridges hang in a curve over the
 * drop): how far below the straight deck line the planks hang `s` metres along a span of `length`. Level for the first
 * and last `ends` metres (over the rims), a sine dip between, `depth` of the length deep at most `max` metres; the
 * steepest plank is ~9 degrees, far under the 40 degree climb.
 */
export function ropeSag(length: number, s: number): number {
  const run = length - 2 * ROPE_SAG.ends; if (run <= 0) return 0;
  const t = Math.min(1, Math.max(0, (s - ROPE_SAG.ends) / run));
  return Math.min(ROPE_SAG.max, ROPE_SAG.depth * length) * Math.sin(Math.PI * t);
}

/** A rise's height above its island's deck at a world point (0 off it); `only` limits it to one rise. */
export function knollHeight(x: number, z: number, only?: Knoll): number {
  let y = 0;
  for (const k of only === undefined ? KNOLLS : [only]) {
    const d = Math.hypot(x - k.x, z - k.z); if (d >= k.base) continue;
    // the cap's sphere radius (data/layout.ts KNOLL_GLSL bakes the same)
    const R = (k.base * k.base + k.h * k.h) / (2 * k.h); y += Math.sqrt(R * R - d * d) - (R - k.h);
  }
  return y;
}

/** The apothem of an island's 12-gon top: where the rim edge is nearest the centre. */
export const apothem = (isle: Isle): number => isle.r * APOTHEM;

/** The 12-gon's rim distance from an island's centre in the direction `a` (radians, from +x toward +z). */
export function rimAlong(isle: Isle, a: number): number {
  const step = Math.PI / 6, t = ((a % step) + step) % step;
  return apothem(isle) / Math.cos(t - step / 2);
}

/** A Roost spire's foot (data/layout.ts SPIRES: its angle round the Roost's centre and distance from it). */
export const spireAt = (s: (typeof SPIRES)[number]): { x: number; z: number } => ({ x: ROOST.x + Math.cos(s.a) * s.d, z: ROOST.z + Math.sin(s.a) * s.d });
