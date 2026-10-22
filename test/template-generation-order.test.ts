// oxlint-disable-next-line import/no-nodejs-modules -- Test the shipping producer dependency order on a cold tree.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';

test('Template product reads each generated input after its producer', () => {
  const { jobs } = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), inputRoots: v.array(v.string()), outputs: v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  const product = jobs.find(job => job.id === 'template-product');
  if (product === undefined) throw new Error('Missing Template product producer');
  const dependencies = jobs.filter(job => job.outputs.some(file => product.inputRoots.includes(file)));
  expect(dependencies.map(job => job.id).sort()).toEqual(['template-author-behaviour', 'template-author-props', 'template-author-terrain', 'template-boss-decision']);
  for (const upstream of dependencies) expect(jobs.indexOf(upstream)).toBeLessThan(jobs.indexOf(product));
});
