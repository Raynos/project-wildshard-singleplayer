// oxlint-disable-next-line import/no-nodejs-modules -- Read the tracked texture-baker header without importing it into the compiler.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';

/** Retain the complete independent alias table and its original order/hash assertions. */
export function originalPineAstcAliases(): Record<string, string> {
  const value: unknown = JSON.parse(readFileSync(new URL('../../src/shards/pine-hollow/data/astc6.generated.json', import.meta.url), 'utf8'));
  return v.parse(v.record(v.string(), v.string()), value);
}
