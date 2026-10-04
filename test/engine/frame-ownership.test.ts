// oxlint-disable-next-line import/no-nodejs-modules -- Native frame ownership fixture reads the committed Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { currentOwner, withOwner } from '../../src/engine/app/ownership';
import { Physics } from '../../src/engine/physics/Physics';
import { CharacterMotor } from '../../src/engine/physics/CharacterMotor';
import { prepareFrameMotors } from '../../src/engine/physics/frame';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { createSimHost } from '../../src/engine/sim';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it.each([false, true])('keeps a regional host independent of its ambient construction owner (playerBody=%s)', (playerBody) => {
  const page = new Scope('page');
  const host = withOwner(page, () => createSimHost(SIM_LEVEL, { rapier, playerBody }));
  try {
    expect(page.census.colliders).toBe(0); page.dispose();
    expect(host.physics.world.colliders.len()).toBeGreaterThan(0);
    if (playerBody) { host.step(); expect(host.state.tick).toBe(1); }
    else { expect(() => host.step()).toThrow('Frozen simulation'); host.physics.step(); }
    host.physics.world.forEachCollider((collider) => { expect(collider.isValid()).toBe(true); });
  } finally { host.dispose(); page.dispose(); }
});
it.each([false, true])('keeps transfer motors transaction-owned in a page callback (page already disposed=%s)', (closed) => {
  const home = new Physics(rapier), region = new Physics(rapier), page = new Scope('page');
  const rider = { position: { x: 0, y: 1, z: 0 }, motor: new CharacterMotor(home, { radius: 0.3, height: 1.7, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] }) };
  if (closed) page.dispose();
  try {
    withOwner(page, () => {
      const transfer = prepareFrameMotors([rider], region, { x: -555, z: 0 });
      expect(currentOwner()).toBe(page); expect(page.census.colliders).toBe(0);
      transfer.commit(); expect(rider.motor.collider.isValid()).toBe(true);
      page.dispose(); expect(rider.motor.collider.isValid()).toBe(true);
      const back = prepareFrameMotors([rider], home, { x: 555, z: 0 });
      back.commit(); expect(rider.motor.collider.isValid()).toBe(true); expect(rider.position.x).toBe(0);
      const cancelled = prepareFrameMotors([rider], region, { x: 555, z: 0 });
      expect(region.world.colliders.len()).toBe(1); cancelled.cancel(); expect(region.world.colliders.len()).toBe(0);
    });
    expect(currentOwner()).toBe(null);
  } finally { rider.motor.dispose(); home.dispose(); region.dispose(); page.dispose(); }
});
