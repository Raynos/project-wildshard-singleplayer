// src/player/rideAssist.ts — NALATI-FINISH B1 (N13): the horse keeping to a road with the stick let go, and the rhythm spur.
import { describe, expect, it } from 'vitest';
import { RhythmSpur, roadSteer, SPUR_MAX_STREAK, SPUR_BOOST_PER, type RoadXZ } from '../src/player/rideAssist';

const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// a road north (+z) from the origin, then a bend east (−x is east in Nalati, it does not matter here: +x)
const ROAD: RoadXZ[] = [[0, 0], [0, 100], [60, 160]];

describe('roadSteer', () => {
  it('follows the road the way the horse faces, aimed down it', () => {
    const up = roadSteer([ROAD], 1, 20, 0, 10);
    expect(up).not.toBeNull();
    if (up === null) return;
    expect(Math.abs(angDiff(up.yaw, Math.atan2(-1, 10)))).toBeLessThan(0.02);   // back toward the centre line, 10 m on
    expect(up.off).toBeCloseTo(1, 5);
    const down = roadSteer([ROAD], 0, 50, Math.PI, 10);
    expect(down).not.toBeNull();
    if (down !== null) expect(Math.abs(angDiff(down.yaw, Math.PI))).toBeLessThan(0.01);
  });

  it('turns round a bend ahead', () => {
    const r = roadSteer([ROAD], 0, 95, 0, 14);
    expect(r).not.toBeNull();
    if (r !== null) expect(r.yaw).toBeGreaterThan(0.3);   // aimed round the bend toward +x
  });

  it('keeps to its road at a junction (the branch across the heading is skipped)', () => {
    const branch: RoadXZ[] = [[0, 50], [40, 52]];
    const r = roadSteer([branch, ROAD], 0.4, 50.3, 0, 10);
    expect(r).not.toBeNull();
    if (r !== null) expect(Math.abs(r.yaw)).toBeLessThan(0.1);
  });

  it('lets go off the road, across it, and at its end', () => {
    expect(roadSteer([ROAD], 12, 50, 0, 10)).toBeNull();               // 12 m off
    expect(roadSteer([ROAD], 0, 50, Math.PI / 2, 10)).toBeNull();      // heading across the road
    expect(roadSteer([ROAD], 0, 4, Math.PI, 10)).toBeNull();           // the road ends behind the look-ahead
    expect(roadSteer([], 0, 50, 0, 10)).toBeNull();
  });
});

describe('RhythmSpur', () => {
  const period = 0.45;
  it('taps on the beat build a streak that holds the gallop and adds speed', () => {
    const s = new RhythmSpur();
    let t = 0;
    for (let i = 0; i < 5; i++) { t += period; expect(s.tap(t, i % 2 === 0 ? 0.04 : 0.97, period)).toBe('good'); s.update(0.01); }
    expect(s.streak).toBe(SPUR_MAX_STREAK);
    expect(s.latched).toBe(true);
    expect(s.boost).toBeCloseTo(1 + SPUR_BOOST_PER * SPUR_MAX_STREAK, 6);
    s.update(period * 2);   // no tap for two strides: the latch runs out
    expect(s.latched).toBe(false);
    expect(s.streak).toBe(0);
    expect(s.boost).toBe(1);
  });

  it('an off-beat or mashed tap breaks the streak', () => {
    const s = new RhythmSpur();
    expect(s.tap(1, 0.02, period)).toBe('good');
    expect(s.tap(1 + period, 0.5, period)).toBe('off');
    expect(s.streak).toBe(0);
    expect(s.latched).toBe(false);
    expect(s.tap(2, 0.01, period)).toBe('good');
    expect(s.tap(2.05, 0.03, period)).toBe('early');   // 50 ms later: mashing
    expect(s.latched).toBe(false);
  });
});
