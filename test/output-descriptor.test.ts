// oxlint-disable-next-line import/no-nodejs-modules -- Device-cost source fixture uses one tracked bounded KTX2 file.
import { readFileSync } from 'node:fs';
import { parseKtx2, ktx2DeviceCosts, ktx2DeviceGpu } from '../src/format/ktx2Cost';
import { runtimeOnlyProductFiles, deviceLibraryCostPaced } from '../src/game/shardfile/productCost';
import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson as canonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { parseOutputIndex, type OutputIndex } from '../src/format/outputIndex';
import { OUTPUT_SECTIONS, outputSectionPayloads } from '../src/format/outputFields';
import { parseShardfile, type Shardfile } from '../src/format/shardSchema';
import { parseStateLineage } from '../src/format/stateLineage';
import { readProductDescriptor, admitProduct, type CachedProduct, type ProductCache, type ProductOptions } from '../src/game/shardfile/product';
import { provideHybridDeclaration, runtimeProduct, loadShardProduct, completeManifestCache } from '../src/game/shardfile/runtimeProduct';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { isBuildValidatedOutput, outputBlobUrl, outputDescriptor, resolveOutputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { DownloadAccounting, installDownloadAccounting } from '../src/engine/boot/download';
import { saves } from '../src/engine/saves/runtime';
import { installManifestShardfile, installShardfileProduct } from '../src/game/shardfile/clientSource';
import { prepareBootImports } from '../src/bootDownloads';
import { sourceManifest } from '../src/game/plugin/context';
import { installShards, shards } from '../src/game/shard/list';
import { game, setActiveChunk } from '../src/game/shard/registry';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';

const encodeCanonicalJson = (value: unknown): Uint8Array => new TextEncoder().encode(canonicalJson(value));
const base = 'https://example.test/shardfiles/loader-fixture/';
const hash = (bytes: Uint8Array): Promise<string> => Promise.resolve(hashImmutableBytes(bytes));
function fixture(blob = false, spawnX = 0, revision = 1, slug = 'loader-fixture', late = false, declaredLate = false, texture?: Uint8Array): { source: Shardfile; index: OutputIndex; wires: Map<string, Uint8Array> } {
  const source = emptyShardfile({ slug, name: 'Loader', author: 'Test', revision, seed: 1 });
  source.spawn.x = spawnX;
  const wires = new Map<string, Uint8Array>();
  if (blob) {
    const bytes = texture ?? new Uint8Array([1, 2, 3]), ref = hashImmutableBytes(bytes);
    const cost = texture === undefined ? {decoded:3,gpu:0,triangles:0,draws:0} : parseKtx2(bytes);
    source.files.push({ hash: ref, kind: texture === undefined ? 'binary' : 'ktx2', compressed: bytes.length, ...cost, dependencies: [], critical: false });
    if (!late) { source.library.push(ref); source.budgets.library = { resident: cost.decoded+cost.gpu, compressed: bytes.length }; }
    if (declaredLate) source.late = [{hash:ref,at:[25,0]}];
    wires.set(texture === undefined ? `blobs/bin/${ref}.bin` : `blobs/ktx2/${ref}.ktx2`, bytes);
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
    admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library, ...(source.late === undefined ? {} : {late:source.late}) },
    ...(texture === undefined ? {} : {ktx2Costs:{[hashImmutableBytes(texture)]:ktx2DeviceCosts(texture)}}),
    sections, schemas: [], files: source.files.map(file => ({ ...file, kind: texture === undefined ? 'bin' : 'ktx2', ...(declaredLate ? {name:'late.bin'} : {}), path: texture === undefined ? `blobs/bin/${file.hash}.bin` : `blobs/ktx2/${file.hash}.ktx2` })), runtime: null });
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

function installIndexReceipt(index: OutputIndex): () => void {
  const values = { __SHARDFILE_VALIDATOR__: 'index-receipt-test', __SHARDFILE_VERDICTS__: [{ revision: 'index-receipt-test', sourceHash: index.build.sourceHash,
    indexHash: hashImmutableBytes(encodeCanonicalJson(index)), worst: { playing: 0, loading: 0, accounted: 0, location: [0, 0] } }] };
  const previous = new Map(Object.keys(values).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const));
  for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, name);
      else Object.defineProperty(globalThis, name, descriptor);
    }
  };
}
function sectionReader(wires: ReadonlyMap<string, Uint8Array>): (path: string) => Promise<Uint8Array> {
  return path => {
    const bytes = wires.get(path); if (bytes === undefined) throw new Error('Missing fixture section');
    return Promise.resolve(new Uint8Array(bytes));
  };
}

test('receipted phone admission defers unused bytes and publishes offline only after their verified storage', async () => {
  const row = fixture(true, 0, 1, 'loader-fixture', true), restore = installIndexReceipt(row.index), store = cacheStore();
  const scope = new Scope('offline-completion'), requests: string[] = [], opts = options(row.wires, store.cache), fetcher = opts.fetch;
  opts.tier = 'phone'; opts.fetch = url => { requests.push(url); return fetcher(url); };
  try {
    const admitted = await admitProduct(row.index, opts), finish = admitted.completeCache;
    if (finish === undefined) throw new Error('Missing deferred offline completion');
    expect(admitted.assets.size).toBe(0); expect(store.product()).toBeNull();
    expect(requests.some(url => url.includes('/blobs/'))).toBe(false);
    await finish(scope);
    expect(store.product()?.source).toStrictEqual(row.index);
    expect(admitted.assets.size).toBe(0); // warming never refills the page's released transport map
    expect(requests.filter(url => url.includes('/blobs/'))).toHaveLength(1);
  } finally { scope.dispose(); restore(); }
});

test('poisoned late cache or a retired owner cannot publish a complete offline product', async () => {
  for (const retired of [false, true]) {
    const row = fixture(true, 0, 1, 'loader-fixture', true), restore = installIndexReceipt(row.index), store = cacheStore();
    const scope = new Scope('offline-refusal'), opts = options(row.wires, store.cache); opts.tier = 'phone';
    try {
      const admitted = await admitProduct(row.index, opts), finish = admitted.completeCache;
      if (finish === undefined) throw new Error('Missing deferred offline completion');
      if (retired) scope.dispose();
      else { const file = row.source.files[0]; if (file === undefined) throw new Error('Missing fixture file'); store.bytes.set(file.hash, new Uint8Array([9, 9, 9])); }
      await expect(finish(scope)).rejects.toThrow(retired ? 'owner retired' : 'hash or size');
      expect(store.product()).toBeNull(); expect(admitted.assets.size).toBe(0);
    } finally { scope.dispose(); restore(); }
  }
});

