import { expect, test } from 'vitest';
import { boxDesc as nativeBox } from '@wildshard/engine/world/registry';
import { boxDesc, type BoxSpec, type ContactSurface } from './placement';

const rows: readonly BoxSpec[] = [
  { x: 0, z: 0, hw: 2, hd: 3, rot: 0, yBottom: -1, yTop: 5 },
  { x: -3.5, z: 7.25, hw: 0.18, hd: 9, rot: Math.PI / 3, yBottom: 2, yTop: 2 },
  { x: 8, z: -2, hw: 1, hd: 2, rot: -Math.PI / 2, yBottom: 7, yTop: -3 },
];
const surfaces: readonly (ContactSurface | undefined)[] = [undefined, 'stone', 'wood', 'wetSand'];

test.each(rows)('authored box %j retains every native field, signed yaw, clamped height and JSON order', row => {
  for (const surface of surfaces) {
    const actual = boxDesc(row, surface), original = nativeBox(row, surface);
    expect(actual).toEqual(original);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(original));
    expect(Object.hasOwn(actual, 'surface')).toBe(surface !== undefined);
  }
});
