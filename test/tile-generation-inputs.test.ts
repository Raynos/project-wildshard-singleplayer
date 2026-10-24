// oxlint-disable-next-line import/no-nodejs-modules -- The authored catalogue declares each isolated generator's source boundary.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';

test('isolated SDK bake users stage the tile-completion module alongside their emitter', () => {
  const catalogue = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), inputRoots: v.array(v.string()) })) }),
    JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
  let checked = 0;
  for (const job of catalogue.jobs) {
    const covers = (file: string): boolean => job.inputRoots.some(root => file === root || file.startsWith(`${root}/`));
    if (!covers('src/sdk/bake.ts') && !covers('src/sdk/bake/authoredWorld.ts')) continue;
    checked++;
    expect(covers('src/sdk/bake/tileGrid.ts'), `${job.id}: tile completion must exist in its isolated source stage`).toBe(true);
  }
  expect(checked).toBeGreaterThan(0);
});
