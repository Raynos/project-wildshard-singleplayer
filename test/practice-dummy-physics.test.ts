import { describe, expect, it } from 'vitest';
import { loadRapier } from '#engine-internal/physics/rapier';
import { Physics } from '#engine-internal/physics/Physics';
import { CharacterMotor } from '#engine-internal/physics/CharacterMotor';
import { groups } from '#engine-internal/physics/groups';
import { addTrainingTarget, trainingTargetRaycast } from '#engine-internal/physics/trainingTargets';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

describe('practice dummy physics', () => {
  it('stops the player capsule while still accepting body and head shots', async () => {
    const R = await rapier();
    const physics = new Physics(R);
    physics.world.createCollider(R.ColliderDesc.cuboid(10, 0.5, 10)
      .setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
    const dummy = {};
    addTrainingTarget(physics, dummy, 0, 0, 0);
    const motor = new CharacterMotor(physics, {
      radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3,
      group: 'PLAYER', blockedBy: ['WORLD', 'CREATURE'],
    });
    physics.step();
    const feet = { x: 0, y: 0.02, z: 2 };
    for (let i = 0; i < 90; i++) {
      motor.move(feet, { x: 0, y: -0.02, z: -0.05 });
      physics.step();
    }
    expect(feet.z).toBeGreaterThan(0.55); // player cannot walk through the dummy at z=0
    const body = trainingTargetRaycast(physics, { x: 0, y: 0.92, z: 2 }, { x: 0, y: 0, z: -1 }, 4);
    const head = trainingTargetRaycast(physics, { x: 0, y: 1.58, z: 2 }, { x: 0, y: 0, z: -1 }, 4);
    expect(body?.target).toBe(dummy);
    expect(body?.headshot).toBe(false);
    expect(head?.target).toBe(dummy);
    expect(head?.headshot).toBe(true);
    physics.dispose();
  });
});
