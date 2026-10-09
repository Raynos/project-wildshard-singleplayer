import type { Vector3 } from 'three';

/** The flight numbers of a drawn projectile (an arrow, a thrown bolt): gravity (m/s²), speed-squared drag and the sideways
 *  pull toward the wind velocity (/s). `ProjectileKind` (combat/view/projectile.ts) carries them with its view. */
export interface ProjectileFlight { gravity: number; drag: number; windCoupling: number }

/** Deterministic flight substep. Only the supplied position/velocity are written; no world or clock is read. Renderer-free:
 *  the browser's Projectiles (combat/view/projectile.ts) and a headless runtime's arrows fly the one law. */
export function projectileFlightStep(pos: Vector3, vel: Vector3, h: number,
  kind: ProjectileFlight, wind: Readonly<Vector3> | null = null): void {
  vel.y -= kind.gravity * h;
  if (wind !== null && kind.windCoupling > 0) {
    const sp = vel.length();
    if (sp > 1e-3) {
      let x = wind.x - vel.x, y = -vel.y, z = wind.z - vel.z;
      const along = -(x * vel.x + y * vel.y + z * vel.z) / (sp * sp);
      x += vel.x * along; y += vel.y * along; z += vel.z * along;
      const coupling = kind.windCoupling * h;
      vel.x += x * coupling;
      vel.y += y * coupling;
      vel.z += z * coupling;
    }
  }
  vel.multiplyScalar(1 - kind.drag * h * vel.length() * 0.1);
  pos.addScaledVector(vel, h);
}
