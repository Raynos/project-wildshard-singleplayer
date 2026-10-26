// oxlint-disable-next-line import/no-nodejs-modules -- Own the real immutable cache and compare the original shipping bytes.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the exact public input root without inferring an asset path.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { nameBlob } from '../src/sdk/blobs';
import { PopulationFieldSchema } from '../src/format/populationEnvironment';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiBakeBlob } from '../src/shards/nalati-grasslands/generators/placeBlobProgram';
import { prepareOutput } from '../src/shards/nalati-grasslands/generators/output';
import original from './fixtures/nalati-place-blob.json' with { type: 'json' };
import cragOriginal from './fixtures/nalati-crag-blob.json' with { type: 'json' };
import dressingOriginal from './fixtures/nalati-dressing-blob.json' with { type: 'json' };
import sceneOriginal from './fixtures/nalati-dressing-scenes.json' with { type: 'json' };
import assemblyOriginal from './fixtures/nalati-headless-assembly.json' with { type: 'json' };
import shapeBookOriginal from './fixtures/nalati-shape-book.json' with { type: 'json' };
import * as v from 'valibot';
import { discoverGeneration } from '../scripts/generate.mjs';
import { dressingSceneBlobs } from '../src/shards/nalati-grasslands/generators/dressingScene';
import { nalatiRuntimeRows } from '../src/shards/nalati-grasslands/generators/runtimeRows';
import { nalatiRuntime } from './fixtures/nalati-runtime';
import { nalatiDecorative } from './fixtures/nalati-decorative';
import { sceneWithNativeOutcrops } from './fixtures/nalati-scene-provenance';

const paintInput: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/poiPaint.json', 'utf8'));

const originalAssembly: unknown = JSON.parse(readFileSync('test/fixtures/nalati-headless-original.json', 'utf8'));
const fieldInput: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/populationField.generated.json', 'utf8'));
const originalAssemblyRows = v.parse(v.looseObject({ constants: v.looseObject({ nativeField: PopulationFieldSchema }) }), originalAssembly);
const assemblyForField = (field: unknown) => nameBlob(assemblyOriginal.name, 'json', new TextEncoder().encode(encodeCanonicalJson({
  ...originalAssemblyRows, constants: { ...originalAssemblyRows.constants, nativeField: v.parse(PopulationFieldSchema, field) },
})));

test('the full frozen assembly pin and exact current geography input retain separate ownership', () => {
  expect(assemblyForField(originalAssemblyRows.constants.nativeField).file).toEqual(assemblyOriginal);
  const current = assemblyForField(fieldInput);
  const rows = v.parse(v.object({ constants: v.object({ nativeField: PopulationFieldSchema }) }), JSON.parse(new TextDecoder().decode(current.bytes)));
  expect(rows.constants.nativeField).toStrictEqual(v.parse(PopulationFieldSchema, fieldInput));
  expect(() => assemblyForField({})).toThrow();
});

test('native dressing and duplicate scene-copy jobs stay retired', () => {
  const descriptors = discoverGeneration(resolve('.')).jobs;
  const jobs = descriptors.map(job => job.id);
  expect(jobs).not.toContain('nalati-decorative');
  expect(jobs).not.toContain('nalati-dressing'); expect(jobs).not.toContain('nalati-places-blob'); expect(jobs).not.toContain('nalati-crags-blob'); expect(jobs).not.toContain('nalati-dressing-blob');
});

