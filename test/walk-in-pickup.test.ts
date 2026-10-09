import { expect, it } from 'vitest';
import { itemPickupFloor, walkInPickup } from '../src/engine/world/interact/pickup';
import { floorBelow } from '../src/engine/physics/query';
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

it('settles the page and native orb at exactly the former floor-query arithmetic over a real deck', async () => {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  try {
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(2, 0.2, 2).setTranslation(0, 1, 0).setCollisionGroups(groups('WORLD')));
    physics.step();
    for (const point of [{ x: 0, y: 1.4, z: 0 }, { x: 0, y: -0.1, z: 0 }, { x: 5, y: 3, z: 0 }, { x: 0, y: 8, z: 0 }]) {
      const from = point.y + 1.2, y = floorBelow(physics, point.x, point.z, from, 1.2 + 2);
      expect(itemPickupFloor(physics, point)).toEqual({ x: point.x, y: y !== undefined && y < from - 0.01 ? y : point.y, z: point.z });
      expect(itemPickupFloor(null, point)).toEqual(point);
    }
  } finally { physics.dispose(); }
});
