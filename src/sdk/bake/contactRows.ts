import { readColliderRows, poseOf, placeCollider } from '@wildshard/engine/models/colliders';
import type { AuthorPlacement, ColliderDesc, ContactSurface } from './placement';

/** Explicit authored shape/surface vocabulary, enforced before any geometry lane is borrowed. */
export interface AuthorContactPolicy {
  readonly kinds: readonly ColliderDesc['kind'][];
  readonly surfaces: readonly ContactSurface[];
  readonly requireSurface?: boolean;
}

/** Admit fresh bounded contact rows with the native strict grammar and owned numeric lane copies. */
export function admitContactRows(rows: readonly unknown[], policy: AuthorContactPolicy): ColliderDesc[] {
  return readColliderRows(rows, policy);
}

/** Compile an ordered contact batch at one authored pose using the native matrix/quaternion/scale law. */
export function placeContactRows(rows: readonly ColliderDesc[], placement: AuthorPlacement<object>): ColliderDesc[] {
  const pose = poseOf(placement);
  return rows.map(row => placeCollider(row, pose));
}

/** Compile authored stair contacts with the native block order and exact arithmetic.
 * This returns data only; registration, Rapier shapes and collision queries remain engine-owned. */
export function treadBoxRows(d: Extract<ColliderDesc, { kind: 'treads' }>): Extract<ColliderDesc, { kind: 'box' }>[] {
  const dx = d.to.x - d.from.x, dz = d.to.z - d.from.z, run = Math.hypot(dx, dz) / d.count, rise = (d.to.y - d.from.y) / d.count;
  const yaw = Math.atan2(dx, dz);
  const out: Extract<ColliderDesc, { kind: 'box' }>[] = [];
  for (let i = 0; i < d.count; i++) {
    const f = (i + 0.5) / d.count, top = d.from.y + rise * (i + 1), hy = Math.max(0.01, (top - d.from.y) / 2);
    out.push({ kind: 'box', x: d.from.x + dx * f, y: d.from.y + hy, z: d.from.z + dz * f, hx: d.width / 2, hy, hz: run / 2, yaw, ...(d.surface === undefined ? {} : { surface: d.surface }) });
  }
  return out;
}
