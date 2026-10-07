import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { KinematicMover } from '../../src/engine/physics/mover';
import { canStandAt } from '../../src/engine/physics/query';
import { groups } from '../../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
it('admits current reset deck collision without a world tick, and refuses actual capsule obstacles', () => {
  const physics = new Physics(rapier), dimensions = { radius: 0.35, height: 1.8, blockedBy: ['WORLD', 'CREATURE'] as const };
  const deck = new KinematicMover(physics, [{ x: 0, y: -0.25, z: 0, hx: 4, hy: 0.25, hz: 5, rot: { x: 0, y: 0, z: 0, w: 1 } }],
    { position: { x: 0, y: 3, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true }, 'deck');
  try {
    physics.step(); const feet = { x: 0, y: 0, z: 0 };
    expect(canStandAt(physics, feet, dimensions, 'deck')).toBe(false);
    deck.resetPose({ position: feet, euler: { x: 0, y: 0, z: 0 }, enabled: true });
    expect(canStandAt(physics, feet, dimensions, 'deck')).toBe(true);
    expect(canStandAt(physics, feet, dimensions, 'other')).toBe(false);
    const obstacle = physics.world.createCollider(rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(0, 1, 0).setCollisionGroups(groups('CREATURE')));
    expect(canStandAt(physics, feet, dimensions, 'deck')).toBe(false);
    obstacle.setSensor(true); expect(canStandAt(physics, feet, dimensions, 'deck')).toBe(true);
    obstacle.setSensor(false); obstacle.setEnabled(false); expect(canStandAt(physics, feet, dimensions, 'deck')).toBe(true);
  } finally { deck.dispose(); physics.dispose(); }
});
