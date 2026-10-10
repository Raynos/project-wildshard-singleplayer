import { expect, it } from 'vitest';
import { cadenceWithinQuantum, observedTimestampQuantum, rafCadenceWithinQuantum } from '../scripts/sf22-cadence.mjs';

it('measures the observed clock step instead of assuming a tenth of a millisecond', () => {
  expect(observedTimestampQuantum([33.29999999998, 33.40000000002, 33.5, 33.4, 100])).toBe(0.1);
  expect(observedTimestampQuantum([33.33, 33.335, 33.34])).toBe(0.005);
  expect(observedTimestampQuantum([33.4, 33.4])).toBeNull();
  expect(observedTimestampQuantum([Number.NaN, Infinity, -1, 0])).toBeNull();
});

it('allows exactly one measured quantum against the same session standing ruler and retains the limit', () => {
  const quantum = observedTimestampQuantum([33.3, 33.4, 33.5]);
  expect(cadenceWithinQuantum(33.40000000002, [33.40000000002, 33.4], quantum)).toBe(true);
  expect(cadenceWithinQuantum(33.5, [33.4, 33.4], quantum)).toBe(true);
  expect(cadenceWithinQuantum(33.50001, [33.4, 33.4], quantum)).toBe(false);
  expect(cadenceWithinQuantum(33.5, [33.3, 33.4], quantum)).toBe(false);
  expect(cadenceWithinQuantum(33.6, [33.6], quantum)).toBe(false);
  expect(cadenceWithinQuantum(33.4, [], quantum)).toBe(false);
  expect(cadenceWithinQuantum(33.4, [33.4], null)).toBe(false);
});

it('grades delivered rAF timestamps rather than callback-start or polling jitter', () => {
  const standing = [{ rafDt: 33.4, missedFrames: 0, startedDt: 34.8, polledDt: 50 }];
  const crossing = [{ rafDt: 33.3, missedFrames: 0, startedDt: 34.3, polledDt: 46 }];
  expect(rafCadenceWithinQuantum(crossing, [standing], 0.1)).toBe(true);
  expect(rafCadenceWithinQuantum([{ ...crossing[0], rafDt: 33.6, missedFrames: 0 }], [standing], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([{ rafDt: 36, missedFrames: 0 }], [[{ rafDt: 34, missedFrames: 0 }]], 1)).toBe(false);
  expect(rafCadenceWithinQuantum(crossing, [[{ rafDt: 34.6, missedFrames: 0 }]], 0.1)).toBe(false);
});

it('refuses missing draw counters, missing timestamps and empty route or standing coverage', () => {
  const row = { rafDt: 33.4, missedFrames: 0 };
  expect(rafCadenceWithinQuantum([{ ...row, missedFrames: 1 }], [[row]], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([row], [[{ ...row, missedFrames: 1 }]], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([{ ...row, rafDt: Number.NaN }], [[row]], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([], [[row]], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([row], [[]], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([row], [], 0.1)).toBe(false);
  expect(rafCadenceWithinQuantum([row], [[row]], null)).toBe(false);
});
