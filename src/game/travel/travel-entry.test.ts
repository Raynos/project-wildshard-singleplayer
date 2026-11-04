import { expect, test } from 'vitest';
import { resolveTravelEntry } from './entry';
import { shardEntry } from '../shard/entryMode';

test('an enter request reaches the shard it names, in its shardfile', () => {
  const primary = { slug: 'nine-dragon-stack', entries: { legacy: true, shardfile: true } } as const;
  expect(resolveTravelEntry(primary)).toBe(primary);
  expect(shardEntry(primary)).toBe('shardfile');
});

test('a frozen copy is never entered: the flag refuses it, whatever its name', () => {
  const copy = { slug: 'pine-hollow', legacy: true, entries: { legacy: true, shardfile: false } } as const;
  expect(resolveTravelEntry(copy)).toBeUndefined();
  const ordinary = { slug: 'pine-hollow', entries: { legacy: false, shardfile: true } } as const;
  expect(resolveTravelEntry(ordinary)).toBe(ordinary);
});
