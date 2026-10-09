import { afterAll, describe, expect, it } from 'vitest';
import { ChallengeGrazerBrain, type ChallengeGrazerSpec } from '../../src/engine/ai/challengeGrazer';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { registerSpecies } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { DUNE_STRIDER } from '../../src/shards/sunscar-dunes/runtime/species/strider';
import { DUNE_STRIDER_LOOK } from '../../src/shards/sunscar-dunes/species/strider';
import { slot } from '../../src/shards/sunscar-dunes/runtime/species/skitterer';
import { StriderBrain, CHARGE, HORNS, STRIDE } from '../fixtures/grazer-oracle/strider';
import { creature } from '../fake/creature';

registerSpecies(speciesWithLook(DUNE_STRIDER, DUNE_STRIDER_LOOK));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(unbind);
const SPEC: ChallengeGrazerSpec = { noticeRadius: STRIDE.notice, chargeRadius: STRIDE.charge, loseRadius: STRIDE.lose,
  walkSpeed: STRIDE.walk, approachSpeed: STRIDE.approach, homeRadius: STRIDE.homeR, faceSeconds: STRIDE.face, circleRate: 0.05,
  farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' };

function fixture(platform: boolean): ReturnType<typeof creature> & {
  policy: () => ChallengeGrazerBrain<Animal> | StriderBrain; freshPolicy: () => ChallengeGrazerBrain<Animal>;
} {
  let policy: ChallengeGrazerBrain<Animal> | StriderBrain | undefined;
  const f = creature('duneStrider', 'dusk', {}, undefined, (a, c) => {
    if (policy === undefined) throw new Error('Missing policy');
    if (policy instanceof ChallengeGrazerBrain) policy.think({ ...c, phaseOffset: slot(a, 6) }); else policy.think(c);
  }, (a, c) => {
    if (policy === undefined) throw new Error('Missing policy');
    if (policy instanceof ChallengeGrazerBrain) policy.act({ ...c, phaseOffset: slot(a, 6) }); else policy.act(c);
  });
  policy = platform ? new ChallengeGrazerBrain(f.animal, SPEC, CHARGE, HORNS) : new StriderBrain(f.animal);
  return { ...f, get frame(): number { return f.frame; }, policy: () => {
    if (policy === undefined) throw new Error('Missing policy'); return policy;
  }, freshPolicy: () => { const next = new ChallengeGrazerBrain(f.animal, SPEC, CHARGE, HORNS); policy = next; return next; } };
}
type Scenario = 'contact' | 'cover' | 'tokens' | 'calm' | 'damaged' | 'far';
function drive(f: ReturnType<typeof fixture>, tick: number, scenario: Scenario): void {
  f.ctx.player.set(Math.sin(tick * 0.004) * 4, 0, tick < 600 || (scenario === 'far' && tick >= 5000) ? 60 : tick % 3000 < 1500 ? 2 : 12);
  f.ctx.reach = () => scenario !== 'cover' || tick < 3000 || tick >= 4000;
  f.ctx.claim = () => scenario !== 'tokens' || tick < 1000 || tick >= 4000;
  f.ctx.calm = scenario === 'calm' && tick >= 3000 && tick < 6000;
  if (scenario === 'damaged' && tick === 200) f.animal.hp = f.animal.maxHp - 1;
  f.advance(1);
}
function replay(platform: boolean, scenario: Scenario): object {
  const f = fixture(platform), frames: ReturnType<Animal['snapshot']>[] = [], phases: string[] = [];
  for (let tick = 0; tick < 10000; tick++) { drive(f, tick, scenario); frames.push(f.animal.snapshot()); phases.push(f.policy().state); }
  return { frames, phases, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('declared challenge grazer', () => {
  it.each(['contact', 'cover', 'tokens', 'calm', 'damaged', 'far'] as const)('matches the captured shipping policy for 10,000 ticks: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it.each([800, 1400, 4000])('restores an exact suffix into a fresh policy at tick %i', at => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof ChallengeGrazerBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < at; tick++) drive(f, tick, 'contact');
    const actor = f.animal.snapshot(), saved = policy.snapshot(), rng = f.ctx.rng.snapshot();
    const continueFor = (active: ReturnType<typeof fixture>, activePolicy: ChallengeGrazerBrain<Animal>): object => {
      const frames: object[] = [];
      for (let tick = at; tick < at + 2000; tick++) {
        drive(active, tick, 'contact'); frames.push({ actor: active.animal.snapshot(), policy: activePolicy.snapshot(), rng: active.ctx.rng.snapshot() });
      }
      return frames;
    };
    const expected = continueFor(f, policy), restored = fixture(true);
    for (let tick = 0; tick < at; tick++) drive(restored, tick, 'contact');
    restored.animal.restore(actor); restored.ctx.rng.restore(rng);
    const starts = restored.starts.length, hits = restored.hits.length;
    const next = restored.freshPolicy(); next.restore(saved);
    expect(restored.ctx.rng.snapshot()).toEqual(rng); expect(restored.animal.snapshot()).toEqual(actor);
    expect(restored.starts.length).toBe(starts); expect(restored.hits.length).toBe(hits);
    expect(continueFor(restored, next)).toEqual(expected);
    expect(restored.hits).toEqual(f.hits); expect(restored.starts).toEqual(f.starts);
  });
  it('validates finite tuning and rejects policy drift atomically', () => {
    const f = fixture(true), brain = new ChallengeGrazerBrain(f.animal, SPEC, CHARGE, HORNS), saved = brain.snapshot();
    expect(() => new ChallengeGrazerBrain(f.animal, { ...SPEC, walkSpeed: Infinity }, CHARGE, HORNS)).toThrow('parameters');
    expect(() => new ChallengeGrazerBrain(f.animal, { ...SPEC, homeRadius: 20 }, CHARGE, HORNS).restore(saved)).toThrow('Incompatible');
    expect(() => brain.restore(null)).toThrow('continuation');
    expect(() => brain.restore('{"state":"fight"}')).toThrow();
    expect(brain.snapshot()).toBe(saved);
  });
  it('takes an interrupt\'s zero step (a second wake in one frame) instead of faulting', () => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof ChallengeGrazerBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < 1500; tick++) drive(f, tick, 'contact');
    const zero = { ...f.ctx, dt: 0, phaseOffset: slot(f.animal, 6) };
    expect(() => { policy.think(zero); policy.think(zero); policy.act(zero); }).not.toThrow();
    for (let tick = 1500; tick < 1800; tick++) drive(f, tick, 'contact');
  });
});
