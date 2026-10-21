// oxlint-disable-next-line import/no-nodejs-modules -- Read exact retained source and installed physics fixtures for isolated native tests.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../../../src/engine/app/scope';
import { GameClock } from '../../../../src/engine/core/clock';
import { createSimHost } from '../../../../src/engine/sim';
import { loadRapier } from '../../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../../src/engine/physics/CharacterMotor';
import { SIM_LEVEL } from '../../../../test/fixtures/sim-level/level';
import { createMedusaNativeSource, loadMedusaNativeSource, medusaWeightedVertices } from './medusaNativeSource';
import { MedusaBorrowedOwner } from './medusaBorrowedOwner';

async function fixture() {
  const scope = new Scope('medusa-borrowed-test');
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { scope,
    rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))) });
  const directory = 'art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/';
  const metadata: unknown = JSON.parse(readFileSync(`${directory}metadata.json`, 'utf8'));
  const parts = await loadMedusaNativeSource(metadata, Uint8Array.from(readFileSync(`${directory}payload.bin`)));
  const native = new MedusaBorrowedOwner(parts, scope, outside,
    { reach: () => false, claim: () => false, hurt: () => { throw new Error('Unexpected contact'); }, shove: () => { throw new Error('Unexpected shove'); } });
  return { scope, outside, parts, native, dispose: () => {
    scope.dispose(); for (const geometry of [...parts.furParts, ...parts.hardParts, ...parts.eyeParts]) geometry.dispose();
  } };
}

test('actual Medusa borrows one world/player/combat and steps only its own clock and pose', async () => {
  const f = await fixture();
  try {
    const { native, outside } = f;
    expect(native.host.physics).toBe(outside.physics); expect(native.host.player).toBe(outside.player);
    expect(native.host.events).toBe(outside.events); expect(native.host.combat).toBe(outside.combat);
    expect(native.actor.flying).toBe(true); expect(native.pose.corpseJoints()).toHaveLength(27);
    const physics = vi.spyOn(outside.physics, 'step'), before = outside.clock.snapshot();
    for (let i = 0; i < 60; i++) native.fixed();
    expect(physics).not.toHaveBeenCalled(); expect(outside.clock.snapshot()).toEqual(before);
    expect(native.host.state.tick).toBe(60); expect(native.host.clock.frame).toBe(60);
    expect(native.pose.context.t).toBeCloseTo(1, 12);
    const snapshot = native.snapshot();
    for (let i = 0; i < 100; i++) { native.pose.headWorld(new Vector3()); native.snapshot(); }
    expect(native.snapshot()).toEqual(snapshot); expect(native.admission).toBe(false);
  } finally { f.dispose(); }
});

test('publishes the real flying capsule without grounded movement, load resets or trajectory changes', async () => {
  const f = await fixture();
  try {
    const motor = f.native.actor.motor;
    if (!(motor instanceof CharacterMotor)) throw new Error('Missing real page capsule');
    const initial = { ...motor.collider.translation() }, move = vi.spyOn(motor, 'move'), reset = vi.spyOn(motor, 'resetAt');
    const position = f.native.actor.position.clone();
    for (let i = 0; i < 60; i++) f.native.fixed();
    expect(f.native.actor.position.distanceTo(position)).toBeGreaterThan(.1);
    expect(motor.collider.translation()).not.toEqual(initial);
    expect(motor.collider.translation().x).toBeCloseTo(f.native.actor.position.x, 6);
    expect(motor.collider.translation().z).toBeCloseTo(f.native.actor.position.z, 6);
    expect(motor.collider.translation().y).toBeCloseTo(f.native.actor.position.y + (motor.opts.length === undefined ? motor.opts.height / 2 : motor.opts.radius), 6);
    expect(move).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled();
    expect(f.native.admission).toBe(false);
  } finally { f.dispose(); }
});

test('real borrowed lethal contact still exposes unsafe floor penetration and does not claim admission', async () => {
  const f = await fixture();
  try {
    const native = f.native;
    native.fixed();
    const result = f.outside.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: native.actor.combatActor(),
      amount: 10000, point: native.actor.position.clone(), dir: new Vector3(1, 0, 0) });
    expect(result?.dealt).toBeGreaterThan(0); expect(native.actor.alive).toBe(false);
    for (let i = 0; i < 180; i++) native.fixed();
    const lowest = Math.min(...medusaWeightedVertices(f.parts, native.pose).flat().map(p => native.actor.position.y + p.y * native.actor.scale));
    expect(lowest).toBeLessThan(-1); expect(native.admission).toBe(false);
    expect(native.actor.motor).toBeNull();
  } finally { f.dispose(); }
});

test('candidate disposal preserves the borrowed world and player and releases its page capsule', async () => {
  const f = await fixture();
  try {
    const before = f.outside.physics.world.colliders.len();
    const playerMotor = f.outside.player.motor;
    f.native.dispose(); f.native.dispose();
    expect(f.outside.physics.world.colliders.len()).toBe(before - 1);
    expect(f.outside.player.motor).toBe(playerMotor); expect(f.scope.disposed).toBe(false);
    const frame = f.native.host.clock.frame; f.native.fixed(); expect(f.native.host.clock.frame).toBe(frame);
    expect(() => f.native.snapshot()).toThrow('disposed');
    expect(() => f.outside.step()).not.toThrow();
  } finally { f.dispose(); }
});

