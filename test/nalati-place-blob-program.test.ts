// oxlint-disable-next-line import/no-nodejs-modules -- Own the real immutable cache and compare the original shipping bytes.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the exact public input root without inferring an asset path.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiBakeBlob } from '../src/shards/nalati-grasslands/generators/placeBlobProgram';
import { prepareOutput } from '../src/shards/nalati-grasslands/generators/output';
import original from './fixtures/nalati-place-blob.json' with { type: 'json' };
import cragOriginal from './fixtures/nalati-crag-blob.json' with { type: 'json' };
import dressingOriginal from './fixtures/nalati-dressing-blob.json' with { type: 'json' };
import { discoverGeneration } from '../scripts/generate.mjs';

test('native dressing and duplicate scene-copy jobs stay retired', () => {
  const descriptors = discoverGeneration(resolve('.')).jobs;
  const jobs = descriptors.map(job => job.id);
  expect(jobs).not.toContain('nalati-dressing'); expect(jobs).not.toContain('nalati-places-blob'); expect(jobs).not.toContain('nalati-crags-blob'); expect(jobs).not.toContain('nalati-dressing-blob');
});

test('the actual output hook preserves every predecessor file cost and binary byte on cold and cache hit', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-place-blob-'));
  const requested: string[] = [];
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/nalati/baked/', directory: resolve('public/assets/nalati/baked') },
        { prefix: '/assets/baked/nalati-grasslands/', directory: resolve('public/assets/baked/nalati-grasslands') }]);
    return { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      requested.push(...(step.inputs ?? [])); return ctx.cached(step, make);
    } };
  };
  const before = readFileSync('public/assets/nalati/baked/places.bin');
  try {
    for (const [name, pin] of [['crags', cragOriginal]] as const) {
      const cold = await nalatiBakeBlob(context(), name, pin.decoded);
      expect(cold.file).toEqual(pin);
      expect(Buffer.compare(cold.bytes, readFileSync(`public/assets/nalati/baked/${name}.bin`))).toBe(0);
      cold.bytes.fill(0);
    }
    requested.length = 0;
    const hit = await prepareOutput(context());
    expect(requested).not.toContain('/assets/nalati/baked/dressing.bin');
    expect(requested).not.toContain('/assets/nalati/baked/places.bin');
    expect(requested).toContain('/assets/baked/nalati-grasslands/terrain.bin');
    for (const field of ['pond', 'red', 'green', 'blue']) expect(requested).toContain(`data/geography-${field}.bin`);
    const files = hit.namedFiles.filter(file => file.name === 'world/places.bin');
    expect(files).toEqual([original]); expect(hit.blobs.some(file => file.name === 'world/places.bin')).toBe(false);
    const bytes = hit.assets.get(original.hash);
    if (bytes === undefined) throw new Error('Output lost the owned places bytes');
    expect(bytes.length).toBe(original.compressed); expect(hashImmutableBytes(bytes)).toBe(original.hash);
    expect(Buffer.compare(bytes, before)).toBe(0);
    expect(hit.namedFiles.filter(file => file.name === 'world/crags.bin')).toEqual([cragOriginal]);
    expect(hit.blobs.some(file => file.name === 'world/crags.bin')).toBe(false);
    const crags = hit.assets.get(cragOriginal.hash);
    if (crags === undefined) throw new Error('Output lost the owned crag bytes');
    expect(crags.length).toBe(cragOriginal.compressed); expect(hashImmutableBytes(crags)).toBe(cragOriginal.hash);
    expect(Buffer.compare(crags, readFileSync('public/assets/nalati/baked/crags.bin'))).toBe(0);
    expect(hit.namedFiles.filter(file => file.name === 'world/dressing.bin')).toEqual([dressingOriginal]);
    expect(hit.blobs.some(file => file.name === 'world/dressing.bin')).toBe(false);
    const dressing = hit.assets.get(dressingOriginal.hash);
    if (dressing === undefined) throw new Error('Output lost the owned dressing bytes');
    expect(dressing.length).toBe(dressingOriginal.compressed); expect(hashImmutableBytes(dressing)).toBe(dressingOriginal.hash);
    expect(Buffer.compare(dressing, readFileSync('test/fixtures/nalati-dressing.bin'))).toBe(0);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing authored and owned bytes refuse before output publication', async () => {
  for (const [name, pin] of [['crags', cragOriginal]] as const) {
    await expect(nalatiBakeBlob({ cached: (_step, generate) => Promise.resolve(generate(new Map())) }, name, pin.decoded)).rejects.toThrow(`Missing authored ${name} binary`);
    await expect(nalatiBakeBlob({ cached: () => Promise.resolve(new Map()) }, name, pin.decoded)).rejects.toThrow(`Missing owned ${name} binary`);
    await expect(nalatiBakeBlob({ cached: () => Promise.resolve(new Map([[`${name}.bin`, new Uint8Array(1)], ['extra', new Uint8Array(1)]])) }, name, pin.decoded)).rejects.toThrow(`Missing owned ${name} binary`);
  }
});

test('the owned places source stays in one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/placeBlobProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing places source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
