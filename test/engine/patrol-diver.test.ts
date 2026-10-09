import { afterAll, describe, expect, it } from 'vitest';
import { PatrolDiverBrain, type PatrolDiverSpec } from '../../src/engine/ai/patrolDiver';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { registerSpecies } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { DUNE_RAY } from '../../src/shards/sunscar-dunes/runtime/species/duneRay';
import { DUNE_RAY_LOOK } from '../../src/shards/sunscar-dunes/species/duneRay';
import { DuneRayBrain, SWOOP, RAY } from '../fixtures/flight-oracle/patrol';
import { RAY_HOME } from '../../src/shards/sunscar-dunes/data/layout';
import { creature } from '../fake/creature';

registerSpecies(speciesWithLook(DUNE_RAY, DUNE_RAY_LOOK));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(unbind);
const HOME = { x: RAY_HOME.x, z: RAY_HOME.z };
const SPEC: PatrolDiverSpec = { glideAltitude: RAY.glideAlt, glideSpeed: RAY.glideSpeed, circleRadius: RAY.circleR,
  patrolRadius: RAY.patrolR, patrolAltitude: RAY.patrolAlt, noticeRadius: RAY.notice, diveFrom: RAY.diveFrom,
  diveSpeed: RAY.diveSpeed, climbAltitude: RAY.climbAlt, climbSeconds: RAY.climbFor, diveMaxSeconds: RAY.diveMax,
  restSeconds: RAY.rest, targetHeight: 1.2, diveSlope: 0.35, climbSpeedBonus: 3, orbitLead: 0.55, heldField: 'held' };
function fixture(platform: boolean): ReturnType<typeof creature> & {
  policy: () => PatrolDiverBrain<Animal> | DuneRayBrain; freshPolicy: () => PatrolDiverBrain<Animal>;
} {
  let policy: PatrolDiverBrain<Animal> | DuneRayBrain | undefined;
  const f = creature('duneRay', 'dusk', {}, undefined, (_a, c) => {
    if (policy === undefined) throw new Error('Missing policy'); policy.think(c);
  }, (_a, c) => { if (policy === undefined) throw new Error('Missing policy'); policy.act(c); });
  f.animal.position.set(12, 14, 0);
  policy = platform ? new PatrolDiverBrain(f.animal, SPEC, HOME, SWOOP) : new DuneRayBrain(f.animal);
  return { ...f, get frame(): number { return f.frame; }, policy: () => {
    if (policy === undefined) throw new Error('Missing policy'); return policy;
  }, freshPolicy: () => { const next = new PatrolDiverBrain(f.animal, SPEC, HOME, SWOOP); policy = next; return next; } };
}
type Scenario = 'contact' | 'cover' | 'calm' | 'tokens' | 'escape' | 'held';
function drive(f: ReturnType<typeof fixture>, tick: number, scenario: Scenario): void {
  f.ctx.player.set(Math.sin(tick * 0.004) * 3, 0,
    scenario === 'escape' && tick > 1000 && tick < 4000 ? 90 : 2);
  f.ctx.reach = () => scenario !== 'cover' || tick < 3000 || tick >= 6000;
  f.ctx.claim = () => scenario !== 'tokens' || tick < 1000 || tick >= 4000;
  f.ctx.mayAttack = f.ctx.claim;
  f.ctx.calm = scenario === 'calm' && tick >= 3000 && tick < 6000;
  f.animal.mem['held'] = scenario === 'held' && tick >= 1000 && tick < 5000 ? 1 : 0;
  f.advance(1);
}
function replay(platform: boolean, scenario: Scenario): object {
  const f = fixture(platform), frames: object[] = [], phases = new Set<string>();
  for (let tick = 0; tick < 10000; tick++) {
    drive(f, tick, scenario); frames.push({ actor: f.animal.snapshot(), phase: f.policy().state }); phases.add(f.policy().state);
  }
  if (scenario === 'contact') {
    expect([...phases].sort()).toEqual(['climb', 'dive', 'glide']); expect(f.starts.length).toBeGreaterThan(0); expect(f.hits.length).toBeGreaterThan(0);
  }
  return { frames, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('declared patrol and chest swoop', () => {
  it.each(['contact', 'cover', 'calm', 'tokens', 'escape', 'held'] as const)('matches shipping flight and contact for 10,000 ticks: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it.each([800, 1400, 4000])('restores a fresh policy with the exact flight/strike suffix at tick %i', at => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof PatrolDiverBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < at; tick++) drive(f, tick, 'contact');
    const actor = f.animal.snapshot(), saved = policy.snapshot(), rng = f.ctx.rng.snapshot();
    const continueFor = (active: ReturnType<typeof fixture>, activePolicy: PatrolDiverBrain<Animal>): object => {
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
    expect(() => new PatrolDiverBrain(f.animal, { ...SPEC, diveSpeed: Infinity }, HOME, SWOOP)).toThrow('parameters');
    expect(() => new PatrolDiverBrain(f.animal, SPEC, { ...HOME, x: HOME.x + 1 }, SWOOP).restore(saved)).toThrow('Incompatible');
    expect(() => policy.restore(null)).toThrow('continuation'); expect(policy.snapshot()).toBe(saved);
  });
  it('takes an interrupt\'s zero step (a second wake in one frame) instead of faulting', () => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof PatrolDiverBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < 1500; tick++) drive(f, tick, 'contact');
    const zero = { ...f.ctx, dt: 0 };
    expect(() => { policy.think(zero); policy.think(zero); policy.act(zero); }).not.toThrow();
    for (let tick = 1500; tick < 1800; tick++) drive(f, tick, 'contact');
  });
});
