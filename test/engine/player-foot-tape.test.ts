import { afterAll, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { PlayerHealth } from '../../src/engine/combat/health';
import { Player } from '../../src/engine/player/Player';
import type { PlayerCommand } from '../../src/engine/input/commands';
import { legacyDouble } from '../fake/FakeGame';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { installPortableMath } from '../fake/portableMath';

// Platform-stable (ci-green): the tape runs on test/fake/portableMath, as the board tape does.
const restoreMath = installPortableMath();
afterAll(() => { restoreMath(); });
// Flat dry terrain at 0 through the terrain port (E422); the walk stands on a Rapier ground slab.
const restoreTerrain = overrideTerrain({ heightAt: () => 0 });
afterAll(restoreTerrain);

/**
 * Recorded on Player.ts before the jump and dash laws moved to player/jump.ts and player/dash.ts (SF72, on f55c719c1),
 * under the portable Math: [jumps, landings, hard landings, dodges, lunges].
 */
const TAPE = { events: [7, 4, 3, 3, 1], print: '9cc5f8dd:9000' };

/** FNV-1a over every recorded float's bytes: one number for the whole tape. */
function fingerprint(values: readonly number[]): string {
  const bytes = new Uint8Array(new Float64Array(values).buffer);
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16)}:${values.length}`;
}

/**
 * The client Player on foot on recorded input (SF72 oracle): a 900-step tape over flat ground with a raised deck (a
 * Rapier box to walk off: the coyote jump), a wall a dodge runs into, ground jumps, double jumps, a refused third jump,
 * dodges toward the stick, a backstep, a dodge refused on its cooldown, and two sword lunges (dashTo), one refused as
 * already close. Every step's pose, velocity and dash clocks go into one fingerprint.
 */
async function tape(): Promise<{ values: number[]; jumps: number; lands: number; hard: number; dodges: number; lunges: number }> {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  physics.world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD'))); // the ground
  physics.world.createCollider(R.ColliderDesc.cuboid(4, 0.75, 4).setTranslation(0, 0.75, -12).setCollisionGroups(groups('WORLD'))); // a 1.5 m deck
  physics.world.createCollider(R.ColliderDesc.cuboid(6, 3, 0.2).setTranslation(0, 3, 9).setCollisionGroups(groups('WORLD'))); // a wall
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  const scope = new Scope('player-foot-tape'), previous = app.levelScope;
  app.levelScope = scope;
  const health = new PlayerHealth(app.events, { now: () => 0, position: () => player.position, dodging: () => player.dodging, dodgeGuard: () => false,
    mode: () => 'foot', impulse: (velocity) => player.impulse(velocity) });
  app.registerPlayer(health, scope);
  let jumps = 0, lands = 0, hard = 0, dodges = 0, lunges = 0;
  player.onJump = () => { jumps++; };
  player.onLand = (isHard) => { lands++; if (isHard) hard++; };
  player.onDodge = () => { dodges++; };
  player.onLunge = () => { lunges++; };
  const values: number[] = [];
  try {
    player.spawn(0, -12, 0, 1.5);
    for (let i = 0; i < 900; i++) {
      // north-facing yaw 0 = -z ahead. Walk south off the deck (coyote jump at 52), jumps and doubles on open ground,
      // dodges (right, backstep, refused on cooldown, south into the wall), lunges at 600 and 640
      const moveY = i < 40 ? 0 : i < 300 ? -1 : i < 420 ? 0 : i < 520 ? -1 : 0;
      const moveX = i >= 300 && i < 420 ? 0.8 : 0;
      const jump = i === 52 || i === 106 || i === 120 || i === 140 || i === 152 || i === 200 || i === 230 || i === 232 || i === 700 || i === 712;
      const dodge = i === 320 || i === 380 || i === 390 || i === 460;
      if (i === 600) player.dashTo(player.position.x + 5, player.position.z - 3, 1.5, 0.12);
      if (i === 640) player.dashTo(player.position.x + 0.5, player.position.z, 1, 0.1);
      const command: PlayerCommand = { moveX, moveY, yaw: 0, pitch: 0, crouch: false, sprint: i >= 200 && i < 260, jump, dodge, dive: false, surface: false,
        aim: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
      physics.step();
      player.step(1 / 60, command);
      values.push(player.position.x, player.position.y, player.position.z, player.velocity.x, player.velocity.y, player.velocity.z,
        player.onGround ? 1 : 0, player.dashing ? 1 : 0, player.dodging ? 1 : 0, player.dodgeCooldown);
    }
  } finally { scope.dispose(); app.levelScope = previous; player.motor.dispose(); physics.dispose(); }
  return { values, jumps, lands, hard, dodges, lunges };
}

it('walks, jumps and dodges as the client Player did before the laws moved (bit-identical tape)', async () => {
  const run = await tape();
  expect([run.jumps, run.lands, run.hard, run.dodges, run.lunges]).toEqual(TAPE.events);
  expect(fingerprint(run.values)).toBe(TAPE.print);
});
