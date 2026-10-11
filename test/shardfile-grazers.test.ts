import { describe, expect, it } from 'vitest';
import { parseRamGrazer, parseChallengeGrazer, parseGrazer, grazerPreset } from '@wildshard/format/grazers';

const ram = { id: 'fixture.ram', kind: 'ram-grazer', strike: 'fixture.ram.strike',
  grazeSpeed: 1.2, ramSpeed: 7.5, noticeRadius: 9, rimMargin: 2.5, fallDrop: 1.5,
  levelTolerance: 2.5, threatSpeed: 1.6, wanderMinSeconds: 2, wanderMaxSeconds: 5, rampRate: 4 };
describe('declared ram grazer data', () => {
  it('admits finite tuning and defaults to the shipping six-tick cadence', () => {
    expect(parseRamGrazer(ram)).toEqual({ ...ram, thinkDivisor: 6 });
  });
  it.each([{ ramSpeed: Infinity }, { grazeSpeed: 10.1 }, { wanderMinSeconds: 6 },
    { levelTolerance: 0 }, { thinkDivisor: 7 }, { strike: '../not-a-strike' }, { field: 1 }])('refuses invalid tuning or unknown fields: %j', patch => {
    expect(() => parseRamGrazer({ ...ram, ...patch })).toThrow();
  });
});
const challenge = { id: 'fixture.challenge', kind: 'challenge-grazer', charge: 'fixture.charge', close: 'fixture.horns',
  noticeRadius: 24, chargeRadius: 17, loseRadius: 40, walkSpeed: 1.1, approachSpeed: 2.4, homeRadius: 16, faceSeconds: 0.7,
  circleRate: 0.05, farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' };
describe('declared challenge grazer data', () => {
  it('admits finite utility and pose bindings with six-tick cadence', () => {
    expect(parseChallengeGrazer(challenge)).toEqual({ ...challenge, thinkDivisor: 6 });
  });
  it.each([{ walkSpeed: Infinity }, { noticeRadius: 41 }, { faceSeconds: 0 }, { close: challenge.charge },
    { recoveryField: challenge.windupField }, { thinkDivisor: 7 }, { field: 1 }])('refuses invalid or conflicting declarations: %j', patch => {
    expect(() => parseChallengeGrazer({ ...challenge, ...patch })).toThrow();
  });
});

describe('parametric grazer declaration', () => {
  it.each([[ram, 'wander-ram'], [challenge, 'circle-challenge']] as const)('canonicalizes each pattern to its exact legacy row', (preset, pattern) => {
    const row = parseGrazer({ ...preset, kind: 'grazer', pattern });
    expect(row.thinkDivisor).toBe(6);
    expect(grazerPreset(row)).toEqual({ ...preset, thinkDivisor: 6 });
  });
  it.each([{ pattern: 'herd' }, { ramSpeed: 16 }, { wanderMinSeconds: 6 }, { thinkDivisor: 7 }, { charge: 'wrong.pattern' }])('refuses unsupported patterns, excessive tuning and cross-pattern fields: %j', patch => {
    expect(() => parseGrazer({ ...ram, kind: 'grazer', pattern: 'wander-ram', ...patch })).toThrow();
  });
});
