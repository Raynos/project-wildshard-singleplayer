import { describe, expect, it } from 'vitest';
import { fit, slope } from '#engine-internal/calibrate/math';

describe('calibration publication fit', () => {
  it('refuses flat and frame-paced series', () => {
    expect(() => fit([{ n: 8, ms: 12 }, { n: 32, ms: 12 }, { n: 64, ms: 12 }])).toThrow('unresolved');
    expect(() => fit([{ n: 8, ms: 13.4 }, { n: 32, ms: 12 }, { n: 64, ms: 12.5 }])).toThrow('unresolved');
    expect(() => fit([{ n: 8, ms: 12 }, { n: 32, ms: 13 }, { n: 64, ms: 12.5 }])).toThrow('unresolved');
  });
  it('accepts a linear cost and reports fit quality and fixed overhead', () => {
    const points = [64, 256, 1024].map((n) => ({ n, ms: 3 + 0.25 * n }));
    expect(fit(points)).toEqual({ slope: 0.25, intercept: 3, r2: 1 });
    expect(slope(points)).toBe(0.25);
  });
  it('refuses insufficient, invalid, duplicate and negative observations', () => {
    for (const points of [[], [{ n: 1, ms: 2 }], [{ n: 1, ms: 2 }, { n: 1, ms: 3 }], [{ n: 1, ms: Number.NaN }, { n: 2, ms: 4 }], [{ n: 1, ms: 4 }, { n: 2, ms: 2 }]]) expect(() => fit(points)).toThrow('unresolved');
  });
});
