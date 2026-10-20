// oxlint-disable-next-line import/no-nodejs-modules -- Actual inert image fixture exercises the admitted cost envelope.
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import * as schema from '../src/format/shardSchema';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { outputSectionPayloads, parseOutputIndex } from '../src/format/outputIndex';
import { loadShardProduct, runtimeProduct, shardProductFromAdmission } from '../src/game/shardfile/runtimeProduct';
import { admitProduct, readProductDescriptor, type ProductOptions, type ProductCache } from '../src/game/shardfile/product';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { neighbourProductFiles, productResidentBytes, runtimeOnlyProductFiles, tierLibrarySource, urlImageLibrarySource, scopedSpecimenLibrarySource } from '../src/game/shardfile/productCost';
import { carryOutputDescriptor, resolveOutputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { MemoryAdmission } from '../src/format/product';
import { acceptValidatedCost } from '../src/format/assetAdmission';
import { ProductLeases } from '../src/game/grid/productLeases';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import metadata from '../src/shards/far-reach/manifest.json';
import { parseManifestMetadata } from '../src/format/minimap';
import { parseImageAsset } from '../src/format/stillImage';
import { Scope } from '../src/engine/app/scope';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); Reflect.deleteProperty(globalThis, '__SHARDFILE_VALIDATOR__'); Reflect.deleteProperty(globalThis, '__SHARDFILE_VERDICTS__'); });
const own = (): Scope => { const scope = new Scope('loader-test'); scopes.push(scope); return scope; };
const bytes = (input: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(input));

test('read-only runtime lookups defer descriptor classification until release', async () => {
  const source = emptyShardfile({ slug: 'runtime-readonly', name: 'Reader', author: 'Test', revision: 1, seed: 1 });
  let classifications = 0;
  Object.defineProperty(source, 'runtime', { get: () => { classifications++; return null; } });
  const priorLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'https://test.example/' } });
  try {
    const first = runtimeProduct(source), second = runtimeProduct(source);
    expect(first.source).toBe(source); expect(second.source).toBe(source);
    expect(classifications).toBe(0);
    await first.releaseTransport([]); expect(classifications).toBe(1);
    await first.releaseTransport([]); expect(classifications).toBe(1);
    await second.releaseTransport([]); expect(classifications).toBe(2);
  } finally {
    if (priorLocation === undefined) Reflect.deleteProperty(globalThis, 'location');
    else Object.defineProperty(globalThis, 'location', priorLocation);
  }
});

