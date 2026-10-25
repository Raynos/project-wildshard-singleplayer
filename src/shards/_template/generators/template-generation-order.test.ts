// oxlint-disable-next-line import/no-nodejs-modules -- Verify retirement of the obsolete report-only generation job.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import entry, { generate } from '../shard.config';

test('Template has one executable product entry and no obsolete product report job', () => {
  const { jobs } = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), inputRoots: v.array(v.string()), outputs: v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  expect(jobs.some(job => job.id === 'template-product')).toBe(false);
  expect(jobs.flatMap(job => job.inputRoots).some(file => file.startsWith('src/shards/_template/.wildshard/product'))).toBe(false);
  expect(entry).toBe(generate);
  const declaration = readFileSync('src/shards/_template/generators/product.ts', 'utf8');
  expect(declaration).not.toMatch(/from ['"]\.\.\/data\/(?:terrain|props)\.json/u);
});