test('receipt lookup refuses authored accessors without invoking them', async () => {
  const f = fixture(); let reads = 0;
  const input = { ...f.index };
  Object.defineProperty(input, 'build', { enumerable: true, get: () => { reads++; return f.index.build; } });
  await expect(resolveOutputDescriptor(input, { read: sectionReader(f.wires), hash, offline: false, firstParty: true })).rejects.toThrow('bounded plain JSON');
  expect(reads).toBe(0);
});

test('build receipt skips descriptor grammar and owns the index across pauses', async () => {
  const f = fixture(), restore = installIndexReceipt(f.index);
  const grammar = vi.spyOn(await import('../src/format/outputIndex'), 'parseOutputDescriptorIndex');
  let paused = false;
  try {
    const source = await resolveOutputDescriptor(f.index, { read: sectionReader(f.wires), hash, offline: false, firstParty: true,
      pause: () => { paused = true; f.index.identity.name = 'Changed after intake'; return Promise.resolve(); } });
    expect(paused).toBe(true);
    expect(source).toEqual(f.source);
    expect(isBuildValidatedOutput(source)).toBe(true);
    expect(grammar).not.toHaveBeenCalled();
  } finally { grammar.mockRestore(); restore(); }
});

test('build index proof still refuses changed section bytes', async () => {
  const f = fixture(), restore = installIndexReceipt(f.index);
  const grammar = vi.spyOn(await import('../src/format/outputIndex'), 'parseOutputDescriptorIndex');
  const entry = f.index.sections[0]; if (entry === undefined) throw new Error('Missing fixture section');
  const wire = f.wires.get(entry.path); if (wire === undefined) throw new Error('Missing fixture wire');
  const changed = new Uint8Array(wire), first = changed[0]; if (first === undefined) throw new Error('Empty fixture wire');
  changed[0] = first ^ 1; f.wires.set(entry.path, changed);
  try {
    await expect(resolveOutputDescriptor(f.index, { read: sectionReader(f.wires), hash, offline: false, firstParty: true }))
      .rejects.toThrow(/section hash or size mismatch/u);
    expect(grammar).not.toHaveBeenCalled();
  } finally { grammar.mockRestore(); restore(); }
});

test('a changed index cannot borrow its original build receipt', async () => {
  const f = fixture(), restore = installIndexReceipt(f.index);
  const grammar = vi.spyOn(await import('../src/format/outputIndex'), 'parseOutputDescriptorIndex');
  f.index.identity.name = 'Changed before intake';
  try {
    const source = await resolveOutputDescriptor(f.index, { read: sectionReader(f.wires), hash, offline: false, firstParty: true });
    expect(source).toMatchObject({ identity: { name: 'Changed before intake' } });
    expect(isBuildValidatedOutput(source)).toBe(false);
    expect(grammar).toHaveBeenCalledOnce();
  } finally { grammar.mockRestore(); restore(); }
});

test.each([true, false])('first-party data admission retains Explore=%s without restoring the native loader', async (withExplore) => {
  const { source, wires } = fixture(false, 0, 1, 'template');
  const explore = { art: { world: '/assets/world.webp', models: '/assets/models.webp', sets: '/assets/sets.webp', practice: '/assets/practice.webp' } };
  const legacyLoad = () => Promise.reject(new Error('Native loader must not run'));
  const descriptorName = withExplore ? 'entry.json' : 'shard.json';
  if (withExplore) {
    const wire = wires.get('shard.json');
    if (wire === undefined) throw new Error('Missing fixture descriptor');
    wires.set(descriptorName, wire);
  }
  const manifest = { ...sourceManifest(source), ...(withExplore ? { explore } : {}), load: legacyLoad, shardfile: `${base}${descriptorName}` };
  const previous = shards(), active = game.shard;
  const descriptorDetails: string[] = [];
  try {
    installShards([manifest]);
    const installed = await installManifestShardfile(manifest, {...options(wires), progress: row => {
      if (row.phase === 'descriptor') descriptorDetails.push(row.detail);
    }}, {
      instance: 'template-solo', recipes: new Map(), items: new Map(), catalogue: [],
      voices: () => new Map(), icon: () => { throw new Error('No fixture item'); },
    });
    expect(installed.explore).toBe(withExplore ? explore : undefined);
    expect(game.shard).toBe(installed);
    expect(installed.load).not.toBe(legacyLoad);
    expect(installed.ground).not.toBe(manifest.ground);
    expect(installed.ground.terrain?.heightAt(0, 0)).toBe(0);
    expect(descriptorDetails.length).toBeGreaterThan(0);
    for (const detail of descriptorDetails) expect(detail).toContain(new URL(manifest.shardfile).pathname);
  } finally { installShards(previous); setActiveChunk(active.slug); }
});

test.each(['manifest', 'external'] as const)('%s admission finishes during kit imports but publishes only after them', async kind => {
  const { source, wires } = fixture(false, 0, 1, 'template');
  const manifest = { ...sourceManifest(source), shardfile: `${base}shard.json` };
  let release = (): void => { throw new Error('Uninitialized kit import'); };
  const imports = prepareBootImports(new Promise<void>(resolve => { release = resolve; }));
  let admitted = (): void => { throw new Error('Uninitialized admission'); };
  const admission = new Promise<void>(resolve => { admitted = resolve; });
  const opts = { ...options(wires), progress: (row: Parameters<NonNullable<ProductOptions['progress']>>[0]) => {
    if (row.phase === 'complete') admitted();
  } };
  const bindings = { instance: 'template-solo', recipes: new Map(), items: new Map(), catalogue: [],
    voices: () => new Map(), icon: () => { throw new Error('No fixture item'); } };
  const previous = shards(), active = game.shard;
  try {
    const installing = kind === 'manifest'
      ? installManifestShardfile(manifest, opts, bindings, imports.ready)
      : installShardfileProduct(source, opts, bindings, imports.ready);
    await admission;
    expect(game.shard).toBe(active);
    expect(shards()).toBe(previous);
    release();
    const installed = await installing;
    expect(game.shard).toBe(installed);
    expect(installed.slug).toBe(manifest.slug);
  } finally { release(); installShards(previous); setActiveChunk(active.slug); }
});

test('a rejected kit barrier leaves admitted data unpublished and retains the original failure', async () => {
  const { source, wires } = fixture(false, 0, 1, 'template');
  const manifest = { ...sourceManifest(source), shardfile: `${base}shard.json` };
  const kit = new Error('kit import failed'), imports = prepareBootImports(Promise.reject(kit));
  const previous = shards(), active = game.shard;
  await expect(installManifestShardfile(manifest, options(wires), {
    instance: 'template-solo', recipes: new Map(), items: new Map(), catalogue: [],
    voices: () => new Map(), icon: () => { throw new Error('No fixture item'); },
  }, imports.ready)).rejects.toBe(kit);
  expect(game.shard).toBe(active);
  expect(shards()).toBe(previous);
});

