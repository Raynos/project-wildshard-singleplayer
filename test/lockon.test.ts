import { describe, expect, it } from 'vitest';
import { FlickTracker, LOCK, lockScore, pickSwitch, wrapAngle } from '../src/player/LockOnTarget';

const DEG = Math.PI / 180;

describe('lock-on scoring (E50 §2.2)', () => {
  it('prefers the enemy nearest the screen centre over a closer one off to the side', () => {
    expect(lockScore(5 * DEG, 10, false)).toBeLessThan(lockScore(30 * DEG, 3, false));
  });
  it('breaks a tie on distance, and a wind-up wins a near tie', () => {
    expect(lockScore(10 * DEG, 4, false)).toBeLessThan(lockScore(10 * DEG, 8, false));
    expect(lockScore(10 * DEG, 6, true)).toBeLessThan(lockScore(10 * DEG, 5, false));
  });
  it('keeps the acquire / break ratio at OoT\'s 1.5', () => {
    expect(LOCK.BREAK / LOCK.ACQUIRE).toBeCloseTo(1.5);
  });
});

describe('flick switch target (E50 §2.5)', () => {
  const cur = { yaw: 0, pitch: 0 };
  const row = [
    { t: 'far-left', yaw: 40 * DEG, pitch: 0 },
    { t: 'near-left', yaw: 15 * DEG, pitch: 0 },
    { t: 'right', yaw: -20 * DEG, pitch: 0 },
    { t: 'up', yaw: 2 * DEG, pitch: 25 * DEG },
  ];
  it('left takes the next target on the left — larger yaw — nearest first, so repeated flicks walk the row', () => {
    expect(pickSwitch('left', cur, row)).toBe('near-left');
    expect(pickSwitch('left', { yaw: 15 * DEG, pitch: 0 }, row)).toBe('far-left');
  });
  it('right takes the next target on the right', () => {
    expect(pickSwitch('right', cur, row)).toBe('right');
  });
  it('up / down read the pitch (flyers); nothing that way → null', () => {
    expect(pickSwitch('up', cur, row)).toBe('up');
    expect(pickSwitch('down', cur, row)).toBeNull();
    expect(pickSwitch('right', { yaw: -20 * DEG, pitch: 0 }, row)).toBeNull();
  });
  it('wraps bearings across ±π', () => {
    expect(wrapAngle(350 * DEG)).toBeCloseTo(-10 * DEG);
    expect(pickSwitch('left', { yaw: 175 * DEG, pitch: 0 }, [{ t: 'across', yaw: -175 * DEG, pitch: 0 }])).toBe('across');
  });
});

describe('the flick classifier (E50 §2.5)', () => {
  it('a fast short swipe is a flick in the direction a look drag turns', () => {
    const f = new FlickTracker();
    f.begin(100, 100, 0);
    expect(f.move(115, 100, 16)).toBeNull(); // 15 px: not yet far enough
    expect(f.move(140, 101, 40)).toBe('right');
    expect(f.move(180, 101, 60)).toBeNull(); // one flick per touch
  });
  it('a slow drag is the glance, never a flick', () => {
    const f = new FlickTracker();
    f.begin(100, 100, 0);
    let got = null;
    for (let t = 16; t <= 400; t += 16) got ??= f.move(100 - t * 0.2, 100, t); // 200 px/s
    expect(got).toBeNull();
  });
  it('late fast motion (after 200 ms) does not count', () => {
    const f = new FlickTracker();
    f.begin(100, 100, 0);
    expect(f.move(100, 100, 250)).toBeNull();
    expect(f.move(160, 100, 270)).toBeNull();
  });
  it('vertical flicks: up the screen = up', () => {
    const f = new FlickTracker();
    f.begin(100, 200, 0);
    expect(f.move(101, 160, 40)).toBe('up');
  });
});
