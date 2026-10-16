import { expect, test } from 'vitest';
import { floorAtRects, type FloorRect } from '../src/engine/physics/box';

test('deck floors preserve first/highest priority, inclusive edges and the authored inverse turn', () => {
  const floors: readonly FloorRect[] = [
    { x: 0, z: 0, hw: 2, hd: 1, y: 3, rot: 0 },
    { x: 0, z: 0, hw: 1, hd: 1, y: 7 },
    { x: 10, z: 5, hw: 2, hd: 0.5, y: 4, rot: Math.PI / 2 },
  ];
  expect(floorAtRects(floors, 0, 0, 'first')).toBe(3);
  expect(floorAtRects(floors, 0, 0, 'highest')).toBe(7);
  expect(floorAtRects(floors, 2, 1, 'highest')).toBe(3);
  expect(floorAtRects(floors, 2.01, 1, 'first')).toBeUndefined();
  expect(floorAtRects(floors, 10, 6, 'first')).toBe(4);
  expect(floorAtRects(floors, 11, 5, 'highest')).toBeUndefined();
  expect(floorAtRects([], 0, 0, 'first')).toBeUndefined();
});
