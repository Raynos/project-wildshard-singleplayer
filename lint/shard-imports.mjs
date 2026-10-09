import { dirname, resolve } from 'node:path';

/** Resolve source syntax to the game boundary; relative imports cannot bypass the author-package rule. */
export function shardGameImport(filename, source) {
  if (typeof source !== 'string') return false;
  if (/^@wildshard\/game(?:\/|$)/u.test(source)) return true;
  return source.startsWith('.') && /\/src\/game(?:\/|$)/u.test(resolve(dirname(filename), source).replaceAll('\\', '/'));
}
