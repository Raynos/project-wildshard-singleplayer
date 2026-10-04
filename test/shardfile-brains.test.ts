import { describe, expect, it } from 'vitest';
import { parseSkirmisher, parseScriptBrain } from '../src/game/shardfile/brains';
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

describe('declared custom brain admission', () => {
  const policy = { id: 'brain.fixture', kind: 'script', module: 'a'.repeat(64), thinkDivisor: 6,
    maxSpeed: 3, maxStrafe: 1, maxTurnRate: 6, parameters: [2], strikes: [{ event: 101, strike: 'boar.charge' }] };
  it('admits host-query policies without an author-selected actor handle', () => {
    expect(parseScriptBrain(policy)).toEqual(policy);
    expect(() => parseScriptBrain({ ...policy, entity: 7 })).toThrow();
  });
  it.each([{ thinkDivisor: 7 }, { maxSpeed: 16 }, { parameters: [Infinity] }, { module: 'runtime.ts' },
    { strikes: [{ event: 101, strike: 'a' }, { event: 101, strike: 'b' }] }])('rejects invalid policy declarations: %j', invalid => {
    expect(() => parseScriptBrain({ ...policy, ...invalid })).toThrow();
  });
});
