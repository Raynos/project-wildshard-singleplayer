// oxlint-disable-next-line import/no-nodejs-modules -- Hash native policy traces against the captured shipping implementation.
import { createHash } from 'node:crypto';
import { GuardianPolicy } from '../../src/engine/ai/guardianPolicy';
import { CapturedGuardianBrain } from '../fixtures/guardian-oracle/guardian';
import { admitSpeciesBrains } from "../../src/game/plugin/brain";
import { afterAll, describe, expect, it } from 'vitest';
import { GuardianBrain } from '../../src/engine/ai/guardian';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { Rng } from '../../src/engine/core/rng';
import { SAILOR_BRAIN } from '../../src/shards/driftwood-isle/data/brains';
import { creature } from '../fake/creature';

const restore = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restore);
const catalogue = admitSpeciesBrains([{ id: 'species.sailor', kind: 'sailor', label: 'sailor', variants: [],
  brain: { archetype: 'guardian', data: SAILOR_BRAIN } }], []);
function replay(platform: boolean | 'parametric', scenario: 'hold' | 'cover' | 'tokens', restoreAt?: number): object {
  let brain: GuardianBrain<Animal> | CapturedGuardianBrain<Animal> | GuardianPolicy<Animal> | undefined;
  const f = creature('sailor', 'sailor', {}, undefined, (actor, ctx) => {
    if (brain === undefined) {
      if (platform === false) brain = new CapturedGuardianBrain(actor, SAILOR_BRAIN);
      else if (platform === 'parametric') brain = new GuardianPolicy(actor, { pattern: 'interior', spec: SAILOR_BRAIN });
      else { const decision = catalogue.decision('sailor', actor);
        if (decision.archetype !== 'guardian') throw new Error('Wrong species decision'); brain = decision.policy; }
    }
    if (brain instanceof GuardianPolicy) brain.think({ ...ctx, pattern: 'interior' }); else brain.think(ctx);
  });
  f.ctx.rng = new Rng(357);
  const splashes: { frame: number; strength: number }[] = [];
  f.ctx.world = { hold: { x: 0, z: 0, r: 8, guardR: 9, floorAt: () => 1.5 },
    splash: (_at, strength) => { splashes.push({ frame: f.frame, strength }); } };
  const trace = createHash('sha256');
  for (let tick = 0; tick < 10000; tick++) {
    f.ctx.player.set(0, 0, tick < 1000 || tick >= 6000 ? 30 : 1.6);
    if (scenario === 'cover') f.ctx.reach = () => f.frame < 2000 || f.frame >= 4000;
    if (scenario === 'tokens') { f.ctx.mayAttack = () => f.frame < 2000 || f.frame >= 4000; f.ctx.claim = f.ctx.mayAttack; }
    if (tick === 1500) f.animal.lastHitT = tick / 60;
    if (tick === restoreAt) {
      if (brain === undefined) throw new Error('Missing guardian continuation');
      const saved = brain.snapshot(), actor = f.animal.snapshot(), rng = f.ctx.rng.snapshot();
      const counts = [f.hits.length, f.starts.length, f.sounds.length, splashes.length];
      const next = new GuardianPolicy(f.animal, { pattern: 'interior', spec: SAILOR_BRAIN });
      next.restore(saved);
      expect(next.snapshot()).toBe(saved); expect(f.animal.snapshot()).toEqual(actor); expect(f.ctx.rng.snapshot()).toEqual(rng);
      expect([f.hits.length, f.starts.length, f.sounds.length, splashes.length]).toEqual(counts);
      brain = next;
    }
    f.advance(1); trace.update(JSON.stringify(f.animal.snapshot()));
  }
  return { framesHash: trace.digest('hex'), splashes, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('data-selected interior guardian', () => {
  it.each(['hold', 'cover', 'tokens'] as const)('matches shipping decisions plus the real native rise/sink recipe for 10,000 frames: %s', scenario => {
    const expected = replay(false, scenario);
    expect(replay(true, scenario)).toEqual(expected); expect(replay('parametric', scenario)).toEqual(expected);
  });
  it.each([1700,3400,6100])('accepts a shipping continuation in a fresh parametric policy without effects at tick %i', at => {
    expect(replay(false, 'hold', at)).toEqual(replay(false, 'hold'));
  });
  it('refuses the other pattern and invalid steps before touching actor/RNG, while admitting zero interrupts', () => {
    const f = creature('sailor', 'sailor'), policy = new GuardianPolicy(f.animal, { pattern: 'interior', spec: SAILOR_BRAIN });
    const saved = policy.snapshot(), actor = f.animal.snapshot(), rng = f.ctx.rng.snapshot();
    expect(() => policy.think({ ...f.ctx, pattern: 'perch', attackRandom: f.ctx.rng,
      pickPerch: () => -1, setPerch: () => undefined })).toThrow('Incompatible guardian observation');
    for (const dt of [-1, Infinity, Number.NaN, 1.1]) expect(() => policy.think({ ...f.ctx, pattern: 'interior', dt })).toThrow('step');
    expect(() => policy.restore(null)).toThrow('continuation'); expect(policy.snapshot()).toBe(saved);
    expect(f.animal.snapshot()).toEqual(actor); expect(f.ctx.rng.snapshot()).toEqual(rng);
    expect(f.hits).toHaveLength(0); expect(f.starts).toHaveLength(0); expect(f.sounds).toHaveLength(0);
    expect(() => policy.think({ ...f.ctx, pattern: 'interior', dt: 0 })).not.toThrow();
  });
  it('rejects invalid tuning and incompatible continuations', () => {
    const f = creature('sailor', 'sailor');
    expect(() => new GuardianBrain(f.animal, { ...SAILOR_BRAIN, speed: Infinity })).toThrow('parameters');
    const brain = new GuardianBrain(f.animal, SAILOR_BRAIN);
    expect(() => new GuardianBrain(f.animal, { ...SAILOR_BRAIN, speed: 2 }).restore(brain.snapshot())).toThrow('Incompatible');
  });
});
