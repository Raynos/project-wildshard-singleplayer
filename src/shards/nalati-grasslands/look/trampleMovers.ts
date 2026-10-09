/**
 * The player's trail through the grass, one law for the page's painterly grass (look/grass.ts `update`) and a renderer-free
 * host (runtime/headless.ts, SF72): each frame the player pushes the trample map at its feet with its velocity from the last
 * frame's spot (none on the first frame), skipped above 30 m/s (a teleport or respawn, not a stride), before the map updates.
 */

/** The player's trample radius (m): the map is stamped within 0.8 × this (game/systems/looks/trample.ts `push`). */
export const PLAYER_TRAMPLE_RADIUS = 0.55;

/** Where the player stood last frame (NaN before the first). */
export interface PlayerTrail { lastX: number; lastZ: number }

/** A trample map's push (TrampleField.push). */
type Push = (x: number, z: number, radius: number, strength: number, vx: number, vz: number) => void;

/** This frame's push from the player at (x, z), `dt` seconds after the last; the trail moves on. */
export function pushPlayerTrail(trail: PlayerTrail, dt: number, x: number, z: number, radius: number, push: Push): void {
  const vx = Number.isNaN(trail.lastX) || dt <= 0 ? 0 : (x - trail.lastX) / dt;
  const vz = Number.isNaN(trail.lastZ) || dt <= 0 ? 0 : (z - trail.lastZ) / dt;
  trail.lastX = x; trail.lastZ = z;
  if (vx * vx + vz * vz < 900) push(x, z, radius, 1, vx, vz);
}
