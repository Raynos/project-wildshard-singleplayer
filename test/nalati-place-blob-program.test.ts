import { nativePlaceFile } from './fixtures/nalati-native-place-files';
import { nalatiSpecimens } from './fixtures/nalati-specimens';
import { nalatiBalbal } from './fixtures/nalati-balbal';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the real immutable cache and compare the original shipping bytes.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the exact public input root without inferring an asset path.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { nameBlob, type NamedBlob } from '../src/sdk/blobs';
import { PackedSpecimenSchema } from '../src/format/specimenCatalogue';
import { FixedDrawRowsSchema } from '../src/format/fixedDraws';
import {SceneDressingSchema} from '../src/format/sceneDressing';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { PopulationFieldSchema } from '../src/format/populationEnvironment';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiBakeBlob } from '../src/shards/nalati-grasslands/generators/placeBlobProgram';
import { prepareOutput, prepareSpecies } from '../src/shards/nalati-grasslands/generators/output';
import { build as buildNalati } from '../src/shards/nalati-grasslands/generators/build';
import { originalSpeciesBank, originalSpeciesMetadata } from './fixtures/nalati-species-bank-transport';
import { originalSpeciesOutput } from './fixtures/nalati-original-species';
import speciesPins from './fixtures/nalati-species-files.json' with { type: 'json' };
import headerPin from './fixtures/nalati-species-product-header.json' with { type: 'json' };
import original from './fixtures/nalati-place-blob.json' with { type: 'json' };
import cragOriginal from './fixtures/nalati-crag-blob.json' with { type: 'json' };
import dressingOriginal from './fixtures/nalati-dressing-blob.json' with { type: 'json' };
import sceneOriginal from './fixtures/nalati-dressing-scenes.json' with { type: 'json' };
import assemblyOriginal from './fixtures/nalati-headless-assembly.json' with { type: 'json' };
import shapeBookOriginal from './fixtures/nalati-shape-book.json' with { type: 'json' };
import shapeBookRowsOriginal from './fixtures/nalati-shape-book-original.json' with { type: 'json' };
import * as v from 'valibot';
import { discoverGeneration } from '../scripts/generate.mjs';
import { dressingScene, dressingSceneBlobs } from '../src/shards/nalati-grasslands/generators/dressingScene';
import {originalDressingContactTransport} from './fixtures/nalati-contact-transport';
import { nalatiRuntimeRows } from '../src/shards/nalati-grasslands/generators/runtimeRows';
import { nalatiRuntime } from './fixtures/nalati-runtime';
import { nalatiDecorative } from './fixtures/nalati-decorative';
import { sceneWithNativeOutcrops } from './fixtures/nalati-scene-provenance';
import { withOwnedModelFiles, withPaintedModelParts } from './fixtures/nalati-owned-models';

const modelPartFile = v.looseObject({ name: v.string(), compressed: v.number(), hash: v.string() });
const modelPartsOriginal = v.parse(v.array(v.object({ file: v.string(), geometry: modelPartFile, atlas: v.nullable(modelPartFile) })),
  JSON.parse(readFileSync('test/fixtures/nalati-model-parts.json', 'utf8')));

const paintInput: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/poiPaint.json', 'utf8'));
const productShapeRow = (row: typeof shapeBookRowsOriginal.draws[number]) => 'lane' in row ? { ...row, lane: { file: 'world/places.bin', offset: row.lane.offset } } : row;

const originalAssembly: unknown = JSON.parse(readFileSync('test/fixtures/nalati-headless-original.json', 'utf8'));
const fieldInput: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/data/populationField.generated.json', 'utf8'));
const originalAssemblyRows = v.parse(v.looseObject({ constants: v.looseObject({ nativeField: PopulationFieldSchema }) }), originalAssembly);
const assemblyForField = (field: unknown) => nameBlob(assemblyOriginal.name, 'json', new TextEncoder().encode(encodeCanonicalJson({
  ...originalAssemblyRows, constants: { ...originalAssemblyRows.constants, nativeField: v.parse(PopulationFieldSchema, field) },
})));

