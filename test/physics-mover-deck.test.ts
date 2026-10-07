// SF49 / SF51: the player stalled on a RESTING KinematicMover deck (Sky Reach's rising islet, Nine Dragon's lantern
// lift): a step or two onto it, the controller reported the move fully blocked by the deck's own top (time of impact 0,
// normal straight up) on every pass. The feet rest a hair inside the controller's skin; on static ground Rapier's
// normal nudge lifts the capsule clear, but its kinematic-platform friction resets the move's normal part to the
// platform's motion on every pass and erases the nudge. CharacterMotor retries such a stall lifted by the skin.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { KinematicMover, type MoverBox, type MoverPose } from '../src/engine/physics/mover';
import { groups } from '../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());
const MOTOR = { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] } as const;
const ROT = { x: 0, y: 0, z: 0, w: 1 };
const WALK = 5 / 60, GRAVITY_STEP = 9.81 / 60 / 60;

/** static lip x ∈ [-10, 0] and x ∈ [20, 30], top y = 0; a kinematic deck in between, its top at `deckY` */
async function rig(deckY: number, boxes: readonly MoverBox[]) {
  const R = await rapier(), ph = new Physics(R);
  for (const x of [-5, 25]) ph.world.createCollider(R.ColliderDesc.cuboid(5, 0.25, 5).setTranslation(x, -0.25, 0).setCollisionGroups(groups('WORLD')));
  const pose: MoverPose = { position: { x: 10, y: deckY, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true };
  const deck = new KinematicMover(ph, boxes, pose, 'deck');
  const motor = new CharacterMotor(ph, MOTOR);
  const feet = { x: -3, y: 0.02, z: 0.3 };
  let onGround = false, vy = 0, stalls = 0, steps = 0;
  /** one fixed step the way Player.step runs it: deck pose, world step, ride the deck, then the character's own move */
  const step = (dx: number, dz: number): void => {
    deck.setPose(pose); ph.step();
    vy = onGround ? 0 : vy - GRAVITY_STEP;
    const riding = onGround && motor.carry(feet);
    const r = motor.move(feet, { x: dx, y: riding ? 0 : vy - GRAVITY_STEP, z: dz });
    onGround = r.grounded; steps++;
    if (Math.hypot(dx, dz) > 0 && r.horizontalFreedom < 0.3) stalls++;
  };
  return { ph, pose, deck, motor, feet, step, stats: () => ({ stalls, steps }), onDeck: () => motor.result.groundCollider?.parent() === deck.body };
}
const slab = (hx: number): MoverBox[] => [{ x: 0, y: -0.25, z: 0, hx, hy: 0.25, hz: 5, rot: ROT }];
/** the islet's shape: several boxes side by side, their tops flush */
const tiles: MoverBox[] = [-7.5, -2.5, 2.5, 7.5].map((x) => ({ x, y: -0.25, z: 0, hx: 2.5, hy: 0.25, hz: 5, rot: ROT }));

describe('a resting kinematic deck walks like the ground', () => {
  for (const [label, deckY, boxes] of [['flush slab', 0, slab(10)], ['flush tiles', 0, tiles], ['5 mm proud', 0.005, slab(10)], ['5 mm under', -0.005, slab(10)], ['1 cm proud', 0.01, slab(10)]] as const) {
    it(`walks on, across and off it, both ways (${label})`, async () => {
      const r = await rig(deckY, boxes);
      for (let i = 0; i < 30; i++) r.step(0, 0);
      let sawDeck = false;
      while (r.feet.x < 24 && r.stats().steps < 2000) { r.step(WALK, 0); if (r.feet.x > 1 && r.feet.x < 19) { sawDeck ||= r.onDeck(); expect(Math.abs(r.feet.y - deckY), `feet off the deck at x=${r.feet.x.toFixed(2)}`).toBeLessThan(0.05); } }
      while (r.feet.x > -4 && r.stats().steps < 4000) r.step(-WALK, 0);
      // and diagonally, so the seam is crossed at an angle
      for (let i = 0; i < 240; i++) r.step(WALK * 0.8, WALK * 0.6 * (i < 120 ? 1 : -1));
      const { stalls, steps } = r.stats();
      expect(sawDeck).toBe(true);
      expect(stalls, `${stalls} of ${steps} steps stalled`).toBe(0);
      expect(r.feet.x).toBeGreaterThan(8);
      r.ph.dispose();
    });
  }
  it('stands still on it without drifting', async () => {
    const r = await rig(0, slab(10));
    r.feet.x = 10; r.feet.z = 0;
    for (let i = 0; i < 300; i++) r.step(0, 0);
    expect(Math.abs(r.feet.x - 10)).toBeLessThan(1e-3); expect(Math.abs(r.feet.y)).toBeLessThan(0.05); expect(r.onDeck()).toBe(true);
    r.ph.dispose();
  });
});

describe('riding a moving kinematic deck', () => {
  it('carries the feet up with a rising deck and walks across it while it rises', async () => {
    const r = await rig(0, slab(10));
    r.feet.x = 5; r.feet.z = 0;
    for (let i = 0; i < 30; i++) r.step(0, 0);
    for (let i = 0; i < 180; i++) { r.pose.position.y += 1 / 60; r.step(i < 60 ? 0 : WALK * 0.5, 0); }
    expect(r.pose.position.y).toBeCloseTo(3, 6);
    expect(Math.abs(r.feet.y - 3), 'feet ride the deck top').toBeLessThan(0.05);
    expect(r.feet.x).toBeGreaterThan(9.5);
    expect(r.stats().stalls).toBe(0);
    r.ph.dispose();
  });
  it('carries the feet sideways with a sliding deck and walks against its motion', async () => {
    const r = await rig(0, slab(6));
    r.feet.x = 10; r.feet.z = 0;
    for (let i = 0; i < 30; i++) r.step(0, 0);
    for (let i = 0; i < 120; i++) { r.pose.position.z += 1.5 / 60; r.step(0, 0); }
    expect(r.feet.z).toBeCloseTo(3, 1);
    for (let i = 0; i < 48; i++) { r.pose.position.z += 1.5 / 60; r.step(0, -WALK); }
    expect(r.feet.z, 'walked 4 m against a 1.2 m deck drift').toBeCloseTo(3 + 1.2 - 4, 1);
    expect(Math.abs(r.feet.y)).toBeLessThan(0.05);
    expect(r.stats().stalls).toBe(0);
    r.ph.dispose();
  });
});
