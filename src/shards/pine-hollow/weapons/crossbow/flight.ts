import type { Vector3 } from 'three';
import { CROSSBOW_PROFILE, type CrossbowProfile } from './profiles';

/** The flight multipliers a bolt carries (the selected ammo's, the weather's): 1 / 1 is the plain iron bolt. */
export interface BoltFlight { gravity: number; drag: number }
/** The plain bolt's flight (no ammo, still weather). */
export const PLAIN_FLIGHT: BoltFlight = { gravity: 1, drag: 1 };

/**
 * The crossbow bolt's one flight law, renderer-free: the page's Crossbow (runtime/weapons/crossbow/Crossbow.ts) and the
 * headless crossbow (runtime/weapons/headlessCrossbow.ts) both step their bolts through it. One deterministic substep of
 * `h` s: gravity (× the bolt's multiplier), then speed-squared drag, then the move. Writes only `pos` / `vel`.
 */
export function boltFlightStep(pos: Vector3, vel: Vector3, h: number, mod: BoltFlight,
  profile: Pick<CrossbowProfile, 'gravity' | 'drag'> = CROSSBOW_PROFILE): void {
  vel.y -= profile.gravity * mod.gravity * h;
  vel.multiplyScalar(1 - profile.drag * mod.drag * h * vel.length() * 0.1);
  pos.addScaledVector(vel, h);
}
