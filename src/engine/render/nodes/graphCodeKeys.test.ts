import { expect, test } from 'vitest';
import { realGc } from '@wildshard/engine/test/realGc';
import { GraphCodeKeys } from './graphCodeKeys';

test('complete signatures share names while distinct and changed shapes stay distinct', () => {
  const keys = new GraphCodeKeys(), first = { signature: 'Aa' }, other = { signature: 'BB' };
  const original = keys.key(first);
  expect(keys.key({ signature: 'Aa' })).toBe(original);
  expect(keys.key(other)).not.toBe(original);
  expect(keys.key({ signature: 'Aa\u0000' })).not.toBe(original);
  first.signature = 'BB'; expect(keys.key(first)).toBe(keys.key(other));
  first.signature = 'Aa'; expect(keys.key(first)).toBe(original);
});

test('capacity saturation keeps every existing name and exact sharing stable', () => {
  for (const [chars, entries] of [[100, 1], [3, 100]] as const) {
    const keys = new GraphCodeKeys(chars, entries), a = { signature: 'aa' }, b = { signature: 'bb' };
    const first = keys.key(a), second = keys.key(b), renewed = keys.key({ signature: 'aa' });
    expect(new Set([first, second, renewed]).size).toBe(2);
    expect(renewed).toBe(first);
    expect(keys.key({signature: 'bb'})).toBe(second);
    expect(keys.key(a)).toBe(first); expect(keys.key(b)).toBe(second);
  }
});

test('oversized exact keys do not evict ordinary names or alias compact ones', () => {
  const keys = new GraphCodeKeys(5, 2), small = { signature: 'x' }, original = keys.key(small);
  const large = keys.key({ signature: 'long-shape' });
  expect(keys.key({ signature: 'long-shape' })).toBe(large);
  expect(keys.key({ signature: 'long-shapf' })).not.toBe(large);
  expect(keys.key({ signature: 'x' })).toBe(original);
  expect(large).not.toBe(original);
});

test('handler lifetimes cannot alias existing compact or oversized program keys', () => {
  const a = new GraphCodeKeys(5), b = new GraphCodeKeys(5);
  for (const signature of ['same', 'oversized-signature'])
    expect(a.key({ signature })).not.toBe(b.key({ signature }));
});

test('refuses invalid capacities', () => {
  for (const limit of [0, -1, 0.5, Infinity, Number.NaN]) {
    expect(() => new GraphCodeKeys(limit)).toThrow(RangeError);
    expect(() => new GraphCodeKeys(100, limit)).toThrow(RangeError);
  }
});

function releasedShape(keys: GraphCodeKeys): {ref: WeakRef<object>; key: string} {
  const shape = {signature: 'retired-shape', owner: {scene: 'retired-scene'}};
  return {ref: new WeakRef(shape), key: keys.key(shape)};
}

test('a live key table releases the retired graph and its owner', async () => {
  await realGc('src/engine/render/nodes/graphCodeKeys.test.ts', 'a live key table releases the retired graph and its owner', async collect => {
    const keys = new GraphCodeKeys(), {ref, key} = releasedShape(keys);
    await collect(ref);
    expect(keys.key({signature: 'retired-shape'})).toBe(key);
  });
});
