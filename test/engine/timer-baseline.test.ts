import { expect, it } from 'vitest';
import { ExternalTimerBaseline } from '#engine/debug/timerBaseline';

it('counts only still-live pre-engine shell timers and never hides new or registered timers', () => {
  const baseline = new ExternalTimerBaseline({ timeouts: [1, 2], intervals: [3, 4] }, { timeouts: [2], intervals: [4] });
  expect(baseline.live({ timeouts: [1, 2], intervals: [3, 4] })).toEqual({ timeouts: 1, intervals: 1 });
  expect(baseline.live({ timeouts: [2, 5], intervals: [4, 6] })).toEqual({ timeouts: 0, intervals: 0 });
  expect(baseline.live({ timeouts: [], intervals: [] })).toEqual({ timeouts: 0, intervals: 0 });
});
