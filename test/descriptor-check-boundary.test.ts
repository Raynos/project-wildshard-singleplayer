import { expect, test, vi } from 'vitest';
import { build } from 'vite';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { outputSectionPayloads } from '../src/format/outputFields';
import type { resolveOutputDescriptor } from '../src/game/shardfile/outputDescriptor';
import type { admitProduct, ProductOptions } from '../src/game/shardfile/product';
import type { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { readCheckedOutputIndex } from '../src/game/shardfile/outputIndexChecks';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute and remove one real browser build as an owned temporary module.
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the temporary browser module under the repository scratch root.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Native import evaluates the bundled browser entry without a browser or eval shim.
import { pathToFileURL } from 'node:url';

function resolverModule(input: unknown): input is { resolveOutputDescriptor: typeof resolveOutputDescriptor; admitProduct: typeof admitProduct;
  createShardProduct: typeof createShardProduct; readCheckedOutputIndex: typeof readCheckedOutputIndex } {
  return typeof input === 'object' && input !== null && 'resolveOutputDescriptor' in input && typeof input.resolveOutputDescriptor === 'function'
    && 'admitProduct' in input && typeof input.admitProduct === 'function'
    && 'createShardProduct' in input && typeof input.createShardProduct === 'function'
    && 'readCheckedOutputIndex' in input && typeof input.readCheckedOutputIndex === 'function';
}

test('browser products need a build proof and bundle no checked host intake', async () => {
  const encode = (input: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(input));
  const source = emptyShardfile({ slug: 'browser-descriptor', name: 'Browser', author: 'Test', revision: 1, seed: 1 });
  const values = outputSectionPayloads(source), wires = new Map([...values].map(([name, value]) => [`sections/${name}.json`, encode(value)]));
  const index = { format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity,
    requires: source.requires, build: { sourceHash: hashImmutableBytes(encode(source)), validator: 'browser-boundary' },
    admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
    sections: [...values].map(([name]) => {
      const path = `sections/${name}.json`, bytes = wires.get(path); if (bytes === undefined) throw new Error('Missing section');
      return { name, path, bytes: bytes.length, hash: hashImmutableBytes(bytes), schema: `wildshard:${name}@1` };
    }), schemas: [], files: [], runtime: null };
  const entry = new URL('../descriptor-check-boundary', import.meta.url).pathname;
  const productEntry = new URL('../src/game/shardfile/product.ts', import.meta.url).pathname;
  const metadataEntry = new URL('../src/game/shardfile/outputIndexChecks.ts', import.meta.url).pathname;
  const result = await build({ configFile: false, publicDir: false, logLevel: 'silent',
    define: { __SHARDFILE_VALIDATOR__: JSON.stringify('browser-boundary'), __SHARDFILE_VERDICTS__: JSON.stringify([{ revision: 'browser-boundary',
      sourceHash: index.build.sourceHash, indexHash: hashImmutableBytes(encode(index)), worst: { playing: 0, loading: 0, accounted: 0, location: [0, 0] } }]) },
    plugins: [{ name: 'descriptor-check-boundary', resolveId(id) { return id === entry ? '\0descriptor-check-boundary' : null; },
      load(id) { return id === '\0descriptor-check-boundary' ? `export {resolveOutputDescriptor} from '@wildshard/game/shardfile/outputDescriptor';
        export {admitProduct} from ${JSON.stringify(productEntry)};
        export {readCheckedOutputIndex} from ${JSON.stringify(metadataEntry)};
        export {createShardProduct} from '@wildshard/game/shardfile/shardProduct';` : null; } }],
    build: { write: false, minify: false, lib: { entry, formats: ['es'] }, rolldownOptions: { output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing descriptor bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'), modules = chunks.flatMap(chunk => Object.keys(chunk.modules));
  expect(chunks).toHaveLength(1);
  for (const name of ['outputIndex', 'shardSchema', 'product', 'assetAdmission', 'scriptAdmission']) {
    expect(modules.some(id => id.endsWith(`/src/format/${name}.ts`)), name).toBe(false);
  }
  expect(modules.some(id => id.endsWith('/shardfile/customSchema.ts'))).toBe(false);
  const code = chunks.map(chunk => chunk.code).join('\n');
  await mkdir('tmp', { recursive: true });
  const dir = await mkdtemp(resolve('tmp/browser-descriptor-')), file = resolve(dir, 'reader.mjs');
  let loaded: unknown;
  try { await writeFile(file, code); loaded = await import(pathToFileURL(file).href); }
  finally { await rm(dir, { recursive: true, force: true }); }
  if (!resolverModule(loaded)) throw new Error('Missing browser resolver');
  const read = vi.fn((path: string) => {
    const bytes = wires.get(path); if (bytes === undefined) throw new Error('Missing section');
    return Promise.resolve(Uint8Array.from(bytes));
  }), hash = vi.fn((bytes: Uint8Array) => Promise.resolve(hashImmutableBytes(bytes)));
  const reader = { offline: false, firstParty: true, read, hash };
  expect(await loaded.resolveOutputDescriptor(index, reader)).toEqual(source);
  expect(read).toHaveBeenCalledTimes(index.sections.length);
  read.mockClear(); hash.mockClear();
  await expect(loaded.resolveOutputDescriptor({ ...index, identity: { ...index.identity, revision: 2 } }, reader))
    .rejects.toThrow('server validation');
  expect(read).not.toHaveBeenCalled();
  await expect(loaded.resolveOutputDescriptor(index, { ...reader, firstParty: false })).rejects.toThrow('server validation');
  expect(read).not.toHaveBeenCalled();
  const fetch = vi.fn((url: string) => {
    const bytes = wires.get(url.slice('https://fixture.test/'.length));
    return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(Uint8Array.from(bytes)));
  });
  const options: ProductOptions = { base: 'https://fixture.test/', offline: false, firstParty: true, hash, fetch };
  const admitted = await loaded.admitProduct(index, options);
  expect(admitted.source).toEqual(source);
  expect((await loaded.admitProduct(admitted.source, options)).source).toBe(admitted.source);
  fetch.mockClear();
  admitted.source.identity.name = 'Changed exposed source';
  await expect(loaded.admitProduct(admitted.source, options)).rejects.toThrow('Built shardfile changed after verification');
  expect(fetch).not.toHaveBeenCalled();
  await expect(loaded.admitProduct(structuredClone(source), options)).rejects.toThrow('server validation');
  expect(fetch).not.toHaveBeenCalled();
  await expect(loaded.readCheckedOutputIndex(index)).rejects.toThrow('server validation');
  const jsonBytes = encode({ value: 7 }), jsonHash = hashImmutableBytes(jsonBytes);
  const jsonInput = { slug: source.identity.slug, revision: 1, shardfile: source, sections: values,
    files: new Map([['value.json', { hash: jsonHash, url: '/value.json', jsonSchema: { type: 'object', properties: { value: { type: 'number' } } } }]]),
    read: vi.fn(() => Promise.resolve(jsonBytes)) };
  expect(await loaded.createShardProduct({ ...jsonInput, builtJson: true }).json<{ value: number }>('value.json')).toEqual({ value: 7 });
  await expect(loaded.createShardProduct(jsonInput).json('value.json')).rejects.toThrow('server validation');
  await expect(loaded.createShardProduct({ ...jsonInput, builtJson: true, read: () => Promise.resolve(new TextEncoder().encode('{broken')) }).json('value.json')).rejects.toThrow();
  await expect(loaded.createShardProduct({ ...jsonInput, builtJson: true, read: () => Promise.resolve(new Uint8Array([255])) }).json('value.json')).rejects.toThrow();
  const first = index.sections[0]; if (first === undefined) throw new Error('Missing section');
  wires.set(first.path, new Uint8Array(first.bytes));
  await expect(loaded.resolveOutputDescriptor(index, reader)).rejects.toThrow('section hash or size mismatch');
});