/** Only the packed bank locator changes; every predecessor scene field remains strict. */
function sceneWithSpecimenBank(before:NamedBlob,bank:NamedBlob):NamedBlob {
  const name=before.file.name,file=bank.file.name;
  if(name===undefined||file===undefined||before.file.kind!=='json')throw new Error('Missing named scene or bank');
  const rows=v.parse(v.looseObject({catalogues:v.array(v.looseObject({packed:v.exactOptional(PackedSpecimenSchema)}))}),JSON.parse(new TextDecoder().decode(before.bytes)));
  const packed=rows.catalogues[0]?.packed;
  if(packed===undefined||packed.bin!=='/assets/nalati/baked/specimens.bin')throw new Error('Missing original specimen bank locator');
  packed.bin={file,bytes:bank.bytes.byteLength};
  return nameBlob(name,'json',new TextEncoder().encode(encodeCanonicalJson(rows)),before.file.jsonSchema===undefined?{}:{jsonSchema:before.file.jsonSchema});
}

function sceneWithOwnedModels(before: NamedBlob): NamedBlob {
  const name = before.file.name;
  if (name === undefined) throw new Error('Missing named scene');
  const rows: unknown = JSON.parse(new TextDecoder().decode(before.bytes));
  return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(withPaintedModelParts(withOwnedModelFiles(rows), modelPartsOriginal))),
    before.file.jsonSchema === undefined ? {} : { jsonSchema: before.file.jsonSchema });
}

// One genuinely empty cache owns native compilation during fixture preparation.
// The timed case still checks every complete cold/warm file and refusal below.
const coldOutputFixture = await (async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-place-blob-'));
  const requested: string[] = [], steps: string[] = [], constructions = new Map<string, number>();
  let nativePlaces: Uint8Array | undefined;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/nalati/baked/', directory: resolve('public/assets/nalati/baked') },
        { prefix: '/assets/nalati/models/', directory: resolve('public/assets/nalati/models') },
        { prefix: '/assets/baked/nalati-grasslands/', directory: resolve('public/assets/baked/nalati-grasslands') }]);
    return { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      requested.push(...(step.inputs ?? [])); steps.push(step.id);
      return ctx.cached(step, inputs => { constructions.set(step.id, (constructions.get(step.id) ?? 0) + 1); return make(inputs); }).then(files => {
        if (step.id === 'places') nativePlaces = files.get('places.json');
        return files;
      });
    } };
  };
  try {
    const crags = await nalatiBakeBlob(context(), 'crags', cragOriginal.decoded);
    requested.length = 0;
    const shared = context(), header = await buildNalati(shared);
    const output = await prepareOutput(shared);
    const beforeWarm = new Map(constructions), warm = await prepareOutput(context());
    return { cache, requested, steps, constructions, context, crags, header, output, beforeWarm, warm, get nativePlaces() { return nativePlaces; } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
})();

