import type { Vector3 } from 'three';

/** Caller-owned contact vectors. No collision query, clock, allocation or random draw is performed here. */
export interface ProjectileReach { radius: number; up: number; down: number }
export interface ProjectileGlance { lift: number; keep: number; bounce: number; maxSpeed: number }

/** Move a swept sphere's centre to the tip's surface contact along its flight. */
export function projectileContactTip(at: Vector3, direction: Vector3, normal: Vector3, radius: number): void {
  at.addScaledVector(direction, radius / Math.max(0.25, -normal.dot(direction)));
}

/** Retain tangential motion and the authored fraction of normal bounce, in the shipping operation order. */
export function projectileGlance(at: Vector3, velocity: Vector3, normal: Vector3, policy: ProjectileGlance): void {
  at.addScaledVector(normal, policy.lift);
  const vn = velocity.dot(normal);
  velocity.addScaledVector(normal, -vn).multiplyScalar(policy.keep).addScaledVector(normal, -vn * policy.bounce);
  if (velocity.length() > policy.maxSpeed) velocity.setLength(policy.maxSpeed);
}

/** Lie across the contacted surface. `along` is scratch/output; the supplied axes are not written. */
export function projectileRest(at: Vector3, direction: Vector3, normal: Vector3, radius: number, length: number,
  along: Vector3, yAxis: Vector3, xAxis: Vector3): void {
  along.copy(direction).addScaledVector(normal, -direction.dot(normal));
  if (along.lengthSq() < 1e-6) along.crossVectors(normal, Math.abs(normal.y) < 0.9 ? yAxis : xAxis);
  along.normalize();
  at.addScaledVector(normal, -radius * 0.8).addScaledVector(along, length * 0.5);
}

/** Insert a tip by the caller's material-specific depth, preserving the input point. */
export function projectileBury(point: Vector3, direction: Vector3, depth: number, out: Vector3): Vector3 {
  return out.copy(point).addScaledVector(direction, depth);
}

/** Detach into the supplied floor height. The caller decides when its attachment is dead or hidden. */
export function projectileDrop(position: Vector3, direction: Vector3, floor: number, bury: number): void {
  direction.set(direction.x * 0.35, -1, direction.z * 0.35).normalize();
  position.set(position.x, floor, position.z).addScaledVector(direction, bury * 1.5);
}

/** Test the shaft midpoint. Eligibility, capacity, reverse-order removal and survival draws remain caller-owned. */
export function projectileWithinReach(position: Vector3, direction: Vector3, length: number, feet: Vector3,
  reach: ProjectileReach): boolean {
  const mx = position.x - direction.x * length * 0.5;
  const my = position.y - direction.y * length * 0.5;
  const mz = position.z - direction.z * length * 0.5;
  return !(Math.hypot(mx - feet.x, mz - feet.z) > reach.radius || my - feet.y > reach.up || my - feet.y < -reach.down);
}
