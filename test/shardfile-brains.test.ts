import { guardianPattern } from '@wildshard/sdk/brains';
import { describe, expect, it } from 'vitest';
import { parseGuardianPattern, guardianPreset, parseSkirmisher, parseScriptBrain, parseGuardian, parsePerchHunter } from '@wildshard/format/brains';
import { CRAB_BRAIN, SAILOR_BRAIN, MONKEY_BRAIN } from '../src/shards/driftwood-isle/data/brains';

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

it('admits native guardian/perch policies and rejects invalid authored ranges', () => {
  expect(parseGuardian(SAILOR_BRAIN)).toEqual(SAILOR_BRAIN);
  expect(parsePerchHunter(MONKEY_BRAIN)).toEqual(MONKEY_BRAIN);
  expect(() => parseGuardian({ ...SAILOR_BRAIN, hideOffset: -16 })).toThrow();
  expect(() => parseGuardian({ ...SAILOR_BRAIN, swingDuration: 0 })).toThrow();
  expect(() => parsePerchHunter({ ...MONKEY_BRAIN, throwCooldownMin: 5 })).toThrow();
  expect(() => parsePerchHunter({ ...MONKEY_BRAIN, runSpeed: Infinity })).toThrow();
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

describe('parametric guardian admission', () => {
  it.each([[SAILOR_BRAIN, 'interior'], [MONKEY_BRAIN, 'perch']] as const)('keeps legacy defaults and canonical save-key order: %s', (preset, pattern) => {
    const row = parseGuardianPattern({ ...preset, kind: 'guardian', pattern });
    expect(guardianPattern(row)).toEqual(row);
    const expected = preset.kind === 'guardian' ? parseGuardian(preset) : parsePerchHunter(preset);
    expect(JSON.stringify(guardianPreset(row))).toBe(JSON.stringify(expected));
  });
  it.each([{ pattern: 'invented' }, { swingDuration: 0 }, { wakeRadius: 10 }, { thinkDivisor: 7 },
    { throwRadius: 14 }, { author: 'runtime.ts' }])('refuses invalid and cross-pattern home fields: %j', patch => {
    expect(() => parseGuardianPattern({ ...SAILOR_BRAIN, pattern: 'interior', ...patch })).toThrow();
  });
  it.each([{ runSpeed: 16 }, { throwCooldownMin: 5 }, { biteRadius: 15 }, { swingRadius: 1.8 }, { throwDuration: Number.NaN }])('refuses invalid and cross-pattern perch fields: %j', patch => {
    expect(() => parseGuardianPattern({ ...MONKEY_BRAIN, kind: 'guardian', pattern: 'perch', ...patch })).toThrow();
  });
});
