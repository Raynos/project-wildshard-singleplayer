// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this sealed producer fixture's private cache/catalogue.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checkout and its owned negative catalogue.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';

test.each(['public/assets/nine-dragon/authored/sign-atlas', 'public/assets/nine-dragon/authored/glyphs'])('the sealed map refuses omitted native root %s', async native => {
  const root = resolve('.'), jobs = discoverGeneration(root).jobs, job = jobs.find(row => row.id === 'nine-data-map');
  if (job === undefined) throw new Error('Missing Nine map producer');
  const cacheDir = mkdtempSync(resolve(root, 'tmp/nine-map-native-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(file => file !== native) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

// Keep cold admission separate from each negative: every original proof retains
// its own unchanged 30-second budget, without repeating the positive bake twice.
test('the sealed map retains the original complete image bytes and output inventory', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-data-map');
  if (job === undefined) throw new Error('Missing Nine map producer');
  const cacheDir = mkdtempSync(resolve(root, 'tmp/nine-map-native-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hashes['public/assets/nine-dragon-stack/map/top.webp']).toBe('cbc4ca4ed3a0f116cd9d80adf2786e999e5e98c97ae9eea6dd0995d0da4d4e40');
      expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
