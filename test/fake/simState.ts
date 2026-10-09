// oxlint-disable-next-line import/no-nodejs-modules -- A witness's continuation hash is a sha256 of the canonical state.
import { createHash } from 'node:crypto';
import RAPIER, { RigidBodyType, type Collider, type World } from '@dimforge/rapier3d-simd';
import { Physics } from '../../src/engine/physics/Physics';
import { decodeSimSnapshot, type SimSnapshot } from '../../src/engine/sim/snapshot';

/**
 * A sim snapshot's native physics as restored world state, the one canonical form of "the same world" (SF72, E435).
 *
 * Rapier's snapshot bytes are not canonical: `takeSnapshot(restoreSnapshot(x))` can differ from `x` by a few records
 * (Driftwood's quest checkpoint: two 13-byte records swapped near offset 194 k of 3.3 MB, the broad phase's pair order),
 * and repeated round trips keep permuting them, with no step in between and every body, collider and contact the same.
 * Whether it shows hangs on where a dynamic body rests, so a byte check of a restore flakes about one run in two on the
 * wrong checkpoint. So a restore or a replay is judged on the world the bytes restore to: every rigid body (type,
 * enabled, asleep, pose, velocities, mass, damping, gravity scale, CCD, dominance), every collider (parent, enabled,
 * collision and solver groups, sensor, shape type, pose, friction, restitution, density) in the arenas' own order, and
 * every contact of a dynamic body's collider (partners by handle; per manifold its contacts' distances and impulses, the
 * solver's warm start). Numbers compare exactly: a 1-ULP pose difference still fails. Identical bytes need no restore.
 */
export interface PhysicsState {
  /** the state, flattened (booleans as 0 / 1, a missing parent as -1) */
  readonly values: number[];
  /** [index of a record's first value, what the record is], ascending: names the first difference */
  readonly marks: [number, string][];
}

const bodyType = (t: RigidBodyType): number => t === RigidBodyType.Dynamic ? 0 : t === RigidBodyType.Fixed ? 1 : t === RigidBodyType.KinematicPositionBased ? 2 : 3;

function contacts(world: World, collider: Collider, out: number[]): void {
  const partners: Collider[] = [];
  world.contactPairsWith(collider, other => { partners.push(other); });
  partners.sort((a, b) => a.handle - b.handle);
  out.push(partners.length);
  for (const other of partners) {
    out.push(other.handle);
    world.contactPair(collider, other, (manifold, flipped) => {
      const n = manifold.numContacts();
      out.push(flipped ? 1 : 0, n);
      for (let i = 0; i < n; i++) out.push(manifold.contactDist(i), manifold.contactImpulse(i));
    });
  }
}

/** The world `bytes` restore to, as state. */
export function physicsState(bytes: ArrayLike<number>): PhysicsState {
  const physics = new Physics(RAPIER, Uint8Array.from(bytes)), world = physics.world, values: number[] = [], marks: [number, string][] = [];
  try {
    world.forEachRigidBody(rb => {
      marks.push([values.length, `rigid body ${String(rb.handle)}`]);
      const t = rb.translation(), r = rb.rotation(), v = rb.linvel(), w = rb.angvel();
      values.push(rb.handle, bodyType(rb.bodyType()), rb.isEnabled() ? 1 : 0, rb.isSleeping() ? 1 : 0, t.x, t.y, t.z, r.x, r.y, r.z, r.w,
        v.x, v.y, v.z, w.x, w.y, w.z, rb.mass(), rb.linearDamping(), rb.angularDamping(), rb.gravityScale(), rb.isCcdEnabled() ? 1 : 0, rb.dominanceGroup());
    });
    world.forEachCollider(c => {
      marks.push([values.length, `collider ${String(c.handle)}`]);
      const t = c.translation(), r = c.rotation(), parent = c.parent();
      values.push(c.handle, parent?.handle ?? -1, c.isEnabled() ? 1 : 0, c.collisionGroups(), c.solverGroups(), c.isSensor() ? 1 : 0, c.shapeType(),
        t.x, t.y, t.z, r.x, r.y, r.z, r.w, c.friction(), c.restitution(), c.density());
      if (parent?.bodyType() === RigidBodyType.Dynamic) { marks.push([values.length, `contacts of collider ${String(c.handle)}`]); contacts(world, c, values); }
    });
  } finally { physics.dispose(); }
  return { values, marks };
}

/** Do two byte arrays hold the same bytes? */
export function sameBytes(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Where two physics states first differ (`null`: the same world, exactly). */
export function physicsDifference(a: PhysicsState, b: PhysicsState): string | null {
  const n = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < n; i++) {
    const x = a.values[i], y = b.values[i];
    if (x !== undefined && y !== undefined && Object.is(x, y)) continue;
    let at = '';
    for (const [start, label] of a.marks) { if (start > i) break; at = label; }
    return `${at || 'the world'}: value ${String(i)} is ${String(x)}, expected ${String(y)}`;
  }
  return null;
}

/**
 * The sha256 of a snapshot in canonical form, a witness's continuation hash: every field but the physics bytes as JSON,
 * then the physics as restored world state, each value's exact float64 bits (so -0, NaN payloads and 1 ULP all count).
 */
export function canonicalSimDigest(snapshot: SimSnapshot | string): string {
  const { physics, ...rest } = typeof snapshot === 'string' ? decodeSimSnapshot(snapshot) : snapshot;
  return createHash('sha256').update(JSON.stringify(rest)).update('\0').update(new Uint8Array(Float64Array.from(physicsState(physics).values).buffer)).digest('hex');
}
