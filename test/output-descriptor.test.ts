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
function fixture(blob = false, spawnX = 0, revision = 1): { source: Shardfile; index: OutputIndex; wires: Map<string, Uint8Array> } {
  const source = emptyShardfile({ slug: 'loader-fixture', name: 'Loader', author: 'Test', revision, seed: 1 });
  source.spawn.x = spawnX;
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

test('an evicted section of an older visit refetches online and replaces the offline record', async () => {
  const old = fixture(), current = fixture(false, 4), store = cacheStore();
  const oldOptions = options(old.wires, store.cache);
  await admitProduct(await readProductDescriptor(oldOptions), oldOptions);
  const section = old.index.sections.find(value => value.name === 'world/spawn');
  if (section === undefined) throw new Error('Missing spawn section');
  store.bytes.delete(section.hash);
  const offline = { ...oldOptions, offline: true, fetch: () => Promise.reject(new Error('Offline network')) };
  await expect(readProductDescriptor(offline)).rejects.toThrow('needs a connection');
  await expect(admitProduct(null, offline)).rejects.toThrow('needs a connection');
  expect(store.product()?.source).toEqual(old.index); // No partial publication.

  const online = options(current.wires, store.cache), fetch = online.fetch, requests: string[] = [];
  online.fetch = url => { requests.push(url); return fetch(url); };
  const admitted = await admitProduct(await readProductDescriptor(online), online);
  expect(requests).toContain(`${base}shard.json`);
  expect(requests).toContain(`${base}${section.path}`);
  expect(admitted.source).toEqual(current.source);
  expect(store.product()?.source).toEqual(current.index);
  expect(await readProductDescriptor(offline)).toEqual(current.source);
  expect((await admitProduct(null, offline)).source).toEqual(current.source);
});

test('a complete older visit still enforces saved-state compatibility', async () => {
  const visited = fixture(false, 0, 2), older = fixture(), store = cacheStore();
  const savedOptions = options(visited.wires, store.cache);
  await admitProduct(await readProductDescriptor(savedOptions), savedOptions);
  const downgrade = options(older.wires, store.cache);
  await expect(admitProduct(await readProductDescriptor(downgrade), downgrade)).rejects.toThrow('revisions cannot move backwards');
  expect(store.product()?.source).toEqual(visited.index);
});

// G531 retired the manifest's `entries.public`: a phone that visited before it holds sections this build's strict schemas
// refuse. The visit is compared by identity and state only, so the shard still loads and the record is replaced.
test('an older visit this build no longer parses is compared by its state lineage only', async () => {
  const stale = (revision: number): { visited: CachedProduct; bytes: Map<string, Uint8Array> } => {
    const old = fixture(false, 0, revision), section = old.index.sections.find(value => value.name === 'world/spawn');
    const wire = section === undefined ? undefined : old.wires.get(section.path);
    if (section === undefined || wire === undefined) throw new Error('Missing spawn section');
    const payload: unknown = JSON.parse(new TextDecoder().decode(wire));
    if (typeof payload !== 'object' || payload === null) throw new Error('Spawn section is not an object');
    const bytes = encodeCanonicalJson({ ...payload, public: 'legacy' }), ref = hashImmutableBytes(bytes);
    const sections = old.index.sections.map(value => value === section ? { ...value, hash: ref, bytes: bytes.length } : value);
    return { visited: { source: { ...old.index, sections }, firstParty: true },
      bytes: new Map([...old.index.sections.flatMap(value => { const b = old.wires.get(value.path); return b === undefined ? [] : [[value.hash, b] as const]; }), [ref, bytes]]) };
  };
  const seed = (store: ReturnType<typeof cacheStore>, revision: number): void => {
    const { visited, bytes } = stale(revision);
    for (const [ref, wire] of bytes) store.bytes.set(ref, wire);
    void store.cache.putProduct(base, visited);
  };
  const current = fixture(false, 4, 2), store = cacheStore(), online = options(current.wires, store.cache);
  seed(store, 1);
  await expect(readProductDescriptor({ ...online, offline: true })).rejects.toThrow('undeclared field');
  expect((await admitProduct(await readProductDescriptor(online), online)).source).toEqual(current.source);
  expect(store.product()?.source).toEqual(current.index);
  const downgrade = cacheStore(), older = options(fixture().wires, downgrade.cache);
  seed(downgrade, 3);
  await expect(admitProduct(await readProductDescriptor(older), older)).rejects.toThrow('revisions cannot move backwards');
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

test('checks emitted custom schemas at load, including first-party and cached readers', async () => {
  const { index, wires } = fixture();
  const name = 'custom/probe', path = `sections/${name}.json`, schemaPath = `schemas/${name}.schema.json`;
  const schema = encodeCanonicalJson({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false });
  const measured = (file: string, bytes: Uint8Array) => ({ path: file, hash: hashImmutableBytes(bytes), bytes: bytes.length });
  const read = (value: unknown, schemaBytes = schema) => {
    const bytes = encodeCanonicalJson(value);
    wires.set(path, bytes); wires.set(schemaPath, schemaBytes);
    wires.set('shard.json', encodeCanonicalJson({ ...index,
      sections: [...index.sections, { name, schema: schemaPath, ...measured(path, bytes) }],
      schemas: [measured(schemaPath, schemaBytes)] }));
    return readProductDescriptor(options(wires));
  };
  await expect(read({ n: 1 })).resolves.toBeDefined();
  await expect(read({ n: 'bad' })).rejects.toThrow('refuses its schema');
  await expect(read({})).rejects.toThrow('refuses its schema');
  await expect(read({ n: 1 }, encodeCanonicalJson({ $schema: 'http://json-schema.org/draft-07/schema#', typo: true }))).rejects.toThrow();
  await read({ n: 1 });
  const store = cacheStore();
  const opts = options(wires, store.cache);
  const source = await readProductDescriptor(opts);
  await admitProduct(source, opts);
  await expect(readProductDescriptor({ ...opts, offline: true })).resolves.toBeDefined();
  store.bytes.delete(hashImmutableBytes(schema));
  await expect(readProductDescriptor({ ...opts, offline: true })).rejects.toThrow('incomplete section cache');
});
