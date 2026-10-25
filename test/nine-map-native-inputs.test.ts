// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this sealed producer fixture's private cache/catalogue.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checkout and its owned negative catalogue.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

test('the sealed map requires its native atlas root and retains the original image bytes', async () => {
  const root = resolve('.'), jobs = discoverGeneration(root).jobs, job = jobs.find(row => row.id === 'nine-data-map');
  if (job === undefined) throw new Error('Missing Nine map producer');
  const native = 'public/assets/nine-dragon/authored/sign-atlas', cacheDir = mkdtempSync(resolve(root, 'tmp/nine-map-native-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(file => file !== native) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hashes['public/assets/nine-dragon-stack/map/top.webp']).toBe('cbc4ca4ed3a0f116cd9d80adf2786e999e5e98c97ae9eea6dd0995d0da4d4e40');
      expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
