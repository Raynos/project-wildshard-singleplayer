import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real options factory with explicit worker/cache ports.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Erase only types from the actual factory.
import { stripTypeScriptTypes } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Do not construct a renderer or a real browser worker in this unit control.
import { runInNewContext } from 'node:vm';
import { preflightProduct } from './productPreflight';

test.each([false, true])('boot stays main and only live decoding uses bounded pages: live=%s', async live => {
  const source = readFileSync(new URL('runtimeProduct.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export function browserShardfileOptions('), end = source.indexOf('\n/** Paint before admission', start);
  if (start === -1 || end < start) throw new Error('Product options factory missing');
  const parsed = { rows: [1, 2, 3] }, calls: string[] = [], pause = (): Promise<void> => Promise.resolve();
  let cachePreparation: unknown;
  const parser = { parsePaced: (bytes: Uint8Array, actualPause: () => Promise<void>): Promise<unknown> => {
    expect([...bytes]).toEqual([1,2]); expect(actualPause).toBe(pause); calls.push('parse'); return Promise.resolve(parsed);
  } };
  const method: unknown = runInNewContext(stripTypeScriptTypes(`${source.slice(start, end).replace('export function', 'function')}\nbrowserShardfileOptions`), {
    productControlsReady: live, observesProductControl: false, document: undefined, caches: {}, navigator: { onLine: true },
    prepareContentHash: (): void => undefined,
    browserLiveJsonParser: () => { calls.push('parser'); return parser; },
    TIER_CONFIG: {}, TIER: 'phone', builtIndexes: null, ktx2TranscodeSupport: () => ({}),
    browserContentStore: () => ({}), ContentCacheWorker: class { readonly kind = 'controlled-cache'; }, hashOwnedBytes: (): void => undefined,
    pauseDescriptor: () => pause, browserProductCache: (_storage: unknown, options: unknown) => { cachePreparation = options; return {}; },
  });
  if (typeof method !== 'function') throw new Error('Product options factory is not callable');
  const result: unknown = Reflect.apply(method, undefined, ['https://game.test/shardfiles/fixture/', true]);
  if (typeof result !== 'object' || result === null || !('pause' in result)) throw new Error('Product options missing pause');
  expect(result.pause).toBe(pause);
  if (!live) {
    expect('parseJson' in result).toBe(false); expect(calls).toEqual([]);
  } else {
    if (!('parseJson' in result) || typeof result.parseJson !== 'function') throw new Error('Live parser missing');
    const value: unknown = await Reflect.apply(result.parseJson, undefined, [new Uint8Array([1,2])]);
    expect(value).toBe(parsed); expect(calls).toEqual(['parser','parse']);
  }
  if (typeof cachePreparation !== 'object' || cachePreparation === null || !('pause' in cachePreparation)) throw new Error('Visited cache preparation missing');
  expect(cachePreparation.pause).toBe(pause);
  expect(Object.keys(cachePreparation).sort()).toEqual(live ? ['parseJson','pause'] : ['pause']);
});

test('visited cache bodies use the same parser and paced complete fence before publication', async () => {
  const source = readFileSync(new URL('product.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export function browserProductCache('), end = source.indexOf('\n}', start) + 2;
  if (start === -1 || end < start) throw new Error('Browser product cache missing');
  const bytes = new Uint8Array([1, 2]), calls: string[] = [];
  let value: unknown = { source: { rows: Array.from({ length: 1000 }, (_, id) => ({ id })) }, firstParty: true };
  const method: unknown = runInNewContext(stripTypeScriptTypes(`${source.slice(start, end).replace('export function', 'function')}\nbrowserProductCache`), {
    URL, PRODUCT_CACHE_NAME: 'test-product-cache', browserContentStore: () => ({}),
    ContentCacheWorker: class { readonly kind = 'controlled-cache'; },
    boundedResponse: (): Promise<Uint8Array> => Promise.resolve(bytes), limits: { sourceBytes: 4000000 }, preflightProduct,
  });
  if (typeof method !== 'function') throw new Error('Browser product cache is not callable');
  const storage = { open: (): Promise<{ match: () => Promise<Response> }> => Promise.resolve({ match: (): Promise<Response> => Promise.resolve(new Response('owned')) }) };
  let pauses = 0;
  const cache: unknown = Reflect.apply(method, undefined, [storage, {
    pause: (): Promise<void> => { pauses++; return Promise.resolve(); },
    parseJson: (actual: Uint8Array): Promise<unknown> => { expect(actual).toBe(bytes); calls.push('parse'); return Promise.resolve(value); },
  }]);
  if (typeof cache !== 'object' || cache === null || !('product' in cache) || typeof cache.product !== 'function') throw new Error('Cache product reader missing');
  const product = cache.product;
  const read = (): Promise<unknown> => { const result: unknown = Reflect.apply(product, cache, ['https://game.test/shardfiles/fixture/']); return Promise.resolve(result); };
  expect(await read()).toEqual(value); expect(pauses).toBeGreaterThan(20); expect(calls).toEqual(['parse']);
  value = { source: { min: [-Number.MAX_SAFE_INTEGER, 0, 0], max: [0, 1, 1] }, firstParty: true };
  await expect(read()).rejects.toThrow('Out-of-cell bounds');
});