test('direct Rapier collider queries follow the published Medusa capsule rather than its spawn', async () => {
  const f = await fixture();
  try {
    const motor = f.native.actor.motor;
    if (!(motor instanceof CharacterMotor)) throw new Error('Missing real capsule');
    const old = { ...motor.collider.translation() };
    for (let i = 0; i < 180; i++) f.native.fixed();
    const center = motor.collider.translation(), R = f.outside.physics.R;
    const ball = new R.Ball(.01), rotation = { x: 0, y: 0, z: 0, w: 1 };
    expect(motor.collider.intersectsShape(ball, center, rotation)).toBe(true);
    expect(motor.collider.intersectsShape(ball, old, rotation)).toBe(false);
    const ray = new R.Ray({ x: center.x - 2, y: center.y, z: center.z }, { x: 1, y: 0, z: 0 });
    expect(motor.collider.castRay(ray, 4, true)).toBeCloseTo(2 - motor.opts.radius, 5);
    const wall = f.outside.physics.world.createCollider(R.ColliderDesc.cuboid(.1, 2, 2).setTranslation(center.x, center.y, center.z));
    const contact = motor.collider.contactCollider(wall, 0);
    expect(contact).not.toBeNull(); expect(contact?.distance).toBeLessThan(0);
    // The pre-existing flight law has no wall sweep. Synchronization does NOT repair this:
    // a wall at the authoritative pose is a real overlap, not clearance or admission evidence.
    expect(f.native.admission).toBe(false);
    f.outside.physics.world.removeCollider(wall, false);
  } finally { f.dispose(); }
});

test('flight publication rejects nonfinite and disabled inputs without changing the collider', async () => {
  const f = await fixture();
  try {
    const motor = f.native.actor.motor;
    if (!(motor instanceof CharacterMotor)) throw new Error('Missing real capsule');
    const before = motor.collider.translation();
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      expect(() => motor.syncFlightPose({ x: value, y: 1, z: 0 })).toThrow('flight pose');
      expect(() => motor.syncFlightPose({ x: 0, y: value, z: 0 })).toThrow('flight pose');
      expect(() => motor.syncFlightPose({ x: 0, y: 1, z: value })).toThrow('flight pose');
      expect(motor.collider.translation()).toEqual(before);
    }
    motor.setEnabled(false);
    expect(() => motor.syncFlightPose({ x: 1, y: 2, z: 3 })).toThrow('flight pose');
    expect(motor.collider.translation()).toEqual(before);
    motor.setEnabled(true);
  } finally { f.dispose(); }
});


test('borrowed installer preserves every original live flight/brain/pose endpoint while publishing its capsule', async () => {
  const f = await fixture();
  try {
    const baseline = createMedusaNativeSource(f.parts, { heightAt: () => 0, random: () => .5 });
    const clock = new GameClock();
    const ports = { dt: 1 / 60, player: f.outside.player.position, calm: false,
      reach: () => false, claim: () => false, hurt: () => { throw new Error('Unexpected hit'); },
      shove: () => { throw new Error('Unexpected shove'); },
      flight: { steer: (actor: typeof baseline.actor, yaw: number, speed: number, altitude: number, turn: number) => { actor.fly(yaw, speed, altitude, turn); } } };
    for (let i = 1; i <= 180; i++) {
      baseline.brain.think(ports); baseline.brain.act(ports);
      clock.tick(1 / 60); baseline.actor.step(1 / 60); baseline.pose.advance(1 / 60, clock.now, true); baseline.pose.publish();
      f.native.fixed();
      expect(f.native.actor.position).toEqual(baseline.actor.position);
      expect(f.native.brain.snapshot()).toEqual(baseline.brain.snapshot());
      expect(f.native.pose.corpseJoints()).toEqual(baseline.pose.corpseJoints());
    }
  } finally { f.dispose(); }
});


test('world queries see flight publication at the next sole physics step, not immediately after a far relocation', async () => {
  const f = await fixture();
  try {
    const motor = f.native.actor.motor;
    if (!(motor instanceof CharacterMotor)) throw new Error('Missing real capsule');
    const { world, R } = f.outside.physics;
    const ball = new R.Ball(.01), rotation = { x: 0, y: 0, z: 0, w: 1 };
    const onlyMotor = (collider: typeof motor.collider) => collider.handle === motor.collider.handle;
    const overlap = (center: { x: number; y: number; z: number }) => world.intersectionWithShape(
      center, rotation, ball, undefined, undefined, undefined, undefined, onlyMotor);
    const rayHit = (center: { x: number; y: number; z: number }) => world.castRay(
      new R.Ray({ x: center.x - 2, y: center.y, z: center.z }, { x: 1, y: 0, z: 0 }),
      4, true, undefined, undefined, undefined, undefined, onlyMotor);
    // Reproduce the page's fixed.step -> fixed.post ordering. The owner does not step physics.
    for (let i = 0; i < 180; i++) {
      f.outside.physics.step();
      const published = motor.collider.translation();
      expect(overlap(published)?.handle).toBe(motor.collider.handle);
      expect(rayHit(published)?.collider.handle).toBe(motor.collider.handle);
      f.native.fixed();
    }
    f.outside.physics.step();
    const old = motor.collider.translation();
    const feet = f.native.actor.position.clone(); feet.x += 20;
    motor.syncFlightPose(feet);
    const current = motor.collider.translation();
    // Direct shape checks use the current transform; world queries still cull by the old broadphase.
    expect(motor.collider.intersectsShape(ball, current, rotation)).toBe(true);
    expect(overlap(current)).toBeNull(); expect(rayHit(current)).toBeNull();
    f.outside.physics.step();
    expect(overlap(current)?.handle).toBe(motor.collider.handle);
    expect(rayHit(current)?.collider.handle).toBe(motor.collider.handle);
    expect(overlap(old)).toBeNull(); expect(rayHit(old)).toBeNull();
    expect(f.native.admission).toBe(false);
  } finally { f.dispose(); }
});
