import type { Vector3 } from 'three';

/** How fast a transient player impulse fades (1/s): each fixed step scales it by e^(-rate · dt). */
export const IMPULSE_DECAY_RATE = 3.5;
/** Below this squared speed (m²/s²) a fading impulse stops outright, so it never creeps forever. */
export const IMPULSE_REST_SQ = 0.05;

/**
 * The player's transient-impulse law, shared by the client's Player and the headless SimHost so the two never drift:
 * a shove (a wisp's burst, a gale wall, an updraft) adds world velocity in m/s, every displacement goes through the motor
 * with that velocity added to the step's own, and after each step the impulse decays.
 */
export function addImpulse(impulse: Vector3, velocity: Readonly<Vector3>): void {
  if (![velocity.x, velocity.y, velocity.z].every(Number.isFinite)) throw new Error('Player impulse must be finite');
  impulse.add(velocity);
}
/** One step's fade: scale by e^(-IMPULSE_DECAY_RATE · dt), then zero it once its squared speed is under IMPULSE_REST_SQ. */
export function decayImpulse(impulse: Vector3, dt: number): void {
  impulse.multiplyScalar(Math.exp(-IMPULSE_DECAY_RATE * dt));
  if (impulse.lengthSq() < IMPULSE_REST_SQ) impulse.set(0, 0, 0);
}
