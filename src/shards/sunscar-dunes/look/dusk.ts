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

