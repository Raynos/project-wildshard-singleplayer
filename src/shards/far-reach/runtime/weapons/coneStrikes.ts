import { weaponContactDistance } from '@wildshard/engine/combat/contactWeapon';
import type { Vector3 } from 'three';

/** True when `to` lies inside a cone of `reach` metres and `halfAngle` radians around `dir` from `from`. */
export function inCone(from: Vector3, dir: Vector3, to: Vector3, reach: number, halfAngle: number): boolean {
  return weaponContactDistance(from, dir, to, 'cone', reach, halfAngle) !== null;
}