function fixture(platformRef = false, extra?: (source: schema.Shardfile) => ReadonlyMap<string, unknown>, logicalNames?: ReadonlyMap<string, string>) {
  const source = emptyShardfile({ slug: 'runtime-loader', name: 'Loader', author: 'Test', revision: 1, seed: 1 });
  const blob = new Uint8Array([1, 2, 3]), ref = hashImmutableBytes(blob);
  source.files.push({ hash: ref, kind: 'binary', compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(ref); source.budgets.library = { compressed: 3, resident: 3 };
  const added = extra?.(source);
  const values = new Map(outputSectionPayloads(source)); values.set('custom/facts', { count: 3 });
  for (const [name, value] of added ?? []) values.set(name, value);
  if (platformRef) values.set('ui/strings', { file: `blobs/bin/${ref}.bin` });
  const customSchema = bytes({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', required: ['count'], additionalProperties: false, properties: { count: { type: 'number' } } });
  const wires = new Map<string, Uint8Array>([['schemas/custom/facts.schema.json', customSchema]]); let descriptors = 0;
  const sections = [...values].map(([name, value]) => {
    const wire = bytes(value), path = `sections/${name}.json`; wires.set(path, wire);
    return { name, path, hash: hashImmutableBytes(wire), bytes: wire.length,
      schema: name.startsWith('custom/') ? `schemas/${name}.schema.json` : `wildshard:${name}@1` };
  });
  const index = parseOutputIndex({ format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version,
    identity: source.identity, requires: source.requires, build: { sourceHash: hashImmutableBytes(bytes(source)), validator: 'test' },
    admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
    sections, schemas: [{ path: 'schemas/custom/facts.schema.json', hash: hashImmutableBytes(customSchema), bytes: customSchema.length }],
    files: source.files.map(file => ({ ...file, kind: file.kind === 'image' ? 'image' : 'bin', name: logicalNames?.get(file.hash) ?? (file.hash === ref ? 'models/token.bin' : 'models/desktop.bin'), path: file.kind === 'image' ? `blobs/image/${file.hash}.png` : `blobs/bin/${file.hash}.bin` })), runtime: null });
  wires.set('shard.json', bytes(index)); wires.set(`blobs/bin/${ref}.bin`, blob);
  const base = 'https://test.example/shardfiles/runtime-loader/';
  const options: ProductOptions = { base, offline: false, firstParty: true,
    hash: wire => Promise.resolve(hashImmutableBytes(wire)), fetch: url => {
      const path = url.slice(base.length); if (path === 'shard.json') descriptors++;
      const wire = wires.get(path); return Promise.resolve(wire === undefined ? new Response(null, { status: 404 }) : new Response(Uint8Array.from(wire)));
    } };
  const receipt = { revision: 'loader-test', indexHash: hashImmutableBytes(bytes(index)), sourceHash: index.build.sourceHash,
    worst: { playing: 0, loading: 0, accounted: 0, location: [0, 0] } };
  return { source, index, wires, options, blob, ref, receipt, descriptors: () => descriptors };
}
function trust(receipt: unknown): void { vi.stubGlobal('__SHARDFILE_VALIDATOR__', 'loader-test'); vi.stubGlobal('__SHARDFILE_VERDICTS__', [receipt]); }

test('the pinned index keeps custom admission and shares a facade until its last lease ends', async () => {
  const f = fixture(); trust(f.receipt); const parse = vi.spyOn(schema, 'parseShardfile');
  const a = own(), b = own();
  const [first, second] = await Promise.all([loadShardProduct(f.source.identity.slug, f.options, a), loadShardProduct(f.source.identity.slug, f.options, b)]);
  expect(first).toBe(second); expect(f.descriptors()).toBe(1); expect(parse).not.toHaveBeenCalled();
  expect(first.section('quests/quests').quests).toEqual(f.source.quests);
  expect(first.section('custom/facts', { 'custom/facts': v.strictObject({ count: v.number() }) })).toEqual({ count: 3 });
  expect(await first.file('models/token.bin')).toEqual(f.blob);
  a.dispose(); expect(await loadShardProduct(f.source.identity.slug, f.options, b)).toBe(first);
  b.dispose(); expect(await loadShardProduct(f.source.identity.slug, f.options, own())).not.toBe(first);
  expect(f.descriptors()).toBe(2);
});

test('a pinned product still refuses missing and changed custom schema bytes', async () => {
  const missing = fixture(); trust(missing.receipt);
  missing.wires.delete('schemas/custom/facts.schema.json');
  await expect(loadShardProduct(missing.source.identity.slug, missing.options, own())).rejects.toThrow('Unavailable');
  const changed = fixture(); trust(changed.receipt);
  changed.wires.set('schemas/custom/facts.schema.json', bytes({ $schema: 'http://json-schema.org/draft-07/schema#' }));
  await expect(loadShardProduct(changed.source.identity.slug, changed.options, own())).rejects.toThrow('hash or size');
});

test('a wrong index receipt never bypasses parsing and custom checks', async () => {
  const f = fixture(); trust({ ...f.receipt, indexHash: '0'.repeat(64) }); const parse = vi.spyOn(schema, 'parseShardfile');
  const product = await loadShardProduct(f.source.identity.slug, f.options, own());
  expect(parse).toHaveBeenCalled();
  expect(() => product.section('custom/facts', { 'custom/facts': v.strictObject({ count: v.string() }) })).toThrow('schema');
});

test('a pinned index refuses changed section bytes even with a matching source receipt', async () => {
  const f = fixture(); trust(f.receipt);
  const section = f.index.sections.find(row => row.name === 'custom/facts');
  if (section === undefined) throw new Error('Missing custom section');
  f.wires.set(section.path, bytes({ count: 4 }));
  await expect(loadShardProduct(f.source.identity.slug, f.options, own())).rejects.toThrow('hash or size');
});

test('a pinned index cannot certify a different assembled source', async () => {
  const f = fixture(), changed = { ...f.index, build: { ...f.index.build, sourceHash: '0'.repeat(64) } };
  f.wires.set('shard.json', bytes(changed));
  trust({ ...f.receipt, sourceHash: changed.build.sourceHash, indexHash: hashImmutableBytes(bytes(changed)) });
  await expect(loadShardProduct(f.source.identity.slug, f.options, own())).rejects.toThrow('source receipt mismatch');
});

test('failed loads retry, and a cancelled lease cannot retire another pending owner', async () => {
  const f = fixture(), index = f.wires.get('shard.json'); if (index === undefined) throw new Error('Missing fixture');
  const a = own(); f.wires.delete('shard.json');
  await expect(loadShardProduct(f.source.identity.slug, f.options, a)).rejects.toThrow();
  f.wires.set('shard.json', index);
  const cancelled = loadShardProduct(f.source.identity.slug, f.options, a), b = own();
  const pending = loadShardProduct(f.source.identity.slug, f.options, b); a.dispose();
  await expect(cancelled).rejects.toThrow('left during loading');
  const product = await pending;
  expect(await loadShardProduct(f.source.identity.slug, f.options, b)).toBe(product);
  expect(f.descriptors()).toBe(2);
});

test('regional facade uses admitted bytes and the verified reader after transport release', async () => {
  const f = fixture(), source = await readProductDescriptor(f.options), assets = new Map([[f.ref, f.blob]]);
  const admitted = { source, assets, cached: false }, product = shardProductFromAdmission(admitted, own(), f.options);
  expect(shardProductFromAdmission(admitted, own(), f.options)).toBe(product);
  expect(await product.file('models/token.bin')).toBe(f.blob);
  assets.clear(); expect(await product.file('models/token.bin')).toEqual(f.blob); expect(f.descriptors()).toBe(1);
});

test('neighbour transport release shrinks the shared claim before readers copy its bytes', async () => {
  const f = fixture(); trust(f.receipt);
  const disk = new Map<string, Uint8Array>(), pins = new Set<string>();
  const cache: ProductCache = {
    product: () => Promise.resolve(null), putProduct: () => Promise.resolve(),
    asset: (_base, ref) => Promise.resolve(disk.get(ref) ?? null),
    putAsset: (_base, ref, wire) => { disk.set(ref, wire); return Promise.resolve(true); },
    verifiedPresent: (ref, size) => Promise.resolve(disk.get(ref)?.length === size),
    pin: refs => { for (const ref of refs) pins.add(ref); return () => { pins.clear(); }; },
  };
  const options = { ...f.options, cache }, allocator = new ResidencyAllocator();
  const load = async (reserve: (source: schema.Shardfile) => void, releaseBytes: (size: number) => void) => {
    const admitted = await admitProduct(f.index, { ...options, reserve });
    const before = allocator.cost().input.products;
    const refs = runtimeOnlyProductFiles(admitted.source), unpin = cache.pin?.(refs);
    const released = await admitted.releaseTransport?.(refs) ?? [];
    releaseBytes(released.includes(f.ref) ? f.blob.length : 0);
    return { admitted, before, unpin };
  };
  const products = new ProductLeases<Awaited<ReturnType<typeof load>>>(allocator, 'grid');
  const [first, second] = await Promise.all([products.acquire('runtime-loader', load), products.acquire('runtime-loader', load)]);
  expect(first.value).toBe(second.value);
  expect(first.value.before).toBe(productResidentBytes(first.value.admitted.source));
  expect(allocator.cost().input.products).toBe((first.value.before ?? 0) - f.blob.length);
  expect(first.value.admitted.assets.has(f.ref)).toBe(false);
  const reader = new ClientAssets(first.value.admitted.source, first.value.admitted.assets, { ...options, offline: true });
  expect(reader.retained.size).toBe(0); expect(pins.has(f.ref)).toBe(true);
  const product = shardProductFromAdmission(first.value.admitted, own(), { ...options, offline: true });
  expect(await product.file('models/token.bin')).toEqual(f.blob);
  expect(await reader.read(f.ref)).toEqual(f.blob); expect(reader.retained.size).toBe(0);
  disk.set(f.ref, new Uint8Array([3, 2, 1]));
  await expect(reader.read(f.ref)).rejects.toThrow('hash or size');
  first.release(); expect(allocator.entries()).toHaveLength(1);
  second.release(); products.dispose(); first.value.unpin?.();
  expect(allocator.entries()).toHaveLength(0); expect(pins.size).toBe(0);
});

test('declared neighbour inputs and their transitive dependencies survive runtime trimming', () => {
  const f = fixture(), child = 'f'.repeat(64), leaf = 'e'.repeat(64);
  f.source.sim.scripts.push(f.ref);
  const root = f.source.files[0]; if (root === undefined) throw new Error('Missing fixture file');
  root.dependencies.push(child);
  f.source.files.push({ ...root, hash: child, dependencies: [leaf] }, { ...root, hash: leaf, dependencies: [] });
  expect(runtimeOnlyProductFiles(f.source)).toEqual([]);
  f.source.sim.scripts.length = 0;
  f.source.look.samplers = { [f.ref]: { wrap: 'repeat' } };
  expect(runtimeOnlyProductFiles(f.source)).toEqual([]);
  f.source.look.samplers = {};
  expect(new Set(runtimeOnlyProductFiles(f.source))).toEqual(new Set([f.ref, child, leaf]));
});

test('independent platform sections keep their file-path inputs for synchronous hosts', async () => {
  const f = fixture(true), source = await readProductDescriptor(f.options);
  expect(runtimeOnlyProductFiles(source)).toEqual([]);
});

test('bound props stream tiles and whole geometry while retaining neighbour panel dependencies', () => {
  const f = fixture(), panel = 'b'.repeat(64), texture = 'c'.repeat(64);
  const file = f.source.files[0]; if (file === undefined) throw new Error('Missing fixture file');
  f.source.files.push({ ...file, hash: panel, dependencies: [texture] }, { ...file, hash: texture, dependencies: [] });
  f.source.runtime = { entry: 'runtime/index.ts', binds: ['props'] };
  f.source.props = { version: 1, family: 'toon', tiles: [{ lod: 0, x: 0, z: 0, file: f.ref }],
    wholeLibrary: [f.ref], models: [], panels: [{ id: 'door', file: panel, visible: true }], far: null, colliders: [], textures: [] };
  f.source.tiles.push({ lod: 0, x: 0, z: 0, files: [f.ref], compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0,
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, geometricError: 0 });
  expect(runtimeOnlyProductFiles(f.source)).toEqual([]);
  expect(neighbourProductFiles(f.source)).toEqual([f.ref]);
  f.source.sim.scripts.push(f.ref); expect(neighbourProductFiles(f.source)).toEqual([]);
  f.source.sim.scripts.length = 0; f.source.runtime = null;
  expect(neighbourProductFiles(f.source)).toEqual([]); // unbound whole-library references remain synchronous
  f.source.props.wholeLibrary = [];
  expect(neighbourProductFiles(f.source)).toEqual([f.ref]);
  f.source.props.models.push({ id: 'synchronous-library', file: f.ref });
  expect(neighbourProductFiles(f.source)).toEqual([]);
});

test('failed durable writes retain runtime bytes instead of shrinking admission', async () => {
  const f = fixture(); trust(f.receipt);
  const options: ProductOptions = { ...f.options, cache: {
    product: () => Promise.resolve(null), putProduct: () => Promise.resolve(),
    asset: () => Promise.resolve(null), putAsset: () => Promise.resolve(false),
    verifiedPresent: () => Promise.resolve(false),
  } };
  const admitted = await admitProduct(f.index, options);
  expect(await admitted.releaseTransport?.([f.ref])).toEqual([]);
  expect(admitted.assets.get(f.ref)).toEqual(f.blob);
  options.offline = true;
  expect(await admitted.releaseTransport?.([f.ref], 'cache-or-fetch')).toEqual([]);
  expect(admitted.assets.get(f.ref)).toEqual(f.blob);
});

test('bound terrain queries reread on entry while unbound simulation inputs remain', () => {
  const f = fixture();
  f.source.runtime = { entry: 'runtime/index.ts', binds: ['terrain'] };
  f.source.terrain = { version: 1, form: 'query', family: 'toon', collider: f.ref, tiles: [],
    sampling: { law: 'bilinear', file: f.ref, normalEpsilon: 0.25, datum: 0 } };
  expect(neighbourProductFiles(f.source)).toEqual([f.ref]);
  f.source.sim.scripts.push(f.ref); expect(neighbourProductFiles(f.source)).toEqual([]);
  f.source.sim.scripts.length = 0; f.source.runtime.binds = [];
  expect(neighbourProductFiles(f.source)).toEqual([]);
});

test('online grid wires reread and verify network bytes after cache quota failure', async () => {
  const f = fixture(); trust(f.receipt);
  const options: ProductOptions = { ...f.options, cache: {
    product: () => Promise.resolve(null), putProduct: () => Promise.resolve(),
    asset: () => Promise.resolve(null), putAsset: () => Promise.resolve(false),
    verifiedPresent: () => Promise.resolve(false),
  } };
  const admitted = await admitProduct(f.index, options);
  expect(await admitted.releaseTransport?.([f.ref], 'cache-or-fetch')).toEqual([f.ref]);
  expect(admitted.assets.has(f.ref)).toBe(false);
  const reader = new ClientAssets(admitted.source, admitted.assets, options);
  expect(await reader.read(f.ref)).toEqual(f.blob);
  f.wires.set(`blobs/bin/${f.ref}.bin`, new Uint8Array([9, 9, 9]));
  await expect(reader.read(f.ref)).rejects.toThrow('hash or size');
});

test('shrinking residency cannot grow, underflow or revive a released claim', () => {
  const allocator = new ResidencyAllocator(), claim = allocator.reserve({ id: 'product:test', owner: 'test', category: 'product', bytes: 10, distance: 0, needed: true });
  if (claim === null) throw new Error('Missing test claim');
  expect(() => claim.shrink(11)).toThrow('shrink'); expect(() => claim.shrink(-1)).toThrow('shrink');
  claim.shrink(4); expect(allocator.cost().input.products).toBe(4);
  claim.release(); claim.shrink(1); expect(allocator.entries()).toHaveLength(0);
});

test('tier residency excludes only a typed alternative with no other live reference', async () => {
  const desktop = hashImmutableBytes(new Uint8Array([9]));
  const f = fixture(false, source => {
    source.files.push({ hash: desktop, kind: 'binary', compressed: 1, decoded: 700, gpu: 300, triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(desktop); source.budgets.library.resident += 1000;
    return new Map([['world/scenes', { version: 1, libraries: [{ id: 'trees', kind: 'owned', models: [
      { id: 'tree', file: { phone: 'models/token.bin', desktop: 'models/desktop.bin' } },
    ] }], materials: [], steps: [] }]]);
  });
  const resolved = await resolveOutputDescriptor(f.index, { offline: false, hash: f.options.hash,
    read: path => { const wire = f.wires.get(path); if (wire === undefined) throw new Error('Missing fixture section'); return Promise.resolve(wire); } });
  const source = schema.parseShardfile(resolved);
  carryOutputDescriptor(resolved, source);
  const admitted = source;
  expect(tierLibrarySource(admitted, 'phone').budgets.library.resident).toBe(3);
  expect(tierLibrarySource(admitted, 'desktop').budgets.library.resident).toBe(1000);
  expect(tierLibrarySource(admitted, 'phone').library).not.toContain(desktop);
  expect(source.budgets.library.resident).toBe(1003);
  const token = admitted.files.find(file => file.hash === f.ref); if (token === undefined) throw new Error('Missing token');
  token.dependencies.push(desktop);
  expect(tierLibrarySource(admitted, 'phone').budgets.library.resident).toBe(1003);
});

test('tier residency excludes the other tier of a rigged-hull book', async () => {
  const desktop = hashImmutableBytes(new Uint8Array([9]));
  const f = fixture(false, source => {
    source.files.push({ hash: desktop, kind: 'binary', compressed: 1, decoded: 700, gpu: 300, triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(desktop); source.budgets.library.resident += 1000;
    const tier = (file: string) => ({ files: { hull: file }, coats: {} });
    return new Map([['look/rigged-hulls', { productFiles: true, family: { label: 'Herd', rigs: [], hulls: { 'deer:hind': 'hull' } },
      tiers: { phone: tier('models/token.bin'), desktop: tier('models/desktop.bin') } }]]);
  });
  const resolved = await resolveOutputDescriptor(f.index, { offline: false, hash: f.options.hash,
    read: path => { const wire = f.wires.get(path); if (wire === undefined) throw new Error('Missing fixture section'); return Promise.resolve(wire); } });
  const source = schema.parseShardfile(resolved);
  carryOutputDescriptor(resolved, source);
  expect(tierLibrarySource(source, 'phone').library).not.toContain(desktop);
  expect(tierLibrarySource(source, 'phone').budgets.library.resident).toBe(3);
  expect(tierLibrarySource(source, 'desktop').library).toContain(desktop);
});

async function specimenCostFixture(profiles = false) {
  const assets = new Map<string, Uint8Array>(), names = new Map<string, string>();
  const add = (source: schema.Shardfile, name: string, wire: Uint8Array, decoded: number): string => {
    const hash = hashImmutableBytes(wire); assets.set(hash, wire); names.set(hash, name);
    source.files.push({ hash, kind: 'binary', compressed: wire.length, decoded, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(hash); source.budgets.library.resident += decoded; return hash;
  };
  const f = fixture(false, source => {
    const models = Array.from({ length: 8 }, (_, i) => {
      const id = `m${String(i)}`, name = `models/${id}.bin`;
      add(source, name, new Uint8Array([30 + i]), 100); return { id, file: name };
    });
    const catalogue = { product: 'runtime-loader', models: [{ key: 'crate', id: 'runtime-loader/crate', name: 'Crate', file: 'crate.json', category: 'props', pipeline: 'code', assembly: 'scene', defaults: { style: 0 },
      choices: models.map((model, i) => ({ id: model.id, params: { style: i }, size: [1, 1, 1], colliders: [], draws: [], scene: { id: model.id, root: 'root', nodes: [
        { id: 'mesh', parent: 'root', kind: 'mesh', geometry: { library: 'shapes', model: model.id }, material: 'paint', sphere: [0, 0, 0, 1] },
      ] } })) }] };
    const wire = bytes(catalogue); add(source, 'models/catalogue.json', wire, wire.length);
    const welds = [];
    if (profiles) {
      models.push({ id: 'wide', file: 'models/wide.bin' }); add(source, 'models/wide.bin', new Uint8Array([99]), 1000);
      source.plumbing = { namespace: 'fixture', knobs: [{ id: 'fixture.rich', phone: false, desktop: true }], input: [], debug: [] };
      for (const [name, model] of [['plain', 'm0'], ['rich', 'wide']]) {
        const graph = bytes({ id: 'world', root: 'root', nodes: [{ kind: 'mesh', id: 'wall', parent: 'root', geometry: { library: 'shapes', model }, material: 'paint', sphere: [0, 0, 0, 1] }] });
        add(source, `scenes/${name}.json`, graph, graph.length);
      }
      welds.push({ id: 'world', file: { knob: 'fixture.rich', false: 'scenes/plain.json', true: 'scenes/rich.json' } });
    }
    return new Map([['world/scenes', { version: 1, libraries: [{ id: 'shapes', kind: 'owned', models }], materials: [{ id: 'paint', kind: 'standard', properties: {} }], steps: [], welds, catalogue: 'models/catalogue.json' }]]);
  }, names);
  const resolved = await resolveOutputDescriptor(f.index, { offline: false, hash: f.options.hash, read: path => {
    const wire = f.wires.get(path); if (wire === undefined) throw new Error('Missing cost fixture section'); return Promise.resolve(wire);
  } });
  const source = schema.parseShardfile(resolved); carryOutputDescriptor(resolved, source);
  return { source, assets, ref: f.ref };
}

test('scoped specimen estimates reserve comparisons and cancelled decode while preserving other readers', async () => {
  const { source, assets, ref } = await specimenCostFixture();
  const before = source.budgets.library.resident;
  expect(scopedSpecimenLibrarySource(source, assets).budgets.library.resident).toBe(before - 400);
  expect(source.budgets.library.resident).toBe(before);
  const first = hashImmutableBytes(new Uint8Array([30])), next = hashImmutableBytes(new Uint8Array([31]));
  const geometry = source.files.find(file => file.hash === first); if (geometry === undefined) throw new Error('Missing cost fixture geometry');
  geometry.gpu = 50; source.budgets.library.resident += 50;
  // Draw geometry is copied from the intake: charge its CPU attributes too.
  expect(scopedSpecimenLibrarySource(source, assets).budgets.library.resident).toBe(before);
  geometry.gpu = 0; source.budgets.library.resident = before;
  source.critical.push(first);
  expect(scopedSpecimenLibrarySource(source, assets).budgets.library.resident).toBe(before - 300);
  const token = source.files.find(file => file.hash === ref); if (token === undefined) throw new Error('Missing cost fixture token');
  token.dependencies.push(next);
  expect(scopedSpecimenLibrarySource(source, assets).budgets.library.resident).toBe(before - 200);
  assets.clear(); expect(() => scopedSpecimenLibrarySource(source, assets)).toThrow('Missing specimen cost bytes');
});

test('selected world profiles keep their own geometry and charge a fresh expensive selection', async () => {
  const { source, assets } = await specimenCostFixture(true), before = source.budgets.library.resident;
  expect(scopedSpecimenLibrarySource(source, assets).budgets.library.resident).toBe(before - 300);
  expect(scopedSpecimenLibrarySource(source, assets, { tier: 'phone' }).budgets.library.resident).toBe(before - 1300);
  expect(scopedSpecimenLibrarySource(source, assets, { tier: 'phone', overrides: { 'fixture.rich': true } }).budgets.library.resident).toBe(before - 400);
  expect(scopedSpecimenLibrarySource(source, assets, { tier: 'desktop' }).budgets.library.resident).toBe(before - 400);
});

test('a lower exact estimate clears a previous warning without changing the cap', () => {
  const source = emptyShardfile({ slug: 'cost-test', name: 'Cost', author: 'Test', revision: 1, seed: 1 });
  const memory = new MemoryAdmission(() => true);
  acceptValidatedCost(source, { playing: 1_300_000_000, loading: 1_380_000_000, accounted: 900_000_000, location: [0, 0] }, memory);
  expect(memory.reports()).toHaveLength(1);
  acceptValidatedCost(source, { playing: 1_100_000_000, loading: 1_180_000_000, accounted: 700_000_000, location: [0, 0] }, memory);
  expect(memory.reports()).toHaveLength(0);
});

test.each(['manifest', 'journal'])('%s URL images retain pixels/wire and protect shared readers', async consumer => {
  const wire = Uint8Array.from(readFileSync('test/fixtures/world-source/image.png'));
  const image = parseImageAsset(wire), ref = hashImmutableBytes(wire), cost = image.decoded + image.gpu;
  const f = fixture(false, source => {
    source.files.push({ hash: ref, kind: 'image', compressed: wire.length, decoded: image.decoded, gpu: image.gpu,
      triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(ref); source.budgets.library.resident += cost;
    const original = parseManifestMetadata(metadata);
    if (consumer === 'manifest') source.manifest = { ...original, explore: { ...original.explore,
      art: { ...original.explore.art, world: `/shardfiles/runtime-loader/blobs/image/${ref}.png` } } };
    else source.rows.compendiums.push({ kind: 'journal', id: 'book', chunkId: 'book', className: 'book', title: 'Book',
      tabs: [{ id: 'places', label: 'Places' }], stamp: { place: 'Seen', default: 'Seen' }, icons: [], stats: { place: [], default: [] },
      entries: [{ id: 'point', kind: 'place', tab: 'places', name: 'Point', notes: '', place: { x: 0, z: 0, r: 1 }, plate: { sketch: ref } }] });
    return new Map();
  });
  const raw = await resolveOutputDescriptor(f.index, { offline: false, hash: f.options.hash,
    read: path => { const data = f.wires.get(path); if (data === undefined) throw new Error('Missing fixture'); return Promise.resolve(data); } });
  const source = schema.parseShardfile(raw); carryOutputDescriptor(raw, source);
  const assets = new Map([[ref, wire]]), before = source.budgets.library.resident;
  expect(urlImageLibrarySource(source, assets).budgets.library.resident).toBe(before - (image.decoded - image.gpu - wire.length));
  expect(source.budgets.library.resident).toBe(before);
  source.map = { image: ref, tilesHash: ref };
  expect(urlImageLibrarySource(source, assets).budgets.library.resident).toBe(before);
  delete source.map; source.files[0]?.dependencies.push(ref);
  expect(urlImageLibrarySource(source, assets).budgets.library.resident).toBe(before);
});
