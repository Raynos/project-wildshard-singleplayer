import { afterAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { RamGrazerBrain, type RamGrazerSpec } from '../../src/engine/ai/ramGrazer';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { registerSpecies } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { SKY_GOAT, SKY_GOAT_LOOK } from '../../src/shards/far-reach/species/skyGoat';
import { setHome } from '../../src/shards/far-reach/species/rig';
import { SkyGoatBrain, RAM, GOAT } from '../fixtures/grazer-oracle/goat';
import { creature } from '../fake/creature';

// SF72: a lane strike with no `motion` is swept and ends at its `active` window (the Roc's gale wall); the captured goat's
// RAM ran as a charge, which the shipping RAM now declares (`motion: {}`). The source-hashed fixture keeps its bytes, so
// the capture's RAM gets the same declaration here (test/shards/far-reach/goat-ram-oracle.test.ts: goats byte-identical).
RAM.motion = {};
registerSpecies(speciesWithLook(SKY_GOAT, SKY_GOAT_LOOK));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(unbind);
const HOME = { x: 0, z: 0, r: 20, y: 0 };
const SPEC: RamGrazerSpec = { grazeSpeed: GOAT.graze, ramSpeed: GOAT.ram, noticeRadius: GOAT.notice,
  rimMargin: GOAT.rimMargin, fallDrop: GOAT.drop, levelTolerance: 2.5, threatSpeed: 1.6,
  wanderMinSeconds: 2, wanderMaxSeconds: 5, rampRate: 4 };

function fixture(platform: boolean): ReturnType<typeof creature> & {
  policy: () => RamGrazerBrain<Animal> | SkyGoatBrain;
  freshPolicy: () => RamGrazerBrain<Animal>;
} {
  let policy: RamGrazerBrain<Animal> | SkyGoatBrain | undefined;
  const f = creature('skyGoat', 'cloud', {}, undefined, (_a, c) => {
    if (policy === undefined) throw new Error('Missing policy');
    if (policy instanceof RamGrazerBrain) policy.think({ ...c, home: HOME }); else policy.think(c);
  }, (_a, c) => {
    if (policy === undefined) throw new Error('Missing policy');
    if (policy instanceof RamGrazerBrain) policy.act({ ...c, home: HOME }); else policy.act(c);
  });
  setHome(f.animal, HOME);
  policy = platform ? new RamGrazerBrain(f.animal, SPEC, RAM) : new SkyGoatBrain(f.animal);
  return { ...f, get frame(): number { return f.frame; }, policy: () => {
    if (policy === undefined) throw new Error('Missing policy'); return policy;
  }, freshPolicy: () => { const next = new RamGrazerBrain(f.animal, SPEC, RAM); policy = next; return next; } };
}
type Scenario = 'contact' | 'rim' | 'impulse' | 'calm' | 'fall' | 'tokens';
function drive(f: ReturnType<typeof fixture>, tick: number, scenario: Scenario): void {
  f.ctx.player.set(Math.sin(tick * 0.004) * 6, tick >= 6000 && tick < 7000 ? 5 : 0, tick < 600 ? 40 : 2);
  f.ctx.reach = () => tick < 3000 || tick >= 4000;
  f.ctx.claim = () => scenario !== 'tokens' || tick < 1000 || tick >= 4000;
  f.ctx.calm = scenario === 'calm' && tick >= 3000 && tick < 6000;
  if (scenario === 'rim' && tick % 1000 === 0) f.animal.position.set(19.9, 0, 0);
  if (scenario === 'impulse' && tick % 500 === 0) f.animal.impulse(new Vector3(1, 2, 0));
  if (scenario === 'fall' && tick === 1500) f.animal.position.y = -2;
  f.advance(1);
}
function replay(platform: boolean, scenario: Scenario): object {
  const f = fixture(platform), frames: ReturnType<Animal['snapshot']>[] = [], phases: string[] = [];
  for (let tick = 0; tick < 10000; tick++) {
    drive(f, tick, scenario); frames.push(f.animal.snapshot()); phases.push(f.policy().state);
  }
  return { frames, phases, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('declared rim-aware ram grazer', () => {
  it.each(['contact', 'rim', 'impulse', 'calm', 'fall', 'tokens'] as const)('matches the captured shipping policy for 10,000 ticks: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it.each([800, 1400, 4000])('restores an exact suffix without executing a body or drawing RNG at tick %i', at => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof RamGrazerBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < at; tick++) drive(f, tick, 'contact');
    const actor = f.animal.snapshot(), saved = policy.snapshot(), rng = f.ctx.rng.snapshot();
    const continueFor = (active: ReturnType<typeof fixture>, activePolicy: RamGrazerBrain<Animal>): object => {
      const frames: object[] = [];
      for (let tick = at; tick < at + 2000; tick++) { drive(active, tick, 'contact'); frames.push({ actor: active.animal.snapshot(), policy: activePolicy.snapshot(), rng: active.ctx.rng.snapshot() }); }
      return frames;
    };
    const expected = continueFor(f, policy);
    // Recreate the fixture's global clock/cadence before restoring into a fresh policy instance.
    const restored = fixture(true);
    for (let tick = 0; tick < at; tick++) drive(restored, tick, 'contact');
    restored.animal.restore(actor); restored.ctx.rng.restore(rng);
    const starts = restored.starts.length, hits = restored.hits.length;
    const next = restored.freshPolicy(); next.restore(saved);
    expect(restored.ctx.rng.snapshot()).toEqual(rng); expect(restored.animal.snapshot()).toEqual(actor);
    expect(restored.starts.length).toBe(starts); expect(restored.hits.length).toBe(hits);
    expect(continueFor(restored, next)).toEqual(expected);
    expect(restored.hits).toEqual(f.hits); expect(restored.starts).toEqual(f.starts);
  });
  it('refuses invalid tuning and a different actor or policy before changing its continuation', () => {
    const f = fixture(true), brain = new RamGrazerBrain(f.animal, SPEC, RAM), saved = brain.snapshot();
    expect(() => new RamGrazerBrain(f.animal, { ...SPEC, ramSpeed: Infinity }, RAM)).toThrow('parameters');
    expect(() => new RamGrazerBrain(f.animal, { ...SPEC, ramSpeed: 14 }, RAM).restore(saved)).toThrow('Incompatible');
    expect(() => brain.restore(null)).toThrow('continuation');
    expect(() => brain.restore('{"state":"ram"}')).toThrow();
    if (typeof saved !== 'string') throw new Error('Expected a bounded string continuation');
    expect(() => brain.restore(saved.replace('creature.skyGoat.0.5', 'creature.skyGoat.other'))).toThrow('Incompatible');
    expect(brain.snapshot()).toBe(saved);
  });
});
