/** Synthetic bodies and character controllers; Rapier remains inside the physics boundary. */
import { loadRapier } from './rapier';
import type { Collider, KinematicCharacterController } from '@dimforge/rapier3d-simd';

export async function calibrationBodies(n: number): Promise<{ run: () => void; dispose: () => void }> {
  const R = await loadRapier(), world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(R.ColliderDesc.cuboid(100, 0.1, 100));
  const controllers: { controller: KinematicCharacterController; collider: Collider }[] = [];
  for (let i = 0; i < n; i++) {
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation((i % 20) * 2, 1 + Math.floor(i / 20) * 2, 0));
    const collider = world.createCollider(R.ColliderDesc.capsule(0.3, 0.2), body);
    controllers.push({ controller: world.createCharacterController(0.01), collider });
  }
  return { run: () => { world.step(); for (const { controller, collider } of controllers) controller.computeColliderMovement(collider, { x: 0.01, y: 0, z: 0.01 }); }, dispose: () => { world.free(); } };
}
