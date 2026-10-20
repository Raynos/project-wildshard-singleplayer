import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SceneDressingContactsSchema } from '../src/format/sceneDressing';
import { readColliderRows } from '../src/engine/models/colliders';

test('dressing preserves stair contacts accepted by the engine', () => {
  const stair = { kind: 'treads', from: { x: 0, y: 0, z: 0 }, to: { x: 2, y: 1, z: 0 }, width: 2, count: 4, surface: 'stone' };
  const rows = v.parse(SceneDressingContactsSchema, [stair]);
  expect(readColliderRows(rows, { kinds: ['treads'], surfaces: ['stone'] })).toEqual([stair]);
  for (const malformed of [{ ...stair, count: 0 }, { ...stair, count: 1.5 }, { ...stair, to: { x: 2, z: 0 } }, { ...stair, width: Infinity }]) {
    expect(() => v.parse(SceneDressingContactsSchema, [malformed])).toThrow();
  }
});
