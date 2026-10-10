import { admitSpeciesBrains } from '../../src/game/shardfile/speciesBrains';
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
function replay(platform: boolean, scenario: 'hold' | 'cover' | 'tokens'): object {
  let brain: GuardianBrain<Animal> | undefined;
  const f = creature('sailor', 'sailor', {}, undefined, platform ? (actor, ctx) => {
    if (brain === undefined) { const decision = catalogue.decision('sailor', actor);
      if (decision.archetype !== 'guardian') throw new Error('Wrong species decision'); brain = decision.policy; } brain.think(ctx);
  } : undefined);
  f.ctx.rng = new Rng(357);
  const splashes: { frame: number; strength: number }[] = [];
  f.ctx.world = { hold: { x: 0, z: 0, r: 8, guardR: 9, floorAt: () => 1.5 },
    splash: (_at, strength) => { splashes.push({ frame: f.frame, strength }); } };
  const frames: ReturnType<Animal['snapshot']>[] = [];
  for (let tick = 0; tick < 10000; tick++) {
    f.ctx.player.set(0, 0, tick < 1000 || tick >= 6000 ? 30 : 1.6);
    if (scenario === 'cover') f.ctx.reach = () => f.frame < 2000 || f.frame >= 4000;
    if (scenario === 'tokens') { f.ctx.mayAttack = () => f.frame < 2000 || f.frame >= 4000; f.ctx.claim = f.ctx.mayAttack; }
    if (tick === 1500) f.animal.lastHitT = tick / 60;
    f.advance(1); frames.push(f.animal.snapshot());
  }
  return { frames, splashes, hits: f.hits, sounds: f.sounds, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('data-selected interior guardian', () => {
  it.each(['hold', 'cover', 'tokens'] as const)('matches shipping decisions plus the real native rise/sink recipe for 10,000 frames: %s', scenario => {
    expect(replay(true, scenario)).toEqual(replay(false, scenario));
  });
  it('rejects invalid tuning and incompatible continuations', () => {
    const f = creature('sailor', 'sailor');
    expect(() => new GuardianBrain(f.animal, { ...SAILOR_BRAIN, speed: Infinity })).toThrow('parameters');
    const brain = new GuardianBrain(f.animal, SAILOR_BRAIN);
    expect(() => new GuardianBrain(f.animal, { ...SAILOR_BRAIN, speed: 2 }).restore(brain.snapshot())).toThrow('Incompatible');
  });
});
