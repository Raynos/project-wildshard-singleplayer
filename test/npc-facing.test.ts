import { expect, test } from 'vitest';
import { stepNpcFacing } from '../src/game/plugin/animation';
import { CASTAWAY_FACING, TRADER_FACING } from '../src/shards/driftwood-isle/data/npcFocus';

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
test('both native NPC profiles retain the wrapped target, exponential response and angular speed cap', () => {
  for (const profile of [CASTAWAY_FACING, TRADER_FACING]) {
    for (const [current, target, dt] of [[0, 3, .1], [3.1, -3.1, .016], [-3.1, 3.1, .3], [2, 0, 0], [1, -7, .5]]) {
      if (current === undefined || target === undefined || dt === undefined) throw new Error('Missing facing case');
      const change = wrap(wrap(target) - current) * (1 - Math.exp(-3 * dt));
      const expected = wrap(current + Math.max(-2.2 * dt, Math.min(2.2 * dt, change)));
      expect(stepNpcFacing(current, target, profile, dt)).toBe(expected);
    }
  }
});

test('uncapped unwrapped yaw preserves the existing W3 figure law across repeated revolutions', () => {
  const current = 5 * Math.PI, target = -.4, dt = .2;
  const expected = current + wrap(target - current) * (1 - Math.exp(-2.5 * dt));
  expect(stepNpcFacing(current, target, { rate: 2.5 }, dt)).toBe(expected);
  expect(stepNpcFacing(current, target, { rate: 2.5 }, dt)).toBeGreaterThan(Math.PI);
  expect(stepNpcFacing(0, 2, { rate: 5, maxSpeed: 0 }, dt)).toBe(0);
  expect(Math.abs(stepNpcFacing(current, target, { rate: 2.5, wrapOutput: true }, dt))).toBeLessThanOrEqual(Math.PI);
});

test('invalid native clocks and angular coefficients refuse', () => {
  expect(() => stepNpcFacing(0, 1, { rate: 3 }, Number.NaN)).toThrow('Invalid NPC facing frame');
  expect(() => stepNpcFacing(0, 1, { rate: 3, maxSpeed: -1 }, .1)).toThrow('Invalid NPC facing frame');
  expect(() => stepNpcFacing(0, 1, { rate: Number.POSITIVE_INFINITY }, .1)).toThrow('Invalid NPC facing frame');
});
