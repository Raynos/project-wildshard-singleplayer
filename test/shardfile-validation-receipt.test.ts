import { afterEach, expect, it, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { canonicalJson, contentHash } from '@wildshard/sdk/project';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';
import { builtValidationReceipt, readValidationReceipt, validationSourceBytes } from '../src/game/shardfile/validationReceipt';
import { worstContentCost } from '../src/game/shardfile/budget';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import * as validation from '../src/game/shardfile/validate';

const base = 'https://example.test/product/';
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(globalThis, '__SHARDFILE_VALIDATOR__'); Reflect.deleteProperty(globalThis, '__SHARDFILE_VERDICTS__'); });
function fixture() {
  vi.stubGlobal('__SHARDFILE_VALIDATOR__', 'fixture-validator');
  const source = emptyShardfile({ slug: 'receipt-test', name: 'Receipt', author: 'Test', revision: 1, seed: 1 });
  const bytes = new TextEncoder().encode('{"value":1}'), hash = contentHash(bytes);
  source.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(hash); source.budgets.library = { compressed: bytes.length, resident: bytes.length };
  let product: CachedProduct | null = null;
  const saved = new Map<string, Uint8Array>();
  const cache: ProductCache = { product: () => Promise.resolve(product), asset: (_base, key) => Promise.resolve(saved.get(key) ?? null),
    putAsset: (_base, key, value) => { saved.set(key, value); return Promise.resolve(); },
    putProduct: (_base, value) => { product = value; return Promise.resolve(); } };
  const digest = vi.fn((value: Uint8Array) => Promise.resolve(contentHash(value)));
  const options = { base, cache, firstParty: false, offline: false, hash: digest, fetch: () => Promise.resolve(new Response(Uint8Array.from(bytes))) };
  const receipt = () => ({ revision: 'fixture-validator', sourceHash: contentHash(validationSourceBytes(source)), worst: worstContentCost(source) });
  return { source, bytes, hash, cache, options, digest, saved, receipt, cached: () => product };
}
it('hashes the same sorted declaration as the SDK, including schema defaults', () => {
  const f = fixture();
  expect(new TextDecoder().decode(validationSourceBytes(f.source))).toBe(canonicalJson(f.source));
});
it('validates an external first visit, then reuses its exact cached verdict while hashing every immutable asset', async () => {
  const f = fixture(), validate = vi.spyOn(validation, 'validateShardfileAssets');
  await admitProduct(f.source, f.options);
  expect(validate).toHaveBeenCalledTimes(1); expect(f.cached()?.validation).toEqual(f.receipt());
  f.digest.mockClear();
  await admitProduct(f.source, { ...f.options, offline: true });
  expect(validate).toHaveBeenCalledTimes(1);
  expect(f.digest.mock.calls.some(([bytes]) => contentHash(bytes) === f.hash)).toBe(true);
  f.saved.set(f.hash, new Uint8Array(f.bytes.length));
  await expect(admitProduct(f.source, { ...f.options, offline: true })).rejects.toThrow('hash mismatch');
});
it('falls back to full validation after declaration or validator changes, and with custom readers', async () => {
  const f = fixture(), validate = vi.spyOn(validation, 'validateShardfileAssets');
  await admitProduct(f.source, f.options);
  f.source.identity.revision++;
  await admitProduct(f.source, f.options);
  expect(validate).toHaveBeenCalledTimes(2);
  vi.stubGlobal('__SHARDFILE_VALIDATOR__', 'next-validator');
  await admitProduct(f.source, f.options);
  expect(validate).toHaveBeenCalledTimes(3);
  await admitProduct(f.source, { ...f.options, versions: { current: f.source.version, readers: new Map([[f.source.version, () => f.source]]) } });
  expect(validate).toHaveBeenCalledTimes(4);
});
it('only uses build-owned first-visit receipts for explicitly first-party products', async () => {
  const f = fixture(), validate = vi.spyOn(validation, 'validateShardfileAssets');
  vi.stubGlobal('__SHARDFILE_VERDICTS__', [f.receipt()]);
  const { cache: _cache, ...uncached } = f.options;
  await admitProduct(f.source, { ...uncached, firstParty: false });
  expect(validate).toHaveBeenCalledTimes(1);
  await admitProduct(f.source, { ...uncached, firstParty: true });
  expect(validate).toHaveBeenCalledTimes(1);
  expect(builtValidationReceipt('unbound')).toBeNull();
});
it('rechecks strict page memory policy when an exact product was validated under Developer', async () => {
  const f = fixture(); f.source.budgets.library.resident = 900_000_000;
  await admitProduct(f.source, { ...f.options, memory: new MemoryAdmission(() => true) });
  await expect(admitProduct(f.source, { ...f.options, offline: true })).rejects.toThrow('worst-location total');
});
it('refuses stale, malformed or unbundled receipts and isolates memoized cost values from mutation', () => {
  const f = fixture(), receipt = f.receipt();
  for (const value of [null, {}, { ...receipt, revision: 'old' }, { ...receipt, worst: { ...receipt.worst, playing: -1 } }]) expect(readValidationReceipt(value, receipt.sourceHash)).toBeNull();
  const first = worstContentCost(f.source); first.playing = 0; first.location[0] = 99;
  expect(worstContentCost(f.source)).toEqual(receipt.worst);
  f.source.budgets.library.resident += 100;
  expect(worstContentCost(f.source).playing).toBeGreaterThan(receipt.worst.playing);
  Reflect.deleteProperty(globalThis, '__SHARDFILE_VALIDATOR__'); Reflect.deleteProperty(globalThis, '__SHARDFILE_VERDICTS__');
  expect(readValidationReceipt(receipt, receipt.sourceHash)).toBeNull();
});
