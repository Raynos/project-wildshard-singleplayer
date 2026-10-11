// oxlint-disable-next-line import/no-nodejs-modules -- Hash native policy traces against the captured shipping implementation.
import { createHash } from 'node:crypto';
import { GuardianPolicy } from '../../src/engine/ai/guardianPolicy';
import { CapturedPerchHunterBrain } from '../fixtures/guardian-oracle/perchHunter';
import { admitSpeciesBrains } from "../../src/game/plugin/brain";
import { afterAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PerchHunterBrain, type PerchHunterPorts } from '../../src/engine/ai/perchHunter';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { app } from '../../src/engine/app/runtime';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { Rng } from '../../src/engine/core/rng';
import { MONKEY_BRAIN } from '../../src/shards/driftwood-isle/data/brains';
import { pickPerch, setPerch } from '../../src/shards/driftwood-isle/species/monkeyPolicy';
import { creature } from '../fake/creature';

const restore = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0],
  waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restore);
const catalogue = admitSpeciesBrains([{ id: 'species.monkey', kind: 'monkey', label: 'monkey', variants: [],
  brain: { archetype: 'perch-hunter', data: MONKEY_BRAIN } }], []);
function replay(platform: boolean | 'parametric', scenario: 'ground' | 'perch' | 'flee' | 'tokens', restoreAt?: number): object {
  const beforeRandom = app.rng.snapshot(); app.rng.seed(357);
  let brain: PerchHunterBrain<Animal> | CapturedPerchHunterBrain<Animal> | GuardianPolicy<Animal> | undefined;
  const f = creature('monkey', 'monkey', {}, undefined, (actor, ctx) => {
    if (brain === undefined) {
      if (platform === false) brain = new CapturedPerchHunterBrain(actor, MONKEY_BRAIN);
      else if (platform === 'parametric') brain = new GuardianPolicy(actor, { pattern: 'perch', spec: MONKEY_BRAIN });
      else { const decision = catalogue.decision('monkey', actor);
        if (decision.archetype !== 'perch-hunter') throw new Error('Wrong species decision'); brain = decision.policy; }
    }
    const observation: PerchHunterPorts<Animal> = { ...ctx, attackRandom: { range: (min, max) => app.rng.stream('ai').range(min, max) },
      pickPerch: (a, min, max, away) => pickPerch(a, ctx, min, max, away), setPerch: (a, index) => { setPerch(a, ctx, index); } };
    if (brain instanceof GuardianPolicy) brain.think({ ...observation, pattern: 'perch' }); else brain.think(observation);
  });
  f.ctx.rng = new Rng(357);
  const throws: { frame: number; from: number[]; target: number[] }[] = [];
  f.ctx.world = { ...(scenario === 'ground' ? {} : {
    perches: [new Vector3(0, 5, 0), new Vector3(20, 5, 0), new Vector3(35, 7, 0)],
    perchBases: [new Vector3(0, 0, 0), new Vector3(20, 0, 0), new Vector3(35, 0, 0)],
  }), throwCoconut: (from, target) => { throws.push({ frame: f.frame, from: from.toArray(), target: target.toArray() }); } };
  const mate = scenario === 'flee' ? creature('monkey', 'elder').animal : undefined;
  if (mate) f.ctx.herd = [f.animal, mate];
  const trace = createHash('sha256');
  try {
    for (let tick = 0; tick < 10000; tick++) {
      f.ctx.player.set(0, 0, tick < 1000 ? 6 : tick < 3000 ? 1 : tick < 6000 ? 5 : 50);
      if (scenario === 'tokens') { f.ctx.mayAttack = () => f.frame < 1500 || f.frame >= 4000; f.ctx.claim = f.ctx.mayAttack; }
      if (mate && tick === 1700) mate.alive = false;
      if (tick === 3300) f.animal.lastHitT = tick / 60;
      if (tick === restoreAt) {
        if (brain === undefined) throw new Error('Missing guardian continuation');
        const saved = brain.snapshot(), actor = f.animal.snapshot(), rng = f.ctx.rng.snapshot();
        const shared = app.rng.snapshot();
        const counts = [f.hits.length, f.starts.length, f.sounds.length, throws.length];
        const next = new GuardianPolicy(f.animal, { pattern: 'perch', spec: MONKEY_BRAIN });
        next.restore(saved);
        expect(app.rng.snapshot()).toEqual(shared); expect(next.snapshot()).toBe(saved); expect(f.animal.snapshot()).toEqual(actor); expect(f.ctx.rng.snapshot()).toEqual(rng);
        expect([f.hits.length, f.starts.length, f.sounds.length, throws.length]).toEqual(counts);
        brain = next;
      }
      f.advance(1);
      if (![...f.animal.position, f.animal.yaw, f.animal.desiredYaw].every(Number.isFinite)) throw new Error(`Nonfinite ${platform === false ? 'shipping' : 'platform'} motion at frame ${f.frame}`);
      trace.update(JSON.stringify(f.animal.snapshot()));
    }
    return { framesHash: trace.digest('hex'), throws, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot(), sharedRandom: app.rng.snapshot() };
  } finally { app.rng.restore(beforeRandom); }
}
describe('data-selected perch hunter', () => {
  it.each(['ground', 'perch', 'flee', 'tokens'] as const)('matches shipping decisions, shared RNG and real drop/climb/projectile recipes for 10,000 frames: %s', scenario => {
    const expected = replay(false, scenario);
    expect(replay(true, scenario)).toEqual(expected); expect(replay('parametric', scenario)).toEqual(expected);
  });
  it.each([1700,3400,6100])('accepts a shipping continuation in a fresh parametric policy without effects at tick %i', at => {
    expect(replay(false, 'flee', at)).toEqual(replay(false, 'flee'));
  });
  it('rejects invalid tuning and fences policy continuations', () => {
    const f = creature('monkey', 'monkey');
    expect(() => new PerchHunterBrain(f.animal, { ...MONKEY_BRAIN, throwCooldownMin: 5 })).toThrow('parameters');
    const brain = new PerchHunterBrain(f.animal, MONKEY_BRAIN);
    expect(() => new PerchHunterBrain(f.animal, { ...MONKEY_BRAIN, runSpeed: 2 }).restore(brain.snapshot())).toThrow('Incompatible');
  });
});
