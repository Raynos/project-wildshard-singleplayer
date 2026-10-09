// SF72: Rapier 0.21's `restoreSnapshot` reported rigid body 0 as the parent of every static collider (a coParent miss read
// as Coarena index 0), so a capsule standing on static ground in a restored world rode the first kinematic body.
// oxlint-disable-next-line import/no-nodejs-modules -- The restore witness uses the production native engine.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CharacterMotor } from '../../src/engine/physics/CharacterMotor';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';

const MOTOR = { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] } as const;

async function world(): Promise<Physics> {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const physics = new Physics(R);
  // body 0 is a kinematic mover, so a coParent miss lands on a body a motor would ride
  const mover = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(6, 0.2, 0));
  physics.world.createCollider(R.ColliderDesc.cuboid(1, 0.2, 1), mover);
  physics.world.createCollider(R.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0));
  const fixed = physics.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(-6, 0, 0));
  physics.world.createCollider(R.ColliderDesc.ball(0.5), fixed);
  physics.world.createCollider(R.ColliderDesc.ball(0.5).setTranslation(-3, 1, 3));
  physics.step();
  return physics;
}

const parents = (physics: Physics): [number, number | null][] => {
  const out: [number, number | null][] = [];
  physics.world.forEachCollider((collider) => { out.push([collider.handle, collider.parent()?.handle ?? null]); });
  return out;
};
const bodies = (physics: Physics): number[] => {
  const out: number[] = [];
  physics.world.forEachRigidBody((body) => { out.push(body.handle); });
  return out;
};

it('a restored world keeps every collider parent and body handle, byte for byte', async () => {
  const original = await world(), bytes = original.snapshot();
  const restored = new Physics(original.R, bytes);
  expect(parents(original).filter(([, parent]) => parent === null)).toHaveLength(2);
  expect(parents(restored)).toEqual(parents(original));
  expect(bodies(restored)).toEqual(bodies(original));
  // the repair touches only JS wrappers: the native continuation is unchanged
  expect(restored.snapshot()).toEqual(bytes);
  // the rewrapped statics still answer the same reads
  restored.world.forEachCollider((collider) => {
    const twin = original.world.getCollider(collider.handle);
    expect(collider.translation()).toEqual(twin.translation());
    expect(collider.shapeType()).toBe(twin.shapeType());
  });
  original.dispose(); restored.dispose();
});

it('a capsule on static ground in a restored world does not ride the first kinematic body', async () => {
  const original = await world(), restored = new Physics(original.R, original.snapshot());
  original.dispose();
  const motor = new CharacterMotor(restored, MOTOR), feet = { x: 0, y: 0.02, z: 0 };
  motor.resetAt(feet);
  const mover = restored.world.getRigidBody(0);
  expect(mover.isKinematic()).toBe(true);
  for (let i = 0; i < 60; i++) {
    const t = mover.translation();
    mover.setNextKinematicTranslation({ x: t.x, y: t.y, z: t.z + 0.05 });
    restored.step();
    motor.carry(feet);
    motor.move(feet, { x: 0, y: -0.05, z: 0 });
  }
  expect(motor.snapshot().anchorBodyHandle).toBeNull();
  expect(Math.abs(feet.x)).toBeLessThan(1e-3); expect(Math.abs(feet.z)).toBeLessThan(1e-3);
  motor.dispose(); restored.dispose();
});
