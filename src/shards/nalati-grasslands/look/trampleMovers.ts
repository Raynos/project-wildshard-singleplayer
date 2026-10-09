/**
 * The player's trail through the grass, one law for the page's painterly grass (look/grass.ts `update`) and a renderer-free
 * host (runtime/headless.ts, SF72): each frame the player pushes the trample map at its feet with its velocity from the last
 * frame's spot (none on the first frame), skipped above 30 m/s (a teleport or respawn, not a stride), before the map updates.
 * And Wildlife's movers (`pushWildMovers`), one law for creatures/wildlife.ts and the host's creature step.
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

/** A creature as Wildlife's grass movers read it. */
export interface WildMover {
  readonly alive: boolean; readonly kind: string; readonly speed: number; readonly yaw: number; readonly scale: number;
  readonly position: { readonly x: number; readonly z: number };
}

/** Wildlife's live movers (creatures/wildlife.ts `update`, after the grass's): every moving wolf, horse or sheepdog (0.6 m/s
 *  and up) within 80 m of the player at (px, pz) parts the grass along its heading (a horse 0.8 m × its scale, a wolf 0.5, a
 *  dog 0.4; strength speed / 6), in the manager's list order. */
export function pushWildMovers(bodies: Iterable<WildMover>, px: number, pz: number, push: Push): void {
  for (const a of bodies) {
    if (!a.alive || a.speed < 0.6 || (a.kind !== 'wolf' && a.kind !== 'horse' && a.kind !== 'sheepdog')) continue;
    const dx = a.position.x - px, dz = a.position.z - pz;
    if (dx * dx + dz * dz > 80 * 80) continue;
    const r = (a.kind === 'horse' ? 0.8 : a.kind === 'wolf' ? 0.5 : 0.4) * a.scale;
    push(a.position.x, a.position.z, r, Math.min(1, a.speed / 6), Math.sin(a.yaw) * a.speed, Math.cos(a.yaw) * a.speed);
  }
}
