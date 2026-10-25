// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated cold cache and matching omission catalogue.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine real producer fixtures to repository scratch.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('retained prepared-model readers declare the pure leaf and the real sealed producer refuses its omission', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), source = 'src/shards/far-reach/generators/preparedModelBytes.ts';
  for (const id of ['sky-prepared-models', 'sky-vane-post', 'sky-vane-rotor', 'sky-hero-library']) {
    const reader = jobs.find(row => row.id === id);
    if (reader === undefined) throw new Error(`Missing retained reader ${id}`);
    expect(reader.inputRoots).toContain(source);
  }
  const job = jobs.find(row => row.id === 'sky-prepared-models');
  if (job === undefined) throw new Error('Missing prepared-model producer');
  mkdirSync('tmp', { recursive: true }); const cacheDir = mkdtempSync(resolve('tmp/sky-prepared-inputs-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT isolated fixture',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hit).toBe(false);
      expect(result.hashes).toEqual({ 'public/assets/far-reach/baked/prepared-models.glb': 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580' });
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('retained boot metadata declares authored layout and preserves all six original outputs', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), source = 'src/shards/far-reach/generators/layout.ts';
  const job = jobs.find(row => row.id === 'sky-boot-metadata');
  if (job === undefined) throw new Error('Missing retained Sky boot producer');
  expect(job.inputRoots).toContain(source);
  const expected = Object.fromEntries(job.outputs.map(path => [path, hashImmutableBytes(readFileSync(path))]));
  const cacheDir = mkdtempSync(resolve('tmp/sky-boot-layout-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT isolated fixture',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual(expected); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
