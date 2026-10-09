import { describe, expect, it } from 'vitest';
import { clipHitReached, clipHitTime } from '../src/game/combat/clipTiming';

describe('authored clip contact clock', () => {
  it('lands on the first caller tick at the authored phase, including a restored clock', () => {
    const clip = { duration: 2, hitPhase: 0.75 };
    for (const hz of [15, 30, 60, 120, 144]) {
      let elapsed = 0;
      let contactTick: number | undefined;
      for (let tick = 0; tick < hz * 2; tick++) {
        const savedClock = JSON.stringify(elapsed);
        const restored: unknown = JSON.parse(savedClock);
        if (typeof restored !== 'number') throw new Error('Invalid fixture clock');
        expect(clipHitReached(restored, clip)).toBe(clipHitReached(elapsed, clip));
        if (clipHitReached(elapsed, clip)) { contactTick = tick; break; }
        elapsed += 1 / hz;
      }
      if (contactTick === undefined) throw new Error('Missing contact');
      // Floating-point accumulation may postpone a mathematically exact boundary by one tick.
      expect(contactTick / hz).toBeGreaterThanOrEqual(1.5);
      expect(contactTick / hz).toBeLessThanOrEqual(1.5 + 1 / hz);
    }
  });

  it('allows endpoint phases and refuses malformed authored data', () => {
    expect(clipHitTime({ duration: 2, hitPhase: 0 })).toBe(0);
    expect(clipHitTime({ duration: 2, hitPhase: 1 })).toBe(2);
    for (const invalid of [
      { duration: 0, hitPhase: 1 }, { duration: -1, hitPhase: 1 },
      { duration: Infinity, hitPhase: 1 }, { duration: Number.NaN, hitPhase: 1 },
      { duration: 1, hitPhase: -1 }, { duration: 1, hitPhase: 1.01 },
      { duration: 1, hitPhase: Infinity }, { duration: 1, hitPhase: Number.NaN },
    ]) expect(() => clipHitTime(invalid)).toThrow('Invalid authored clip timing');
  });
});
