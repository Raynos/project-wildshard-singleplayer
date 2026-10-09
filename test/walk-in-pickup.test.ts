import { expect, it } from 'vitest';
import { walkInPickup } from '../src/engine/world/interact/pickup';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

it('keeps the strict foot and height boundaries independently of the rendered pickup pose', () => {
  const pickup = { x: 0, y: 0, z: 0 };
  expect(walkInPickup(null, { x: 1.1, y: 0, z: 0 }, pickup)).toBe(false);
  expect(walkInPickup(null, { x: 0, y: 2.2, z: 0 }, pickup)).toBe(false);
  expect(walkInPickup(null, { x: 0, y: -2.2, z: 0 }, pickup)).toBe(false);
  expect(walkInPickup(null, { x: 1.099, y: 2.199, z: 0 }, pickup)).toBe(true);
  expect(walkInPickup(null, { x: 0.8, y: 0, z: 0.8 }, pickup)).toBe(false);
});

it('a real wall or deck refuses a nearby pickup, while removal restores native visibility', async () => {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  try {
    const feet = { x: 0, y: 0, z: 0 }, pickup = { x: 1, y: 0, z: 0 };
    const wall = physics.world.createCollider(physics.R.ColliderDesc.cuboid(0.05, 1, 1).setTranslation(0.5, 0.75, 0).setCollisionGroups(groups('WORLD')));
    physics.step();
    expect(walkInPickup(physics, feet, pickup)).toBe(false);
    physics.world.removeCollider(wall, true); physics.step();
    expect(walkInPickup(physics, feet, pickup)).toBe(true);
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(2, 0.05, 2).setTranslation(0, 0.4, 0).setCollisionGroups(groups('WORLD')));
    physics.step();
    expect(walkInPickup(physics, { x: 0, y: 0.5, z: 0 }, { x: 0, y: -0.5, z: 0 })).toBe(false);
  } finally { physics.dispose(); }
});
