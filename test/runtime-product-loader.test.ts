import { afterEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import * as schema from '../src/format/shardSchema';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { outputSectionPayloads, parseOutputIndex } from '../src/format/outputIndex';
import { loadShardProduct, shardProductFromAdmission } from '../src/game/shardfile/runtimeProduct';
import { readProductDescriptor, type ProductOptions } from '../src/game/shardfile/product';
import { Scope } from '../src/engine/app/scope';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); Reflect.deleteProperty(globalThis, '__SHARDFILE_VALIDATOR__'); Reflect.deleteProperty(globalThis, '__SHARDFILE_VERDICTS__'); });
const own = (): Scope => { const scope = new Scope('loader-test'); scopes.push(scope); return scope; };
const bytes = (input: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(input));
function fixture() {
  const source = emptyShardfile({ slug: 'runtime-loader', name: 'Loader', author: 'Test', revision: 1, seed: 1 });
  const blob = new Uint8Array([1, 2, 3]), ref = hashImmutableBytes(blob);
  source.files.push({ hash: ref, kind: 'binary', compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(ref); source.budgets.library = { compressed: 3, resident: 3 };
  const values = new Map(outputSectionPayloads(source)); values.set('custom/facts', { count: 3 });
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
