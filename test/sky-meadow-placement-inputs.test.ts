// oxlint-disable-next-line import/no-nodejs-modules -- Read the original admitted bytes and isolate real sealed-driver scratch.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all sealed-driver scratch under the repository.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original binary output without assertion expansion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bakeMeadowBlades } from '../src/shards/far-reach/generators/meadowBlades';
import { meadowHoles, meadowPaths } from '../src/shards/far-reach/generators/placements';

const output = 'public/assets/far-reach/baked/851f80fb000e621ab1b6e22edd9a9ac7fbcb6ecfeda1047a86f3f919d779e33f.bin';

test('owned meadow placement values preserve every original row and packed blade byte', () => {
  const original = v.parse(v.object({ meadow: v.object({ holes: v.array(v.array(v.number())), paths: v.array(v.array(v.number())) }) }),
    JSON.parse(readFileSync('src/shards/far-reach/data/placements.json', 'utf8')));
  const rows = (values: ReturnType<typeof meadowHoles>): number[][] => values.map(({ x, y, z, w }) => [x, y, z, w]);
  expect(rows(meadowHoles())).toEqual(original.meadow.holes);
  expect(rows(meadowPaths())).toEqual(original.meadow.paths);
  expect(Buffer.compare(bakeMeadowBlades(), readFileSync(output))).toBe(0);
});

test('the actual cold sealed meadow writer excludes the generated placement handoff and retains its complete output', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-meadow-blades');
  if (job === undefined) throw new Error('Missing retained meadow writer');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/placements.json');
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/placements.ts');
  const expected = hashImmutableBytes(readFileSync(output)), cacheDir = mkdtempSync(resolve('tmp/sky-meadow-inputs-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
