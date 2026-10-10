import { expect, it } from 'vitest';
import { cadenceWithinQuantum, observedTimestampQuantum } from '../scripts/sf22-cadence.mjs';

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
