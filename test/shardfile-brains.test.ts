import { describe, expect, it } from 'vitest';
import { parseSkirmisher } from '../src/game/shardfile/brains';
import { CRAB_BRAIN } from '../src/shards/driftwood-isle/data/brains';

describe('declared skirmisher admission', () => {
  it('admits the unchanged shipping crab parameters', () => {
    expect(parseSkirmisher(CRAB_BRAIN)).toEqual(CRAB_BRAIN);
  });
  it.each([
    { attackDuration: 0 }, { fleeSpeed: 16 }, { attackRadius: 10 },
    { shyRadius: 10 }, { disengageRadius: 8 }, { alertCooldown: Number.NaN },
    { noticeCue: '' }, { runtime: 'author-selected-code' },
  ])('rejects invalid or undeclared policy fields: %j', (invalid) => {
    expect(() => parseSkirmisher({ ...CRAB_BRAIN, ...invalid })).toThrow();
  });
});
