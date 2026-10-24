// oxlint-disable-next-line import/no-nodejs-modules -- The regression owns its isolated generation cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Only explicit repository and fixture paths are resolved.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

test('the sealed movers stage contains the source helper and preserves its original module', async () => {
  const root = process.cwd(), helper = 'src/shards/nine-dragon-stack/generators/moversProgram.ts';
  const job = discoverGeneration(root).jobs.find(row => row.id === 'nine-movers-view');
  if (job === undefined) throw new Error('Missing retained Nine movers adapter');
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-movers-stage-'));
  try {
    const options = { cacheDir: cache, forceCompare: true };
    await expect(generateShardJob(root, { ...job, inputRoots: job.inputRoots.filter(file => file !== helper) }, options))
      .rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, options);
    try {
      expect(result.hashes['src/shards/nine-dragon-stack/behaviour/movers.generated.wasm'])
        .toBe('3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276');
    } finally { result.release(); }
  } finally { rmSync(cache, { recursive: true, force: true }); }
});
