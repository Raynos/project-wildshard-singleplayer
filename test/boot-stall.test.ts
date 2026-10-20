import { expect, it } from 'vitest';
import { LoadingStall } from '../src/engine/boot/stall';

it('shows a ten-second quiet interval and resets only for a new progress signature', () => {
  const stall = new LoadingStall(0);
  expect(stall.quietMs('file A:0', 0)).toBe(0);
  expect(stall.quietMs('file A:0', 9999)).toBe(9999);
  expect(stall.quietMs('file A:0', 10_000)).toBe(10_000);
  expect(stall.quietMs('file A:1024', 10_001)).toBe(0);
  expect(stall.quietMs('file A:1024', 11_001)).toBe(1000);
});
