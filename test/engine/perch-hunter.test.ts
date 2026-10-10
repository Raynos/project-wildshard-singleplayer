import { admitSpeciesBrains } from '../../src/game/shardfile/speciesBrains';
import { afterAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PerchHunterBrain } from '../../src/engine/ai/perchHunter';
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
function replay(platform: boolean, scenario: 'ground' | 'perch' | 'flee' | 'tokens'): object {
  const beforeRandom = app.rng.snapshot(); app.rng.seed(357);
  let brain: PerchHunterBrain<Animal> | undefined;
  const f = creature('monkey', 'monkey', {}, undefined, platform ? (actor, ctx) => {
    if (brain === undefined) { const decision = catalogue.decision('monkey', actor);
      if (decision.archetype !== 'perch-hunter') throw new Error('Wrong species decision'); brain = decision.policy; }
    brain.think({ ...ctx, attackRandom: { range: (min, max) => app.rng.stream('ai').range(min, max) },
      pickPerch: (a, min, max, away) => pickPerch(a, ctx, min, max, away), setPerch: (a, index) => { setPerch(a, ctx, index); } });
  } : undefined);
  f.ctx.rng = new Rng(357);
  const throws: { frame: number; from: number[]; target: number[] }[] = [];
  f.ctx.world = { ...(scenario === 'ground' ? {} : {
    perches: [new Vector3(0, 5, 0), new Vector3(20, 5, 0), new Vector3(35, 7, 0)],
    perchBases: [new Vector3(0, 0, 0), new Vector3(20, 0, 0), new Vector3(35, 0, 0)],
  }), throwCoconut: (from, target) => { throws.push({ frame: f.frame, from: from.toArray(), target: target.toArray() }); } };
  const mate = scenario === 'flee' ? creature('monkey', 'elder').animal : undefined;
  if (mate) f.ctx.herd = [f.animal, mate];
  const frames: ReturnType<Animal['snapshot']>[] = [];
  try {
    for (let tick = 0; tick < 10000; tick++) {
      f.ctx.player.set(0, 0, tick < 1000 ? 6 : tick < 3000 ? 1 : tick < 6000 ? 5 : 50);
      if (scenario === 'tokens') { f.ctx.mayAttack = () => f.frame < 1500 || f.frame >= 4000; f.ctx.claim = f.ctx.mayAttack; }
      if (mate && tick === 1700) mate.alive = false;
      if (tick === 3300) f.animal.lastHitT = tick / 60;
      f.advance(1);
      if (![...f.animal.position, f.animal.yaw, f.animal.desiredYaw].every(Number.isFinite)) throw new Error(`Nonfinite ${platform ? 'platform' : 'shipping'} motion at frame ${f.frame}`);
      frames.push(f.animal.snapshot());
    }
    return { frames, throws, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot(), sharedRandom: app.rng.snapshot() };
  } finally { app.rng.restore(beforeRandom); }
}
describe('data-selected perch hunter', () => {
  it.each(['ground', 'perch', 'flee', 'tokens'] as const)('matches shipping decisions, shared RNG and real drop/climb/projectile recipes for 10,000 frames: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it('rejects invalid tuning and fences policy continuations', () => {
    const f = creature('monkey', 'monkey');
    expect(() => new PerchHunterBrain(f.animal, { ...MONKEY_BRAIN, throwCooldownMin: 5 })).toThrow('parameters');
    const brain = new PerchHunterBrain(f.animal, MONKEY_BRAIN);
    expect(() => new PerchHunterBrain(f.animal, { ...MONKEY_BRAIN, runSpeed: 2 }).restore(brain.snapshot())).toThrow('Incompatible');
  });
});
