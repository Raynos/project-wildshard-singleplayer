import { expect, it, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { PerspectiveCamera } from 'three';
import { Events, Scope } from '@wildshard/engine';
import { Player } from '../../src/engine/player/Player';
import { InputService } from '../../src/engine/input/InputService';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import { legacyDouble } from '../fake/FakeGame';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: () => 0 });
afterAll(restoreTerrain);

async function fixture(crouchEnabled = true) {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  physics.world.createCollider(R.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  physics.step();
  let now = 0, jumps = 0; const launches: number[] = [];
  const input = new InputService(() => now), player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  const events = new Events(), scope = new Scope('test-crouch');
  player.traversalEvents = events;
  if (crouchEnabled) events.answer('player.crouch', () => ({ allowed: true, latched: false }), scope);
  player.inputService = input; player.onGround = true; player.onJump = () => { jumps++; launches.push(player.velocity.y); };
  const step = (ms: number) => { now += ms; player.input(ms / 1000); physics.step(); player.step(ms / 1000); };
  return { player, input, step, scope, jumps: () => jumps, launches, dispose: () => { scope.dispose(); player.motor.dispose(); physics.dispose(); } };
}
it('stops a live dash when respawning before the next physics step', async () => {
  const f = await fixture();
  try {
    expect(f.player.dash(18, 0, 0.3)).toBe(true);
    f.step(16);
    expect(f.player.dashing).toBe(true);
    f.player.spawn(8, 9, 0, 0);
    expect(f.player.dashing).toBe(false);
    f.step(16);
    expect(f.player.position.x).toBeCloseTo(8, 5);
    expect(f.player.position.z).toBeCloseTo(9, 5);
    expect(f.player.velocity.x).toBe(0);
    expect(f.player.velocity.z).toBe(0);
  } finally { f.dispose(); }
});
