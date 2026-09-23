// PHYSICS.md P2: the player's body. The bridge's cuboids sit exactly where the old `collide()` boxes were, and the
// character motor keeps the plan's rules: steps ≤ 0.35 m climbed, 0.4 m not; 30° walked up, 50° not; walls stop it.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { ColliderBridge } from '../src/physics/bridge';
import { CharacterMotor } from '../src/physics/CharacterMotor';
import { groups } from '../src/physics/groups';
import type { Collider } from '../src/player/Player';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** The old Player.collide() test: is (x, z) inside the box grown by `pad`? */
function oldInside(c: Collider, x: number, z: number, pad = 0): boolean {
  const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
  const lx = (x - c.x) * cos - (z - c.z) * sin, lz = (x - c.x) * sin + (z - c.z) * cos;
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
}

const MOTOR = { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] } as const;

/** Walk the motor toward +x for `seconds` at 4.3 m/s with gravity, like Player.step's walk branch. */
function walk(ph: Physics, motor: CharacterMotor, feet: { x: number; y: number; z: number }, seconds: number): void {
  let vy = 0;
  for (let i = 0; i < seconds * 60; i++) {
    vy -= 22 / 60;
    const r = motor.move(feet, { x: 4.3 / 60, y: vy / 60, z: 0 });
    if (r.grounded && vy < 0) vy = 0;
    ph.step();
  }
}

function floor(ph: Physics): void {
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
}

describe('physics bridge', () => {
  it('mirrors each Y-rotated box where the old collide() had it (points inside agree, rotation sign included)', async () => {
    const R = await rapier();
    const ph = new Physics(R);
    const boxes: Collider[] = [
      { x: 3, z: -2, hw: 2, hd: 0.3, rot: 0.6, yTop: 3, yBottom: 0 },
      { x: -5, z: 4, hw: 0.5, hd: 1.5, rot: -1.2, yTop: 2, yBottom: -1 },
    ];
    const bridge = new ColliderBridge(ph, boxes);
    bridge.sync();
    ph.step();
    let checked = 0;
    for (const b of boxes) {
      for (let i = 0; i < 400; i++) {
        const x = b.x + (Math.sin(i * 12.9898) * 3), z = b.z + (Math.cos(i * 78.233) * 3);
        const inOld = oldInside(b, x, z), nearEdge = oldInside(b, x, z, 0.02) !== oldInside(b, x, z, -0.02);
        if (nearEdge) continue;
        let inNew = false;
        ph.world.intersectionsWithPoint({ x, y: (b.yTop + b.yBottom) / 2, z }, () => { inNew = true; return false; });
        expect(inNew).toBe(inOld);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(600);
    // a moved box follows, a removed one goes
    const first = boxes[0];
    if (first) first.x += 10;
    boxes.pop();
    bridge.sync(); ph.step();
    expect(bridge.count).toBe(1);
    let hit = false;
    ph.world.intersectionsWithPoint({ x: 13, y: 1.5, z: -2 }, () => { hit = true; return false; });
    expect(hit).toBe(true);
    ph.dispose();
  });
});

describe('character motor', () => {
  it('climbs a 0.3 m step, not a 0.45 m one', async () => {
    for (const [rise, climbs] of [[0.3, true], [0.45, false]] as const) {
      const R = await rapier();
      const ph = new Physics(R);
      floor(ph);
      ph.world.createCollider(R.ColliderDesc.cuboid(5, rise / 2, 5).setTranslation(7, rise / 2, 0).setCollisionGroups(groups('WORLD')));
      const motor = new CharacterMotor(ph, MOTOR);
      ph.step();
      const feet = { x: 0, y: 0.02, z: 0 };
      walk(ph, motor, feet, 2);
      if (climbs) { expect(feet.x).toBeGreaterThan(3); expect(feet.y).toBeCloseTo(rise, 1); }
      else { expect(feet.x).toBeLessThan(2.2); expect(feet.y).toBeLessThan(0.1); }
      ph.dispose();
    }
  });

  it('walks up a 30° ramp, not a 50° one', async () => {
    for (const [deg, climbs] of [[30, true], [50, false]] as const) {
      const R = await rapier();
      const ph = new Physics(R);
      floor(ph);
      const a = deg * Math.PI / 180, half = 6;
      // a slab tilted about z, its lower edge at x ≈ 2
      ph.world.createCollider(R.ColliderDesc.cuboid(half, 0.2, 4).setTranslation(2 + half * Math.cos(a), half * Math.sin(a) - 0.2, 0)
        .setRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }).setCollisionGroups(groups('WORLD')));
      const motor = new CharacterMotor(ph, MOTOR);
      ph.step();
      const feet = { x: 0, y: 0.02, z: 0 };
      walk(ph, motor, feet, 3);
      if (climbs) expect(feet.y).toBeGreaterThan(1.5);
      else expect(feet.y).toBeLessThan(0.6);
      ph.dispose();
    }
  });

  it('rides a moving kinematic platform (the boat on the swell): carried along, never dipping into it', async () => {
    const R = await rapier();
    const ph = new Physics(R);
    const body = ph.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0));
    ph.world.createCollider(R.ColliderDesc.cuboid(3, 0.2, 3).setTranslation(0, -0.2, 0).setCollisionGroups(groups('WORLD')), body);
    const motor = new CharacterMotor(ph, MOTOR);
    ph.step();
    const feet = { x: 0, y: 0.02, z: 0 };
    let vy = 0, worstDip = 0, grounded = 0;
    for (let i = 1; i <= 240; i++) {
      const t = i / 60;
      body.setNextKinematicTranslation({ x: 0.5 * t, y: 0.4 * Math.sin(t * 2), z: 0 }); // drift + heave
      ph.step();
      vy -= 22 / 60;
      const want = { x: 0, y: vy / 60, z: 0 };
      if (motor.carry(feet) && vy <= 0) want.y = 0; // as Player.step: ride the deck's new pose, no downward push
      const r = motor.move(feet, want);
      if (r.grounded) { grounded++; if (vy < 0) vy = 0; }
      worstDip = Math.max(worstDip, body.translation().y - feet.y);
    }
    expect(feet.x).toBeCloseTo(0.5 * 4, 0); // carried the 2 m the deck drifted
    expect(worstDip).toBeLessThan(0.05);     // Rapier #488: the feet never sink into a rising deck
    expect(grounded).toBeGreaterThan(200);
    ph.dispose();
  });

  it('a wall stops the move and says so', async () => {
    const R = await rapier();
    const ph = new Physics(R);
    floor(ph);
    ph.world.createCollider(R.ColliderDesc.cuboid(0.2, 2, 5).setTranslation(3, 2, 0).setCollisionGroups(groups('WORLD')));
    const motor = new CharacterMotor(ph, MOTOR);
    ph.step();
    const feet = { x: 0, y: 0.02, z: 0 };
    walk(ph, motor, feet, 2);
    expect(feet.x).toBeLessThan(3 - 0.2 - 0.38 + 0.05);
    expect(feet.x).toBeGreaterThan(2);
    expect(motor.move(feet, { x: 0.1, y: 0, z: 0 }).horizontalFreedom).toBeLessThan(0.2);
    ph.dispose();
  });
});
