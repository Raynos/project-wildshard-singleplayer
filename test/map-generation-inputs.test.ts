// oxlint-disable-next-line import/no-nodejs-modules -- The sealed producer proof owns and removes its scratch cache.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checkout and its owned scratch catalogue.
import { relative, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { discoverGeneration, generateShardJob, type ShardGenerationJob } from '../scripts/generate.mjs';
import { InputHashMemo } from '../scripts/bake-input-hashes.mjs';
import { MapRaster } from '../src/sdk/bake/mapRaster';
import { paintMapGeometry } from '../src/sdk/bake/mapScenes';
import images from './fixtures/map-stage-images.json' with { type: 'json' };

const root = resolve('.'), sceneSource = 'src/sdk/bake/mapScenes.ts';
// Only source digests are shared. Each producer still stages, executes and
// verifies its own sealed tree; every memo hit rechecks the file identity.
const inputHashes = new InputHashMemo(root);

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
      await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true, inputHashes })).rejects.toThrow('Generator exited 1');
      const result = await generateShardJob(root, job, { cacheDir, forceCompare: true, inputHashes });
      try {
        expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
        for (const [file, hash] of Object.entries(original)) expect(result.hashes[file], file).toBe(hash);
      } finally { result.release(); }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}

// One genuinely cold world is fixture preparation, shared by every original
// positive and omission case. Failed initialization owns its cleanup too.
const openPlotFixture = await (async () => {
  const original = discoverGeneration(root).jobs.find(row => row.id === 'open-plots-world');
  if (original === undefined) throw new Error('Missing registered open-plot producer');
  const cacheDir = mkdtempSync(resolve(root, 'tmp/plot-map-inputs-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'jobs.json'));
    const worldOutputs = original.outputs.filter(file => file.endsWith('.glb'));
    const worlds: ShardGenerationJob = { ...original, id: 'fixture-plot-worlds', command: [...original.command, '--worlds-only'], outputs: worldOutputs, buildTimeOutputs: worldOutputs };
    const maps: ShardGenerationJob[] = [];
    for (const [index, file] of Object.keys(images['open-plots-world']).entries()) {
      const slug = file.split('/')[2]; if (slug === undefined) throw new Error('Missing map output identity');
      const outputs = [file, `src/shards/open-plots/look/map.${slug}.baked.json`];
      maps.push({ ...original, id: `fixture-plot-map-${String(index)}`, command: [...original.command, `--map-only=${slug}`],
        inputRoots: [...original.inputRoots, 'src/shards/open-plots'], outputs, buildTimeOutputs: outputs, catalogueDependencies: [worlds.id] });
    }
    expect([...worlds.outputs, ...maps.flatMap(row => row.outputs)].sort()).toEqual([...original.outputs].sort());
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT isolated map fixtures', jobs: [worlds, ...maps] }));
    const prepared = await generateShardJob(root, worlds, { cacheDir, catalogPath, forceCompare: true, inputHashes });
    return { cacheDir, catalogPath, original, worlds, maps, prepared };
  } catch (error) { rmSync(cacheDir, { recursive: true, force: true }); throw error; }
})();

describe('isolated open-plot map outputs', () => {
  const { cacheDir, catalogPath, original, worlds, maps, prepared } = openPlotFixture;
  afterAll(() => {
    try { prepared.release(); } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
  const options = () => {
    expect(Object.keys(prepared.hashes).sort()).toEqual([...worlds.outputs].sort());
    return Promise.resolve({ cacheDir, catalogPath, forceCompare: true, inputHashes, preparation: { outputs: original.outputs, upstream: new Map([[worlds.id, prepared]]) } });
  };
  test('all isolated map consumers borrow one verified cold world publication', async () => {
    const first = await options(), second = await options();
    const publication = first.preparation.upstream.get(worlds.id);
    expect(publication === undefined).toBe(false);
    expect(second.preparation.upstream.get(worlds.id) === publication).toBe(true);
  });
  test('the declared map stage refuses the omitted painter before painting', async () => {
    const first = maps[0]; if (first === undefined) throw new Error('Missing map stage');
    expect(first.inputRoots).toContain(sceneSource);
    const descriptor = { ...first, inputRoots: first.inputRoots.filter(file => file !== sceneSource) };
    const omitted = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, omitted), JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT sealed negative fixture', jobs: [worlds, descriptor] }));
    await expect(generateShardJob(root, descriptor, { ...await options(), catalogPath: omitted })).rejects.toThrow('Generator exited 1');
  });
  for (const [file, hash] of Object.entries(images['open-plots-world'])) {
    test(`preserves the complete original ${file}`, async () => {
      const job = maps.find(row => row.outputs.includes(file)); if (job === undefined) throw new Error('Missing map stage');
      const result = await generateShardJob(root, job, await options());
      try {
        expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
        expect(result.hashes[file]).toBe(hash);
      } finally { result.release(); }
    });
  }
});