test('the actual output hook preserves every predecessor file cost and binary byte on cold and cache hit', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-place-blob-'));
  const requested: string[] = [], steps: string[] = [];
  let nativePlaces: Uint8Array | undefined;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/nalati/baked/', directory: resolve('public/assets/nalati/baked') },
        { prefix: '/assets/baked/nalati-grasslands/', directory: resolve('public/assets/baked/nalati-grasslands') }]);
    return { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      requested.push(...(step.inputs ?? [])); steps.push(step.id); return ctx.cached(step, make).then(files => {
        if (step.id === 'places') nativePlaces = files.get('places.json');
        return files;
      });
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
    if (nativePlaces === undefined) throw new Error('Missing observed native place metadata');
    const ownedPlaces: unknown = JSON.parse(new TextDecoder().decode(nativePlaces));
    const ownedRuntime = nalatiRuntimeRows({ places: ownedPlaces, paint: paintInput }).runtime;
    const frozenScenes = dressingSceneBlobs(nalatiDecorative, nalatiRuntime);
    expect(frozenScenes.map(blob => ({ name: blob.file.name, bytes: blob.bytes.length, hash: blob.file.hash }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
      .toEqual([...sceneOriginal].sort((a, b) => a.name.localeCompare(b.name)));
    expect(requested).not.toContain('data/placeRuntime.generated.json');
    expect(requested).not.toContain('data/quest-prop.generated.bin');
    const propBefore = readFileSync('src/shards/nalati-grasslands/data/quest-prop.generated.bin');
    const propPin = nameBlob('models/specimens/quest-prop.bin', 'bin', propBefore);
    expect(hit.namedFiles.find(file => file.name === propPin.file.name)).toEqual(propPin.file);
    const propBytes = hit.assets.get(propPin.file.hash);
    if (propBytes === undefined) throw new Error('Missing owned quest prop bytes');
    expect(Buffer.compare(propBytes, propBefore)).toBe(0);
    for (const index of [0, 1]) {
      expect(requested).not.toContain(`data/place-floor-${String(index)}.generated.bin`);
      const beforeFloor = readFileSync(`src/shards/nalati-grasslands/data/place-floor-${String(index)}.generated.bin`);
      const expectedFloor = nameBlob(`world/floors/${String(index)}.bin`, 'bin', beforeFloor);
      expect(hit.namedFiles.find(file => file.name === expectedFloor.file.name)).toEqual(expectedFloor.file);
      const floorBytes = hit.assets.get(expectedFloor.file.hash);
      if (floorBytes === undefined) throw new Error('Missing owned native floor bytes');
      expect(Buffer.compare(floorBytes, beforeFloor)).toBe(0);
    }
    const assembly = hit.namedFiles.find(row => row.name === assemblyOriginal.name);
    const expectedAssembly = assemblyForField(fieldInput);
    expect(assembly).toEqual(expectedAssembly.file);
    const assemblyBytes = hit.assets.get(expectedAssembly.file.hash);
    if (assemblyBytes === undefined) throw new Error('Missing original native assembly bytes');
    expect(assemblyBytes.length).toBe(expectedAssembly.file.compressed);
    expect(hashImmutableBytes(assemblyBytes)).toBe(expectedAssembly.file.hash);
    expect(Buffer.compare(assemblyBytes, expectedAssembly.bytes)).toBe(0);
    const shapeBook = hit.namedFiles.find(row => row.name === shapeBookOriginal.name);
    expect(shapeBook).toEqual(shapeBookOriginal);
    const shapeBytes = hit.assets.get(shapeBookOriginal.hash);
    if (shapeBytes === undefined) throw new Error('Missing original native shape book');
    expect(shapeBytes.length).toBe(shapeBookOriginal.compressed);
    expect(hashImmutableBytes(shapeBytes)).toBe(shapeBookOriginal.hash);
    const readShelters = (output: Awaited<ReturnType<typeof prepareOutput>>) => {
      const file = output.namedFiles.find(row => row.name === assemblyOriginal.name);
      const bytes = file === undefined ? undefined : output.assets.get(file.hash);
      if (bytes === undefined) throw new Error('Missing owned native assembly');
      return v.parse(v.object({ constants: v.object({ nativeShelters: v.array(v.tuple([v.number(), v.number(), v.number()])) }) }),
        JSON.parse(new TextDecoder().decode(bytes))).constants.nativeShelters;
    };
    const suppliedContext = context();
    const supplied = await prepareOutput({ ...suppliedContext, cached: async (step, make) => {
      const files = await suppliedContext.cached(step, make);
      if (step.id !== 'places') return files;
      const changed = new Map(files);
      const document = files.get('places.json');
      if (document === undefined) throw new Error('Missing supplied native places');
      const metadata = v.parse(v.looseObject({ rows: v.array(v.looseObject({ colliders: v.array(v.unknown()) })) }),
        JSON.parse(new TextDecoder().decode(document)));
      const rows: typeof metadata.rows = [];
      for (const [index, row] of metadata.rows.entries()) {
        const copy = { ...row };
        copy.colliders = index === 0 ? [{ x: 18, z: -25, hw: 3, hd: 3, yTop: 4, yBottom: 0 }] : [];
        rows.push(copy);
      }
      changed.set('places.json', new TextEncoder().encode(JSON.stringify({ ...metadata, rows })));
      return changed;
    } });
    expect(readShelters(supplied)).toEqual([[18, -25, 3 / .93]]);
    await expect(prepareOutput({ ...suppliedContext, cached: async (step, make) => {
      const files = await suppliedContext.cached(step, make);
      if (step.id !== 'places') return files;
      const changed = new Map(files);
      changed.set('places.json', new TextEncoder().encode('{"rows":[{"colliders":[{"x":null}]}]}'));
      return changed;
    } })).rejects.toThrow();
    expect(steps).toContain('decorative');
    for (const pin of sceneOriginal) {
      const file = hit.namedFiles.find(row => row.name === pin.name), bytes = file === undefined ? undefined : hit.assets.get(file.hash);
      if (file === undefined || bytes === undefined) throw new Error('Missing owned dressing scene');
      const frozen = frozenScenes.find(blob => blob.file.name === pin.name);
      if (frozen === undefined) throw new Error('Missing frozen complete scene pin');
      const expected = pin.name.endsWith('.json') ? sceneWithNativeOutcrops(frozen, ownedRuntime) : frozen;
      expect(file).toEqual(expected.file);
      expect(bytes.length).toBe(expected.file.compressed);
      expect(hashImmutableBytes(bytes)).toBe(expected.file.hash);
      expect(Buffer.compare(bytes, expected.bytes)).toBe(0);
    }
    const ctx = context();
    await expect(prepareOutput({ ...ctx, cached: (step, make) => step.id === 'decorative'
      ? Promise.resolve(new Map()) : ctx.cached(step, make) })).rejects.toThrow('Owned Nalati decorative inventory differs');
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
