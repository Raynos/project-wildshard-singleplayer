// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the original shipping mounted motion source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The frozen oracle is a source-hashed receipt of the page law.
import { createHash } from 'node:crypto';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { Physics } from '../../../src/engine/physics/Physics';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { groups } from '../../../src/engine/physics/groups';
import { tagCollider } from '../../../src/engine/physics/surface';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { MountedBody, mountedMotorOptions, type MountedWorld, type MountedRider } from '../../../src/shards/nalati-grasslands/runtime/rideBody';
import { HORSE_SPEED } from '../../../src/shards/nalati-grasslands/species/horse';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import type { ReinsFrame } from '../../../src/shards/nalati-grasslands/runtime/rideReins';
import { ShippingBody } from '../../fixtures/nalati-motor-oracle/shipping';
import source from '../../fixtures/nalati-motor-oracle/source.json' with { type: 'json' };

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const dt = 1 / 60;
function horse(id = 'horse:1'): AnimalSim {
  const row = nalatiBake().actors.find(a => a.kind === 'horse');
  if (row === undefined) throw new Error('Missing shipping horse');
  return new AnimalSim(row.spec, 7, 1, id, { heightAt: () => 0, random: () => 0.5 });
}
function rider(): MountedRider { return { position: new Vector3(), velocity: new Vector3(), onGround: true, sprinting: false, crouching: false, speedFactor: 0 }; }
function box(p: Physics, x: number, z: number, y: number, hx: number, hz: number, hy: number, material: 'ground' | 'wood' = 'ground'): void {
  const c = p.world.createCollider(p.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(groups('WORLD')));
  tagCollider(c, material, null);
}
function course(p: Physics, name: string): void {
  if (name === 'ditch') {
    box(p, 0, -25, -0.5, 30, 25, 0.5); box(p, 0, 29, -0.5, 30, 25, 0.5);
    box(p, 0, 2, -2.5, 30, 2, 0.5);
  } else box(p, 0, 0, -0.5, 100, 100, 0.5);
  if (name === 'rail') { box(p, 0, 12, 0.65, 6, 0.12, 0.65, 'wood'); box(p, 0, 40, 2, 6, 0.3, 2, 'wood'); }
  if (name === 'deck') box(p, 0, 0, 1.5, 6, 20, 0.5, 'wood');
}
function install(Law: typeof MountedBody | typeof ShippingBody, name: string) {
  const physics = new Physics(rapier), a = horse(), p = rider(), law = new Law(HORSE_SPEED);
  course(physics, name); physics.step();
  const world: MountedWorld = { physics, heightAt: () => 0, waterLevel: () => name === 'swim' ? 2 : -10,
    wetAt: () => name === 'swim', stampede: () => null, thrown: () => { throw new Error('Unexpected stampede'); } };
  law.feet.set(0, name === 'deck' ? 2 : 0, name === 'ditch' ? -7 : 0); a.position.copy(law.feet);
  a.driven = true; law.motor = new CharacterMotor(physics, mountedMotorOptions(a.scale, a));
  law.settleBody(); law.landBody(world); law.eyeY = law.feet.y;
  const frame: { -readonly [K in keyof ReinsFrame]: ReinsFrame[K] } = { forward: 1, turn: 0, touchX: 0, touchY: 0,
    gallop: false, jump: false, drawing: false, moveScale: 1, phase: 0, feet: law.feet, roads: undefined,
    inBounds: () => true, refuses: () => false, wet: name === 'swim' };
  return { physics, a, p, law, world, frame, dispose: () => { law.motor?.dispose(); physics.dispose(); } };
}
function advance(b: ReturnType<typeof install>, tick: number, name: string): void {
  if (name === 'flat') {
    const phase = Math.floor(tick / 75) % 8;
    b.frame.forward = phase === 0 || phase === 4 ? 1 : phase === 5 ? -1 : 0;
    b.frame.turn = phase === 3 ? 1 : 0;
    b.frame.touchX = phase === 2 ? 0.6 : 0; b.frame.touchY = phase === 1 ? 0.7 : phase === 2 ? 0.9 : 0;
    b.frame.gallop = phase === 4; b.frame.jump = tick % 159 === 0;
  }
  b.frame.phase = (tick % 30) / 30;
  b.law.read(dt, b.frame);
  if (name !== 'flat' && name !== 'swim') { b.law.speed = 8; b.law.target = 8; }
  b.physics.step(); b.law.stepBody(dt, b.a, b.p, b.world); b.law.placeRider(dt, 1, b.a, b.p, b.world);
}

