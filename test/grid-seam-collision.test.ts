// oxlint-disable-next-line import/no-nodejs-modules -- Real collider proof uses the committed native Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { Scope } from '../src/engine/app/scope';
import { seamGeometry, type SeamEdge } from '../src/engine/sim/seamGeometry';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
for (const axis of ['x', 'z'] as const) for (const height of [-40, 100]) it(`stops a real capsule at the ${height}m road guard on axis${axis}, leaving the declared entry open`, () => {
  const physics = new Physics(rapier), scope = new Scope('seam'), edge: SeamEdge = { entryWidth: 6, geometry: height < 0 ? 'void' : 'ground', profile: {
    heights: Array.from({ length: 257 }, (_, i) => Math.abs(i - 128) <= 2 ? 0 : height), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0,
  } };
  const generated = seamGeometry({ id: 'physical.edge', axis, origin: { x: 0, z: 0 }, edges: [edge, edge] });
  installStripCollider(physics, generated.mesh, scope);
  const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.3, snap: 0.2, maxClimbDeg: 45, group: 'PLAYER', blockedBy: ['WORLD'] });
  try {
    const closed = { x: axis === 'x' ? 0 : 20, y: 0.005, z: axis === 'z' ? 0 : 20 };
    for (let tick = 0; tick < 180; tick++) { physics.step(); motor.move(closed, { x: axis === 'x' ? 0.5 : 0, y: -9.81 / 3600, z: axis === 'z' ? 0.5 : 0 }); }
    expect(closed[axis]).toBeGreaterThan(6); expect(closed[axis]).toBeLessThan(7.5); expect(closed.y).toBeGreaterThan(-0.02);
    const open = { x: 0, y: 0.005, z: 0 };
    for (let tick = 0; tick < 60 && open[axis] < 27.25; tick++) {
      physics.step(); const move = motor.move(open, { x: axis === 'x' ? 0.5 : 0, y: -9.81 / 3600, z: axis === 'z' ? 0.5 : 0 });
      expect(move.horizontalFreedom).toBeGreaterThan(0.98);
    }
    expect(open[axis]).toBeGreaterThanOrEqual(27.25); expect(Math.abs(open.y)).toBeLessThan(0.06);
  } finally { motor.dispose(); scope.dispose(); expect(physics.world.colliders.len()).toBe(0); physics.dispose(); }
});
for (const axis of ['x', 'z'] as const) it(`blocks a single jump but permits a double-jump arc over the G101 guard on axis${axis}`, () => {
  const physics = new Physics(rapier), scope = new Scope('jump.seam');
  const profile = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
  const edge: SeamEdge = { profile, entryWidth: 6, geometry: 'void' };
  installStripCollider(physics, seamGeometry({ id: 'jump.edge', axis, origin: { x: 0, z: 0 }, edges: [edge, edge] }).mesh, scope);
  const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.35, snap: 0.2, maxClimbDeg: 45, group: 'PLAYER', blockedBy: ['WORLD'] });
  try {
    for (const apex of [1.18, 2.86]) {
      const feet = { x: axis === 'x' ? 3 : 20, y: 0.005, z: axis === 'z' ? 3 : 20 };
      let velocity = Math.sqrt(2 * 9.81 * apex), highest = 0;
      for (let tick = 0; tick < 120; tick++) {
        physics.step(); velocity -= 9.81 / 60;
        const move = motor.move(feet, { x: axis === 'x' ? 8 / 60 : 0, y: velocity / 60, z: axis === 'z' ? 8 / 60 : 0 });
        if (move.grounded && velocity < 0) velocity = 0;
        highest = Math.max(highest, feet.y);
      }
      if (apex === 1.18) { expect(highest).toBeLessThan(1.18 + 0.35); expect(feet[axis]).toBeLessThan(7.5); }
      else { expect(highest).toBeGreaterThan(2); expect(feet[axis]).toBeGreaterThan(15); }
      expect(Math.abs(feet.y)).toBeLessThan(0.06);
    }
  } finally { motor.dispose(); scope.dispose(); expect(physics.world.colliders.len()).toBe(0); physics.dispose(); }
});
