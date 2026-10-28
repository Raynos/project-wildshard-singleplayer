import { expect, test } from 'vitest';
import { treadBoxes } from '@wildshard/engine/physics/pieces';
import type { ColliderDesc } from './placement';
import { treadBoxRows } from './contactRows';

test('authored stair contacts preserve every native word, ordering and surface', () => {
  for (const count of [0, 1, 3, 8, 2.5]) for (const surface of [undefined, 'stone', 'wood'] as const) {
    for (const end of [{ x: -12.5, y: 7, z: 45 }, { x: 0, y: -9, z: -0 }, { x: 40, y: -3, z: -8 }]) {
      const input: Extract<ColliderDesc, { kind: 'treads' }> = { kind: 'treads', from: { x: -0, y: -3, z: 0 },
        to: end, width: 1.75, count, ...(surface === undefined ? {} : { surface }) };
      const before = structuredClone(input), actual = treadBoxRows(input);
      expect(actual).toEqual(treadBoxes(input));
      expect(input).toEqual(before);
      expect(actual).not.toBe(treadBoxes(input));
    }
  }
});
