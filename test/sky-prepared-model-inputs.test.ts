// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated cold cache and matching omission catalogue.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine real producer fixtures to repository scratch.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyVaneSource, skyVaneProgram, VANE_INPUTS } from '../src/shards/far-reach/generators/vaneProgram';

test('the owned vane source retains both complete original parts and strict source/cache inventories', async () => {
  const inputs = new Map(VANE_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
  const original = [
    ['vane-post.glb', 43_928, 'a5b779f379598b3e6afbf7640a0c5c30c802a2f4f51b53bb0934c29260b46a74'],
    ['vane-rotor.glb', 54_316, '13ad79dd37f10805d3450bbc59a450f27a3262065e85358c8e27f8d3e82b9ad5'],
  ] as const;
  const files = await skyVaneSource(inputs);
  expect([...files.keys()]).toEqual(original.map(row => row[0]));
  for (const [name, size, hash] of original) {
    const bytes = files.get(name); if (bytes === undefined) throw new Error('Missing original vane part');
    expect(bytes.byteLength).toBe(size); expect(hashImmutableBytes(bytes)).toBe(hash); bytes.fill(0);
  }
  const fresh = await skyVaneSource(inputs);
  for (const [name, , hash] of original) {
    const bytes = fresh.get(name); if (bytes === undefined) throw new Error('Missing fresh vane part');
    expect(hashImmutableBytes(bytes)).toBe(hash);
  }
  await expect(skyVaneSource(new Map())).rejects.toThrow('input inventory differs');
  await expect(skyVaneSource(new Map([...inputs, ['extra', new Uint8Array([1])]]))).rejects.toThrow('input inventory differs');
  await expect(skyVaneProgram({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('cache inventory differs');
});

test('prepared geometry has no scheduled writer or public handoff reader while frozen legacy bytes stay exact', () => {
  const { jobs } = discoverGeneration(resolve('.')), handoff = 'public/assets/far-reach/baked/prepared-models.glb';
  expect(jobs.some(row => row.id === 'sky-prepared-models')).toBe(false);
  for (const job of jobs) {
    expect(job.outputs, job.id).not.toContain(handoff);
    expect(job.inputRoots, job.id).not.toContain(handoff);
  }
  expect(hashImmutableBytes(readFileSync(handoff))).toBe('bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580');
});

test('retained prepared-model readers declare the pure leaf and the real sealed producer refuses its omission', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), source = 'src/shards/far-reach/generators/preparedModelBytes.ts';
  for (const id of ['sky-vane-post', 'sky-vane-rotor', 'sky-hero-library']) {
    const reader = jobs.find(row => row.id === id);
    if (reader === undefined) throw new Error(`Missing retained reader ${id}`);
    expect(reader.inputRoots).toContain(source);
    for (const path of ['preparedModelProgram.ts', 'skyIsleFrames.ts', 'skyIsleProbe.ts', 'rows/skyIsles.ts', 'rows/layoutTypes.ts']) {
      expect(reader.inputRoots).toContain(`src/shards/far-reach/generators/${path}`);
    }
    expect(reader.inputRoots).not.toContain('src/shards/far-reach/data/skyIsleFrames.json');
    expect(reader.inputRoots).not.toContain('src/shards/far-reach/data/layout.generated.json');
  }
  const job = jobs.find(row => row.id === 'sky-hero-library');
  if (job === undefined) throw new Error('Missing retained hero-library producer');
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
      expect(result.hashes).toEqual({ 'src/shards/far-reach/data/heroLibrary.generated.json': '8636a32d64c0cffec7c174e8f3983ca6a5d585e3bea4bd00463084dd1d85ac12' });
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test.each([
  ['sky-vane-post', 'public/assets/far-reach/models/wind-vane/post.glb', 'a5b779f379598b3e6afbf7640a0c5c30c802a2f4f51b53bb0934c29260b46a74'],
  ['sky-vane-rotor', 'public/assets/far-reach/models/wind-vane/rotor.glb', '13ad79dd37f10805d3450bbc59a450f27a3262065e85358c8e27f8d3e82b9ad5'],
  ['sky-hero-library', 'src/shards/far-reach/data/heroLibrary.generated.json', '8636a32d64c0cffec7c174e8f3983ca6a5d585e3bea4bd00463084dd1d85ac12'],
])('%s retains its complete original output with both generated fitting inputs absent', async (id, output, hash) => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained reader ${id}`);
  const cacheDir = mkdtempSync(resolve('tmp/sky-prepared-reader-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: hash }); }
    finally { result.release(); }
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
