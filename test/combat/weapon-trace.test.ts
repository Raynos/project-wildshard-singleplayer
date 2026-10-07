import { expect, it } from 'vitest';
import { weaponTraceJson, weaponTraceSnapshot } from '../fake/weaponTrace';

it('ignores last-bit platform math differences in nested frame and recipe numbers', () => {
  expect(weaponTraceJson({ matrix: [Math.sin(0.7), -0], p: Math.PI }))
    .toBe(weaponTraceJson({ matrix: [Math.sin(0.7) + Number.EPSILON, 0], p: Math.PI - Number.EPSILON }));
  expect(weaponTraceSnapshot({ position: [-0.0758266766757564], tick: 600, hash: 4267661955, event: 'loose' }))
    .toEqual({ position: [-0.075827], tick: 600, hash: 4267661955, event: 'loose' });
});
it('retains meaningful transform changes and exact event ordering', () => {
  expect(weaponTraceJson([0.123456, 'draw', 'loose'])).not.toBe(weaponTraceJson([0.123458, 'draw', 'loose']));
  expect(weaponTraceJson([0.123456, 'draw', 'loose'])).not.toBe(weaponTraceJson([0.123456, 'loose', 'draw']));
});