it.each(['flat', 'rail', 'deck', 'ditch', 'swim'])('runs the exact shipping lying-capsule law over native %s geometry', name => {
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-motor-oracle/shipping.txt')).digest('hex')).toBe(source.sourceSha256);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-motor-oracle/shipping.ts')).digest('hex')).toBe(source.adapterSha256);
  const current = install(MountedBody, name), old = install(ShippingBody, name);
  let jumps = 0, decks = 0, swimming = 0, ymax = -100;
  try {
    for (let tick = 0; tick < (name === 'flat' ? 1800 : 420); tick++) {
      advance(old, tick, name); advance(current, tick, name);
      expect(current.law.snapshotBody()).toEqual(old.law.snapshotBody());
      expect(current.law.motor?.snapshot()).toEqual(old.law.motor?.snapshot());
      expect(current.a.snapshot()).toEqual(old.a.snapshot()); expect(current.p).toEqual(old.p);
      if (current.law.airT >= 0) jumps++; if (current.law.onDeck) decks++; if (current.law.swimming) swimming++;
      ymax = Math.max(ymax, current.law.feet.y);
    }
    expect(current.law.motor?.opts.length).toBe(2.4);
    if (name === 'rail') { expect(jumps).toBeGreaterThan(0); expect(ymax).toBeGreaterThan(1); expect(current.law.feet.z).toBeGreaterThan(13); expect(current.law.feet.z).toBeLessThan(40); }
    if (name === 'ditch') { expect(jumps).toBeGreaterThan(0); expect(current.law.feet.z).toBeGreaterThan(5); }
    if (name === 'deck') expect(decks).toBeGreaterThan(20);
    if (name === 'swim') { expect(swimming).toBeGreaterThan(20); expect(current.law.feet.y).toBe(1.05); }
  } finally { current.dispose(); old.dispose(); }
}, 20_000);

it('restores the real capsule, queued inputs and every physical clock with an exact jump suffix', () => {
  const original = install(MountedBody, 'rail'); let restored: ReturnType<typeof install> | undefined;
  try {
    for (let tick = 0; tick < 66; tick++) advance(original, tick, 'rail');
    original.law.jumpQueued = true;
    const saved = original.law.snapshotBody(), motor = original.law.motor?.snapshot();
    if (motor === undefined) throw new Error('Missing mounted motor');
    const native = original.physics.snapshot(), physical = original.a.snapshot();
    restored = install(MountedBody, 'rail'); restored.dispose();
    restored.physics = new Physics(rapier, native);
    const physics = restored.physics;
    restored.world = { ...restored.world, physics };
    restored.dispose = () => { restored?.law.motor?.dispose(); physics.dispose(); };
    restored.a.restore(physical); restored.law.restoreBody(saved);
    restored.law.motor = new CharacterMotor(physics, mountedMotorOptions(restored.a.scale, restored.a), motor);
    expect(restored.law.motor.snapshot()).toEqual(motor);
    for (const bad of [{ ...saved, version: 2 }, { ...saved, feet: [0, Number.NaN, 0] }, { ...saved, extra: 1 },
      { ...saved, reins: { ...saved.reins, spur: { ...saved.reins.spur, lastTap: saved.reins.clock + 1 } } }]) {
      expect(() => restored?.law.restoreBody(bad)).toThrow(); expect(restored.law.snapshotBody()).toEqual(saved);
    }
    for (let tick = 66; tick < 366; tick++) {
      advance(original, tick, 'rail'); advance(restored, tick, 'rail');
      expect(restored.law.snapshotBody()).toEqual(original.law.snapshotBody());
      expect(restored.law.motor.snapshot()).toEqual(original.law.motor?.snapshot());
      expect(restored.a.snapshot()).toEqual(original.a.snapshot()); expect(restored.p).toEqual(original.p);
    }
    expect(restored.physics.snapshot()).toEqual(original.physics.snapshot());
  } finally { restored?.dispose(); original.dispose(); }
}, 20_000);

it('uses the real native herd contact to jostle and throws only at the shipping closing threshold', () => {
  const b = install(MountedBody, 'flat'), other = horse('horse:2');
  let thrown = 0;
  try {
    other.position.set(0.7, 0, 0); other.yaw = Math.PI; other.speed = 13;
    const c = b.physics.world.createCollider(b.physics.R.ColliderDesc.ball(0.4).setTranslation(0.7, 0.5, 0).setCollisionGroups(groups('CREATURE')));
    tagCollider(c, 'flesh', other);
    b.world = { ...b.world, stampede: owner => owner === other ? other : null, thrown: () => { thrown++; } };
    b.law.speed = 13; b.law.target = 13; b.law.gait = 'gallop';
    b.physics.step(); b.law.stepBody(dt, b.a, b.p, b.world);
    expect(thrown).toBe(1); expect(b.law.jostles).toBe(1); expect(b.law.thrownBy).toBe('stampede');
    expect(b.law.shoveX).not.toBe(0); expect(b.law.jostleCd).toBe(0.45);
  } finally { b.dispose(); }
});
