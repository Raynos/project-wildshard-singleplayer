import { afterAll, describe, expect, it } from 'vitest';
import { BurstFlyerBrain, type BurstFlyerSpec } from '../../src/engine/ai/burstFlyer';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { registerSpecies } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { GALE_WISP, GALE_WISP_LOOK } from '../../src/shards/far-reach/species/galeWisp';
import { GaleWispBrain, BURST, WISP } from '../fixtures/flight-oracle/burst';
import { bindPlayerPush, pushPlayer, setHome } from '../../src/shards/far-reach/species/rig';
import { creature } from '../fake/creature';

registerSpecies(speciesWithLook(GALE_WISP, GALE_WISP_LOOK));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(() => { unbind(); bindPlayerPush(null); });
const HOME = { x: 0, z: 0, r: 7, y: 3 };
const SPEC: BurstFlyerSpec = { circleSpeed: WISP.circle, dartSpeed: WISP.dart, noticeRadius: WISP.notice,
  shoveSpeed: WISP.shove, liftSpeed: WISP.lift, targetHeight: 1.2 };
function fixture(platform: boolean): ReturnType<typeof creature> & {
  policy: () => BurstFlyerBrain<Animal> | GaleWispBrain; freshPolicy: () => BurstFlyerBrain<Animal>; pushes: object[]; bindPush: () => void;
} {
  let policy: BurstFlyerBrain<Animal> | GaleWispBrain | undefined;
  const f = creature('galeWisp', 'gale', {}, undefined, (_a, c) => {
    if (policy === undefined) throw new Error('Missing policy'); if (policy instanceof BurstFlyerBrain) policy.think({ ...c, shove: pushPlayer }); else policy.think(c);
  }, (_a, c) => { if (policy === undefined) throw new Error('Missing policy'); if (policy instanceof BurstFlyerBrain) policy.act({ ...c, shove: pushPlayer }); else policy.act(c); });
  f.animal.position.set(7, 3, 0); setHome(f.animal, HOME);
  const pushes: object[] = [];
  policy = platform ? new BurstFlyerBrain(f.animal, SPEC, HOME, BURST) : new GaleWispBrain(f.animal);
  return { ...f, pushes, bindPush: () => { bindPlayerPush(velocity => { pushes.push({ frame: f.frame, velocity: velocity.toArray() }); }); }, get frame(): number { return f.frame; }, policy: () => {
    if (policy === undefined) throw new Error('Missing policy'); return policy;
  }, freshPolicy: () => { const next = new BurstFlyerBrain(f.animal, SPEC, HOME, BURST); policy = next; return next; } };
}
type Scenario = 'contact' | 'cover' | 'calm' | 'tokens' | 'escape' | 'elevation';
function drive(f: ReturnType<typeof fixture>, tick: number, scenario: Scenario): void {
  f.ctx.player.set(Math.sin(tick * 0.004) * 3, scenario === 'elevation' && tick > 3000 && tick < 6000 ? 5 : 0,
    scenario === 'escape' && tick > 1000 && tick < 4000 ? 90 : 2);
  f.ctx.reach = () => scenario !== 'cover' || tick < 3000 || tick >= 6000;
  f.ctx.claim = () => scenario !== 'tokens' || tick < 1000 || tick >= 4000;
  f.ctx.mayAttack = f.ctx.claim;
  f.ctx.calm = scenario === 'calm' && tick >= 3000 && tick < 6000;
  f.bindPush(); f.advance(1);
}
function replay(platform: boolean, scenario: Scenario): object {
  const f = fixture(platform), frames: object[] = [], phases = new Set<string>();
  for (let tick = 0; tick < 10000; tick++) {
    drive(f, tick, scenario); frames.push({ actor: f.animal.snapshot(), phase: f.policy().state }); phases.add(f.policy().state);
  }
  if (scenario === 'contact') {
    expect([...phases].sort()).toEqual(['dart', 'drift']); expect(f.starts.length).toBeGreaterThan(0);
  }
  return { frames, pushes: f.pushes, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('declared orbit and contact burst', () => {
  it.each(['contact', 'cover', 'calm', 'tokens', 'escape', 'elevation'] as const)('matches shipping flight and contact for 10,000 ticks: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it.each([800, 1400, 4000])('restores a fresh policy with the exact flight/strike suffix at tick %i', at => {
    const f = fixture(true), policy = f.policy();
    if (!(policy instanceof BurstFlyerBrain)) throw new Error('Expected platform policy');
    for (let tick = 0; tick < at; tick++) drive(f, tick, 'contact');
    const actor = f.animal.snapshot(), saved = policy.snapshot(), rng = f.ctx.rng.snapshot();
    const continueFor = (active: ReturnType<typeof fixture>, activePolicy: BurstFlyerBrain<Animal>): object => {
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
    expect(continueFor(restored, next)).toEqual(expected); expect(restored.hits).toEqual(f.hits); expect(restored.starts).toEqual(f.starts); expect(restored.pushes).toEqual(f.pushes);
  });
  it('rejects nonfinite admission and incompatible homes without changing continuation', () => {
    const f = fixture(true), policy = f.freshPolicy(), saved = policy.snapshot();
    expect(() => new BurstFlyerBrain(f.animal, { ...SPEC, dartSpeed: Infinity }, HOME, BURST)).toThrow('parameters');
    expect(() => new BurstFlyerBrain(f.animal, SPEC, { ...HOME, r: 13 }, BURST).restore(saved)).toThrow('Incompatible');
    expect(() => policy.restore(null)).toThrow('continuation'); expect(policy.snapshot()).toBe(saved);
  });
});
