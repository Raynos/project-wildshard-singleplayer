import { afterAll, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
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

// Platform-stable (ci-green): V8's native sin / cos / atan2… round differently on arm64 and x64 (CI), so the file runs on
// test/fake/portableMath; the prints were re-recorded that way on 3d68396a2 and match on arm64 and x64.
const restoreMath = installPortableMath();
afterAll(() => { restoreMath(); });
// A gently rolling dry terrain through the terrain port (E422), so the ride-height spring has work on every step.
const restoreTerrain = overrideTerrain({ heightAt: (x, z) => 0.4 * Math.sin(x * 0.11) + 0.25 * Math.cos(z * 0.07) });
afterAll(restoreTerrain);

/** Recorded on Player.ts before the extraction (3d68396a2), under the portable Math. */
const TAPE = {
  standalone: { events: [4, 6, 1], print: '60284a38:16800' },
  capped: { events: [4, 6, 2], print: 'f13ac6cb:16800' },
};

/** FNV-1a over every recorded float's bytes: one number for the whole tape. */
function fingerprint(values: readonly number[]): string {
  const bytes = new Uint8Array(new Float64Array(values).buffer);
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16)}:${values.length}`;
}

/**
 * The client Player's board on recorded input (SF72 oracle): a 1200-step tape over rolling terrain, a raised deck (a
 * Rapier box the spring rides onto and off), a wall the board stops at, a floor-function platform, jumps, an upward
 * impulse (the updraft's kind: airborne) and a hard landing off the deck. Every step's pose, velocity and board
 * telemetry go into one fingerprint, recorded on the Player before the board law moved to player/board.ts.
 */
async function tape(capped: boolean): Promise<{ values: number[]; jumps: number; lands: number; hard: number }> {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  physics.world.createCollider(R.ColliderDesc.cuboid(6, 1.25, 6).setTranslation(30, 1.25, 0).setCollisionGroups(groups('WORLD'))); // a 2.5 m deck
  physics.world.createCollider(R.ColliderDesc.cuboid(0.2, 4, 12).setTranslation(-14, 4, 0).setCollisionGroups(groups('WORLD'))); // a wall
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.platforms.push((x, z) => x > 8 && x < 12 && Math.abs(z) < 3 ? 1.1 : undefined); // a floor-function porch
  if (capped) player.hoverSpeedLimit = () => 22;
  const scope = new Scope('player-board-tape'), previous = app.levelScope;
  app.levelScope = scope;
  const health = new PlayerHealth(app.events, { now: () => 0, position: () => player.position, dodging: () => false, dodgeGuard: () => false,
    mode: () => 'board', impulse: (velocity) => player.impulse(velocity) });
  app.registerPlayer(health, scope);
  let jumps = 0, lands = 0, hard = 0;
  player.onJump = () => { jumps++; };
  player.onLand = (isHard) => { lands++; if (isHard) hard++; };
  const values: number[] = [];
  try {
    player.spawn(0, 0, -Math.PI / 2, 0.5); player.setHover(true);
    for (let i = 0; i < 1200; i++) {
      // the stick: east toward the deck, carve, release (glide), west into the wall, back east; jumps and a lift
      const phase = Math.floor(i / 100);
      const moveY = [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1][phase] ?? 0;
      const moveX = phase === 2 ? Math.sin(i * 0.05) : phase === 8 ? -0.7 : 0;
      const yaw = phase < 4 ? -Math.PI / 2 : phase < 7 ? Math.PI / 2 : -Math.PI / 2 + Math.sin(i * 0.01) * 0.4;
      const jump = i === 150 || i === 260 || i === 340 || i === 905 || i === 1010;
      if (i === 520 || i === 760) player.impulse(new Vector3(0.5, 9, -0.3));
      const command: PlayerCommand = { moveX, moveY, yaw, pitch: 0, crouch: false, sprint: false, jump, dodge: false, dive: false, surface: false,
        aim: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
      physics.step();
      player.step(1 / 60, command);
      values.push(player.position.x, player.position.y, player.position.z, player.velocity.x, player.velocity.y, player.velocity.z,
        player.hoverAir ? 1 : 0, player.hoverBob, player.onGround ? 1 : 0, player.hoverLat, player.hoverFwd, player.hoverAccel,
        player.hoverLanded, player.hoverJumpKick);
    }
  } finally { scope.dispose(); app.levelScope = previous; player.motor.dispose(); physics.dispose(); }
  return { values, jumps, lands, hard };
}

it('rides the client Player\'s board bit-identically on the recorded tape (standalone 14 m/s)', async () => {
  const run = await tape(false);
  expect([run.jumps, run.lands, run.hard]).toEqual(TAPE.standalone.events);
  expect(fingerprint(run.values)).toBe(TAPE.standalone.print);
});
it('rides the client Player\'s board bit-identically on the recorded tape (grid cap 22 m/s)', async () => {
  const run = await tape(true);
  expect([run.jumps, run.lands, run.hard]).toEqual(TAPE.capped.events);
  expect(fingerprint(run.values)).toBe(TAPE.capped.print);
});
