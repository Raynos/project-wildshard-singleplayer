import { afterAll, describe, expect, it } from 'vitest';
import { PackBrain } from '../../../src/engine/ai/pack';
import { HerdBrain } from '../../../src/engine/ai/herd';
import { app } from '../../../src/engine/app/runtime';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { Pack, HorseHerd } from '../../../src/shards/nalati-grasslands/runtime/groupRegistry';
import { packForThink, herdForThink, thinkHorse } from '../../../src/shards/nalati-grasslands/runtime/groupDispatch';
import { Pack as ShippingPack } from '../../fixtures/nalati-group-oracle/pack';
import { HorseHerd as ShippingHorseHerd } from '../../fixtures/nalati-group-oracle/herd';
import { manager } from '../../fake/manager';
import { creature } from '../../fake/creature';

const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(terrain);
function fixture(kind: 'wolf' | 'horse'): { members: ReturnType<typeof manager>['manager']['animals']; context: ReturnType<typeof creature>['ctx'] } {
  app.rng.seed(357);
  const world = manager(), context = creature('crab', 'small').ctx;
  const members = [kind === 'wolf' ? 'alpha' : 'stallion', kind === 'wolf' ? 'grey' : 'bay', kind === 'wolf' ? 'scout' : 'foal-bay']
    .map((variant, i) => world.manager.spawn(kind, 10 + i * 3, -5 + i * 2, 0, variant));
  context.herd = members;
  return { members, context };
}
describe('Nalati declared fallback factories', () => {
  it('matches shipping pack fallback roster, averaged home, member setup and RNG exactly once', () => {
    const shipping = fixture('wolf'), first = shipping.members[0]; if (first === undefined) throw new Error('Missing wolf');
    const legacy = ShippingPack.forThink(first, shipping.context); if (legacy === null) throw new Error('Missing oracle');
    const expected = { memory: shipping.members.map(actor => Object.fromEntries(Object.entries(actor.mem))), rng: app.rng.snapshot(), home: [legacy.homeX, legacy.homeZ] };
    const current = fixture('wolf'), wolf = current.members[0]; if (wolf === undefined) throw new Error('Missing wolf');
    const policy = packForThink(wolf, current.context); if (!(policy instanceof PackBrain)) throw new Error('Missing declared fallback');
    expect({ memory: current.members.map(actor => Object.fromEntries(Object.entries(actor.mem))), rng: app.rng.snapshot(), home: [policy.homeX, policy.homeZ] }).toEqual(expected);
    const random = app.rng.snapshot();
    for (const actor of current.members) expect(packForThink(actor, current.context)).toBe(policy);
    for (const actor of current.members) expect(Pack.of(actor)).toBe(policy); expect(app.rng.snapshot()).toEqual(random);
    const prey = current.members[1]; if (prey === undefined) throw new Error('Missing actor prey');
    expect(policy.raid(prey)).toBe(true); const saved = policy.snapshot(); policy.restore(saved);
    expect(policy.snapshot()).toBe(saved); expect(app.rng.snapshot()).toEqual(random);
  });
  it('matches shipping herd fallback setup and RNG once, retaining the mount registry', () => {
    const shipping = fixture('horse'), first = shipping.members[0]; if (first === undefined) throw new Error('Missing horse');
    const legacy = ShippingHorseHerd.forThink(first, shipping.context); if (legacy === null) throw new Error('Missing oracle');
    const expected = { memory: shipping.members.map(actor => Object.fromEntries(Object.entries(actor.mem))), rng: app.rng.snapshot(), centre: [legacy.cx, legacy.cz] };
    const current = fixture('horse'), horse = current.members[0]; if (horse === undefined) throw new Error('Missing horse');
    const policy = herdForThink(horse, current.context); if (!(policy instanceof HerdBrain)) throw new Error('Missing declared fallback');
    expect({ memory: current.members.map(actor => Object.fromEntries(Object.entries(actor.mem))), rng: app.rng.snapshot(), centre: [policy.cx, policy.cz] }).toEqual(expected);
    const random = app.rng.snapshot();
    for (const actor of current.members) expect(herdForThink(actor, current.context)).toBe(policy);
    for (const actor of current.members) expect(HorseHerd.of(actor)).toBe(policy); expect(app.rng.snapshot()).toEqual(random);
    const saved = policy.snapshot(); policy.restore(saved); expect(policy.snapshot()).toBe(saved); expect(app.rng.snapshot()).toEqual(random);
  });
  it('does no setup for an owned horse or an animal outside a herd', () => {
    const { members, context } = fixture('horse'), horse = members[0]; if (horse === undefined) throw new Error('Missing horse');
    const before = app.rng.snapshot(); horse.mem['owned'] = 1; thinkHorse(horse, context);
    expect(HorseHerd.of(horse)).toBeNull(); expect(app.rng.snapshot()).toEqual(before);
    context.herd = null; expect(herdForThink(horse, context)).toBeNull(); expect(packForThink(horse, context)).toBeNull();
    expect(app.rng.snapshot()).toEqual(before);
  });
});
