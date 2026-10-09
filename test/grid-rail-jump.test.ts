// oxlint-disable-next-line import/no-nodejs-modules -- Real collider proof uses the committed native Rapier binary and reads the player's own jump constants.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { Scope } from '../src/engine/app/scope';
import { generateStrip } from '../src/engine/sim/strips';
import { PLAYER_GRAVITY as GRAVITY } from '../src/engine/player/fall';

// G101: the cheap rail at an edge that can't blend blocks a single jump, and a DOUBLE jump clears it. The arcs use the
// on-foot player's own numbers, read from Player.ts (gravity from its shared fall law) so this proof follows any retune.
const source = readFileSync('src/engine/player/Player.ts', 'utf8');
const constant = (pattern: RegExp): number => { const m = pattern.exec(source); if (m?.[1] === undefined) throw new Error(`Player constant ${String(pattern)} moved`); return Number(m[1]); };
const DOUBLE_JUMP = constant(/const DOUBLE_JUMP = ([\d.]+);/), JUMP = constant(/const jumpV = ([\d.]+) \*/);
const RADIUS = constant(/const RADIUS = ([\d.]+);/), BODY = constant(/const BODY_HEIGHT = ([\d.]+);/), STEP = constant(/const STEP_UP = ([\d.]+);/);

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

const flat = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
for (const axis of ['x', 'z'] as const) it(`the void edge's rail stops a single jump; a double jump at the apex clears it and lands (axis ${axis})`, () => {
  expect(JUMP ** 2 / (2 * GRAVITY)).toBeLessThan(1.85 - STEP); // the single apex (1.18 m) stays under the wall top less one step-up
  const physics = new Physics(rapier), scope = new Scope('rail.jump');
  const strip = generateStrip({ id: 'rail.jump', axis, origin: { x: 0, z: 0 }, profiles: [flat, flat], adjacent: [], observations: [{ entryWidth: 0, geometry: 'void' }, { entryWidth: 0, geometry: 'void' }] });
  const guard = strip.features.filter((f) => f.kind === 'guard-rail').reduce((top, f) => Math.max(top, f.top), 0);
  expect(guard).toBeGreaterThan(JUMP ** 2 / (2 * GRAVITY) + STEP);
  expect(guard).toBeLessThan(JUMP ** 2 / (2 * GRAVITY) + DOUBLE_JUMP ** 2 / (2 * GRAVITY));
  installStripCollider(physics, strip.mesh, scope);
  const motor = new CharacterMotor(physics, { radius: RADIUS, height: BODY, step: STEP, snap: 0.2, maxClimbDeg: 40, group: 'PLAYER', blockedBy: ['WORLD'] });
  try {
    for (const double of [false, true]) {
      const feet = { x: axis === 'x' ? 4.5 : 30, y: 0.005, z: axis === 'z' ? 4.5 : 30 }, run = 6 / 60; // a run at the rail from 3 m
      let vy = JUMP, jumped = false, highest = 0;
      for (let tick = 0; tick < 150; tick++) {
        physics.step();
        if (double && !jumped && vy <= 0) { vy = Math.max(vy, 0) * 0.3 + DOUBLE_JUMP; jumped = true; } // Player.ts: the second jump at the apex
        vy -= GRAVITY / 60;
        const move = motor.move(feet, { x: axis === 'x' ? run : 0, y: vy / 60, z: axis === 'z' ? run : 0 });
        if (move.grounded && vy < 0) vy = 0;
        highest = Math.max(highest, feet.y);
      }
      if (double) { expect(highest).toBeGreaterThan(guard); expect(feet[axis]).toBeGreaterThan(9); }
      else { expect(highest).toBeLessThan(guard); expect(feet[axis]).toBeLessThan(7.5); }
      expect(Math.abs(feet.y)).toBeLessThan(0.06); // on the ground again: the road, or the strip past the rail
    }
  } finally { motor.dispose(); scope.dispose(); expect(physics.world.colliders.len()).toBe(0); physics.dispose(); }
});
