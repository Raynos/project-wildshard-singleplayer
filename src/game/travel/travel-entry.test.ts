import { expect, test } from 'vitest';
import { resolveTravelEntry } from './entry';
import { shardEntry } from '../shard/entryMode';

test('an enter request reaches the shard it names, in its shardfile', () => {
  const primary = { slug: 'nine-dragon-stack', entries: { legacy: true, shardfile: true } } as const;
  expect(resolveTravelEntry(primary)).toBe(primary);
  expect(shardEntry(primary)).toBe('shardfile');
});

test('a frozen copy is never entered, by name or by suffix', () => {
  const copy = { slug: 'nine-dragon-stack-legacy', legacy: true, entries: { legacy: true, shardfile: false } } as const;
  expect(resolveTravelEntry(copy)).toBeUndefined();
  const suffix = { slug: 'nine-dragon-stack-legacy', entries: { legacy: false, shardfile: true } } as const;
  expect(resolveTravelEntry(suffix)).toBe(suffix);
});
