import { describe, expect, it } from 'vitest';
import { parseOrbitDiver, parsePatrolDiver, parseBurstFlyer } from '../src/game/shardfile/flyers';

const orbit = { id: 'fixture.orbit', kind: 'orbit-diver', strike: 'fixture.dive', home: { x: 0, z: 0, r: 12, y: 14 },
  circleSpeed: 8, hangAltitude: 9, stalkSpeed: 10, diveSpeed: 16, restSeconds: 6, noticeRadius: 40, giveUpRadius: 60,
  initialRestSeconds: 3, stalkMaxSeconds: 12, riseMargin: 2, targetHeight: 1.2, alignRadius: 3, alignTolerance: 1.6 };
const patrol = { id: 'fixture.patrol', kind: 'patrol-diver', strike: 'fixture.swoop', home: { x: 0, z: 0 },
  glideAltitude: 14, glideSpeed: 9, circleRadius: 20, patrolRadius: 34, patrolAltitude: 22, noticeRadius: 55,
  diveFrom: 38, diveSpeed: 15, climbAltitude: 17, climbSeconds: 2.6, diveMaxSeconds: 4.5, restSeconds: 3,
  targetHeight: 1.2, diveSlope: 0.35, climbSpeedBonus: 3, orbitLead: 0.55, heldField: 'held' };
const burst = { id: 'fixture.burst', kind: 'burst-flyer', strike: 'fixture.burst.strike', home: { x: 0, z: 0, r: 7, y: 3 },
  circleSpeed: 5, dartSpeed: 13, noticeRadius: 14, shoveSpeed: 7, liftSpeed: 2.5, targetHeight: 1.2 };
describe('declared flight families', () => {
  it('admits all shipping tuning with a six-tick observation cadence', () => {
    expect(parseOrbitDiver(orbit)).toEqual({ ...orbit, thinkDivisor: 6 });
    expect(parsePatrolDiver(patrol)).toEqual({ ...patrol, thinkDivisor: 6 });
    expect(parseBurstFlyer(burst)).toEqual({ ...burst, thinkDivisor: 6 });
  });
  it.each([{ circleSpeed: Infinity }, { diveSpeed: 31 }, { noticeRadius: 61 }, { stalkMaxSeconds: 0 },
    { home: { x: 0, z: 0, r: 0, y: 14 } }, { thinkDivisor: 7 }, { script: 'unbound' }])('refuses malformed orbit admission: %j', patch => {
    expect(() => parseOrbitDiver({ ...orbit, ...patch })).toThrow();
  });
  it.each([{ glideSpeed: Number.NaN }, { climbSpeedBonus: 22 }, { diveFrom: 56 }, { climbSeconds: 0 },
    { heldField: '../held' }, { home: { x: Infinity, z: 0 } }, { script: 'unbound' }])('refuses malformed patrol admission: %j', patch => {
    expect(() => parsePatrolDiver({ ...patrol, ...patch })).toThrow();
  });
  it.each([{ dartSpeed: Infinity }, { shoveSpeed: 31 }, { liftSpeed: -1 }, { home: { x: 0, z: 0, r: 7, y: Number.NaN } },
    { strike: '../burst' }, { thinkDivisor: 7 }, { script: 'unbound' }])('refuses malformed burst admission: %j', patch => {
    expect(() => parseBurstFlyer({ ...burst, ...patch })).toThrow();
  });
});
