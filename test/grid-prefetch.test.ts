import { expect, test } from 'vitest';
import { gridPrefetchOrder } from '../src/game/grid/prefetch';

test('G554: the whole set is read nearest cell first, each product once', () => {
  const cell = (slug: string, x: number, z: number) => ({ instance: `${slug}@${x},${z}`, slug, cell: [x, z] as const, origin: { x: x * 555, y: 0, z: z * 555 } });
  const cells = [cell('far', 2, 2), cell('plot', 1, 0), cell('home', 0, 0), cell('plot', -1, 0), cell('next', 0, 1)];
  expect(gridPrefetchOrder({ cells }, { x: 10, z: -5 })).toEqual(['home', 'plot', 'next', 'far']);
});
