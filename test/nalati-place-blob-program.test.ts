// oxlint-disable-next-line import/no-nodejs-modules -- Own the real immutable cache and compare the original shipping bytes.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the exact public input root without inferring an asset path.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiPlaceBlob } from '../src/shards/nalati-grasslands/generators/placeBlobProgram';
import { prepareOutput } from '../src/shards/nalati-grasslands/generators/output';
import original from './fixtures/nalati-place-blob.json' with { type: 'json' };
import { discoverGeneration } from '../scripts/generate.mjs';

test('the duplicate places-copy job stays retired', () => {
  expect(discoverGeneration(resolve('.')).jobs.map(job => job.id)).not.toContain('nalati-places-blob');
});

test('the actual output hook preserves every predecessor file cost and binary byte on cold and cache hit', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-place-blob-'));
  const context = () => createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
    [{ prefix: '/assets/nalati/baked/', directory: resolve('public/assets/nalati/baked') }]);
  const before = readFileSync('public/assets/nalati/baked/places.bin');
  try {
    const cold = await nalatiPlaceBlob(context(), original.decoded);
    expect(cold.file).toEqual(original); expect(Buffer.compare(cold.bytes, before)).toBe(0);
    cold.bytes.fill(0);
    const hit = await prepareOutput(context());
    const files = hit.namedFiles.filter(file => file.name === 'world/places.bin');
    expect(files).toEqual([original]); expect(hit.blobs.some(file => file.name === 'world/places.bin')).toBe(false);
    const bytes = hit.assets.get(original.hash);
    if (bytes === undefined) throw new Error('Output lost the owned places bytes');
    expect(bytes.length).toBe(original.compressed); expect(hashImmutableBytes(bytes)).toBe(original.hash);
    expect(Buffer.compare(bytes, before)).toBe(0);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing authored and owned bytes refuse before output publication', async () => {
  await expect(nalatiPlaceBlob({ cached: (_step, generate) => Promise.resolve(generate(new Map())) }, original.decoded)).rejects.toThrow('Missing authored places binary');
  await expect(nalatiPlaceBlob({ cached: () => Promise.resolve(new Map()) }, original.decoded)).rejects.toThrow('Missing owned places binary');
  await expect(nalatiPlaceBlob({ cached: () => Promise.resolve(new Map([['places.bin', new Uint8Array(1)], ['extra', new Uint8Array(1)]])) }, original.decoded)).rejects.toThrow('Missing owned places binary');
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
