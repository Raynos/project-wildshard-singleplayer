import { afterAll, describe, expect, it } from 'vitest';
import { OrbitDiverBrain, type OrbitDiverSpec } from '../../src/engine/ai/orbitDiver';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { registerSpecies } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from '../../src/shards/far-reach/species/driftRay';
import { DriftRayBrain, DIVE, RAY } from '../fixtures/flight-oracle/orbit';
import { creature } from '../fake/creature';

registerSpecies(speciesWithLook(DRIFT_RAY, DRIFT_RAY_LOOK));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(unbind);
const HOME = { x: 0, z: 0, r: 12, y: 14 };
const SPEC: OrbitDiverSpec = { circleSpeed: RAY.circleSpeed, hangAltitude: RAY.hang, stalkSpeed: RAY.stalkSpeed,
  diveSpeed: RAY.diveSpeed, restSeconds: RAY.rest, noticeRadius: RAY.notice, giveUpRadius: RAY.giveUp,
  initialRestSeconds: 3, stalkMaxSeconds: 12, riseMargin: 2, targetHeight: 1.2, alignRadius: 3, alignTolerance: 1.6 };
function fixture(platform: boolean): ReturnType<typeof creature> & {
  policy: () => OrbitDiverBrain<Animal> | DriftRayBrain; freshPolicy: () => OrbitDiverBrain<Animal>;
} {
  let policy: OrbitDiverBrain<Animal> | DriftRayBrain | undefined;
  const f = creature('driftRay', 'dusk', {}, undefined, (_a, c) => {
    if (policy === undefined) throw new Error('Missing policy'); policy.think(c);
  }, (_a, c) => { if (policy === undefined) throw new Error('Missing policy'); policy.act(c); });
  f.animal.position.set(12, 14, 0);
  policy = platform ? new OrbitDiverBrain(f.animal, SPEC, HOME, DIVE) : new DriftRayBrain(f.animal, HOME);
  return { ...f, get frame(): number { return f.frame; }, policy: () => {
    if (policy === undefined) throw new Error('Missing policy'); return policy;
  }, freshPolicy: () => { const next = new OrbitDiverBrain(f.animal, SPEC, HOME, DIVE); policy = next; return next; } };
}
type Scenario = 'contact' | 'cover' | 'calm' | 'tokens' | 'escape' | 'elevation';
function drive(f: ReturnType<typeof fixture>, tick: number, scenario: Scenario): void {
  f.ctx.player.set(Math.sin(tick * 0.004) * 3, scenario === 'elevation' && tick > 3000 && tick < 6000 ? 5 : 0,
    scenario === 'escape' && tick > 1000 && tick < 4000 ? 90 : 2);
  f.ctx.reach = () => scenario !== 'cover' || tick < 3000 || tick >= 6000;
  f.ctx.claim = () => scenario !== 'tokens' || tick < 1000 || tick >= 4000;
  f.ctx.mayAttack = f.ctx.claim;
  f.ctx.calm = scenario === 'calm' && tick >= 3000 && tick < 6000;
  f.advance(1);
}
function replay(platform: boolean, scenario: Scenario): object {
  const f = fixture(platform), frames: object[] = [], phases = new Set<string>();
  for (let tick = 0; tick < 10000; tick++) {
    drive(f, tick, scenario); frames.push({ actor: f.animal.snapshot(), phase: f.policy().state }); phases.add(f.policy().state);
  }
  if (scenario === 'contact') {
    expect([...phases].sort()).toEqual(['circle', 'dive', 'rise', 'stalk']); expect(f.starts.length).toBeGreaterThan(0); expect(f.hits.length).toBeGreaterThan(0);
  }
  return { frames, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('declared orbit and overhead dive', () => {
  it.each(['contact', 'cover', 'calm', 'tokens', 'escape', 'elevation'] as const)('matches shipping flight and contact for 10,000 ticks: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it.each([800, 1400, 4000])('restores a fresh policy with the exact flight/strike suffix at tick %i', at => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof OrbitDiverBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < at; tick++) drive(f, tick, 'contact');
    const actor = f.animal.snapshot(), saved = policy.snapshot(), rng = f.ctx.rng.snapshot();
    const continueFor = (active: ReturnType<typeof fixture>, activePolicy: OrbitDiverBrain<Animal>): object => {
      const frames: object[] = [];
      for (let tick = at; tick < at + 2000; tick++) { drive(active, tick, 'contact'); frames.push({ actor: active.animal.snapshot(), policy: activePolicy.snapshot(), rng: active.ctx.rng.snapshot() }); }
      return frames;
    };
    const expected = continueFor(f, policy), restored = fixture(true);
    for (let tick = 0; tick < at; tick++) drive(restored, tick, 'contact');
    restored.animal.restore(actor); restored.ctx.rng.restore(rng);
    const starts = restored.starts.length, hits = restored.hits.length, next = restored.freshPolicy(); next.restore(saved);
    expect(restored.animal.snapshot()).toEqual(actor); expect(restored.ctx.rng.snapshot()).toEqual(rng);
    expect(restored.starts.length).toBe(starts); expect(restored.hits.length).toBe(hits);
    expect(continueFor(restored, next)).toEqual(expected); expect(restored.hits).toEqual(f.hits); expect(restored.starts).toEqual(f.starts);
  });
  it('rejects nonfinite admission and incompatible homes without changing continuation', () => {
    const f = fixture(true), policy = f.freshPolicy(), saved = policy.snapshot();
    expect(() => new OrbitDiverBrain(f.animal, { ...SPEC, diveSpeed: Infinity }, HOME, DIVE)).toThrow('parameters');
    expect(() => new OrbitDiverBrain(f.animal, SPEC, { ...HOME, r: 13 }, DIVE).restore(saved)).toThrow('Incompatible');
    expect(() => policy.restore(null)).toThrow('continuation'); expect(policy.snapshot()).toBe(saved);
  });
  it('takes an interrupt\'s zero step (a second wake in one frame) instead of faulting', () => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof OrbitDiverBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < 1500; tick++) drive(f, tick, 'contact');
    const zero = { ...f.ctx, dt: 0 };
    expect(() => { policy.think(zero); policy.think(zero); policy.act(zero); }).not.toThrow();
    for (let tick = 1500; tick < 1800; tick++) drive(f, tick, 'contact');
  });
});
