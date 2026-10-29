import { expect, test } from 'vitest';
import { cascadeRedraws, stillRedraws } from './shadowCadence';

test('BA-3: the near cascade every frame, the middle every 2nd, the far every 4th, never both', () => {
  const ticks = [0, 1, 2, 3].map(tick => cascadeRedraws(tick, 3));
  expect(ticks).toEqual([[true, false, true], [true, true, false], [true, false, false], [true, true, false]]);
  const maps = ticks.map(row => row.filter(Boolean).length);
  expect(maps.reduce((a, b) => a + b) / 4).toBe(1.75); expect(Math.max(...maps)).toBe(2);
  expect(cascadeRedraws(3, 2)).toEqual([true, false]); expect(cascadeRedraws(5, 1)).toEqual([true]);
});

test('FC13: a still view halves the cadence again, one map a frame at most, every cascade still refreshed', () => {
  const ticks = Array.from({ length: 8 }, (_, tick) => stillRedraws(tick, 3));
  expect(ticks.map((maps) => maps.filter(Boolean).length).every((n) => n <= 1)).toBe(true);
  const per = [0, 1, 2].map((i) => ticks.filter((maps) => maps[i] === true).length);
  expect(per).toEqual([4, 2, 1]); // near every 2nd, middle every 4th, far every 8th: 0.875 maps a frame
  expect(stillRedraws(0, 1)).toEqual([true]);
  // the moving cadence reads the same 8-step counter (skyRig counts to 8 now)
  const moving = Array.from({ length: 8 }, (_, tick) => cascadeRedraws(tick, 3));
  expect(moving.map((maps) => maps.filter(Boolean).length).reduce((a, b) => a + b, 0) / 8).toBe(1.75);
});
