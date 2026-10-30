import { expect, test } from 'vitest';
import { skyWorldRows } from '../src/shards/far-reach/generators/worldRows';

test('world source row loans cannot mutate subsequent map reads', () => {
  const rows = skyWorldRows(), first = Object.values(rows.bakes)[0];
  const before = JSON.stringify(rows);
  if (first === undefined) throw new Error('Missing original baked rows');
  Reflect.set(first.kinds, 'length', 0); Reflect.set(rows.pieces, 'length', 0);
  expect(JSON.stringify(skyWorldRows())).toBe(before);
});
