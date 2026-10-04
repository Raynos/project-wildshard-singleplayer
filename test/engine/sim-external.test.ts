// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the same native physics binary shipped in clean exports.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';
import { CharacterMotor } from '../../src/engine/physics/CharacterMotor';
import { prepareFrameMotors } from '../../src/engine/physics/frame';
import { Events } from '../../src/engine/events/events';
import { PlayerHealth } from '../../src/engine/combat/health';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

it('steps only regional systems with the existing traveller and snapshots its trusted page-object alias', async () => {
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer), home = new Physics(rapier);
  const level = { ...SIM_LEVEL, entities: [], quests: [] }, region = createSimHost(level, { rapier, playerBody: false });
  const position = new Vector3(255, 0, 0), health = new PlayerHealth(new Events(), { now: () => 0, position: () => position, dodging: () => false, dodgeGuard: () => false });
  class LivePlayer { readonly position = position; yaw = 0; readonly health = health; input(): number { return 1; } }
  const page = new LivePlayer(), member = { position, motor: new CharacterMotor(home, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], owner: page }) };
  let physicsSteps = 0, updates = 0;
  const step = region.physics.step.bind(region.physics); region.physics.step = () => { physicsSteps++; step(); };
  region.onStep('probe', () => { updates++; });
  try {
    expect(region.hasPlayerMotor).toBe(false); expect(() => region.stepExternal()).toThrow('not bound');
    const release = region.bindExternalPlayer({ position, get yaw() { return page.yaw; }, health, owner: page });
    expect(() => region.bindExternalPlayer({ position, yaw: 0, health, owner: page })).toThrow('Invalid');
    prepareFrameMotors([member], region.physics, { x: -555, z: 0 }).commit();
    for (let tick = 0; tick < 60; tick++) region.stepExternal();
    expect(region.state.tick).toBe(60); expect(region.clock.now).toBeCloseTo(1); expect(updates).toBe(60); expect(physicsSteps).toBe(0);
    expect(region.player.position).toEqual(position); expect(region.player.health).toBe(health); expect(home.world.colliders.len()).toBe(0);
    region.attachPlayerMotor(member.motor);
    const snapshot = snapshotSimHost(region); region.releasePlayerMotor();
    expect(snapshot.colliderTags.some((row) => row.owner.kind === 'player')).toBe(true);
    const restored = restoreSimHost(level, { rapier }, snapshot); try { expect(restored.state.tick).toBe(60); expect(restored.player.position).toEqual(position); } finally { restored.dispose(); }
    release(); release(); expect(region.player.health).not.toBe(health); expect(() => region.stepExternal()).toThrow('not bound');
    expect(region.state.tick).toBe(60); expect(health.alive).toBe(true); expect(region.isExternalPlayerObject(page)).toBe(false);
  } finally { member.motor.dispose(); region.dispose(); home.dispose(); }
});
