import { describe, expect, it } from 'vitest';
import { clipHitReached, clipHitTime } from '../../../src/game/combat/clipTiming';
import { KING_ATTACK_TIMING } from '../../../src/shards/pine-hollow/combat/kingTiming';

describe('authored King contact clocks', () => {
  it('preserves the shipping contact tick at every caller cadence and across a saved elapsed clock', () => {
    for (const [clip, legacyDuration] of [[KING_ATTACK_TIMING.sweep, 0.9], [KING_ATTACK_TIMING.strike, 1], [KING_ATTACK_TIMING.roar, 1.6]] as const) {
      expect(clipHitTime(clip)).toBe(legacyDuration);
      for (const hz of [15, 30, 60, 120, 144]) {
        let elapsed = 0;
        for (let tick = 0; tick < hz * 3; tick++) {
          expect(clipHitReached(elapsed, clip)).toBe(elapsed >= legacyDuration);
          // A restored caller feeds the same scalar elapsed clock, without an animation mixer or render frame.
          const savedClock = JSON.stringify(elapsed);
          const restored: unknown = JSON.parse(savedClock);
          if (typeof restored !== 'number') throw new Error('Invalid fixture clock');
          expect(clipHitReached(restored, clip)).toBe(elapsed >= legacyDuration);
          elapsed += 1 / hz;
        }
      }
    }
  });

  it('uses authored normalized contacts and refuses invalid clip data', () => {
    const clip = { duration: 2, hitPhase: 0.75 };
    expect(clipHitReached(1.499, clip)).toBe(false);
    expect(clipHitReached(1.5, clip)).toBe(true);
    for (const invalid of [{ duration: 0, hitPhase: 1 }, { duration: Infinity, hitPhase: 1 }, { duration: 1, hitPhase: -1 }, { duration: 1, hitPhase: Number.NaN }]) {
      expect(() => clipHitTime(invalid)).toThrow('Invalid authored clip timing');
    }
  });
});
