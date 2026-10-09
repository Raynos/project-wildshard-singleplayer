/**
 * The dusk deepens as the quest goes on (E399, council round 1, D5 / D8: mockup A is the spawn at sunset, B the logbook
 * at dusk, C the lit waymarks in a dark violet dusk where the fire is the key light, D the blue hour). `DUSK.value` runs
 * from 0 (the first frame's sunset) to 1 (the blue hour once the signal fire burns); it is a shader uniform, read by the
 * sky dome, and the look's key and fill lights follow it each frame. Each quest step sets a deeper target and the light
 * eases there over about a minute of play, so the sun sets while the player works; a loaded save starts at its step.
 */
export const DUSK = { value: 0 };
const state = { target: 0 };
/** How much of the dusk one second of play moves (the light reaches a new step's target in ~50 s). */
const RATE = 0.02;

/** A new target dusk; `snap` jumps there (a loaded save, a capture's staged state). */
export function setDusk(target: number, snap = false): void {
  state.target = Math.min(1, Math.max(0, target));
  if (snap) DUSK.value = state.target;
}

/** Eases the dusk toward its target. */
export function stepDusk(dt: number): void {
  const d = state.target - DUSK.value;
  DUSK.value += Math.sign(d) * Math.min(Math.abs(d), RATE * dt);
}

/** The key light's dimming and the fill's at a dusk value (look/render.ts). */
// (round 25's sunset key / fill shift is gone: seat B after round 25, it brightened every slope facing the key, the near
// ground included, and the fill rose through the sunset against the round-11 monotonic rule)
export const keyAt = (d: number): number => 1 - 0.95 * d ** 0.7; // E407 (B's sand 29 / 39.7 once the 0.5 bell went): a slower fall through the middle steps, still monotonic // the sun drops fast once the quest starts (B measured 1.4x the mockup)
// round 24 (seats B and C after round 23: the late sand lit flat by the fill, D's land median 34 against 13, C's open ground
// 53 against 34; B's dusk already right): the fill falls by a third after the logbook's step, a global dusk term
const lateFill = (d: number): number => { const k = Math.min(1, Math.max(0, (d - 0.6) / 0.3)); return k * k * (3 - 2 * k); };
export const fillAt = (d: number): number => (1 + 0.05 * d) * (1 - 0.35 * lateFill(d)); // round 12 (seat C R11-5: a 1.7x fill bump at dusk 0.5 lit the shade, then dimmed it; B's sand is lifted in the sand material instead) // round 11 (R10B-6b: B's sand at dusk 0.5 31.8 / 39.7; C and D, later, on target) // round 8: the key behind the tower leaves the late views to the fill; round 9: less (B, C, D's late sand 3-10 over their mockups) // a floor: the late views keep warm brown sand (council round 2, R2B-1)
