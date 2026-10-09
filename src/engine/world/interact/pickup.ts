import type { Physics } from '../../physics/Physics';
import { lineOfSight } from '../../physics/query';

interface Point { x: number; y: number; z: number }

/** The page's walk-in pickup law: strict foot radius and height, then chest-to-pickup native world visibility.
 * A null world preserves the existing pre-physics behavior; an admitted host supplies its actual physics. */
export function walkInPickup(physics: Physics | null, feet: Point, pickup: Point): boolean {
  const dx = feet.x - pickup.x, dz = feet.z - pickup.z;
  return dx * dx + dz * dz < 1.1 * 1.1 && Math.abs(feet.y - pickup.y) < 2.2 &&
    (physics === null || lineOfSight(physics, { x: feet.x, y: feet.y + 1, z: feet.z }, { x: pickup.x, y: pickup.y + 0.5, z: pickup.z }, 0.3));
}
