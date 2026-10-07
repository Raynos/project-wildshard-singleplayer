// oxlint-disable-next-line import/no-nodejs-modules -- Hash every replay frame instead of retaining hundreds of megabytes of copied crowd state.
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { FlockBrain, type FlockSpec, type FlockPorts, type FlockPose } from '../../src/engine/ai/flock';
import { Rng } from '../../src/engine/core/rng';
import { ShippingFlock, type OraclePorts } from '../fixtures/flock-oracle/flock';

const SPEC: FlockSpec = { x: 0, z: 0, count: 24, seed: 357, range: 45, runSpeed: 4.6, walkSpeed: 0.9, grazeStep: 0.35, bleatCue: 'sheep_bleat' };
type Scenario = 'grazing' | 'sprint' | 'stealth' | 'wolf' | 'dog' | 'death' | 'water-rim' | 'distance';
function fixture(platform: boolean, scenario: Scenario, initialize = true): {
  policy: FlockBrain | ShippingFlock; player: Vector3; dog: { alive: boolean; position: Vector3 };
  wolves: { alive: boolean; position: Vector3 }[]; sounds: object[]; centres: number[][]; tramples: number[][];
  ports: FlockPorts; oraclePorts: OraclePorts;
} {
  const sounds: object[] = [], centres: number[][] = [], tramples: number[][] = [];
  const home = scenario === 'water-rim' ? 230 : 0;
  const ports: FlockPorts = {
    heightAt: (x, z) => Math.sin(x * 0.08) * 2 + Math.cos(z * 0.05),
    normalY: (x, z) => Math.abs(x - home) < 25 && z < 25 ? 0.98 : 0.7,
    wetAt: (x, z) => scenario === 'water-rim' && (x < 220 || z > 8),
    inBounds: (x, z, margin) => Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin,
    playerCrouched: () => scenario === 'stealth', grassHeightAt: () => 0.9,
    trample: (...values) => { tramples.push(values); }, centre: (...values) => { centres.push(values); },
  };
  const oraclePorts: OraclePorts = { ...ports, normalAt: (x, z) => [0, ports.normalY(x, z), 0], playerCrouched: ports.playerCrouched() };
  const spec = { ...SPEC, x: home };
  const policy = platform ? new FlockBrain(ports, spec) : new ShippingFlock(oraclePorts, spec);
  policy.onSound = (name, x, z) => { sounds.push({ name, x, z }); };
  const dog = { alive: true, position: new Vector3(500, 0, 0) };
  policy.dog = scenario === 'dog' ? dog : null;
  if (initialize) policy.initialize();
  return { policy, player: new Vector3(home + 30, 0, 30), dog,
    wolves: [{ alive: true, position: new Vector3(500, 0, 0) }], sounds, centres, tramples, ports, oraclePorts };
}
function drive(f: ReturnType<typeof fixture>, tick: number, scenario: Scenario): void {
  const p = f.policy, home = scenario === 'water-rim' ? 230 : 0;
  let speed = 0;
  f.player.set(home + 30, 0, 30);
  if (scenario === 'sprint' || scenario === 'stealth') {
    f.player.set(p.cx + 1 + Math.sin(tick * 0.002) * 20, 0, p.cz + 4);
    speed = scenario === 'sprint' ? 6 : tick < 5000 ? 2 : 3;
  }
  const wolf = f.wolves[0];
  if (wolf === undefined) throw new Error('Missing ordered wolf');
  wolf.position.set(scenario === 'wolf' && tick % 2000 < 750 ? p.cx + 8 : 500, 0, p.cz + 6);
  wolf.alive = tick < 8000;
  if (scenario === 'dog') f.dog.position.set(tick % 2000 < 1000 ? p.cx + 2 : 500, 0, p.cz - 3);
  if (scenario === 'death' && tick % 300 === 0 && tick / 300 < SPEC.count) p.kill(tick / 300);
  if (scenario === 'water-rim' && tick % 1500 === 0) p.scare(home - 10, 0, 6);
  if (scenario === 'distance') {
    const segment = tick % 3000;
    f.player.set(p.cx + (segment < 800 ? 40 : segment < 1600 ? 90 : segment < 2500 ? 300 : 35), 0, p.cz);
  }
  const dt = tick % 120 === 0 ? 1 / 30 : 1 / 60;
  p.update(dt, tick / 60, f.player, speed, f.wolves);
}
function replay(platform: boolean, scenario: Scenario): object {
  const f = fixture(platform, scenario), hash = createHash('sha256');
  for (let tick = 0; tick < 10000; tick++) {
    drive(f, tick, scenario);
    hash.update(JSON.stringify(f.policy.state()));
    hash.update(JSON.stringify({ sounds: f.sounds, centres: f.centres, tramples: f.tramples }));
    f.sounds.length = 0; f.centres.length = 0; f.tramples.length = 0;
  }
  return { digest: hash.digest('hex'), final: f.policy.state() };
}
describe('ordered distance-scheduled flock', () => {
  it.each(['grazing', 'sprint', 'stealth', 'wolf', 'dog', 'death', 'water-rim', 'distance'] as const)('matches the source-hashed shipping oracle for 10,000 ticks: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it('preflights tuning, copies the contract, and requires exactly one admitted initialization', () => {
    const f = fixture(true, 'grazing');
    expect(() => f.policy.initialize()).toThrow('already initialized');
    expect(() => new FlockBrain(f.ports, { ...SPEC, runSpeed: Number.NaN })).toThrow('parameters');
    const spec = { ...SPEC }, policy = new FlockBrain(f.ports, spec);
    spec.runSpeed = 14;
    const before = policy.snapshot();
    expect(() => policy.update(1 / 60, 0, f.player, 0, [])).toThrow('not initialized');
    expect(policy.snapshot()).toBe(before);
  });
  it.each([1, 799, 802, 1599, 1602, 2499, 2502])('restores an exact fresh-policy suffix at %i without setup RNG or native effects', at => {
    const f = fixture(true, 'distance');
    if (!(f.policy instanceof FlockBrain)) throw new Error('Expected declared policy');
    for (let tick = 0; tick < at; tick++) drive(f, tick, 'distance');
    const saved = f.policy.snapshot(), draw = vi.spyOn(Rng.prototype, 'next');
    const restored = fixture(true, 'distance', false);
    if (!(restored.policy instanceof FlockBrain)) throw new Error('Expected declared policy');
    restored.policy.restore(saved);
    expect(draw).not.toHaveBeenCalled(); draw.mockRestore();
    expect(restored.sounds).toEqual([]); expect(restored.centres).toEqual([]); expect(restored.tramples).toEqual([]);
    expect(restored.policy.snapshot()).toBe(saved);
    f.sounds.length = 0; f.centres.length = 0; f.tramples.length = 0;
    for (let tick = at; tick < at + 2000; tick++) {
      drive(f, tick, 'distance'); drive(restored, tick, 'distance');
      expect(restored.policy.snapshot()).toBe(f.policy.snapshot());
    }
    expect(restored.sounds).toEqual(f.sounds); expect(restored.tramples).toEqual(f.tramples); expect(restored.centres).toEqual(f.centres);
  });
  it('rejects incompatible or malformed continuation atomically, including an invalid owned clock', () => {
    const f = fixture(true, 'grazing');
    if (!(f.policy instanceof FlockBrain)) throw new Error('Expected declared policy');
    for (let tick = 0; tick < 100; tick++) drive(f, tick, 'grazing');
    const saved = f.policy.snapshot();
    expect(() => f.policy instanceof FlockBrain && f.policy.restore(saved.replace('"phase":', '"unknown":'))).toThrow();
    expect(() => f.policy instanceof FlockBrain && f.policy.restore(saved.replace('"alive":24', '"alive":23'))).toThrow('Incompatible');
    expect(() => f.policy instanceof FlockBrain && f.policy.restore(saved.replace(String.raw`\"credit\":`, String.raw`\"unknown\":`))).toThrow();
    expect(f.policy.snapshot()).toBe(saved);
    expect(() => new FlockBrain(f.ports, { ...SPEC, seed: 358 }).restore(saved)).toThrow('Incompatible');
  });
  it('projects one authoritative ordered pose without allocation and retains prey/death identity', () => {
    const f = fixture(true, 'grazing');
    if (!(f.policy instanceof FlockBrain)) throw new Error('Expected declared policy');
    const pose: FlockPose = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, phase: 0, graze: 0, dead: false, deathTime: 0, scale: 1, wool: 0 };
    expect(f.policy.readPose(4, pose)).toBe(pose);
    const point = new Vector3();
    expect(f.policy.positions(4, point)).toBe(point); expect(point.toArray()).toEqual([pose.x, pose.y + 0.6, pose.z]);
    expect(f.policy.headingOf(4)).toBe(pose.yaw); expect(f.policy.nearest(pose.x, pose.z)).toBe(4);
    f.policy.kill(4); const saved = f.policy.snapshot(); f.policy.kill(4);
    expect(f.policy.snapshot()).toBe(saved); expect(f.policy.isAlive(4)).toBe(false);
    expect(f.policy.nearest(pose.x, pose.z)).not.toBe(4); expect(f.policy.readPose(4, pose).dead).toBe(true);
    expect(() => f.policy instanceof FlockBrain && f.policy.kill(256)).toThrow('member');
    expect(f.policy.isAlive(0.5)).toBe(false);
  });
});
