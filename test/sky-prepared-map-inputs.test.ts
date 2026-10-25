// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated sealed cache and compare complete original map bytes.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omission catalogues and producer outputs to repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete encoded images without expanding assertion objects.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { PREPARED_MODEL_INPUTS } from '../src/shards/far-reach/generators/preparedModelProgram';

const handoff = 'public/assets/far-reach/baked/prepared-models.glb';
const image = 'public/assets/far-reach/map/top.webp';
const hash = 'a4d2c58042946dc131c67027993aa567121d45bab1e33759248acb8aa704728d';

test('the sealed map owns all prepared-model inputs and retains every original image byte without the public GLB', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-data-map');
  if (job === undefined) throw new Error('Missing retained Sky map');
  expect(job.inputRoots).not.toContain(handoff);
  for (const url of PREPARED_MODEL_INPUTS) expect(job.inputRoots).toContain(`public${url}`);
  mkdirSync('tmp', { recursive: true });
  const cacheDir = mkdtempSync(resolve('tmp/sky-map-source-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hit).toBe(false);
      expect(result.hashes[image]).toBe(hash);
      expect(existsSync(resolve(result.directory, handoff))).toBe(false);
      const actual = readFileSync(resolve(result.directory, image));
      expect(actual.byteLength).toBe(17_566);
      expect(hashImmutableBytes(actual)).toBe(hash);
      expect(Buffer.compare(actual, readFileSync(image))).toBe(0);
      const stamp: unknown = JSON.parse(readFileSync(resolve(result.directory, 'src/shards/far-reach/look/map.baked.json'), 'utf8'));
      expect(stamp).toMatchObject({ pixelHash: '39a0770cfbeebbf625bcb62fed48113a2c37ea436467fb9cfa1339c5912c420a',
        image: '/assets/far-reach/map/top.webp', size: 1000, metres: 500, north: '+z', east: '-x', style: 'data:void', bytes: 17_566 });
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('the real sealed map refuses an omitted original model rather than using the retained public geometry', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-data-map');
  if (job === undefined) throw new Error('Missing retained Sky map');
  const source = 'public/assets/far-reach/fan/hand-hd.glb';
  expect(job.inputRoots).toContain(source);
  mkdirSync('tmp', { recursive: true });
  const cacheDir = mkdtempSync(resolve('tmp/sky-map-omitted-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1',
      notice: 'DO NOT EDIT isolated omission fixture', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
