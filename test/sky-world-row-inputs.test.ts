import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyWorldRows } from '../src/shards/far-reach/generators/worldRows';


test('the owned world reader preserves every original baked paint, piece and collider row', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`);
  expect(bytes.byteLength).toBe(65_347);
  expect(hashImmutableBytes(bytes)).toBe('3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d');
});

test('world publication is retired and its retained map reader declares source-owned rows', () => {
  const rows = skyWorldRows(), first = Object.values(rows.bakes)[0];
  if (first === undefined) throw new Error('Missing original baked rows');
  Reflect.set(first.kinds, 'length', 0); Reflect.set(rows.pieces, 'length', 0);
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(skyWorldRows())}\n`))).toBe('3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d');
});