test.each([true, false])('a real admission refusal drains before cleanup and retains kit-first errors=%s', async fails => {
  const { source, wires } = fixture(false, 0, 1, 'template');
  const manifest = { ...sourceManifest(source), shardfile: `${base}shard.json` };
  let release = (): void => { throw new Error('Uninitialized import'); };
  let failImport = (_error: Error): void => { throw new Error('Uninitialized import'); };
  const imports = prepareBootImports(new Promise<void>((resolve, reject) => { release = resolve; failImport = reject; }));
  let refused = (): void => { throw new Error('Uninitialized refusal'); };
  const refusal = new Promise<void>(resolve => { refused = resolve; });
  const kit = new Error('kit import failed'), admission = new Error('descriptor read failed'), events: string[] = [];
  const previous = shards(), active = game.shard;
  const completed = (async () => {
    try {
      return await installManifestShardfile(manifest, { ...options(wires), fetch: () => Promise.reject(admission) }, {
        instance: 'template-solo', recipes: new Map(), items: new Map(), catalogue: [],
        voices: () => new Map(), icon: () => { throw new Error('No fixture item'); },
      }, imports.ready);
    } catch (failure) { refused(); return await imports.refuse(failure); }
    finally { events.push('residency', 'memory'); }
  })();
  const observed = expect(completed).rejects.toBe(fails ? kit : admission);
  await refusal;
  expect(events).toEqual([]);
  expect(game.shard).toBe(active);
  expect(shards()).toBe(previous);
  if (fails) failImport(kit); else release();
  await observed;
  expect(events).toEqual(['residency', 'memory']);
});

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

test('the complete blob bank is declared before the first section read, except for historical lineage', async () => {
  const { index, wires } = fixture(true);
  const expected = new Map(index.sections.map(file => [file.path, file.bytes]));
  for (const file of index.files) expected.set(file.path, file.compressed);
  for (const lineage of [false, true]) {
    const declared = new Map<string, number>(); let reads = 0;
    await resolveOutputDescriptor(index, {
      offline: false, lineage, hash,
      declare: (path, bytes) => { declared.set(path, bytes); },
      read: (path) => {
        expect(declared).toEqual(lineage ? new Map(index.sections.map(file => [file.path, file.bytes])) : expected);
        reads++;
        const bytes = wires.get(path);
        if (bytes === undefined) throw new Error('Missing section');
        return Promise.resolve(bytes);
      },
    });
    expect(reads).toBe(index.sections.length);
  }
});

test('historical transport never loads current host grammar or grants a model proof', async () => {
  const { index, wires, source } = fixture();
  const grammar = vi.spyOn(await import('../src/format/outputIndex'), 'parseOutputDescriptorIndex');
  // An old visit may name host, asset and cost declarations this build removed.
  const historical = { ...index, admission: { obsolete: true }, runtime: { obsolete: true }, files: [{ obsolete: true }] };
  const read = vi.fn(sectionReader(wires));
  try {
    const previous = await resolveOutputDescriptor(historical, { lineage: true, offline: false, hash, read });
    expect(parseStateLineage(previous)).toEqual({ identity: { slug: source.identity.slug, revision: source.identity.revision }, state: source.state });
    expect(grammar).not.toHaveBeenCalled();
    expect(read.mock.calls.map(([path]) => path)).toEqual(index.sections.map(row => row.path));
    expect(isBuildValidatedOutput(previous)).toBe(false);
  } finally { grammar.mockRestore(); }
});

test.each(['version', 'duplicate', 'escape', 'state', 'hash', 'cap'] as const)('historical %s refusal precedes section reads', async kind => {
  const { index, wires } = fixture(), first = index.sections[0];
  if (first === undefined) throw new Error('Missing section');
  const input = kind === 'version' ? { ...index, formatVersion: 3 }
    : kind === 'duplicate' ? { ...index, sections: [...index.sections, first] }
    : kind === 'escape' ? { ...index, sections: [{ ...first, path: '../escape.json' }, ...index.sections.slice(1)] }
    : kind === 'state' ? { ...index, sections: index.sections.filter(row => row.name !== 'state/state') }
    : kind === 'hash' ? { ...index, sections: [{ ...first, hash: 'bad' }, ...index.sections.slice(1)] }
    : { ...index, sections: [{ ...first, bytes: 2_000_001 }, ...index.sections.slice(1)] };
  const read = vi.fn(sectionReader(wires));
  await expect(resolveOutputDescriptor(input, { lineage: true, offline: false, hash, read })).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
});

test('historical reads retain cache completeness, immutable hashes and strict state semantics', async () => {
  const { index, wires } = fixture(), state = index.sections.find(row => row.name === 'state/state');
  if (state === undefined) throw new Error('Missing state');
  const bank = new Map(index.sections.map(row => [row.hash, wires.get(row.path)])), read = vi.fn(sectionReader(wires));
  const cached = vi.fn((ref: string) => Promise.resolve(ref === state.hash ? null : bank.get(ref) ?? null));
  await expect(resolveOutputDescriptor(index, { lineage: true, offline: true, hash, read, cached })).rejects.toThrow('incomplete section cache');
  expect(cached).toHaveBeenCalledTimes(index.sections.length);
  expect(read).not.toHaveBeenCalled();
  const corrupt = new Map(wires); corrupt.set(state.path, new Uint8Array(state.bytes));
  await expect(resolveOutputDescriptor(index, { lineage: true, offline: false, hash, read: sectionReader(corrupt) })).rejects.toThrow('hash or size mismatch');
  const bad = encodeCanonicalJson({ state: { version: 0 } }), sections = index.sections.map(row => row === state ? { ...row, hash: hashImmutableBytes(bad), bytes: bad.length } : row);
  wires.set(state.path, bad);
  const previous = await resolveOutputDescriptor({ ...index, sections }, { lineage: true, offline: false, hash, read: sectionReader(wires) });
  expect(() => parseStateLineage(previous)).toThrow();
});

