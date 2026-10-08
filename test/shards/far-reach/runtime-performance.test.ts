// oxlint-disable-next-line import/no-nodejs-modules -- Audit the actual declared runtime entry, not a copied example.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { runtimePerformanceSites } from '../../../lint/runtime-performance.mjs';

it('admits the defining Sky runtime without any SF62 performance allowance', () => {
  const path = 'src/shards/far-reach/runtime/index.ts';
  expect(runtimePerformanceSites(readFileSync(path, 'utf8'), path)).toEqual([]);
});
