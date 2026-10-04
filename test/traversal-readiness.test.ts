import { expect, it } from 'vitest';
import { readinessModel, TraversalReadiness } from '../src/engine/sim/readiness';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { criticalWireBytes } from '../src/game/shardfile/readiness';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { Scope } from '../src/engine/app/scope';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const bundle = { criticalWireBytes: 2_000_000, hybridWireBytes: 0, decodeSeconds: 0.8, runtimeParseSeconds: 0 };
const link = { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.5, maxStallSeconds: 10 };

it('uses actual link transfer, stall and decode: 435 m at 30 m/s, 5 Mbit/s and ten seconds stalled', () => {
  const estimate = readinessModel(bundle, link);
  expect(estimate.criticalTransferSeconds).toBe(3.2); expect(estimate.seconds).toBe(14.5); expect(estimate.distance).toBe(435);
  expect(readinessModel(bundle, { ...link, maxStallSeconds: 3 }).distance).toBe(225);
  const hybrid = readinessModel({ ...bundle, hybridWireBytes: 500_000, runtimeParseSeconds: 0.2 }, link);
  expect(hybrid.hybridTransferSeconds).toBe(0.8); expect(hybrid.hybridSeconds).toBe(1.5); expect(hybrid.distance).toBe(480);
  expect(readinessModel(bundle, { ...link, speed: 15 }).distance).toBe(217.5);
});

it('rejects a critical bundle above 2 MB and invalid time, wire or link inputs', () => {
  expect(() => readinessModel({ ...bundle, criticalWireBytes: 2_000_001 }, link)).toThrow();
  for (const value of [-1, Number.NaN, Infinity, 1.5]) expect(() => readinessModel({ ...bundle, criticalWireBytes: value }, link)).toThrow();
  for (const value of [0, -1, Number.NaN]) expect(() => readinessModel(bundle, { ...link, linkBitsPerSecond: value })).toThrow();
  expect(() => readinessModel({ ...bundle, runtimeParseSeconds: -1 }, link)).toThrow();
});

it('counts deduplicated collider/sim dependencies and cold-cache commons from admitted bytes', () => {
  const source = { critical: ['collider', 'script'], files: [
    { hash: 'collider', compressed: 1_000_000, dependencies: ['shared'] },
    { hash: 'script', compressed: 500_000, dependencies: ['shared', 'commons:code'] },
    { hash: 'shared', compressed: 300_000, dependencies: [] }], sim: { scripts: ['script'] }, terrain: { collider: 'collider' } };
  const assets = new Map([['collider', new Uint8Array(1_000_000)], ['script', new Uint8Array(500_000)], ['shared', new Uint8Array(300_000)], ['commons:code', new Uint8Array(200_000)]]);
  expect(criticalWireBytes(source, assets)).toBe(2_000_000);
  assets.set('commons:code', new Uint8Array(200_001)); expect(() => criticalWireBytes(source, assets)).toThrow(/2 MB/u);
  assets.delete('commons:code'); expect(() => criticalWireBytes(source, assets)).toThrow(/Missing/u);
  expect(() => criticalWireBytes({ ...source, critical: ['collider'] }, assets)).toThrow(/omitted/u);
});

it('prefetches radially, keeps a U-turn attempt and rejects completions from an unloaded generation', () => {
  const readiness = new TraversalReadiness(), estimate = readinessModel(bundle, link);
  expect(readiness.request('copy.east', 436, estimate, true)).toBeNull();
  const ticket = readiness.request('copy.east', 435, estimate, true); if (ticket === null) throw new Error('Request');
  expect(readiness.request('copy.east', 500, estimate, true)).toBeNull();
  readiness.complete(ticket, 'sim'); readiness.complete(ticket, 'runtime'); expect(readiness.status('copy.east').ready).toBe(false);
  readiness.complete(ticket, 'colliders'); expect(readiness.status('copy.east').ready).toBe(true);
  expect(readiness.status('another.copy').ready).toBe(false); expect(readiness.status(null).proxy).toBe(true);
  readiness.invalidate('copy.east'); expect(readiness.complete(ticket, 'colliders')).toBe(false);
  const retry = readiness.request('copy.east', 0, estimate, true); if (retry === null) throw new Error('Retry');
  readiness.complete(retry, 'sim'); readiness.complete(retry, 'runtime'); expect(readiness.complete(ticket, 'colliders')).toBe(false);
  expect(readiness.status('copy.east').ready).toBe(false); readiness.complete(retry, 'colliders'); expect(readiness.status('copy.east').ready).toBe(true);
});

for (const stall of [3, 10]) it(`holds the real 30 m/s capsule through a ${stall}s cold-cache stall, late collision, U-turn and proxy edge`, async () => {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R), scope = new Scope('readiness-walls');
  // Permanent platform strip; destination terrain is deliberately absent until collision completion.
  const deck = physics.world.createCollider(R.ColliderDesc.cuboid(300, 0.5, 20).setTranslation(-50, -0.5, 0).setCollisionGroups(groups('WORLD')));
  const readiness = new TraversalReadiness(), estimate = readinessModel(bundle, { ...link, maxStallSeconds: stall });
  const walls = new ReadinessWalls(physics, [{ instance: 'east', x: 250, z: 0, halfLength: 20, axis: 'x', floor: 0 }, { instance: null, x: -350, z: 0, halfLength: 20, axis: 'x', floor: 0 }], scope);
  const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.4, group: 'PLAYER', blockedBy: ['WORLD'] });
  const feet = { x: 250 - estimate.distance, y: 0.03, z: 0 };
  const ticket = readiness.request('east', 250 - feet.x, estimate, true); if (ticket === null) throw new Error('Fixture request');
  let verticalVelocity = 0;
  const step = (speed: number, ticks: number) => { for (let tick = 0; tick < ticks; tick++) {
    walls.sync(readiness); physics.step(); verticalVelocity -= 9.81 / 60;
    const result = motor.move(feet, { x: speed / 60, y: verticalVelocity / 60, z: 0 });
    if (result.grounded) verticalVelocity = 0;
    expect(feet.y).toBeGreaterThan(-0.05);
  } };
  try {
    step(30, Math.ceil(estimate.seconds * 60) + 120);
    expect(feet.x).toBeLessThan(250); expect(feet.x).toBeGreaterThan(249);
    readiness.complete(ticket, 'sim'); readiness.complete(ticket, 'runtime'); step(30, 60); expect(feet.x).toBeLessThan(250);
    step(-30, 120); expect(feet.x).toBeLessThan(200); step(30, 120); expect(feet.x).toBeLessThan(250);
    physics.world.createCollider(R.ColliderDesc.cuboid(125, 0.5, 20).setTranslation(375, -0.5, 0).setCollisionGroups(groups('WORLD')));
    readiness.complete(ticket, 'colliders'); step(30, 120); expect(feet.x).toBeGreaterThan(300);
    step(-30, 180); readiness.invalidate('east'); step(30, 180); expect(feet.x).toBeLessThan(250);
    step(-30, 1400); expect(feet.x).toBeGreaterThan(-350); expect(feet.x).toBeLessThan(-349);
    scope.dispose(); expect(deck.isValid()).toBe(true); expect(physics.world.colliders.len()).toBe(3);
  } finally { scope.dispose(); motor.dispose(); physics.dispose(); }
});
