// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM and read the client Player's source in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost, type SimLevel } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import { FIXED_STEP } from '../../src/engine/core/fixedStep';
import { fallStep, groundedVelocity, HARD_FALL_DAMAGE, HARD_LANDING_SPEED, hardLanding, landingCushion, PLAYER_GRAVITY } from '../../src/engine/player/fall';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
/** The fixture's flat ground with no creature, so only the fall law touches the player. */
const LEVEL: SimLevel = { ...SIM_LEVEL, entities: [], quests: [] };
const boot = (): SimHost => createSimHost(LEVEL, { rapier });
const still = { moveX: 0, moveZ: 0, yaw: 0 };

it('is the client Player\'s on-foot fall law, and Player.ts routes through it', () => {
  expect([PLAYER_GRAVITY, HARD_LANDING_SPEED, HARD_FALL_DAMAGE]).toEqual([22, 9, 8]);
  let vy = 3.1, inline = 3.1;
  for (let tick = 0; tick < 200; tick++) { vy = fallStep(vy, FIXED_STEP); inline -= 22 * FIXED_STEP; expect(vy).toBe(inline); }
  expect([groundedVelocity(-4), groundedVelocity(1.6), Object.is(groundedVelocity(-0), -0)]).toEqual([0, 1.6, true]);
  expect([landingCushion(false, 3), landingCushion(true, 0.2), landingCushion(true, 2)]).toEqual([0, 0.4, 1]);
  expect([hardLanding(-9, 0), hardLanding(-9.01, 0), hardLanding(-12, 0.5), hardLanding(-12, 0.6)]).toEqual([false, true, true, false]);
  const player = readFileSync('src/engine/player/Player.ts', 'utf8');
  expect(player).toContain('this.velocity.y = fallStep(this.velocity.y, dt)');
  expect(player).toContain('const hard = hardLanding(this.velocity.y, cushion)');
  expect(player).toContain('this.velocity.y = groundedVelocity(this.velocity.y)');
  expect(player).not.toMatch(/const GRAVITY = |velocity\.y -= GRAVITY/u);
  expect(readFileSync('src/engine/ui/playerHurt.ts', 'utf8')).toContain('this.combat.hit(hardFallHit(this.health, this.ports.player.position))');
});

it('walks off a ledge, falls on the client law and lands hard on the floor below', () => {
  const host = createSimHost(LEVEL, { rapier });
  try {
    // a 3 m block under the spawn, its far edge 1 m ahead (+z)
    host.physics.world.createCollider(rapier.ColliderDesc.cuboid(2, 1.5, 1).setTranslation(0, 1.5, 0).setCollisionGroups(groups('WORLD')));
    host.player.position.set(0, 3, 0); host.player.motor.resetAt(host.player.position);
    host.step(still);
    expect(host.playerFall).toEqual({ vy: 0, grounded: true });
    let ticks = 0, airborne = 0, vy = 0;
    while (ticks < 300 && (airborne === 0 || !host.playerFall.grounded)) {
      host.step({ moveX: 0, moveZ: 1, yaw: 0 }); ticks++;
      if (!host.playerFall.grounded) {
        // after the tick that leaves the ledge, the fall speed is the client's tick for tick
        vy = fallStep(vy, FIXED_STEP); airborne++;
        expect(host.playerFall.vy).toBe(vy);
      }
    }
    expect(airborne).toBeGreaterThan(20);
    expect(host.player.position.y).toBeCloseTo(0, 1);
    expect(host.playerFall).toEqual({ vy: 0, grounded: true });
    expect(host.player.position.z).toBeGreaterThan(1.3);
    // ~11.5 m/s at touchdown, past the 9 m/s hard-landing line: the client's 8-point fall hit
    expect(host.player.health.attributes.health).toBe(100 - HARD_FALL_DAMAGE);
    expect(snapshotSimHost(host).player.fall).toBeUndefined();
  } finally { host.dispose(); }
});

it('pulls a shove\'s lift back down to the ground, and an unshoved idle host keeps its bytes', () => {
  const host = boot(), plain = boot();
  try {
    const before = snapshotSimHost(plain).player;
    for (let tick = 0; tick < 30; tick++) plain.step();
    const idle = snapshotSimHost(plain);
    expect(idle.player.fall).toBeUndefined(); expect(idle.player).toEqual(before);
    host.impulsePlayer(new Vector3(0, 6, 0));
    let peak = 0;
    for (let tick = 0; tick < 240; tick++) { host.step(); peak = Math.max(peak, host.player.position.y); }
    expect(peak).toBeGreaterThan(0.4);
    expect(host.player.position.y).toBeCloseTo(0, 1);
    expect(host.playerFall).toEqual({ vy: 0, grounded: true });
    expect(host.player.health.attributes.health).toBe(100); // a hop's landing is soft
  } finally { host.dispose(); plain.dispose(); }
});

it('keeps a live fall in the strict snapshot, continues it exactly, and refuses a non-canonical one', () => {
  const falling = boot();
  let restored: SimHost | undefined;
  try {
    falling.player.position.set(0, 6, 0); falling.player.motor.resetAt(falling.player.position);
    for (let tick = 0; tick < 12; tick++) falling.step(still);
    expect(falling.playerFall.grounded).toBe(false); expect(falling.playerFall.vy).toBeLessThan(-3);
    const saved = serializeSimSnapshot(snapshotSimHost(falling));
    expect(decodeSimSnapshot(saved).player.fall).toEqual(falling.playerFall);
    restored = restoreSimHost(LEVEL, { rapier }, decodeSimSnapshot(saved));
    expect(restored.playerFall).toEqual(falling.playerFall);
    for (let tick = 0; tick < 90; tick++) { falling.step(still); restored.step(still); }
    expect(falling.playerFall).toEqual({ vy: 0, grounded: true });
    expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(falling)));
    const rest = snapshotSimHost(falling); rest.player.fall = { vy: 0, grounded: true };
    expect(() => restoreSimHost(LEVEL, { rapier }, rest)).toThrow('Snapshot instance registrations do not match');
    expect(() => decodeSimSnapshot(saved.replace(/"fall":\{[^}]*\}/u, '"fall":{"vy":-1}'))).toThrow();
  } finally { restored?.dispose(); falling.dispose(); }
});
