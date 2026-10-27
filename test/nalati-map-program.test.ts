// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed map inputs.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve repository paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { nalatiMapFiles } from '../src/shards/nalati-grasslands/generators/mapAssembly.mjs';
import { NALATI_MAP_INPUTS, nalatiMap, nalatiMapPixels } from '../src/shards/nalati-grasslands/generators/mapProgram';
import { generatedProjectMap } from '../src/sdk/projectMap';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/nalati-map-files.json' with { type: 'json' };

// Cold native construction precedes the timed assertions; every resulting byte
// is checked against the predecessor, rather than a copied authored projection.
const files = await nalatiMapFiles(path => new Uint8Array(readFileSync(resolve(path))));
const bank = new Map(NALATI_MAP_INPUTS.map(name => [name, new Uint8Array(readFileSync(name.startsWith('/') ? `public${name}` : `src/shards/nalati-grasslands/${name}`))]));

test('Nalati owns the complete original scene and packed geometry bytes', () => {
  for (const [index, name] of ['map/assembly.json', 'map/geometry.bin'].entries()) {
    const bytes = files.get(name), before = original[index];
    if (bytes === undefined || before === undefined) throw new Error('Missing original Nalati map oracle');
    expect(bytes.byteLength, before.path).toBe(before.bytes);
    expect(hashImmutableBytes(bytes), before.path).toBe(before.hash);
  }
});

// GR6: the map is a source program (the sidecar's prepareMap); the image it publishes keeps the original bytes
test('the map program paints the full original native map image', async () => {
  const pixels = await nalatiMap({ cached: (step, make) => Promise.resolve(make(new Map((step.inputs ?? []).map(name => [name, bank.get(name) ?? new Uint8Array()])))) });
  const image = await generatedProjectMap({ pixels }, 'f'.repeat(64)), before = original[2];
  if (before === undefined) throw new Error('Missing original Nalati image oracle');
  expect(image.map.bytes.byteLength).toBe(before.bytes);
  expect(hashImmutableBytes(image.map.bytes)).toBe(before.hash);
});

test('the map program refuses an undeclared input', async () => {
  for (const omitted of ['data/campMaterials.json', '/assets/nalati/baked/crags.bin']) {
    const missing = new Map(bank); missing.delete(omitted);
    await expect(nalatiMapPixels(missing), omitted).rejects.toThrow('Undeclared Nalati map input');
  }
});
