import { describe, expect, it } from 'vitest';
import { parseRamGrazer } from '../src/game/shardfile/grazers';

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