// Build the independent full-scene oracle once beside the genuinely cold product.
// Timed cases keep the original hashes, metadata, full bytes and cache controls.
const sceneParityFixture = (() => {
  const { output: hit, nativePlaces } = coldOutputFixture;
  const beforeBank = nativePlaceFile('specimens.bin');
  const expectedBank = nameBlob('models/specimens/camp.bin', 'bin', beforeBank, { decoded: nalatiSpecimens.packed.bytes });
    if (nativePlaces === undefined) throw new Error('Missing observed native place metadata');
    const ownedPlaces: unknown = JSON.parse(new TextDecoder().decode(nativePlaces));
    const ownedRuntime = nalatiRuntimeRows({ places: ownedPlaces, paint: paintInput }).runtime;
    const frozenScenes = originalDressingContactTransport(dressingSceneBlobs(nalatiDecorative, nalatiRuntime,nalatiBalbal,nalatiSpecimens),
      new Map((['phone','desktop']as const).map(tier=>[`world/dressing-${tier}.json`,dressingScene(tier,nalatiDecorative,nalatiRuntime,nalatiBalbal,nalatiSpecimens)])));
    const expectedScenes = new Map(sceneOriginal.map(pin=>{
      const frozen = frozenScenes.find(blob => blob.file.name === pin.name);
      if (frozen === undefined) throw new Error('Missing frozen complete scene pin');
      const expected = pin.name.endsWith('.json') ? sceneWithOwnedModels(sceneWithSpecimenBank(sceneWithNativeOutcrops(frozen, ownedRuntime),expectedBank)) : frozen;
      return[pin.name,expected]as const;
    }));
    const projectedScenes=originalDressingContactTransport(hit.namedFiles.map(file=>{
      const bytes=hit.assets.get(file.hash);if(bytes===undefined)throw new Error('Missing owned output bytes');return{file,bytes};
    }),new Map([...expectedScenes].filter(([name])=>name.endsWith('.json')).map(([name,blob])=>[name,v.parse(SceneDressingSchema,JSON.parse(new TextDecoder().decode(blob.bytes)))])));
  return { frozenScenes, expectedScenes, projectedScenes };
})();

test('cached held source metadata refuses a changed executable or compiled byte charge', async () => {
  for (const kind of ['executable', 'metadata']) {
    const source = coldOutputFixture.context();
    const corrupted: Parameters<typeof prepareSpecies>[0] = { ...source, cached: async (step, make) => {
      const files = await source.cached(step, make);
      if (step.id !== 'species') return files;
      const changed = new Map(files), name = kind === 'executable' ? 'held-weapons.wasm' : 'species.json';
      const bytes = changed.get(name);
      if (bytes === undefined) throw new Error('Missing owned held source fixture');
      if (kind === 'executable') {
        const copy = bytes.slice(); copy[0] = (copy[0] ?? 0) ^ 1; changed.set(name, copy);
      } else {
        const rows = v.parse(v.looseObject({ compiled: v.looseObject({ bytes: v.number() }) }), JSON.parse(new TextDecoder().decode(bytes)));
        rows.compiled.bytes++;
        changed.set(name, new TextEncoder().encode(JSON.stringify(rows)));
      }
      return changed;
    } };
    await expect(prepareSpecies(corrupted)).rejects.toThrow('Held source metadata differs from owned executable bytes');
  }
  const ready = await prepareSpecies(coldOutputFixture.context());
  expect(ready.held.held.compiled.hash).toBe(hashImmutableBytes(ready.files.get('held-weapons.wasm') ?? new Uint8Array()));
});
afterAll(() => { rmSync(coldOutputFixture.cache, { recursive: true, force: true }); });

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
  expect(jobs).not.toContain('nalati-decorative'); expect(jobs).not.toContain('nalati-quest-prop'); expect(jobs).not.toContain('nalati-balbal-specimen');
  expect(jobs).not.toContain('nalati-dressing'); expect(jobs).not.toContain('nalati-places-blob'); expect(jobs).not.toContain('nalati-crags-blob'); expect(jobs).not.toContain('nalati-dressing-blob');
});

test('the actual output cache hit preserves all complete files without reconstructing a source', () => {
  const { constructions, beforeWarm, warm, output: hit } = coldOutputFixture;
    expect(constructions).toEqual(beforeWarm);
    expect(warm.namedFiles).toEqual(hit.namedFiles);
    for (const file of hit.namedFiles) {
      const first = hit.assets.get(file.hash), next = warm.assets.get(file.hash);
      if (first === undefined || next === undefined) throw new Error('Missing complete cold/warm output file');
      expect(next.byteLength).toBe(first.byteLength);
      expect(hashImmutableBytes(next)).toBe(file.hash);
      expect(Buffer.compare(next, first)).toBe(0);
    }
});

