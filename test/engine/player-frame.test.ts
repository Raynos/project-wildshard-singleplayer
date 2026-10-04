// oxlint-disable-next-line import/no-nodejs-modules -- Native Rapier bytes avoid outside-root Vite asset loads in clean exports.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Player } from '../../src/engine/player/Player';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';
import { prepareFrameMotors } from '../../src/engine/physics/frame';
import { groups } from '../../src/engine/physics/groups';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { legacyDouble } from '../fake/FakeGame';

it('keeps the same live player and travel state while committing a controller in another real world', async () => {
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const home = new Physics(rapier), next = new Physics(rapier), restore = overrideTerrain({ heightAt: () => 0 });
  for (const physics of [home, next]) physics.world.createCollider(rapier.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  const player = new Player(new PerspectiveCamera(), home, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  try {
    player.spawn(255, 0, 0, 0.02); player.velocity.set(3, 0, 1); player.dash(18, 0, 0.3);
    const velocity = player.velocity.clone(), before = player.motor;
    const rider = { position: player.position, motor: player.motor };
    const cancelled = prepareFrameMotors([rider], next, { x: -555, z: 0 }); cancelled.cancel();
    expect(player.motor).toBe(before); expect(player.position.x).toBe(255);
    expect(() => player.bindFrame(next, before)).toThrow('another frame');
    const prepared = prepareFrameMotors([rider], next, { x: -555, z: 0 }); prepared.commit();
    player.bindFrame(next, rider.motor);
    expect(player.motor).toBe(rider.motor); expect(player.position.x).toBe(-300);
    expect(player.velocity).toEqual(velocity); expect(player.dashing).toBe(true);
    expect(home.world.colliders.len()).toBe(1); expect(next.world.colliders.len()).toBe(2);
    // Walking probes and the existing player step now read the destination, without stepping the old world.
    for (let tick = 0; tick < 20; tick++) { next.step(); player.step(1 / 60); }
    expect(player.position.y).toBeGreaterThan(-0.1); expect(player.dashing).toBe(false);
    expect(home.world.colliders.len()).toBe(1);
  } finally { player.motor.dispose(); home.dispose(); next.dispose(); restore(); }
});
