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
it('keeps a blocked jump until it can execute inside120ms and consumes it exactly once', async () => {
  const f = await fixture();
  try {
    f.input.setHeld('crouch', true); f.input.press('jump'); f.step(50);
    expect(f.jumps()).toBe(0); expect(f.input.pressed('jump')).toBe(true);
    f.input.setHeld('crouch', false); f.step(50);
    expect(f.jumps()).toBe(1); expect(f.input.pressed('jump')).toBe(false);
    f.step(16); expect(f.jumps()).toBe(1);
  } finally { f.dispose(); }
});
it('expires a blocked jump after120ms', async () => {
  const f = await fixture();
  try {
    f.input.setHeld('crouch', true); f.input.press('jump'); f.step(50); f.step(50);
    f.input.setHeld('crouch', false); f.step(21);
    expect(f.jumps()).toBe(0); expect(f.input.pressed('jump')).toBe(false);
  } finally { f.dispose(); }
});

it('uses the ground launch inside100ms and the existing double jump outside it', async () => {
  for (const [delay, launch] of [[80, 7.2], [101, 8.6]] as const) {
    const f = await fixture();
    try {
      f.step(16); f.player.position.y = 5; f.player.onGround = false;
      f.input.press('jump'); f.step(delay);
      expect(f.launches).toEqual([launch]);
    } finally { f.dispose(); }
  }
});
it('buffers a landing press after both airborne jumps were spent', async () => {
  const f = await fixture();
  try {
    f.input.press('jump'); f.step(16); f.input.press('jump'); f.step(16);
    expect(f.jumps()).toBe(2);
    f.player.position.y = 0.03; f.player.velocity.y = -2;
    f.input.press('jump'); f.step(16);
    expect(f.jumps()).toBe(2); expect(f.player.onGround).toBe(true);
    f.step(16); expect(f.jumps()).toBe(3); expect(f.input.pressed('jump')).toBe(false);
  } finally { f.dispose(); }
});

it('ignores raw and injected crouch without a scoped shard answer, including after unload', async () => {
  const f = await fixture(false);
  try {
    f.player.keys.add('KeyC'); f.player.keys.add('ControlLeft');
    f.input.setHeld('crouch', true); f.input.setHeld('crouch.hold', true);
    f.step(16); expect(f.player.crouching).toBe(false);
    f.player.traversalEvents = null;
    f.step(16); expect(f.player.crouching).toBe(false);
  } finally { f.dispose(); }
  const scoped = await fixture();
  try {
    scoped.input.setHeld('crouch', true); scoped.step(16); expect(scoped.player.crouching).toBe(true);
    scoped.scope.dispose(); scoped.step(16); expect(scoped.player.crouching).toBe(false);
    scoped.input.press('jump'); scoped.step(16); expect(scoped.jumps()).toBe(1);
  } finally { scoped.dispose(); }
});
