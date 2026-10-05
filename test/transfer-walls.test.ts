// oxlint-disable-next-line import/no-nodejs-modules -- Exercise shipped native capsule contacts and exact Rapier restore.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { TransferWalls, TRANSFER_ENTER_LIMIT, TRANSFER_EXIT_LIMIT, TRANSFER_WALL_BYTES } from '../src/engine/physics/transferWalls';
import { groups } from '../src/engine/physics/groups';
import { Player } from '../src/engine/player/Player';
import { legacyDouble } from './fake/FakeGame';

it('holds 15/30 m/s capsules at both hysteresis thresholds on every edge and permits immediate retreat', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  for (const mode of ['entry', 'exit'] as const) for (const radius of [0.3, 0.35]) for (const speed of [15, 30]) {
    const ph = new Physics(rapier), scope = new Scope('transfer.contacts');
    ph.world.createCollider(rapier.ColliderDesc.heightfield(1, 1, new Float32Array(4), { x: 800, y: 1, z: 800 }).setCollisionGroups(groups('WORLD')));
    const before = ph.snapshot().byteLength, walls = new TransferWalls(() => ph, [{ x: 0, z: 0 }], radius, mode, scope);
    expect(ph.snapshot().byteLength - before).toBeLessThan(TRANSFER_WALL_BYTES);
    const motor = new CharacterMotor(ph, { radius, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] });
    const player = new Player(new PerspectiveCamera(), ph, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
    player.motor.dispose(); player.bindFrame(ph, motor, { heightAt: () => 0, waterSurfaceAt: () => null, platforms: [] });
    player.locked = true; player.setHover(true); player.hoverSpeedLimit = () => speed; player.keys.add('KeyW');
    ph.step();
    try {
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const feet = player.position; feet.set(x * (mode === 'exit' ? 249 : 270), 0.3, z * (mode === 'exit' ? 249 : 270));
        player.velocity.set(0, 0, 0);
        const sign = mode === 'exit' ? 1 : -1;
        player.yaw = Math.atan2(-x * sign, -z * sign);
        for (let tick = 0; tick < 300; tick++) { walls.sync(); player.input(1 / 60); ph.step(); player.step(1 / 60); }
        const distance = Math.max(Math.abs(feet.x), Math.abs(feet.z)) - 250;
        if (mode === 'exit') { expect(distance).toBeGreaterThan(10); expect(distance).toBeLessThanOrEqual(TRANSFER_EXIT_LIMIT + 0.005); }
        else { expect(distance).toBeLessThan(6); expect(distance).toBeGreaterThanOrEqual(TRANSFER_ENTER_LIMIT - 0.005); }
        expect(feet.y).toBeGreaterThan(-0.02);
        const reverse = motor.move(feet, { x: -x * sign * 0.05, y: 0, z: -z * sign * 0.05 });
        expect(reverse.horizontalFreedom).toBeGreaterThan(0.9); // The collider permits retreat immediately, before board braking.
        player.yaw += Math.PI;
        for (let tick = 0; tick < 240; tick++) { player.input(1 / 60); ph.step(); player.step(1 / 60); }
        const retreated = Math.max(Math.abs(feet.x), Math.abs(feet.z)) - 250;
        expect(Math.abs(retreated - distance), JSON.stringify({ mode, radius, speed, x, z, feet, velocity: player.velocity, yaw: player.yaw })).toBeGreaterThan(speed / 4);
      }
    } finally { motor.dispose(); scope.dispose(); expect(ph.world.colliders.len()).toBe(1); ph.dispose(); }
  }
});

it('reconnects exact saved handles without allocation and cleans the replacement world, rejecting corrupt adapters', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer), original = new Physics(rapier);
  const first = new Scope('first'), walls = new TransferWalls(() => original, [{ x: 0, z: 0 }], 0.35, 'exit', first);
  const handles = walls.snapshot(), wire = original.snapshot(), replacement = new Physics(rapier, wire), scope = new Scope('restored');
  const restored = new TransferWalls(() => replacement, [{ x: 0, z: 0 }], 0.35, 'exit', scope, true);
  try {
    expect(replacement.world.colliders.len()).toBe(handles.length);
    for (const invalid of [[], [0, 0, 0, 0], [1, 2, 3, Number.NaN], ['1', 2, 3, 4]]) expect(() => restored.restore(invalid)).toThrow();
    restored.restore(handles); restored.sync(); expect(restored.snapshot()).toEqual(handles); expect(replacement.world.colliders.len()).toBe(handles.length);
    scope.dispose(); expect(replacement.world.colliders.len()).toBe(0);
  } finally { scope.dispose(); replacement.dispose(); first.dispose(); original.dispose(); }
});
