// oxlint-disable-next-line import/no-nodejs-modules -- Read the original admitted bytes and isolate real sealed-driver scratch.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all sealed-driver scratch under the repository.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original binary output without assertion expansion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bakeMeadowBlades } from '../src/shards/far-reach/generators/meadowBlades';
import { meadowHoles, meadowPaths } from '../src/shards/far-reach/generators/placements';
import { heroStoneDiscs } from '../src/shards/far-reach/generators/dressing';

const output = 'public/assets/far-reach/baked/851f80fb000e621ab1b6e22edd9a9ac7fbcb6ecfeda1047a86f3f919d779e33f.bin';

test('owned meadow placement values preserve every original row and packed blade byte', () => {
  const original = v.parse(v.object({ meadow: v.object({ holes: v.array(v.array(v.number())), paths: v.array(v.array(v.number())) }) }),
    JSON.parse(readFileSync('src/shards/far-reach/data/placements.json', 'utf8')));
  const rows = (values: ReturnType<typeof meadowHoles>): number[][] => values.map(({ x, y, z, w }) => [x, y, z, w]);
  expect(rows(meadowHoles())).toEqual(original.meadow.holes);
  expect(rows(meadowPaths())).toEqual(original.meadow.paths);
  expect(Buffer.compare(bakeMeadowBlades(), readFileSync(output))).toBe(0);
});

test('authored dressing clearances retain every original disc and own their coordinate arrays', () => {
  const original = v.parse(v.object({ discs: v.array(v.tuple([v.number(), v.number(), v.number()])) }),
    JSON.parse(readFileSync('src/shards/far-reach/data/dressing.json', 'utf8')));
  const first = heroStoneDiscs(), second = heroStoneDiscs(), disc = first[0];
  expect(first).toEqual(original.discs);
  if (disc === undefined) throw new Error('Missing original dressing clearance');
  disc[0] += 1; first.length = 0;
  expect(second).toEqual(original.discs); expect(heroStoneDiscs()).toEqual(original.discs);
});

test('the actual cold sealed meadow writer omits both metadata handoffs, refuses missing source and retains its complete output', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-meadow-blades');
  if (job === undefined) throw new Error('Missing retained meadow writer');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/placements.json');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/dressing.json');
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/placements.ts');
  const source = 'src/shards/far-reach/generators/dressing.ts';
  expect(job.inputRoots).toContain(source);
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
  const expected = hashImmutableBytes(readFileSync(output)), cacheDir = mkdtempSync(resolve('tmp/sky-meadow-inputs-'));
  const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
  try {
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
