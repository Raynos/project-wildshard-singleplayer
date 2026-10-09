/**
 * The riding feel's pure logic (NALATI-FINISH B1, N13 — docs/design/nalati/riding-research.md "Not built"): the horse keeping
 * to a road when you let go of the stick, and the rhythm spur. No three.js, no DOM: Mount.ts drives them, vitest covers
 * them (test/shards/nalati-grasslands/ride-assist.test.ts).
 *
 *   roadSteer(roads, x, z, heading, ahead)  → { yaw, off } | null   the way along the nearest road (within ROAD_REACH m and
 *        heading within 60° of its line), aimed `ahead` m down it the way the horse faces; null off a road, across one, or
 *        at its end (RDR2 / Witcher / KCD: with no stick on a road the horse follows it)
 *   const spur = new RhythmSpur();  spur.tap(t, phase, period) → 'good' | 'early' | 'off'   a GALLOP press at the horse's
 *        gait phase (0..1, the stride's downbeat at 0); spur.update(dt); spur.latched / spur.streak / spur.boost
 *        RDR2's rhythm spur ("well-timed taps hold a gallop at almost no stamina cost") and Rival Stars' timed sprint tap:
 *        a tap within ±WINDOW of the beat keeps the gallop going for a stride and a bit (no hold needed), each tap in a row
 *        adds speed (up to +12 %); an off-beat or mashed tap breaks the streak.
 */

import * as v from 'valibot';

export type RoadXZ = readonly [number, number];

/** m from a road's centre line the horse still counts as on it (the trails' beds are ~5–7 m wide) */
export const ROAD_REACH = 5.5;
/** the heading must lie within this of the road's line (cos 60°): turned further off it, the rider is leaving the road */
const ROAD_ALIGN = 0.5;
/** m short of a road's end the follow lets go (the horse coasts down there) */
const ROAD_END = 3;

export interface RoadSteer { yaw: number; off: number }

/**
 * The yaw (animal convention: x = sin, z = cos) toward the point `ahead` m down the nearest road from (x, z) that runs
 * within 60° of `heading` (at a junction the branch across it is skipped), the way `heading` points along it; `off` = the
 * distance to its centre line. Null when no such road is within ROAD_REACH or it ends within `ahead` + ROAD_END.
 */
export function roadSteer(roads: readonly (readonly RoadXZ[])[], x: number, z: number, heading: number, ahead: number): RoadSteer | null {
  let best = -1, bestSeg = -1, bestT = 0, bestD = ROAD_REACH;
  for (let r = 0; r < roads.length; r++) {
    const pts = roads[r];
    if (pts === undefined) continue;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a === undefined || b === undefined) continue;
      const ux = b[0] - a[0], uz = b[1] - a[1], l2 = ux * ux + uz * uz;
      if (l2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / l2));
      const d = Math.hypot(x - (a[0] + ux * t), z - (a[1] + uz * t));
      // only a road the horse runs along: at a junction the branch across its heading is not the one it is on
      if (d < bestD && Math.abs((ux * Math.sin(heading) + uz * Math.cos(heading)) / Math.sqrt(l2)) >= ROAD_ALIGN) { bestD = d; best = r; bestSeg = i; bestT = t; }
    }
  }
  const pts = roads[best];
  if (pts === undefined) return null;
  const a = pts[bestSeg], b = pts[bestSeg + 1];
  if (a === undefined || b === undefined) return null;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dot = ((b[0] - a[0]) * Math.sin(heading) + (b[1] - a[1]) * Math.cos(heading)) / len;
  if (Math.abs(dot) < ROAD_ALIGN) return null;
  const dir = dot > 0 ? 1 : -1;
  // walk `ahead` m down the polyline from the foot of the perpendicular, the way the horse faces
  let px = a[0] + (b[0] - a[0]) * bestT, pz = a[1] + (b[1] - a[1]) * bestT;
  let left = ahead + ROAD_END, seg = bestSeg, aimX = px, aimZ = pz, aimed = false;
  for (;;) {
    const q = dir > 0 ? pts[seg + 1] : pts[seg];
    if (q === undefined) return null;
    const d = Math.hypot(q[0] - px, q[1] - pz);
    if (!aimed && left - ROAD_END <= d) {
      const u = (left - ROAD_END) / Math.max(d, 1e-6);
      aimX = px + (q[0] - px) * u; aimZ = pz + (q[1] - pz) * u; aimed = true;
    }
    if (left <= d) break;
    left -= d; px = q[0]; pz = q[1];
    seg += dir;
    if (seg < 0 || seg + 1 >= pts.length) return null;   // the road ends before the look-ahead (+ the margin)
  }
  return { yaw: Math.atan2(aimX - x, aimZ - z), off: bestD };
}

