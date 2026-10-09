// oxlint-disable-next-line import/no-nodejs-modules -- Load the shipping WASM and source-fence the shared page formula.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimPlayerMotionSample } from '../../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot } from '../../src/engine/sim/snapshot';
import { combatSpeedFactor } from '../../src/engine/player/combatMotion';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, id: 'motion-sample', entities: [], quests: [] };

it('shares the unchanged page factor for grounded, swimming, airborne and hover samples', () => {
  for (let tick = 0; tick < 10_000; tick++) {
    const x = Math.sin(tick / 30) * 18, z = Math.cos(tick / 71) * 9;
    const grounded = tick % 3 === 0, swimming = tick % 7 === 0, hover = tick % 11 === 0, speed = Math.hypot(x, z);
    expect(combatSpeedFactor(speed, grounded, swimming, hover, 7.2)).toBe((grounded || swimming) && !hover ? speed / 7.2 : 0);
  }
  expect(readFileSync('src/engine/player/Player.ts', 'utf8')).toContain('this.speedFactor = combatSpeedFactor(hSpeed, this.onGround, swim, hover, 7.2)');
});

it('samples command velocity before motor correction, excludes impulse, and leaves exact native output unchanged', () => {
  const control = createSimHost(level, { rapier }), observed = createSimHost(level, { rapier });
  const samples: (SimPlayerMotionSample | null)[] = []; let calls = 0;
  const remove = observed.observePlayerMotion(value => { samples.push(value === null ? null : { ...value }); calls++; });
  const wall = (host: typeof control): void => {
    const p = host.player.position;
    host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(0.1, 3, 3).setTranslation(p.x + 0.7, p.y, p.z));
  };
  wall(control); wall(observed);
  try {
    control.impulsePlayer(new Vector3(5, 0, 0)); observed.impulsePlayer(new Vector3(5, 0, 0));
    for (let tick = 0; tick < 90; tick++) {
      const command = { moveX: 1, moveZ: 0, yaw: 0 };
      control.step(command); observed.step(command);
      const value = samples.at(-1);
      if (value === null || value === undefined) throw new Error('Missing observed native motion');
      expect(value.velocityX).toBe(level.player.speed); expect(value.velocityZ).toBe(0);
      expect(value.grounded).toBe(observed.playerFall.grounded); expect(value.swimming).toBe(false); expect(value.hover).toBe(false);
      expect(serializeSimSnapshot(snapshotSimHost(observed))).toBe(serializeSimSnapshot(snapshotSimHost(control)));
    }
    expect(observed.player.position.x - level.player.at.x).toBeLessThan(0.5); // the blocked displacement is not the sample
    expect(calls).toBe(90); remove(); remove(); observed.step(); expect(calls).toBe(90);
  } finally { observed.dispose(); control.dispose(); }
  expect(Object.values(observed.scope.census).every(n => n === 0)).toBe(true);
});

it('delivers the delegated owner sample before systems, or explicit unavailable, and owns its scope lease', () => {
  const host = createSimHost(level, { rapier }), frozen = createSimHost(level, { rapier, playerBody: false });
  const borrowed = createSimHost(level, { rapier, physics: host.physics, player: host.player, clock: host.clock, combat: host.combat, events: host.events });
  const order: string[] = [], samples: (SimPlayerMotionSample | null)[] = [];
  let supplied: SimPlayerMotionSample = { velocityX: 6, velocityZ: -2, grounded: false, swimming: true, hover: false };
  const observer = (sample: SimPlayerMotionSample | null): void => { order.push('sample'); samples.push(sample === null ? null : { ...sample }); };
  try {
    expect(() => frozen.observePlayerMotion(observer)).toThrow('owned active'); expect(() => borrowed.observePlayerMotion(observer)).toThrow('owned active');
    host.onStep('fixture.sample-order', () => { order.push('system'); });
    const count = host.scope.census.disposers, remove = host.observePlayerMotion(observer);
    expect(host.scope.census.disposers).toBe(count + 1); expect(() => host.observePlayerMotion(observer)).toThrow('owned active');
    let releaseDriver = host.usePlayerDriver({ input: () => true, step: () => { order.push('motion'); } });
    host.step(); expect(order).toEqual(['motion', 'sample', 'system']); expect(samples).toEqual([null]);
    releaseDriver(); order.length = 0;
    releaseDriver = host.usePlayerDriver({ input: () => true, step: () => { order.push('motion'); }, motionSample: () => supplied });
    host.step(); expect(order).toEqual(['motion', 'sample', 'system']); expect(samples[1]).toEqual(supplied);
    supplied = { ...supplied, velocityX: Number.NaN }; expect(() => host.step()).toThrow('Invalid delegated');
    releaseDriver(); remove(); remove(); expect(host.scope.census.disposers).toBe(count);
  } finally { borrowed.dispose(); frozen.dispose(); host.dispose(); }
  expect(() => host.observePlayerMotion(observer)).toThrow('owned active');
});
