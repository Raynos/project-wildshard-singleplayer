// oxlint-disable-next-line import/no-nodejs-modules -- Native output admission is exercised against real bounded local files.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture stays inside the repository's ignored scratch root.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { outputSectionPayloads, parseOutputIndex } from '../src/format/outputIndex';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';

const bytes = (input: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(input));
test('native output admission supplies checked sections and hash-verified named blobs without a renderer', async () => {
  await mkdir('tmp', { recursive: true });
  const dir = await mkdtemp(resolve('tmp/headless-product-'));
  const put = async (path: string, wire: Uint8Array): Promise<void> => { const file = resolve(dir, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, wire); };
  try {
    const source = emptyShardfile({ slug: 'native-product', name: 'Native', author: 'Test', revision: 1, seed: 1 });
    const blob = new Uint8Array([1, 2, 3]), hash = hashImmutableBytes(blob);
    source.files.push({ hash, kind: 'binary', compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(hash); source.budgets.library = { compressed: 3, resident: 3 };
    const values = new Map(outputSectionPayloads(source)); values.set('custom/native', { count: 7 });
    const sections = await Promise.all([...values].map(async ([name, value]) => {
      const wire = bytes(value), path = `sections/${name}.json`; await put(path, wire);
      return { name, path, hash: hashImmutableBytes(wire), bytes: wire.length,
        schema: name.startsWith('custom/') ? 'schemas/custom/native.schema.json' : `wildshard:${name}@1` };
    }));
    const index = parseOutputIndex({ format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version,
      identity: source.identity, requires: source.requires, build: { sourceHash: hashImmutableBytes(bytes(source)), validator: 'test' },
      admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
      sections, schemas: [{ path: 'schemas/custom/native.schema.json', hash: hashImmutableBytes(bytes({})), bytes: 2 }],
      files: source.files.map(file => ({ ...file, kind: 'bin', name: 'models/native.bin', path: `blobs/bin/${hash}.bin` })), runtime: null });
    await put('shard.json', bytes(index)); await put(`blobs/bin/${hash}.bin`, blob);
    const product = await loadHeadlessProduct(dir);
    expect(product.shardfile).toEqual(source);
    expect(product.section('custom/native', { 'custom/native': v.strictObject({ count: v.number() }) })).toEqual({ count: 7 });
    expect(await product.file('models/native.bin')).toEqual(blob);
    const checked = await loadHeadlessProduct(dir);
    expect(() => checked.section('custom/native', { 'custom/native': v.strictObject({ count: v.string() }) })).toThrow('schema');
    await put(`blobs/bin/${hash}.bin`, new Uint8Array([3, 2, 1]));
    await expect(product.file('models/native.bin')).rejects.toThrow('hash or size');
    await put('shard.json', bytes(source));
    await expect(loadHeadlessProduct(dir)).rejects.toThrow('format-2');
  } finally { await rm(dir, { recursive: true, force: true }); }
  await expect(loadHeadlessProduct(resolve(dir, 'absent-output'))).rejects.toThrow('run `wildshard build absent-output`');
});
