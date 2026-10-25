// oxlint-disable-next-line import/no-nodejs-modules -- The sealed producer proof owns and removes its scratch cache.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checkout and its owned scratch catalogue.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
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