test('the actual cold output hook preserves every predecessor file cost and binary byte', () => {
  const { requested, steps, constructions, output: hit } = coldOutputFixture;
  const before = nativePlaceFile('places.bin');
  const beforeBank=nativePlaceFile('specimens.bin');
  const expectedBank=nameBlob('models/specimens/camp.bin','bin',beforeBank,{decoded:nalatiSpecimens.packed.bytes});
    for (const [name, pin] of [['crags', cragOriginal]] as const) {
      const cold = coldOutputFixture.crags;
      expect(cold.file).toEqual(pin);
      expect(Buffer.compare(cold.bytes, readFileSync(`public/assets/nalati/baked/${name}.bin`))).toBe(0);
      cold.bytes.fill(0);
    }
    const headerBytes = new TextEncoder().encode(JSON.stringify(coldOutputFixture.header));
    expect(headerBytes.length).toBe(headerPin.bytes);
    expect(hashImmutableBytes(headerBytes)).toBe(headerPin.sha256);
    expect(constructions.get('species')).toBe(1);
    expect(constructions.get('model-parts')).toBe(1);
    expect(constructions.get('places')).toBe(1);
    expect(constructions.get('dressing-placement')).toBe(1);
    const modelFiles = hit.namedFiles.filter(file => file.name?.startsWith('models/painted/'));
    const nearModels = ['eagle', 'cauldron', 'firewood', 'kumis-churn', 'chest', 'saddle', 'balbal', 'boulder-1', 'boulder-2', 'boulder-3', 'watchtower', 'snow-lotus', 'horse-saddled', 'kokpar-rider', 'sheep'];
    const modelNames = new Set([...nearModels.flatMap(name => [`${name}.glb`, `${name}.phone.glb`]), 'horse-wild.far.glb', 'kokpar-rider.far.glb']);
    const expectedModels = new Map(modelPartsOriginal.filter(row => modelNames.has(row.file)).flatMap(row =>
      (row.atlas === null ? [row.geometry] : [row.geometry, row.atlas]).map(file => [file.name, file] as const)));
    const byName = (a: { readonly name?: string | undefined }, b: { readonly name?: string | undefined }): number => (a.name ?? '').localeCompare(b.name ?? '');
    expect([...modelFiles].sort(byName)).toEqual([...expectedModels.values()].sort(byName));
    for (const file of modelFiles) {
      const bytes = hit.assets.get(file.hash);
      if (bytes === undefined || file.name === undefined) throw new Error('Missing complete owned model part');
      expect(bytes.byteLength).toBe(file.compressed);
      expect(hashImmutableBytes(bytes)).toBe(file.hash);
    }
    expect(steps).toContain('species');
    expect(requested).toContain('/assets/nalati/baked/bodies.bin');
    for (const source of ['data/species.generated.json', 'boot/speciesRows.generated.json', 'behaviour/held-weapons.generated.wasm', 'behaviour/held-witness.generated.bin']) expect(requested).not.toContain(source);
    expect(steps).toContain('model-parts');
    expect(steps).toContain('dressing-placement');
    expect(requested).toContain('data/geography-forest.bin');
    for (const file of modelNames) expect(requested).toContain(`/assets/nalati/models/${file}`);
    expect(hit.namedFiles.filter(file=>file.name===expectedBank.file.name)).toEqual([expectedBank.file]);
    const bankBytes = hit.assets.get(expectedBank.file.hash);
    if (bankBytes === undefined) throw new Error('Missing owned specimen bank bytes');
    expect(bankBytes.byteLength).toBe(beforeBank.byteLength);
    expect(hashImmutableBytes(bankBytes)).toBe(expectedBank.file.hash);
    expect(Buffer.compare(bankBytes, beforeBank)).toBe(0);
    const { frozenScenes, expectedScenes, projectedScenes } = sceneParityFixture;
    expect(frozenScenes.map(blob => ({ name: blob.file.name, bytes: blob.bytes.length, hash: blob.file.hash }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
      .toEqual([...sceneOriginal].sort((a, b) => a.name.localeCompare(b.name)));
    expect(requested).not.toContain('data/placeRuntime.generated.json');
    expect(requested).not.toContain('data/quest-prop.generated.bin');
    for (const index of [0, 1]) {
      expect(requested).not.toContain(`data/balbal-carving-${String(index)}.generated.bin`);
      const originalPart = readFileSync(`test/fixtures/nalati-balbal-original-${String(index)}.bin`);
      const pin = nameBlob(`models/specimens/balbal-${String(index)}.bin`, 'bin', originalPart);
      expect(hit.namedFiles.find(file => file.name === pin.file.name)).toEqual(pin.file);
      const ownedPart = hit.assets.get(pin.file.hash);
      if (ownedPart === undefined) throw new Error('Missing owned balbal carving bytes');
      expect(Buffer.compare(ownedPart, originalPart)).toBe(0);
    }
    const propBefore = readFileSync('test/fixtures/nalati-quest-prop-original.bin');
    const propPin = nameBlob('models/specimens/quest-prop.bin', 'bin', propBefore);
    expect(hit.namedFiles.find(file => file.name === propPin.file.name)).toEqual(propPin.file);
    const propBytes = hit.assets.get(propPin.file.hash);
    if (propBytes === undefined) throw new Error('Missing owned quest prop bytes');
    expect(Buffer.compare(propBytes, propBefore)).toBe(0);
    for (const index of [0, 1]) {
      expect(requested).not.toContain(`data/place-floor-${String(index)}.generated.bin`);
      const beforeFloor = readFileSync(`test/fixtures/nalati-floor-original-${String(index)}.bin`);
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
    const beforeShapes = new TextEncoder().encode(encodeCanonicalJson(shapeBookRowsOriginal.draws));
    const { jsonSchema: _beforeSchema, ...beforeShapePin } = shapeBookOriginal;
    expect(nameBlob(shapeBookOriginal.name, 'json', beforeShapes).file).toEqual(beforeShapePin);
    const expectedShapes = nameBlob(shapeBookOriginal.name, 'json', new TextEncoder().encode(encodeCanonicalJson(shapeBookRowsOriginal.draws.map(productShapeRow))), { jsonSchema: namedJsonSchema(FixedDrawRowsSchema) });
    expect(shapeBook).toEqual(expectedShapes.file);
    const shapeBytes = hit.assets.get(expectedShapes.file.hash);
    if (shapeBytes === undefined) throw new Error('Missing original native shape book');
    expect(shapeBytes.length).toBe(expectedShapes.file.compressed);
    expect(hashImmutableBytes(shapeBytes)).toBe(expectedShapes.file.hash);
    expect(Buffer.compare(shapeBytes, expectedShapes.bytes)).toBe(0);
    expect(steps).toContain('decorative');
    for (const [name,expected] of expectedScenes) {
      const projected=projectedScenes.find(row=>row.file.name===name);
      if(projected===undefined)throw new Error('Missing owned dressing scene');
      const {file,bytes}=projected;
      expect(file).toEqual(expected.file);
      expect(bytes.length).toBe(expected.file.compressed);
      expect(hashImmutableBytes(bytes)).toBe(expected.file.hash);
      expect(Buffer.compare(bytes, expected.bytes)).toBe(0);
    }
    expect(requested).not.toContain('/assets/nalati/baked/dressing.bin');
    expect(requested).not.toContain('/assets/nalati/baked/places.bin');
    expect(requested).not.toContain('/assets/nalati/baked/specimens.bin');
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

// Each independent control retains the same real source/cache path and 30 s case cap.
test('the output hook consumes supplied shelters and refuses malformed native metadata', async () => {
  const { context } = coldOutputFixture;
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

});

test('the output hook refuses all original missing and malformed producer inventories', async () => {
  const { context } = coldOutputFixture;
    const ctx = context();
    await expect(prepareOutput({ ...ctx, cached: (step, make) => step.id === 'species'
      ? Promise.resolve(new Map()) : ctx.cached(step, make) })).rejects.toThrow('Owned species inventory differs');
    await expect(prepareOutput({ ...ctx, cached: (step, make) => step.id === 'dressing-placement'
      ? Promise.resolve(new Map()) : ctx.cached(step, make) })).rejects.toThrow('Owned Nalati dressing placement inventory differs');
    await expect(prepareOutput({ ...ctx, cached: async (step, make) => {
      const files = await ctx.cached(step, make);
      if (step.id !== 'dressing-placement') return files;
      const changed = new Map(files);
      changed.set('dressing-boulder.json', new TextEncoder().encode('{}'));
      return changed;
    } })).rejects.toThrow();
    await expect(prepareOutput({ ...ctx, cached: (step, make) => step.id === 'model-parts'
      ? Promise.resolve(new Map()) : ctx.cached(step, make) })).rejects.toThrow('Nalati model-part inventory differs');
    await expect(prepareOutput({ ...ctx, cached: (step, make) => step.id === 'decorative'
      ? Promise.resolve(new Map()) : ctx.cached(step, make) })).rejects.toThrow('Owned Nalati decorative inventory differs');
    await expect(prepareOutput({ ...ctx, cached: async (step, make) => {
      const source=await ctx.cached(step,make);
      if(step.id!=='places')return source;
      const missing=new Map(source);missing.delete('specimens.bin');return missing;
    } })).rejects.toThrow('Owned Nalati placement inventory differs');

});


test('the owned species bank preserves its full predecessor and needs no public inventory loan', async () => {
  const ctx = coldOutputFixture.context();
  const withoutInventory: ReturnType<typeof createProjectGeneration> = { ...ctx };
  delete withoutInventory.inputFiles;
  const species = await prepareSpecies(withoutInventory), bank = species.files.get('bodies.bin'), metadata = species.files.get('species.json');
  if (bank === undefined || metadata === undefined) throw new Error('Missing owned species bank');
  expect(bank.byteLength).toBe(originalSpeciesBank.bytes);
  expect(hashImmutableBytes(bank)).toBe(originalSpeciesBank.sha256);
  expect(Buffer.compare(bank, originalSpeciesOutput(originalSpeciesBank.path))).toBe(0);
  const before = speciesPins.find(pin => pin.path.endsWith('/species.generated.json'));
  if (before === undefined) throw new Error('Missing full original species metadata pin');
  const originalRows = new TextEncoder().encode(`${JSON.stringify(originalSpeciesMetadata(JSON.parse(new TextDecoder().decode(metadata))), null, 2)}\n`);
  expect(originalRows.length).toBe(before.bytes); expect(hashImmutableBytes(originalRows)).toBe(before.sha256);
  const expected = nameBlob('actors/bodies.bin', 'bin', bank, { decoded: species.rows.packedBodies.bytes });
  expect(coldOutputFixture.output.namedFiles.filter(file => file.name === 'actors/bodies.bin')).toEqual([expected.file]);
  const bytes = coldOutputFixture.output.assets.get(expected.file.hash);
  if (bytes === undefined) throw new Error('Missing admitted named body bytes');
  expect(Buffer.compare(bytes, bank)).toBe(0);
  await expect(prepareSpecies({ ...ctx, cached: (step, make) => ctx.cached(step, make).then(files => {
    if (step.id !== 'species') return files;
    const changed = new Map(files), rows = JSON.parse(new TextDecoder().decode(metadata)) as unknown;
    const shape = v.looseObject({ packedBodies: v.looseObject({ file: v.string() }) });
    if (!v.is(shape, rows)) throw new Error('Missing source body locator');
    rows.packedBodies.file = originalSpeciesBank.path.slice('public'.length);
    changed.set('species.json', new TextEncoder().encode(JSON.stringify(rows)));
    return changed;
  }) })).rejects.toThrow('Species body locator differs');
}, 30000);
