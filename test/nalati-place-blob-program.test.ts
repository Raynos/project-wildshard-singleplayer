// oxlint-disable-next-line import/no-nodejs-modules -- Retire this suite's private source cache after its original controls.
import { rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Declare the exact public input root without inferring an asset path.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import type { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nameBlob } from '../src/sdk/blobs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiBakeBlob } from '../src/shards/nalati-grasslands/generators/placeBlobProgram';
import { prepareOutput, prepareSpecies } from '../src/shards/nalati-grasslands/generators/output';
import cragOriginal from './fixtures/nalati-crag-blob.json' with { type: 'json' };
import assemblyOriginal from './fixtures/nalati-headless-assembly.json' with { type: 'json' };
import * as v from 'valibot';

import { coldOutputFixture } from './fixtures/nalati-output-cache';

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


test('the owned species bank needs no public inventory loan and rejects foreign locators', async () => {
  const ctx = coldOutputFixture.context();
  const withoutInventory: ReturnType<typeof createProjectGeneration> = { ...ctx };
  delete withoutInventory.inputFiles;
  const species = await prepareSpecies(withoutInventory), bank = species.files.get('bodies.bin'), metadata = species.files.get('species.json');
  if (bank === undefined || metadata === undefined) throw new Error('Missing owned species bank');
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
    rows.packedBodies.file = '/foreign/bodies.bin';
    changed.set('species.json', new TextEncoder().encode(JSON.stringify(rows)));
    return changed;
  }) })).rejects.toThrow('Species body locator differs');
}, 30000);
