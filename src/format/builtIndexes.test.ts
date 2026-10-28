import { afterEach, expect, test } from 'vitest';
import { builtIndexHash, builtIndexHashes } from './builtIndexes';

const previous = Object.getOwnPropertyDescriptor(globalThis, '__SHARDFILE_VERDICTS__');
function install(value: unknown): void { Object.defineProperty(globalThis, '__SHARDFILE_VERDICTS__', { configurable: true, writable: true, value }); }
afterEach(() => {
  if (previous === undefined) Reflect.deleteProperty(globalThis, '__SHARDFILE_VERDICTS__');
  else Object.defineProperty(globalThis, '__SHARDFILE_VERDICTS__', previous);
});

test('built index addresses select only the exact declared path and retain complete hashes', () => {
  const hash = 'a'.repeat(64), other = 'b'.repeat(64);
  install([{path:'/shardfiles/one/shard.json',indexHash:hash}, {path:'/shardfiles/two/shard.json',indexHash:other}]);
  expect(builtIndexHash('/shardfiles/one/shard.json')).toBe(hash);
  expect(builtIndexHash('/shardfiles/two/shard.json')).toBe(other);
  expect(builtIndexHash('/shardfiles/one/entry.json')).toBeNull();
  expect(builtIndexHash('/shardfiles/one/shard.json?v=aaaaaaaa')).toBeNull();
  expect(builtIndexHashes()).toEqual(new Set([hash,other]));
});

test('an absent address stays unversioned and malformed or conflicting build addresses refuse', () => {
  install([]);
  expect(builtIndexHash('/shardfiles/one/shard.json')).toBeNull();
  const path = '/shardfiles/one/shard.json';
  install([{path,indexHash:'short'}]);
  expect(()=>builtIndexHash(path)).toThrow('Invalid built index address');
  install([{path,indexHash:'a'.repeat(64)},{path,indexHash:'b'.repeat(64)}]);
  expect(()=>builtIndexHash(path)).toThrow('Ambiguous built index address');
});
