// oxlint-disable-next-line import/no-nodejs-modules -- The sealed producer proof owns and removes its scratch cache.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the producer to the real checkout and its private cache.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

test('retained declaration bakes its sand inputs in isolation and preserves the original full file', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-declaration');
  if (job === undefined) throw new Error('Missing retained declaration producer');
  expect(job.platform).toBe('native');
  const helper = 'src/shards/sunscar-dunes/generators/sandMetadata.ts';
  expect(job.inputRoots).toContain(helper);
  mkdirSync('tmp', { recursive: true }); const cacheDir = mkdtempSync(resolve('tmp', 'sunscar-sand-declaration-'));
  try {
    const descriptor = { ...job, inputRoots: job.inputRoots.filter(path => path !== helper) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture', jobs: [descriptor] }));
    await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hashes).toEqual({ 'src/shards/sunscar-dunes/data/product.generated.json':
        'dcf9a22c356ac6a13abf921fb82a00b371cc79b8544d68dee6981c2618f8137b' });
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
