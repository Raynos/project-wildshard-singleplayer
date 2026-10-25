// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only the isolated map image fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the native image fixture inside the repository tmp directory.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { nalatiMapFiles } from '../src/shards/nalati-grasslands/generators/mapAssembly.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { InputHashMemo } from '../scripts/bake-input-hashes.mjs';
import * as v from 'valibot';
import settings from '../src/shards/nalati-grasslands/look/map.json' with { type: 'json' };
import original from './fixtures/nalati-map-files.json' with { type: 'json' };

// Cold native construction precedes the timed assertions; every resulting byte
// is checked against the predecessor, rather than a copied authored projection.
const files = await nalatiMapFiles();
// Both isolated producers share only the defining stat/content memo; each still
// stages its own sealed tree, executes fresh and verifies every input afterward.
const inputHashes = new InputHashMemo(resolve('.'));
const inputs = new Map(files);
for (const file of settings.painter.glbs) inputs.set(file, readFileSync(resolve('src/shards/nalati-grasslands', file)));

test('Nalati owns the complete original scene and packed geometry bytes', () => {
  for (const [index, name] of ['map/assembly.json', 'map/geometry.bin'].entries()) {
    const bytes = files.get(name), before = original[index];
    if (bytes === undefined || before === undefined) throw new Error('Missing original Nalati map oracle');
    expect(bytes.byteLength, before.path).toBe(before.bytes);
    expect(hashImmutableBytes(bytes), before.path).toBe(before.hash);
  }
});

test('owned assembly and terrain preserve the full original native map image', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'nalati-map-image-'));
  try {
    const dir = resolve(root, 'src/shards/nalati-grasslands/look');
    mkdirSync(dir, { recursive: true });
    // No declared physical inputs exist here. Assembly and all three original
    // terrain GLBs are passed as owned bytes through the existing painter.
    writeFileSync(resolve(dir, 'map.json'), JSON.stringify({ ...settings, inputs: [] }));
    const missing = new Map(inputs); missing.delete('map/geometry.bin');
    await expect(paintDataMap(root, 'nalati-grasslands', { sources: missing })).rejects.toThrow('undeclared map input map/geometry.bin');
    await paintDataMap(root, 'nalati-grasslands', { sources: inputs });
    const bytes = readFileSync(resolve(root, 'public/assets/nalati-grasslands/map/top.webp')), before = original[2];
    if (before === undefined) throw new Error('Missing original Nalati image oracle');
    expect(bytes.byteLength).toBe(before.bytes);
    expect(hashImmutableBytes(bytes)).toBe(before.hash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const omitGeometry of [true, false]) {
  test(`the sealed map producer ${omitGeometry ? 'refuses an omitted geometry helper' : 'preserves the original image without assembly files'}`, async () => {
    const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'nalati-data-map');
    if (job === undefined) throw new Error('Missing Nalati map producer');
    expect(job.inputRoots).toContain('scripts/map-geometry.mjs');
    const cacheDir = mkdtempSync(resolve('tmp', 'nalati-map-stage-'));
    try {
      if (omitGeometry) {
        const descriptor = { ...job, inputRoots: job.inputRoots.filter(file => file !== 'scripts/map-geometry.mjs') };
        const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
        const catalog = v.parse(v.object({ schema: v.string(), notice: v.string(), jobs: v.array(v.unknown()) }),
          JSON.parse(readFileSync('scripts/generation-jobs.json', 'utf8')));
        writeFileSync(resolve(root, catalogPath), JSON.stringify({ ...catalog, jobs: catalog.jobs.map(row =>
          typeof row === 'object' && row !== null && Reflect.get(row, 'id') === job.id ? descriptor : row) }));
        await expect(generateShardJob(root, descriptor, { cacheDir, catalogPath, forceCompare: true, inputHashes })).rejects.toThrow('Generator exited 1');
      } else {
        const result = await generateShardJob(root, job, { cacheDir, forceCompare: true, inputHashes });
        try {
          const before = original[2]; if (before === undefined) throw new Error('Missing native image oracle');
          expect(result.hashes[before.path]).toBe(before.hash);
          expect(Object.keys(result.hashes).sort()).toEqual([...job.outputs].sort());
        } finally { result.release(); }
      }
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });
}
