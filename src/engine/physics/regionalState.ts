import type { Physics } from './Physics';
import { GROUP } from './groups';
import { tagOf } from './surface';
/** Canonical authored collision state omits the traveler and platform colliders (shared seams, home/soft walls). */
export function regionalPhysicsState(physics: Physics): string {
  const colliders: string[] = [], bodies = new Set<number>();
  physics.world.forEachCollider((collider) => {
    const membership = collider.collisionGroups() >>> 16, owner = tagOf(collider)?.owner;
    if ((membership & (GROUP.PLAYER | GROUP.BORDER)) !== 0 || owner === 'platform.grid'
      || (owner !== null && typeof owner === 'object' && 'readiness' in owner)) return;
    const body = collider.parent();
    if (body !== null) bodies.add(body.handle);
    colliders.push(JSON.stringify({ owner, material: tagOf(collider)?.material, shape: collider.shape,
      translation: collider.translation(), rotation: collider.rotation(), enabled: collider.isEnabled(), sensor: collider.isSensor(),
      groups: collider.collisionGroups(), friction: collider.friction(), restitution: collider.restitution(), density: collider.density() }));
  });
  const motion = [...bodies].map((handle) => {
    const body = physics.world.getRigidBody(handle);
    return JSON.stringify({ type: body.bodyType(), translation: body.translation(), rotation: body.rotation(), velocity: body.linvel(), angular: body.angvel(), sleeping: body.isSleeping(), gravity: body.gravityScale(), mass: body.mass() });
  });
  return JSON.stringify({ colliders: colliders.sort(), motion: motion.sort() });
}