test('historical inventory rejects authored getters without invoking them', async () => {
  const { index, wires } = fixture(); let reads = 0;
  Object.defineProperty(index, 'admission', { enumerable: true, get: () => { reads++; return {}; } });
  const read = vi.fn(sectionReader(wires));
  await expect(resolveOutputDescriptor(index, { lineage: true, offline: false, hash, read })).rejects.toThrow('bounded plain JSON');
  expect(reads).toBe(0); expect(read).not.toHaveBeenCalled();
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

test('a product stored whole asks for persistent storage once (iPhone downloads I10)', async () => {
  const { wires } = fixture(), store = cacheStore(), opts = options(wires, store.cache);
  const persist = vi.spyOn(saves, 'persist').mockResolvedValue(true);
  try {
    await admitProduct(await readProductDescriptor(opts), opts);
    expect(store.product()).not.toBeNull(); expect(persist).toHaveBeenCalledTimes(1);
    persist.mockClear();
    await admitProduct(await readProductDescriptor(options(wires)), options(wires));
    expect(persist).not.toHaveBeenCalled();
  } finally { persist.mockRestore(); }
});

test('packed sections and files come from one read of each pack (iPhone downloads I5)', async () => {
  const { wires, index } = fixture(true), packs: NonNullable<OutputIndex['packs']> = [];
  for (const members of [[...index.sections, ...index.schemas].map(entry => ({ path: entry.path, hash: entry.hash })), index.files.map(file => ({ path: file.path, hash: file.hash }))]) {
    const parts = members.map(member => { const part = wires.get(member.path); if (part === undefined) throw new Error('Missing fixture member'); return { hash: member.hash, part }; });
    const bytes = new Uint8Array(parts.reduce((total, row) => total + row.part.length, 0)), entries: { hash: string; offset: number; bytes: number }[] = [];
    let offset = 0;
    for (const row of parts) { bytes.set(row.part, offset); entries.push({ hash: row.hash, offset, bytes: row.part.length }); offset += row.part.length; }
    const packHash = hashImmutableBytes(bytes), path = `blobs/pack/${packHash}.pack`;
    wires.set(path, bytes); packs.push({ path, hash: packHash, bytes: bytes.length, entries });
  }
  wires.set('shard.json', encodeCanonicalJson(parseOutputIndex({ ...index, packs })));
  const reads: string[] = [], plain = options(wires), opts: ProductOptions = { ...plain, fetch: url => { reads.push(url.slice(base.length)); return plain.fetch(url); } };
  const admitted = await admitProduct(await readProductDescriptor(opts), opts), file = index.files[0];
  if (file === undefined) throw new Error('Missing fixture blob');
  expect(admitted.assets.get(file.hash)).toEqual(wires.get(file.path));
  expect(reads.filter(path => path.startsWith('blobs/pack/')).sort()).toEqual(packs.map(pack => pack.path).sort());
  expect(reads.filter(path => path.startsWith('sections/') || path.startsWith('blobs/bin/'))).toEqual([]);
});

async function demandPackFixture(corruptMember = false) {
  const {wires,index,source:original}=fixture(true),first=index.files[0];
  if(first===undefined)throw new Error('Missing first demand member');
  const secondBytes=new Uint8Array([4,5,6]),secondHash=hashImmutableBytes(secondBytes);
  const second={...first,hash:secondHash,path:`blobs/bin/${secondHash}.bin`};
  index.files.push(second);wires.set(second.path,secondBytes);
  const wire=new Uint8Array([corruptMember?9:1,2,3,4,5,6]),packHash=hashImmutableBytes(wire),path=`blobs/pack/${packHash}.pack`;
  const packed=parseOutputIndex({...index,admission:{...index.admission,library:[...original.library,secondHash],
    budgets:{...original.budgets,library:{resident:6,compressed:6}}},packs:[{path,hash:packHash,bytes:6,entries:[
    {hash:first.hash,offset:0,bytes:3},{hash:secondHash,offset:3,bytes:3}]}]});
  wires.set(path,wire);wires.set('shard.json',encodeCanonicalJson(packed));
  const source=await readProductDescriptor(options(wires));
  return {source,wires,first,second,path,wire};
}

test('concurrent native demand reads share one pack, return owned members and retain no settled backing',async()=>{
  const f=await demandPackFixture(),plain=options(f.wires),reads:string[]=[];
  const assets=new ClientAssets(f.source,new Map(),{...plain,fetch:url=>{reads.push(url.slice(base.length));return plain.fetch(url);}});
  const [first,second]=await Promise.all([assets.read(f.first.hash),assets.read(f.second.hash)]);
  expect(reads).toEqual([f.path]);expect(first).toEqual(new Uint8Array([1,2,3]));expect(second).toEqual(new Uint8Array([4,5,6]));
  expect(first.buffer).not.toBe(second.buffer);first[0]=99;
  expect(assets.retained.size).toBe(0);
  expect(await assets.read(f.first.hash)).toEqual(new Uint8Array([1,2,3]));
  expect(reads).toEqual([f.path,f.first.path]); // no cache: a settled pack is not a hidden H6 owner
});

test('native demand packs refuse corruption for every borrower and release the failed read for repair',async()=>{
  const f=await demandPackFixture(),plain=options(f.wires);let corrupt=true,reads=0;
  const assets=new ClientAssets(f.source,new Map(),{...plain,fetch:url=>{
    reads++;if(corrupt){const damaged=f.wire.slice();damaged[0]=99;return Promise.resolve(new Response(damaged));}
    return plain.fetch(url);
  }});
  const results=await Promise.allSettled([assets.read(f.first.hash),assets.read(f.second.hash)]);
  expect(results.map(result=>result.status)).toEqual(['rejected','rejected']);expect(reads).toBe(1);
  for(const result of results)if(result.status==='rejected')expect(String(result.reason)).toContain('Resident pack hash or size mismatch');
  corrupt=false;expect(await Promise.all([assets.read(f.first.hash),assets.read(f.second.hash)])).toEqual([new Uint8Array([1,2,3]),new Uint8Array([4,5,6])]);expect(reads).toBe(2);
});

test('native offline demand never fetches a pack or hides a missing member behind another cached member',async()=>{
  const f=await demandPackFixture(),fetch=vi.fn(()=>Promise.reject(new Error('No offline network')));
  const assets=new ClientAssets(f.source,new Map(),{...options(f.wires),offline:true,fetch,cache:{
    ...cacheStore().cache,verifiedAsset:ref=>Promise.resolve(ref===f.first.hash?new Uint8Array([1,2,3]):null),
  }});
  expect(await assets.read(f.first.hash)).toEqual(new Uint8Array([1,2,3]));
  await expect(assets.read(f.second.hash)).rejects.toThrow('Missing cached resident tile');expect(fetch).not.toHaveBeenCalled();
});

test('a valid native pack hash never substitutes for its demanded member hash',async()=>{
  const f=await demandPackFixture(true),assets=new ClientAssets(f.source,new Map(),options(f.wires));
  const [first,second]=await Promise.allSettled([assets.read(f.first.hash),assets.read(f.second.hash)]);
  expect(first?.status).toBe('rejected');if(first?.status==='rejected')expect(String(first.reason)).toContain('Resident tile hash or size mismatch');
  expect(second).toEqual({status:'fulfilled',value:new Uint8Array([4,5,6])});
});

test('a private build-verified admission does not reread its matching historical sections', async () => {
  const old = fixture(), store = cacheStore(), initial = options(old.wires, store.cache);
  const restore = installIndexReceipt(old.index);
  try {
    await admitProduct(old.index, initial);
    const asset = vi.spyOn(store.cache, 'asset');
    const present = vi.fn(() => Promise.resolve(true));
    await admitProduct(old.index, { ...initial, cache: { ...store.cache, verifiedPresent: present } });
    expect(asset).toHaveBeenCalledTimes(old.index.sections.length);
    expect(present).toHaveBeenCalled(); // Durable publication is still checked.
    asset.mockRestore();
  } finally { restore(); }
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

test('an offline descriptor resolves named section declarations as verified cache hits', async () => {
  const { wires } = fixture(), store = cacheStore(), opts = options(wires, store.cache);
  await admitProduct(await readProductDescriptor(opts), opts);
  const accounting = new DownloadAccounting(base), dispose = installDownloadAccounting(accounting);
  try {
    await readProductDescriptor({ ...opts, offline: true, fetch: () => Promise.reject(new Error('Offline network')) });
    expect(accounting.snapshot().pendingBytes).toBe(0);
    expect(accounting.snapshot().cachedBytes).toBeGreaterThan(0);
    expect(accounting.snapshot().networkBytes).toBe(0);
  } finally { dispose(); }
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
  const gate: { release?: () => void; started?: () => void } = {};
  const wait = new Promise<void>(resolve => { gate.release = resolve; });
  const firstStarted = new Promise<void>(resolve => { gate.started = resolve; });
  const pending = resolveOutputDescriptor(index, { offline: false, hash, read: async path => {
    started.push(path); gate.started?.(); await wait;
    const bytes = wires.get(path); if (bytes === undefined) throw new Error('Missing section');
    return bytes;
  } });
  try { await firstStarted; expect(started).toHaveLength(index.sections.length); }
  finally { gate.release?.(); }
  await expect(pending).resolves.toBeDefined();
});

test.each(['network', 'cache', 'quota'] as const)('verified %s sections avoid page hashing and duplicate writes', async mode => {
  const f = fixture(), store = cacheStore(), pageHash = vi.fn(hash), fetch = vi.fn(options(f.wires).fetch);
  const checked = vi.fn(async (url: string, expected: string, maximum: number) => {
    const wire = f.wires.get(url.slice(base.length));
    if (wire === undefined) throw new Error('Missing verified section');
    expect(wire.length).toBe(maximum); expect(hashImmutableBytes(wire)).toBe(expected);
    await Promise.resolve();
    if (mode !== 'quota') store.bytes.set(expected, new Uint8Array(wire));
    return { bytes: new Uint8Array(wire), cached: false, stored: mode !== 'quota' };
  });
  if (mode === 'cache') for (const section of f.index.sections) {
    const wire = f.wires.get(section.path); if (wire === undefined) throw new Error('Missing cache section');
    store.bytes.set(section.hash, wire);
  }
  const raw = vi.fn(store.cache.asset), put = vi.fn(store.cache.putAsset);
  const opts: ProductOptions = { ...options(f.wires), hash: pageHash, fetch, transport: checked,
    cache: { ...store.cache, asset: raw, putAsset: put,
      verifiedAsset: address => Promise.resolve(store.bytes.get(address) ?? null) } };
  const source = await readProductDescriptor(opts);
  expect(source).toEqual(f.source);
  const sectionHashes = new Set(f.index.sections.map(section => section.hash));
  expect(pageHash.mock.calls.filter(([wire]) => sectionHashes.has(hashImmutableBytes(wire)))).toHaveLength(0);
  expect(fetch.mock.calls.map(([url]) => url.slice(base.length))).toEqual(['shard.json']);
  expect(checked).toHaveBeenCalledTimes(mode === 'cache' ? 0 : f.index.sections.length);
  expect(raw).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
  expect(outputDescriptor(source)?.cached).toBe(mode !== 'quota');
  await admitProduct(source, opts);
  expect(store.product() === null).toBe(mode === 'quota');
});

test('verified section transport retains size refusals, failure and ordinary hash fallback', async () => {
  const f = fixture(), opts = options(f.wires);
  await expect(readProductDescriptor({ ...opts, transport: () => Promise.resolve({ bytes: new Uint8Array(), cached: false, stored: true }) }))
    .rejects.toThrow('section hash or size mismatch');
  await expect(readProductDescriptor({ ...opts, transport: () => Promise.reject(new Error('Worker hash mismatch')) }))
    .rejects.toThrow('Worker hash mismatch');
  const first = f.index.sections[0]; if (first === undefined) throw new Error('Missing section');
  f.wires.set(first.path, new Uint8Array(first.bytes));
  await expect(readProductDescriptor({ ...opts, transport: () => Promise.resolve(null) })).rejects.toThrow('section hash or size mismatch');
});

test('cold sections build before disk writes while offline publication waits for durability', async () => {
  const f = fixture(), store = cacheStore();
  let release = (): void => { throw new Error('Missing cache write gate'); };
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const cache: ProductCache = { ...store.cache, putAssetBackground: async (productBase, address, bytes) => {
    const copy = Uint8Array.from(bytes); await blocked; return await store.cache.putAsset(productBase, address, copy) !== false;
  } };
  const opts = options(f.wires, cache);
  try {
    const source = await readProductDescriptor(opts);
    expect(source).toEqual(f.source);
    expect(outputDescriptor(source)?.cached).toBe(false);
    expect(store.product()).toBeNull(); expect(store.bytes.size).toBe(0);
    const admitted = admitProduct(source, opts);
    await new Promise<void>(resolve => { setTimeout(resolve, 0); });
    expect(store.product()).toBeNull();
    release(); await admitted;
    expect(outputDescriptor(source)?.cached).toBe(true);
    expect(store.product()?.source).toEqual(f.index);
    expect(await readProductDescriptor({ ...opts, offline: true })).toEqual(f.source);
  } finally { release(); }
});

test('a refused background section write cannot advertise a complete offline product', async () => {
  const f = fixture(), store = cacheStore(), opts = options(f.wires, { ...store.cache, putAssetBackground: () => Promise.resolve(false) });
  const source = await readProductDescriptor(opts);
  expect(source).toEqual(f.source);
  expect(await outputDescriptor(source)?.cacheStored).toBe(false);
  expect(outputDescriptor(source)?.cached).toBe(false);
  await admitProduct(source, opts);
  expect(store.product()).toBeNull();
  await expect(readProductDescriptor({ ...opts, offline: true })).rejects.toThrow('not been visited offline');
});

test('checks emitted custom schemas at load, including first-party and cached readers', async () => {
  const { index, wires } = fixture();
  let paused = 0;
  const name = 'custom/probe', path = `sections/${name}.json`, schemaPath = `schemas/${name}.schema.json`;
  const schema = encodeCanonicalJson({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false });
  const measured = (file: string, bytes: Uint8Array) => ({ path: file, hash: hashImmutableBytes(bytes), bytes: bytes.length });
  const read = (value: unknown, schemaBytes = schema) => {
    const bytes = encodeCanonicalJson(value);
    wires.set(path, bytes); wires.set(schemaPath, schemaBytes);
    wires.set('shard.json', encodeCanonicalJson({ ...index,
      sections: [...index.sections, { name, schema: schemaPath, ...measured(path, bytes) }],
      schemas: [measured(schemaPath, schemaBytes)] }));
    return readProductDescriptor({ ...options(wires), pause: () => { paused++; return Promise.resolve(); } });
  };
  await expect(read({ n: 1 })).resolves.toBeDefined();
  expect(paused).toBeGreaterThan(2);
  const completedPauses = paused;
  await expect(read({ n: 'bad' })).rejects.toThrow('refuses its schema');
  expect(paused).toBeGreaterThan(completedPauses);
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

test('concurrent products serialize painted custom schema phases', async () => {
  const { index, wires } = fixture(), name = 'custom/parallel', path = `sections/${name}.json`, schemaPath = `schemas/${name}.schema.json`;
  const value = encodeCanonicalJson({ n: 1 }), schema = encodeCanonicalJson({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false });
  const measured = (file: string, bytes: Uint8Array) => ({ path: file, hash: hashImmutableBytes(bytes), bytes: bytes.length });
  wires.set(path, value); wires.set(schemaPath, schema);
  const input = { ...index, sections: [...index.sections, { name, schema: schemaPath, ...measured(path, value) }], schemas: [measured(schemaPath, schema)] };
  let blocked = true, pauses = 0, completed = 0;
  const release: (() => void)[] = [];
  const pause = (): Promise<void> => { pauses++; return blocked ? new Promise(resolve => { release.push(resolve); }) : Promise.resolve(); };
  const read = () => resolveOutputDescriptor(input, { offline: false, hash, pause, read: file => {
    const bytes = wires.get(file); if (bytes === undefined) throw new Error('Missing section'); return Promise.resolve(bytes);
  } });
  const products = [read(), read()].map(async product => { const descriptor = await product; completed++; return descriptor; });
  try {
    await new Promise<void>(resolve => { setTimeout(resolve, 0); });
    expect(release).toHaveLength(1);
    release[0]?.();
    await new Promise<void>(resolve => { setTimeout(resolve, 0); });
    expect(release).toHaveLength(2);
    expect(completed).toBe(0); // A complete check paints before its consumer resumes.
  } finally {
    blocked = false; for (const done of release) done();
    await Promise.all(products);
  }
  expect(pauses).toBeGreaterThan(4);
});


test('descriptor envelope detection refuses getters before reading format or starting reads', async () => {
  let calls = 0;
  const input = Object.defineProperty({}, 'format', { enumerable: true, get() { calls++; return 'wildshard.shardfile'; } });
  await expect(resolveOutputDescriptor(input, { offline: false, hash, read: () => { calls++; throw new Error('Unexpected read'); } })).rejects.toThrow('bounded plain JSON');
  expect(calls).toBe(0);
});

test('descriptor index admission retains every inventory refusal before any section read', async () => {
  const { index } = fixture(); let reads = 0;
  const reader = { offline: false, hash, read: () => { reads++; throw new Error('Unexpected read'); } };
  const first = index.sections[0]; if (first === undefined) throw new Error('Missing section');
  for (const input of [
    { ...index, formatVersion: 3 },
    { ...index, sections: [...index.sections, first] },
    { ...index, sections: [{ ...first, path: '../escape.json' }] },
    { ...index, schemas: [{ path: 'schemas/orphan.json', hash: first.hash, bytes: 2 }] },
  ]) {
    expect(() => parseOutputIndex(input)).toThrow();
    await expect(resolveOutputDescriptor(input, reader)).rejects.toThrow();
  }
  expect(reads).toBe(0);
  const legacy = { legacy: [1, 'text', null, false] };
  expect(await resolveOutputDescriptor(legacy, reader)).toBe(legacy);
});

test('an off-page transport supplies verified stored blobs without a page read or second write', async () => {
  const { wires, index } = fixture(true), store = cacheStore(), file = index.files[0];
  if (file === undefined) throw new Error('Missing blob');
  const writes: string[] = [], pageReads: string[] = [];
  const cache: ProductCache = { ...store.cache, putAsset: (productBase, ref, wire) => { writes.push(ref); return store.cache.putAsset(productBase, ref, wire); } };
  const page = options(wires, cache);
  const opts: ProductOptions = { ...page, fetch: url => { pageReads.push(url); return page.fetch(url); },
    transport: (url, address, bytes) => {
      const wire = wires.get(url.slice(base.length));
      if (wire === undefined || wire.length !== bytes) throw new Error('Unexpected transport read');
      store.bytes.set(address, Uint8Array.from(wire)); // the worker stored it
      return Promise.resolve({ bytes: Uint8Array.from(wire), cached: false, stored: true });
    } };
  const admitted = await admitProduct(await readProductDescriptor(opts), opts);
  expect(admitted.assets.get(file.hash)).toEqual(new Uint8Array([1, 2, 3]));
  expect(pageReads.some(url => url.endsWith(file.path))).toBe(false);
  expect(writes).not.toContain(file.hash);
  // No live worker: the page reads, hashes and writes it as before.
  const fallback: ProductOptions = { ...opts, transport: () => Promise.resolve(null) }, cold = cacheStore();
  const again = await admitProduct(await readProductDescriptor(fallback), { ...fallback, cache: cold.cache });
  expect(again.assets.get(file.hash)).toEqual(new Uint8Array([1, 2, 3]));
  expect(cold.bytes.get(file.hash)).toEqual(new Uint8Array([1, 2, 3]));
  expect(pageReads.some(url => url.endsWith(file.path))).toBe(true);
});


test('exact receipted library costs reserve all bytes without reading unused bodies', async () => {
  const row = fixture(true), restore = installIndexReceipt(row.index), store = cacheStore(), opts = options(row.wires, store.cache);
  const scope = new Scope('receipt-costs'), allocator = new ResidencyAllocator();
  try {
    const source = await readProductDescriptor(opts), read = vi.fn(() => Promise.reject(new Error('Cost-only body read')));
    expect(isBuildValidatedOutput(source)).toBe(true);
    // A host may project rows, but only exact original file objects inherit its build proof.
    await leaseClientLibrary({ ...source }, new Map(), { allocator, scope, owner: 'home', read, validatedSource: source });
    expect(read).not.toHaveBeenCalled(); expect(allocator.cost().input.libraries).toBe(3);
    const ref = source.files[0]?.hash; if (ref === undefined) throw new Error('Missing fixture library');
    const assets = new ClientAssets(source, new Map(), opts);
    await expect(assets.read(ref)).resolves.toEqual(new Uint8Array([1, 2, 3]));
  } finally { scope.dispose(); restore(); }
  expect(allocator.entries()).toHaveLength(0);
});

test('a replaced cost row cannot borrow an original receipt to skip its byte reader', async () => {
  const row = fixture(true), restore = installIndexReceipt(row.index), store = cacheStore();
  const scope = new Scope('receipt-cost-refusal'), allocator = new ResidencyAllocator();
  try {
    const source = await readProductDescriptor(options(row.wires, store.cache));
    const projected = { ...source, files: source.files.map(file => ({ ...file, decoded: file.decoded + 1 })) };
    const read = vi.fn(() => Promise.reject(new Error('Unproven cost row')));
    await expect(leaseClientLibrary(projected, new Map(), { allocator, scope, owner: 'home', read, validatedSource: source })).rejects.toThrow('Unproven cost row');
    expect(read).toHaveBeenCalled(); expect(allocator.entries()).toHaveLength(0);
  } finally { scope.dispose(); restore(); }
});


test('declared late library round-trips into phone admission and native after-control warming', async () => {
  const row = fixture(true, 0, 1, 'loader-fixture', false, true), restore = installIndexReceipt(row.index), store = cacheStore();
  const scope = new Scope('late-native'), opts = options(row.wires, store.cache), original = opts.fetch, reads: string[] = [];
  opts.tier = 'phone'; opts.fetch = url => { reads.push(url); return original(url); };
  try {
    const product = await loadShardProduct('loader-fixture', opts, scope);
    expect(product.shardfile.late).toStrictEqual(row.source.late);
    const admitted = await admitProduct(row.index, opts);
    expect(admitted.assets.size).toBe(0); expect(reads.some(url => url.includes('/blobs/'))).toBe(false);
    expect(store.product()).toBeNull();
    await product.file('late.bin'); // actual demand can precede the optional warm queue
    await completeManifestCache(sourceManifest(product.shardfile), scope, product);
    expect(reads.filter(url => url.includes('/blobs/'))).toHaveLength(1);
    expect(store.product()?.source).toStrictEqual(row.index);
  } finally { scope.dispose(); restore(); }
});

test('an unreceipted late hint never skips byte validation or admits an undeclared root', async () => {
  const row = fixture(true, 0, 1, 'loader-fixture', false, true), opts = options(row.wires), reads: string[] = [], original = opts.fetch;
  opts.tier = 'phone'; opts.fetch = url => { reads.push(url); return original(url); };
  const admitted = await admitProduct(row.index, opts);
  expect(admitted.assets.size).toBe(1); expect(reads.filter(url => url.includes('/blobs/'))).toHaveLength(1);
  expect(() => parseOutputIndex({...row.index,admission:{...row.index.admission,late:[{hash:'f'.repeat(64)}]}})).toThrow('declared library root');
});


test('late scheduling hints do not create synchronous transport ownership', () => {
  const row = fixture(true,0,1,'loader-fixture',false,true), file = row.source.files[0];
  if (file === undefined) throw new Error('Missing scheduled fixture file');
  expect(runtimeOnlyProductFiles(row.source)).toEqual([file.hash]);
  row.source.look.grade.lut = file.hash;
  expect(runtimeOnlyProductFiles(row.source)).toEqual([]);
});


test('receipted KTX2 device costs preserve the exact claim without fetching a body for costing', async () => {
  const bytes = Uint8Array.from(readFileSync('test/fixtures/shard-assets/pixel.ktx2'));
  for (const support of [{astc:false,bc7:false},{astc:true,bc7:false},{astc:false,bc7:true}]) {
    const row = fixture(true,0,1,'loader-fixture',false,false,bytes), restore = installIndexReceipt(row.index), scope = new Scope('device-costs'), allocator = new ResidencyAllocator();
    try {
      const source = await readProductDescriptor(options(row.wires)), read = vi.fn(() => Promise.reject(new Error('Cost-only KTX2 transfer')));
      await leaseClientLibrary({...source},new Map(),{validatedSource:source,scope,allocator,owner:'home',textures:support,read});
      expect(read).not.toHaveBeenCalled();
      expect(allocator.cost().input.libraries).toBe(parseKtx2(bytes,support).gpu);
      expect(ktx2DeviceGpu(ktx2DeviceCosts(bytes),support)).toBe(parseKtx2(bytes,support).gpu);
    } finally {scope.dispose();restore();}
  }
});

test('old receipted KTX2 products still parse the body when device metadata is absent', async () => {
  const bytes = Uint8Array.from(readFileSync('test/fixtures/shard-assets/pixel.ktx2')), row = fixture(true,0,1,'loader-fixture',false,false,bytes);
  delete row.index.ktx2Costs;row.wires.set('shard.json',encodeCanonicalJson(row.index));
  const restore = installIndexReceipt(row.index), scope = new Scope('old-device-costs'), allocator = new ResidencyAllocator();
  try {
    const source = await readProductDescriptor(options(row.wires)), read = vi.fn(() => Promise.resolve(bytes));
    await leaseClientLibrary(source,new Map(),{validatedSource:source,scope,allocator,owner:'home',read});
    expect(read).toHaveBeenCalledTimes(1);expect(allocator.cost().input.libraries).toBe(parseKtx2(bytes).gpu);
  } finally {scope.dispose();restore();}
});


test('device footprints preserve padded tiny mips even above RGBA size', () => {
  expect(ktx2DeviceGpu({rgba:4,astc:16,bc7:16},{astc:true,bc7:false})).toBe(16);
  expect(ktx2DeviceGpu({rgba:4,astc:4,bc7:16},{astc:true,bc7:true})).toBe(16);
  expect(ktx2DeviceGpu({rgba:4,astc:16,bc7:16})).toBe(4);
});


test('late KTX2 cost projection uses exact receipt facts without admitting its body', async () => {
  const bytes = Uint8Array.from(readFileSync('test/fixtures/shard-assets/pixel.ktx2'));
  const row = fixture(true,0,1,'loader-fixture',false,true,bytes), restore = installIndexReceipt(row.index);
  try {
    const source = await readProductDescriptor(options(row.wires));
    for (const support of [{astc:true,bc7:false},{astc:false,bc7:true}]) {
      const projected = {...source};
      const actual = await deviceLibraryCostPaced(projected,new Map(),support,undefined,source);
      const parsed = await deviceLibraryCostPaced(projected,new Map([[hashImmutableBytes(bytes),bytes]]),support,undefined);
      expect(actual).toEqual(parsed);
      await expect(deviceLibraryCostPaced({...source,files:source.files.map(file=>({...file}))},new Map(),support,undefined,source))
        .rejects.toThrow('Missing admitted texture cost bytes');
      await expect(deviceLibraryCostPaced(projected,new Map(),support,undefined,{...source}))
        .rejects.toThrow('Missing admitted texture cost bytes');
    }
  } finally {restore();}
});

async function rangeDemandFixture() {
  const f=await demandPackFixture(),index=parseOutputIndex(JSON.parse(new TextDecoder().decode(f.wires.get('shard.json'))));
  const wire=new Uint8Array([1,2,3,4,5,6,7,8,9]),thirdBytes=wire.slice(6),thirdHash=hashImmutableBytes(thirdBytes);
  const third={...f.second,hash:thirdHash,path:`blobs/bin/${thirdHash}.bin`},packHash=hashImmutableBytes(wire),path=`blobs/pack/${packHash}.pack`;
  const packed=parseOutputIndex({...index,files:[...index.files,third],admission:{...index.admission,library:[...f.source.library,thirdHash],
    budgets:{...f.source.budgets,library:{resident:9,compressed:9}}},packs:[{path,hash:packHash,bytes:9,entries:[
      {hash:f.first.hash,offset:0,bytes:3},{hash:f.second.hash,offset:3,bytes:3},{hash:thirdHash,offset:6,bytes:3}]}]});
  f.wires.set(third.path,thirdBytes);f.wires.set(path,wire);f.wires.set('shard.json',encodeCanonicalJson(packed));
  return {...f,third,wire,path,source:await readProductDescriptor(options(f.wires))};
}

test('adjacent partial native demands share only their exact pack range, then release it',async()=>{
  const f=await rangeDemandFixture(),plain=options(f.wires),ranges:number[][]=[],reads:string[]=[];
  const assets=new ClientAssets(f.source,new Map(),{...plain,fetch:url=>{reads.push(url.slice(base.length));return plain.fetch(url);},fetchRange:(url,start,end)=>{
    expect(url).toBe(base+f.path);ranges.push([start,end]);return Promise.resolve(new Response(f.wire.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/9`}}));
  }});
  const values=await Promise.all([assets.read(f.first.hash),assets.read(f.second.hash)]);
  expect(values).toEqual([new Uint8Array([1,2,3]),new Uint8Array([4,5,6])]);expect(ranges).toEqual([[0,5]]);expect(reads).toEqual([]);
  expect(values[0]?.buffer).not.toBe(values[1]?.buffer);expect(assets.retained.size).toBe(0);
  expect(await assets.read(f.first.hash)).toEqual(new Uint8Array([1,2,3]));expect(reads).toEqual([f.first.path]);expect(ranges).toEqual([[0,5]]);
});

test('a gap never pulls an unrequested member into a range',async()=>{
  const f=await rangeDemandFixture(),plain=options(f.wires),ranges=vi.fn(()=>Promise.reject(new Error('Unexpected range'))),reads:string[]=[];
  const assets=new ClientAssets(f.source,new Map(),{...plain,fetch:url=>{reads.push(url.slice(base.length));return plain.fetch(url);},fetchRange:ranges});
  expect(await Promise.all([assets.read(f.first.hash),assets.read(f.third.hash)])).toEqual([new Uint8Array([1,2,3]),new Uint8Array([7,8,9])]);
  expect(reads.sort()).toEqual([f.first.path,f.third.path].sort());expect(ranges).not.toHaveBeenCalled();
});

test('partial pack responses retain exact range, size and independent member guards',async()=>{
  const f=await rangeDemandFixture();
  for(const mode of ['header','short','member'] as const){
    const assets=new ClientAssets(f.source,new Map(),{...options(f.wires),fetchRange:()=>{
      const wire=f.wire.slice(0,mode==='short'?5:6);if(mode==='member')wire[0]=99;
      return Promise.resolve(new Response(wire,{status:206,headers:{'content-range':mode==='header'?'bytes 1-6/9':'bytes 0-5/9'}}));
    }});
    const values=await Promise.allSettled([assets.read(f.first.hash),assets.read(f.second.hash)]);
    expect(values[0]?.status).toBe('rejected');expect(values[1]?.status).toBe(mode==='member'?'fulfilled':'rejected');expect(assets.retained.size).toBe(0);
  }
});

test('offline partial native demand never invokes the range capability',async()=>{
  const f=await rangeDemandFixture(),fetchRange=vi.fn(()=>Promise.reject(new Error('No offline range'))),fetch=vi.fn(()=>Promise.reject(new Error('No offline fetch')));
  const assets=new ClientAssets(f.source,new Map(),{...options(f.wires),offline:true,fetchRange,fetch,cache:{
    ...cacheStore().cache,verifiedAsset:ref=>Promise.resolve(ref===f.first.hash?new Uint8Array([1,2,3]):null),
  }});
  expect(await assets.read(f.first.hash)).toEqual(new Uint8Array([1,2,3]));
  await expect(assets.read(f.second.hash)).rejects.toThrow('Missing cached resident tile');
  expect(fetchRange).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(assets.retained.size).toBe(0);
});

test('an unsupported range refuses without a whole-pack fallback and a repaired wave retries',async()=>{
  const f=await rangeDemandFixture(),fetch=vi.fn(()=>Promise.reject(new Error('Unexpected fallback')));let supported=false,reads=0;
  const assets=new ClientAssets(f.source,new Map(),{...options(f.wires),fetch,fetchRange:()=>{
    reads++;return Promise.resolve(new Response(f.wire.slice(0,6),{status:supported?206:200,headers:{'content-range':'bytes 0-5/9'}}));
  }});
  const refused=await Promise.allSettled([assets.read(f.first.hash),assets.read(f.second.hash)]);
  for(const value of refused){expect(value.status).toBe('rejected');if(value.status==='rejected')expect(String(value.reason)).toContain('Resident pack range response differs');}
  expect(reads).toBe(1);expect(fetch).not.toHaveBeenCalled();supported=true;
  expect(await Promise.all([assets.read(f.first.hash),assets.read(f.second.hash)])).toEqual([new Uint8Array([1,2,3]),new Uint8Array([4,5,6])]);
  expect(reads).toBe(2);expect(assets.retained.size).toBe(0);
});


test('low-priority read-ahead and actual demand share one exact verified body', async () => {
  const row = fixture(true), opts = options(row.wires), source = await readProductDescriptor(opts);
  const file = source.files[0], bytes = row.wires.get(`blobs/bin/${file?.hash ?? ''}.bin`);
  if (file === undefined || bytes === undefined) throw new Error('Native body fixture missing');
  let finish = (_value: Response): void => undefined;
  const body = new Promise<Response>(resolve => { finish = resolve; });
  const backgroundFetch = vi.fn(() => body), fetch = vi.fn(() => Promise.reject(new Error('Ordinary retry'))), verify = vi.fn(hash);
  const assets = new ClientAssets(source, new Map(), { ...opts, hash: verify, fetch, backgroundFetch });
  const warm = assets.read(file.hash, 'low'), demand = assets.read(file.hash);
  finish(new Response(Uint8Array.from(bytes)));
  expect(await warm).toEqual(bytes); expect(await demand).toBe(await warm);
  expect(backgroundFetch).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  expect(verify).toHaveBeenCalledOnce(); expect(assets.retained.size).toBe(0);
  await expect(assets.read(file.hash)).rejects.toThrow('Ordinary retry');
  expect(fetch).toHaveBeenCalledOnce();
});
