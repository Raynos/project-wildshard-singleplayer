// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual checkout's generation catalogue.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { MapRaster } from '../src/sdk/bake/mapRaster';
import { paintMapGeometry } from '../src/sdk/bake/mapScenes';

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
