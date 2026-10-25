// oxlint-disable-next-line import/no-nodejs-modules -- The sealed producer proof owns and removes its scratch cache.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the producer to the actual checkout and its owned cache.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import original from './fixtures/sunscar-view-files.json' with { type: 'json' };

test('the retained view producer owns its native skeleton inputs and preserves all twenty original files', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-view-data');
  if (job === undefined) throw new Error('Missing retained view producer');
  expect(job.platform).toBe('native');
  const cacheDir = mkdtempSync(resolve('tmp', 'sunscar-view-inputs-'));
  try {
    for (const missing of ['src/sdk/bake/skinned.ts', 'src/shards/sunscar-dunes/assets/models/dune-strider.glb']) {
      expect(job.inputRoots).toContain(missing);
      const descriptor = { ...job, inputRoots: job.inputRoots.filter(file => file !== missing) }, catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
      writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture', jobs: [descriptor] }));
      await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    }
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hashes).toEqual(original); } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
