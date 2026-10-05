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
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';

it('retires the returned page traveller after callback-owned frame teardown without leaving a capsule', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const home = new Physics(rapier), next = new Physics(rapier), page = new Scope('page-frame');
  const player = withOwner(page, () => new Player(new PerspectiveCamera(), home, legacyDouble<HTMLCanvasElement>({}),
    { waterLine: { update: () => undefined, setHint: () => undefined } }));
  page.onDispose(() => { player.motor.dispose(); });
  const rider = { position: player.position, motor: player.motor };
  try {
    withOwner(page, () => {
      prepareFrameMotors([rider], next, { x: -555, z: 0 }).commit(); player.bindFrame(next, rider.motor);
      page.onDispose(() => {
        prepareFrameMotors([rider], home, { x: 555, z: 0 }).commit(); player.bindFrame(home, rider.motor);
        expect(next.world.colliders.len()).toBe(0); expect(home.world.colliders.len()).toBe(1);
        next.dispose();
      });
    });
    expect(home.world.colliders.len()).toBe(0); expect(next.world.colliders.len()).toBe(1);
    page.dispose();
    expect(home.world.bodies.len()).toBe(0); expect(home.world.colliders.len()).toBe(0);
    expect(page.census.colliders).toBe(0); expect(page.census.disposers).toBe(0);
    expect(() => next.world.colliders.len()).toThrow();
  } finally { page.dispose(); home.dispose(); }
});

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

it('uses the destination ground, water and platforms without sampling home surfaces, then restores standalone queries', async () => {
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const home = new Physics(rapier), next = new Physics(rapier), scope = new Scope('frame-water');
  let homeGround = 0, homeWater = 0, homePlatform = 0, nextPlatform = 0;
  const restore = overrideTerrain({ heightAt: () => { homeGround++; return 7; } });
  app.world.water.add({ id: 'frame-fixture', level: 10, surfaceAt: () => 10, inside: () => true, restAt: () => { homeWater++; return 10; } }, scope);
  for (const physics of [home, next]) physics.world.createCollider(rapier.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  const player = new Player(new PerspectiveCamera(), home, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.platforms.push(() => { homePlatform++; return 8; });
  try {
    const rider = { position: player.position, motor: player.motor };
    prepareFrameMotors([rider], next, { x: -555, z: 0 }).commit();
    player.bindFrame(next, rider.motor, { heightAt: () => 1, waterSurfaceAt: () => null, platforms: [() => { nextPlatform++; return 3; }] });
    player.spawn(5, 6, 0); expect(player.position.y).toBe(1); expect(player.waterSurfaceAt(5, 6)).toBeNull();
    player.position.y = 3.2; player.setHover(true);
    for (let tick = 0; tick < 120; tick++) { next.step(); player.step(1 / 60); }
    expect(player.position.y).toBeCloseTo(3.45, 2); expect(nextPlatform).toBeGreaterThan(0);
    player.bindFrame(next, player.motor, { heightAt: () => 1, waterSurfaceAt: () => null, platforms: [] });
    player.spawn(5, 6, 0);
    for (let tick = 0; tick < 120; tick++) { next.step(); player.step(1 / 60); }
    expect(player.position.y).toBeCloseTo(1.45, 2); expect([homeGround, homeWater, homePlatform]).toEqual([0, 0, 0]);
    const back = { position: player.position, motor: player.motor };
    prepareFrameMotors([back], home, { x: 555, z: 0 }).commit(); player.bindFrame(home, back.motor);
    player.spawn(5, 6, 0); expect(player.position.y).toBe(7); expect(player.waterSurfaceAt(5, 6)).toBe(10);
    player.step(1 / 60); expect(homePlatform).toBeGreaterThan(0);
  } finally { player.motor.dispose(); home.dispose(); next.dispose(); scope.dispose(); restore(); }
});
