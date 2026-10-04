import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { admitProduct, boundedResponse, type ProductOptions } from '../src/game/shardfile/product';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/game/shardfile/admissionLimits';

const hash = 'a'.repeat(64);
const empty = () => emptyShardfile({ slug: 'preflight-test', name: 'Preflight', author: 'Local', seed: 1, revision: 1 });
it.each([false, true])('a valid-hash 3 GB manifest makes zero asset requests (reachable=%s)', async (reachable) => {
  const source = empty(); let requests = 0;
  source.files.push({ hash, kind: 'binary', compressed: 3_000_000_000, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  if (reachable) source.library.push(hash);
  const options: ProductOptions = { base: 'https://outside.test/', offline: false, firstParty: false, hash: () => Promise.resolve(hash), fetch: () => { requests++; return Promise.resolve(new Response()); },
    cache: { product: () => Promise.resolve(null), asset: () => { requests++; return Promise.resolve(null); }, putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() } };
  await expect(admitProduct(source, options)).rejects.toThrow('total wire'); expect(requests).toBe(0);
});
it('a small orphan refuses before reading a cache asset or fetching bytes', async () => {
  const source = empty(); let requests = 0;
  source.files.push({ hash, kind: 'binary', compressed: 1, decoded: 1, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  await expect(admitProduct(source, { base: 'https://outside.test/', offline: false, firstParty: false, hash: () => Promise.resolve(hash), fetch: () => { requests++; return Promise.resolve(new Response()); },
    cache: { product: () => Promise.resolve(null), asset: () => { requests++; return Promise.resolve(null); }, putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() } })).rejects.toThrow('Orphan');
  expect(requests).toBe(0);
});
it.each([false, true])('oversized source refuses before asset requests online and cached (offline=%s)', async (offline) => {
  const source = { ...empty(), extra: Array.from({ length: 500 }, () => 'x'.repeat(4096)) }; let requests = 0;
  await expect(admitProduct(source, { base: 'https://outside.test/', offline, firstParty: false, hash: () => Promise.resolve(hash), fetch: () => { requests++; return Promise.resolve(new Response()); },
    cache: { product: () => Promise.resolve(offline ? { source, firstParty: false } : null), asset: () => { requests++; return Promise.resolve(null); }, putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() } })).rejects.toThrow('source');
  expect(requests).toBe(0);
});
it('a headerless network source is bounded by actual bytes and cancels when over the source cap', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(limits.sourceBytes)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
  await expect(boundedResponse(new Response(body), limits.sourceBytes)).rejects.toThrow('wire size'); expect(cancelled).toBe(true);
});
it('forged cached wire lengths refuse before hashing or making an owned copy', async () => {
  const source = empty(); source.files.push({ hash, kind: 'binary', compressed: 2, decoded: 2, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(hash); source.budgets.library = { compressed: 2, resident: 2 }; let hashes = 0;
  await expect(admitProduct(source, { base: 'https://outside.test/', offline: true, firstParty: false, hash: () => { hashes++; return Promise.resolve(hash); }, fetch: () => Promise.reject(new Error('No network')),
    cache: { product: () => Promise.resolve({ source, firstParty: false }), asset: () => Promise.resolve(new Uint8Array(1)), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() } })).rejects.toThrow('wire size');
  expect(hashes).toBe(0);
});
