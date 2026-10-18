import { afterEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import * as schema from '../src/format/shardSchema';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { outputSectionPayloads, parseOutputIndex } from '../src/format/outputIndex';
import { loadShardProduct, shardProductFromAdmission, runtimeProduct } from '../src/game/shardfile/runtimeProduct';
import { admitProduct, readProductDescriptor, type ProductOptions, type ProductCache } from '../src/game/shardfile/product';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { neighbourProductFiles, productResidentBytes, runtimeOnlyProductFiles } from '../src/game/shardfile/productCost';
import { ProductLeases } from '../src/game/grid/productLeases';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { Scope } from '../src/engine/app/scope';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); Reflect.deleteProperty(globalThis, '__SHARDFILE_VALIDATOR__'); Reflect.deleteProperty(globalThis, '__SHARDFILE_VERDICTS__'); });
const own = (): Scope => { const scope = new Scope('loader-test'); scopes.push(scope); return scope; };
const bytes = (input: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(input));
function fixture(platformRef = false) {
  const source = emptyShardfile({ slug: 'runtime-loader', name: 'Loader', author: 'Test', revision: 1, seed: 1 });
  const blob = new Uint8Array([1, 2, 3]), ref = hashImmutableBytes(blob);
  source.files.push({ hash: ref, kind: 'binary', compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(ref); source.budgets.library = { compressed: 3, resident: 3 };
  const values = new Map(outputSectionPayloads(source)); values.set('custom/facts', { count: 3 });
  if (platformRef) values.set('ui/strings', { file: `blobs/bin/${ref}.bin` });
  const wires = new Map<string, Uint8Array>(); let descriptors = 0;
  const sections = [...values].map(([name, value]) => {
    const wire = bytes(value), path = `sections/${name}.json`; wires.set(path, wire);
    return { name, path, hash: hashImmutableBytes(wire), bytes: wire.length,
      schema: name.startsWith('custom/') ? `schemas/${name}.schema.json` : `wildshard:${name}@1` };
  });
  const index = parseOutputIndex({ format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version,
    identity: source.identity, requires: source.requires, build: { sourceHash: hashImmutableBytes(bytes(source)), validator: 'test' },
    admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
    sections, schemas: [{ path: 'schemas/custom/facts.schema.json', hash: hashImmutableBytes(bytes({})), bytes: bytes({}).length }],
    files: source.files.map(file => ({ ...file, kind: 'bin', name: 'models/token.bin', path: `blobs/bin/${ref}.bin` })), runtime: null });
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

test('the pinned index skips section schemas and shares a facade until its last lease ends', async () => {
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


test('runtime readers preserve the live product fetch and memory-only cache policy', async () => {
  const f = fixture(); trust(f.receipt);
  const fetch = vi.spyOn(f.options, 'fetch');
  const product = await loadShardProduct(f.source.identity.slug, f.options, own());
  const runtime = runtimeProduct(product.shardfile);
  expect(await runtime.assets.read(f.ref)).toEqual(f.blob);
  expect(fetch).toHaveBeenCalledWith(`${f.options.base}blobs/bin/${f.ref}.bin`);
  expect(runtimeProduct(product.shardfile).assets).toBe(runtime.assets);
  expect(await product.file('models/token.bin')).toEqual(f.blob);
  expect(fetch).toHaveBeenLastCalledWith(`${f.options.base}blobs/bin/${f.ref}.bin`);
});
