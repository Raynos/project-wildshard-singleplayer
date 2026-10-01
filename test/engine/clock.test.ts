import { describe, expect, it } from 'vitest';
import { GameClock } from '#engine/index';

describe('game clock', () => {
  it('advances live wall and game seconds, excluding pauses and slowing simulation with hit-stop', () => {
    const clock = new GameClock();
    expect([clock.now, clock.real, clock.frame, clock.mode]).toEqual([0, 0, 0, 'live']);
    expect(clock.tick(0.5)).toBe(0.5);
    clock.paused = true;
    clock.tick(2);
    clock.paused = false;
    clock.timeScale = 0.25;
    clock.tick(2);
    expect(clock.now).toBe(1);
    expect(clock.real).toBe(4.5);
    expect(clock.frame).toBe(3);
  });

  it('advances by 1/fps in capture regardless of render time, then returns to live deltas', () => {
    const fast = new GameClock(), slow = new GameClock();
    fast.setCapture(60); slow.setCapture(60);
    for (let i = 0; i < 120; i++) {
      expect(fast.tick(0.001)).toBe(1 / 60);
      expect(slow.tick(3)).toBe(1 / 60);
    }
    expect(fast.now).toBe(slow.now);
    expect(fast.real).toBe(slow.real);
    expect(fast.now).toBeCloseTo(2, 12);
    expect(fast.frame).toBe(120);
    expect(fast.mode).toBe('capture');
    fast.setCapture(null);
    const before = fast.now;
    fast.tick(0.5);
    expect(fast.now).toBe(before + 0.5);
    expect(fast.mode).toBe('live');
  });

  it('rejects invalid deltas, capture rates, and scales without changing state', () => {
    const clock = new GameClock();
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => clock.tick(value)).toThrow(RangeError);
      expect(() => { clock.timeScale = value; }).toThrow(RangeError);
      expect(() => clock.setCapture(value)).toThrow(RangeError);
    }
    expect(() => clock.setCapture(0)).toThrow(RangeError);
    expect(clock.frame).toBe(0);
    expect(clock.timeScale).toBe(1);
    clock.timeScale = 0;
    clock.tick(1);
    expect(clock.now).toBe(0);
    expect(clock.real).toBe(1);
  });
});
