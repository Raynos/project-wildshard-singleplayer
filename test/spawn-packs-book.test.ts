import {afterEach, expect, test, vi} from 'vitest';
import {setSpawnPacks, startSpawnDownload} from '../src/game/boot/spawnDownload';

const initialStorage = globalThis.localStorage;
afterEach(() => { setSpawnPacks(false); vi.unstubAllGlobals(); vi.stubGlobal('localStorage', initialStorage); });

// sp-x9's review of 40bc516d5c: with Runtime packs on, a packs book that fails or lacks the entry must fail the
// download (admission refuses control with the reason), never run the default set and report it complete.
test.each([
  ['a missing book', 'book-missing', () => new Response(null, {status: 404}), 'Packs book unavailable (404)'],
  ['an unreadable book', 'book-broken', () => new Response('{not json'), 'JSON'],
  ['a book without the entry', 'book-entryless', () => Response.json({client: {}}), 'Packs book has no client entry for book-entryless (phone, 000)'],
] as const)('%s fails the Runtime packs download instead of running the default set', async (_name, slug, book, reason) => {
  const address = {url: `/assets/spawn/${slug}-0123456789abcdef.json`, bytes: 10, totalBytes: 3, files: 1};
  vi.stubGlobal('document', {baseURI: 'http://localhost/', getElementById: () => ({textContent: JSON.stringify({spawnManifests: {
    cacheName: 'ws-assets-v1', client: {[slug]: {phone: address}}}})})});
  vi.stubGlobal('caches', undefined); vi.stubGlobal('__BUILD_ID__', 'test-build');
  const reads: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input); reads.push(url);
    return Promise.resolve(/\/assets\/spawn\/packs-[^/]+\.json$/u.test(url) ? book() : new Response(null, {status: 500}));
  });
  setSpawnPacks(true);
  const download = startSpawnDownload(slug, 'client', 'phone');
  if (download === null) throw new Error('Missing spawn download');
  await expect(download.ready).rejects.toThrow(reason);
  expect(download.snapshot()).toMatchObject({complete: false, error: expect.stringContaining(reason)});
  // Only the book was read: the default manifest and its files never started.
  expect(reads).toHaveLength(1);
  expect(reads[0]).toMatch(/\/assets\/spawn\/packs-[^/]+\.json$/u);
});
