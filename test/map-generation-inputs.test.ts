// oxlint-disable-next-line import/no-nodejs-modules -- The sealed producer proof owns and removes its scratch cache.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checkout and its owned scratch catalogue.
import { relative, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { discoverGeneration, generateShardJob, type ShardGenerationJob } from '../scripts/generate.mjs';
import { MapRaster } from '../src/sdk/bake/mapRaster';
import { paintMapGeometry } from '../src/sdk/bake/mapScenes';
import images from './fixtures/map-stage-images.json' with { type: 'json' };

const root = resolve('.'), sceneSource = 'src/sdk/bake/mapScenes.ts';

test('output notes remain metadata while malformed selected exclusions refuse', async () => {
  const raster = new MapRaster(2), config = { painter: { version: 1 }, outputs: { why: 'Shared map author note', plot: { exclude: 1 } } };
  const readers = { input: (file: string): string => file, bytes: (): Uint8Array => new Uint8Array(), json: (): unknown => ({}) };
  raster.triangles = 1;
  await expect(paintMapGeometry(raster, config, readers)).resolves.toBeUndefined();
  await expect(paintMapGeometry(raster, config, readers, { output: 'plot' })).rejects.toThrow('Invalid type');
});

test('every retained map adapter stages the shared geometry painter', () => {
  let checked = 0;
  for (const job of discoverGeneration(root).jobs) {
    const covers = (file: string): boolean => job.inputRoots.some(input => file === input || file.startsWith(`${input}/`));
    if (!covers('scripts/bake-data-maps.mjs')) continue;
    expect(covers(sceneSource), job.id).toBe(true);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

for (const [id, original] of Object.entries(images)) {
  if (id === 'open-plots-world') continue;
  test(`${id} refuses the missing painter and preserves every original image`, async () => {
    const job = discoverGeneration(root).jobs.find(row => row.id === id);
    if (job === undefined) throw new Error(`Missing registered map producer: ${id}`);
    const cacheDir = mkdtempSync(resolve(root, 'tmp/map-stage-inputs-'));
    try {
      expect(job.inputRoots).toContain(sceneSource);
      const descriptor = { ...job, inputRoots: job.inputRoots.filter(file => file !== sceneSource) };
      const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
      writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture', jobs: [descriptor] }));
      await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
      const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
      try {
        expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
        for (const [file, hash] of Object.entries(original)) expect(result.hashes[file], file).toBe(hash);
      } finally { result.release(); }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}

describe('isolated open-plot map outputs', () => {
  let cacheDir: string, catalogPath: string, original: ShardGenerationJob, worlds: ShardGenerationJob, maps: ShardGenerationJob[];
  let prepared: Awaited<ReturnType<typeof generateShardJob>> | undefined;
  beforeAll(async () => {
    const job = discoverGeneration(root).jobs.find(row => row.id === 'open-plots-world');
    if (job === undefined) throw new Error('Missing registered open-plot producer');
    original = job; cacheDir = mkdtempSync(resolve(root, 'tmp/plot-map-inputs-'));
    catalogPath = relative(root, resolve(cacheDir, 'jobs.json'));
    const worldOutputs = job.outputs.filter(file => file.endsWith('.glb'));
    worlds = { ...job, id: 'fixture-plot-worlds', command: [...job.command, '--worlds-only'], outputs: worldOutputs, buildTimeOutputs: worldOutputs };
    maps = [];
    for (const [index, file] of Object.keys(images['open-plots-world']).entries()) {
      const slug = file.split('/')[2]; if (slug === undefined) throw new Error('Missing map output identity');
      const outputs = [file, `src/shards/open-plots/look/map.${slug}.baked.json`];
      maps.push({ ...job, id: `fixture-plot-map-${String(index)}`, command: [...job.command, `--map-only=${slug}`],
        inputRoots: [...job.inputRoots, 'src/shards/open-plots'], outputs, buildTimeOutputs: outputs, catalogueDependencies: [worlds.id] });
    }
    expect([...worlds.outputs, ...maps.flatMap(row => row.outputs)].sort()).toEqual([...job.outputs].sort());
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT isolated map fixtures', jobs: [worlds, ...maps] }));
    prepared = await generateShardJob(root, worlds, { cacheDir, catalogPath, forceCompare: true });
    expect(Object.keys(prepared.hashes).sort()).toEqual([...worlds.outputs].sort());
  });
  afterAll(() => {
    prepared?.release();
    if (cacheDir !== undefined) rmSync(cacheDir, { recursive: true, force: true });
  });
  const options = () => {
    if (prepared === undefined) throw new Error('Missing verified world setup');
    return { cacheDir, catalogPath, forceCompare: true, preparation: { outputs: original.outputs, upstream: new Map([[worlds.id, prepared]]) } };
  };
  test('the declared map stage refuses the omitted painter before painting', async () => {
    const first = maps[0]; if (first === undefined) throw new Error('Missing map stage');
    expect(first.inputRoots).toContain(sceneSource);
    const descriptor = { ...first, inputRoots: first.inputRoots.filter(file => file !== sceneSource) };
    const omitted = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, omitted), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture', jobs: [worlds, descriptor] }));
    await expect(generateShardJob(root, descriptor, { ...options(), catalogPath: omitted })).rejects.toThrow('Generator exited 1');
  });
  for (const [file, hash] of Object.entries(images['open-plots-world'])) {
    test(`preserves the complete original ${file}`, async () => {
      const job = maps.find(row => row.outputs.includes(file)); if (job === undefined) throw new Error('Missing map stage');
      const result = await generateShardJob(root, job, options());
      try {
        expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
        expect(result.hashes[file]).toBe(hash);
      } finally { result.release(); }
    });
  }
});
