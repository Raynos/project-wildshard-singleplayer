import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson as canonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { OUTPUT_SECTIONS, outputSectionPayloads, parseOutputIndex, type OutputIndex } from '../src/format/outputIndex';
import { parseShardfile, type Shardfile } from '../src/format/shardSchema';
import { readProductDescriptor, admitProduct, type CachedProduct, type ProductCache, type ProductOptions } from '../src/game/shardfile/product';
import { provideHybridDeclaration, runtimeProduct } from '../src/game/shardfile/runtimeProduct';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { outputBlobUrl, outputDescriptor, resolveOutputDescriptor } from '../src/game/shardfile/outputDescriptor';

const encodeCanonicalJson = (value: unknown): Uint8Array => new TextEncoder().encode(canonicalJson(value));
const base = 'https://example.test/shardfiles/loader-fixture/';
const hash = (bytes: Uint8Array): Promise<string> => Promise.resolve(hashImmutableBytes(bytes));
function fixture(blob = false): { source: Shardfile; index: OutputIndex; wires: Map<string, Uint8Array> } {
  const source = emptyShardfile({ slug: 'loader-fixture', name: 'Loader', author: 'Test', revision: 1, seed: 1 });
  const wires = new Map<string, Uint8Array>();
  if (blob) {
    const bytes = new Uint8Array([1, 2, 3]), ref = hashImmutableBytes(bytes);
    source.files.push({ hash: ref, kind: 'binary', compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(ref); source.budgets.library = { resident: 3, compressed: 3 };
    wires.set(`blobs/bin/${ref}.bin`, bytes);
  }
  const sections = [...outputSectionPayloads(source)].map(([name, payload]) => {
    const mapping = OUTPUT_SECTIONS.find(row => row.name === name);
    if (mapping === undefined) throw new Error('Missing section mapping');
    const bytes = encodeCanonicalJson(payload), path = `sections/${name}.json`;
    wires.set(path, bytes);
    return { name, path, schema: `wildshard:${name}@1`, hash: hashImmutableBytes(bytes), bytes: bytes.length };
  });
  const index = parseOutputIndex({ format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version,
    identity: source.identity, build: { sourceHash: hashImmutableBytes(encodeCanonicalJson(source)), validator: 'test' }, requires: source.requires,
    admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
    sections, schemas: [], files: source.files.map(file => ({ ...file, kind: 'bin', path: `blobs/bin/${file.hash}.bin` })), runtime: null });
  wires.set('shard.json', encodeCanonicalJson(index));
  return { source, index, wires };
}
function options(wires: ReadonlyMap<string, Uint8Array>, cache?: ProductCache): ProductOptions {
  return { base, offline: false, firstParty: true, hash, ...(cache === undefined ? {} : { cache }), fetch: url => {
    const bytes = wires.get(url.slice(base.length));
    return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(Uint8Array.from(bytes)));
  } };
}
function cacheStore(): { cache: ProductCache; bytes: Map<string, Uint8Array>; product: () => CachedProduct | null } {
  const bytes = new Map<string, Uint8Array>(); let product: CachedProduct | null = null;
  return { bytes, product: () => product, cache: {
    product: () => Promise.resolve(product), asset: (_base, ref) => Promise.resolve(bytes.get(ref) ?? null),
    putAsset: (_base, ref, wire) => { bytes.set(ref, Uint8Array.from(wire)); return Promise.resolve(true); },
    putProduct: (_base, value) => { product = structuredClone(value); return Promise.resolve(); },
  } };
}

test('v2 sections reconstruct host values and refuse the old monolithic transport', async () => {
  const { source, wires } = fixture(true), opts = options(wires);
  const read = await readProductDescriptor(opts);
  expect(read).toEqual(parseShardfile(source));
  provideHybridDeclaration(read);
  expect(runtimeProduct(parseShardfile(source)).source).toBe(read);
  const file = read.files[0]; if (file === undefined) throw new Error('Missing blob');
  expect(outputBlobUrl(read, file.hash, base)).toBe(`${base}blobs/bin/${file.hash}.bin`);
  expect(await new ClientAssets(read, new Map(), opts).read(file.hash)).toEqual(new Uint8Array([1, 2, 3]));
  expect(() => outputBlobUrl(read, '0'.repeat(64), base)).toThrow('Undeclared');
  const v1 = new Map([['shard.json', encodeCanonicalJson(source)], [file.hash, new Uint8Array([1, 2, 3])]]);
  await expect(readProductDescriptor(options(v1))).rejects.toThrow('format-2');
  expect(() => outputBlobUrl(source, file.hash, base)).toThrow('format-2');
});

test('admission preserves v2 addressing across parser copies and offline section reassembly', async () => {
  const { source, wires, index } = fixture(), store = cacheStore(), opts = options(wires, store.cache);
  const read = await readProductDescriptor(opts), admitted = await admitProduct(read, opts);
  expect(admitted.source).toEqual(source);
  expect(outputDescriptor(admitted.source)?.index).toEqual(index);
  expect(store.product()?.source).toEqual(index);
  const offline = { ...opts, offline: true, fetch: () => Promise.reject(new Error('Offline network')) };
  expect((await admitProduct(null, offline)).source).toEqual(source);
  expect(await readProductDescriptor(offline)).toEqual(source);
  const section = index.sections[0]; if (section === undefined) throw new Error('Missing section');
  store.bytes.delete(section.hash);
  await expect(readProductDescriptor(offline)).rejects.toThrow('incomplete section cache');
});

test('index, section integrity and path/version refusals happen before any host or blob read', async () => {
  const { wires, index } = fixture(); let fetched = 0;
  const opts = options(wires), fetch = opts.fetch;
  opts.fetch = url => { fetched++; return fetch(url); };
  await expect(readProductDescriptor({ ...opts, descriptorHash: '0'.repeat(64) })).rejects.toThrow('descriptor hash');
  expect(fetched).toBe(1);
  await expect(readProductDescriptor({ ...opts, descriptorHash: await hash(encodeCanonicalJson(index)) })).resolves.toBeDefined();
  wires.set('shard.json', encodeCanonicalJson({ ...index, formatVersion: 3 }));
  await expect(readProductDescriptor(opts)).rejects.toThrow();
  const first = index.sections[0]; if (first === undefined) throw new Error('Missing section');
  wires.set('shard.json', encodeCanonicalJson({ ...index, sections: [{ ...first, path: '../escape.json' }, ...index.sections.slice(1)] }));
  await expect(readProductDescriptor(opts)).rejects.toThrow();
  wires.set('shard.json', encodeCanonicalJson(index));
  wires.set(first.path, new Uint8Array(first.bytes).fill(32));
  await expect(readProductDescriptor(opts)).rejects.toThrow('section hash or size');
  wires.set(first.path, new Uint8Array(first.bytes + 1));
  await expect(readProductDescriptor(opts)).rejects.toThrow('wire size');
});

test('every section request starts before a slow first response completes', async () => {
  const { index, wires } = fixture(), started: string[] = [];
  const gate: { release?: () => void } = {};
  const wait = new Promise<void>(resolve => { gate.release = resolve; });
  const pending = resolveOutputDescriptor(index, { offline: false, hash, read: async path => {
    started.push(path); await wait;
    const bytes = wires.get(path); if (bytes === undefined) throw new Error('Missing section');
    return bytes;
  } });
  try { await Promise.resolve(); expect(started).toHaveLength(index.sections.length); }
  finally { gate.release?.(); }
  await expect(pending).resolves.toBeDefined();
});
