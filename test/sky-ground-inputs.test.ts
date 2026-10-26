// oxlint-disable-next-line import/no-nodejs-modules -- Compare original scene bytes and isolate real sealed-driver fixtures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep omitted-source catalogues in repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete original scene without expanding every hull scalar.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyGroundSource } from '../src/shards/far-reach/generators/groundScene';

const output = 'src/shards/far-reach/data/groundScene.generated.json';

test('the source-derived ground preserves every original hull, scene and registry byte', () => {
  expect(Buffer.compare(skyGroundSource(), readFileSync(output))).toBe(0);
});

test('the real cold sealed ground reader omits metadata, refuses a missing hull source and preserves its full output', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-ground-scene');
  if (job === undefined) throw new Error('Missing retained ground scene writer');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/knolls.json');
  const source = 'src/shards/far-reach/generators/knoll.ts';
  expect(job.inputRoots).toContain(source);
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
  const expected = hashImmutableBytes(readFileSync(output)), cacheDir = mkdtempSync(resolve('tmp/sky-ground-inputs-'));
  const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
  try {
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