/** half-width of the beat window, in stride phase (±0.16 of a stride ≈ ±70 ms at a gallop's ~2.3 strides a second) */
export const SPUR_WINDOW = 0.16;
/** a tap sooner than this share of a stride after the last one is mashing, not riding the rhythm */
const SPUR_MASH = 0.55;
/** strides a good tap keeps the gallop going for (so the next beat's tap lands before it runs out) */
const SPUR_LATCH = 1.35;
export const SPUR_MAX_STREAK = 3, SPUR_BOOST_PER = 0.04;

export type SpurTap = 'good' | 'early' | 'off';
const SpurState = v.strictObject({ version: v.literal(1), streak: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(SPUR_MAX_STREAK)),
  latchT: v.pipe(v.number(), v.finite(), v.minValue(0)), good: v.pipe(v.number(), v.integer(), v.minValue(0)), lastTap: v.pipe(v.number(), v.finite()) });
export type RhythmSpurState = v.InferOutput<typeof SpurState>;

export class RhythmSpur {
  /** good taps in a row (0..SPUR_MAX_STREAK) */
  streak = 0;
  /** s the last good tap still holds the gallop */
  latchT = 0;
  /** good taps this ride (for the HUD / the checks) */
  good = 0;
  private lastTap = -1e9;

  /** a GALLOP press at time `t` (s), the horse's gait `phase` (0..1) and stride `period` (s) */
  tap(t: number, phase: number, period: number): SpurTap {
    const since = t - this.lastTap;
    this.lastTap = t;
    const p = ((phase % 1) + 1) % 1, off = Math.min(p, 1 - p);
    if (since < period * SPUR_MASH) { this.streak = 0; this.latchT = 0; return 'early'; }
    if (off > SPUR_WINDOW) { this.streak = 0; this.latchT = 0; return 'off'; }
    this.streak = Math.min(SPUR_MAX_STREAK, this.streak + 1);
    this.latchT = period * SPUR_LATCH;
    this.good++;
    return 'good';
  }

  update(dt: number): void {
    if (this.latchT > 0) { this.latchT = Math.max(0, this.latchT - dt); if (this.latchT === 0) this.streak = 0; }
  }

  reset(): void { this.streak = 0; this.latchT = 0; this.lastTap = -1e9; }

  /** Exact rhythm continuation, including the previous press that makes a rapid repeat count as mashing. */
  snapshot(): RhythmSpurState { return v.parse(SpurState, { version: 1, streak: this.streak, latchT: this.latchT, good: this.good, lastTap: this.lastTap }); }
  restore(value: unknown): void { const s = v.parse(SpurState, value); this.streak = s.streak; this.latchT = s.latchT; this.good = s.good; this.lastTap = s.lastTap; }

  /** the rhythm is holding the gallop */
  get latched(): boolean { return this.latchT > 0; }
  /** the gallop's speed factor while latched (1 + 4 % a tap in a row, up to +12 %) */
  get boost(): number { return this.latched ? 1 + SPUR_BOOST_PER * this.streak : 1; }
}
