import { expect, test } from 'vitest';
import { cascadeRedraws } from './shadowCadence';

const maps = (cadence: 'alternate' | 'staggered'): number[] => [0, 1, 2, 3].map(tick => cascadeRedraws(cadence, tick, 3).filter(Boolean).length);

test('BA-3: E189 redraws the far cascade every 2nd frame (2.5 maps a frame)', () => {
  expect([0, 1, 2, 3].map(tick => cascadeRedraws('alternate', tick, 3))).toEqual([[true, true, true], [true, true, false], [true, true, true], [true, true, false]]);
  expect(maps('alternate').reduce((a, b) => a + b) / 4).toBe(2.5);
});

test('BA-3: the staggered cadence keeps the near one every frame, the middle every 2nd, the far every 4th', () => {
  expect([0, 1, 2, 3].map(tick => cascadeRedraws('staggered', tick, 3))).toEqual([[true, false, true], [true, true, false], [true, false, false], [true, true, false]]);
  expect(maps('staggered').reduce((a, b) => a + b) / 4).toBe(1.75);
  expect(Math.max(...maps('staggered'))).toBe(2);
  expect(cascadeRedraws('staggered', 3, 2)).toEqual([true, false]);
});
