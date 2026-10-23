// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { cachedBodyEvidence } from '../scripts/loading-benchmark/cache-bodies.mjs';

const originals = ['caches', 'location', 'fetch'].map(key => ({ key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key) }));
afterEach(() => {
  vi.useRealTimers();
  for (const { key, descriptor } of originals) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, key);
    else Object.defineProperty(globalThis, key, descriptor);
  }
});

function environment(match: (url: string) => Promise<Response | undefined>, names = ['bundle']): { fetch: ReturnType<typeof vi.fn>; keys: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(() => { throw new Error('Evidence must never fetch'); });
  const keys = vi.fn(() => Promise.resolve(names));
  vi.stubGlobal('location', new URL('http://localhost/'));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('caches', { keys, match, open: () => { throw new Error('Evidence must never create caches'); } });
  return { fetch, keys };
}

test('reads decoded cached copies once without fetching, writing or claiming cache hits', async () => {
  const body = 'decoded café';
  const { fetch } = environment(url => Promise.resolve(url.endsWith('/missing.js') ? undefined
    : new Response(body, { headers: { 'content-encoding': 'gzip', 'content-length': '3' } })));
  const result = await cachedBodyEvidence(['/assets/a.js', '/assets/a.js', '/assets/missing.js']);
  expect(result.files).toEqual([{ url: 'http://localhost/assets/a.js', bytes: new TextEncoder().encode(body).byteLength }]);
  expect(result.missing).toEqual(['http://localhost/assets/missing.js']);
  expect(result.readBytes).toBe(new TextEncoder().encode(body).byteLength);
  expect(result.source).toContain('not cache-hit evidence');
  expect(result.limited).toBeNull(); expect(result.failures).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

test('preflights the entire URL bank and refuses excessive cache banks before reading', async () => {
  const match = vi.fn(() => Promise.resolve(new Response('unused')));
  const { keys } = environment(match, Array.from({ length: 17 }, (_, i) => `cache-${String(i)}`));
  await expect(cachedBodyEvidence(['/assets/a.js', 'https://foreign.example/a.js'])).rejects.toThrow('Foreign');
  await expect(cachedBodyEvidence(Array.from({ length: 1025 }, () => '/assets/a.js'))).rejects.toThrow('URL bank');
  expect(keys).not.toHaveBeenCalled();
  expect((await cachedBodyEvidence(['/assets/a.js'])).limited).toBe('cache count');
  expect(match).not.toHaveBeenCalled();
});

test('stops oversized cached streams without publishing a partial body size', async () => {
  const chunk = new Uint8Array(64 * 1024); let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ pull: controller => { controller.enqueue(chunk); }, cancel: () => { cancelled = true; } });
  environment(() => Promise.resolve(new Response(body)));
  const result = await cachedBodyEvidence(['/assets/large.bin']);
  expect(result.files).toEqual([]);
  expect(result.failures).toEqual([{ url: 'http://localhost/assets/large.bin', reason: 'body bytes' }]);
  expect(result.readBytes).toBe(8 * 1024 * 1024 + chunk.byteLength);
  expect(cancelled).toBe(true);
});

test('reports a stalled cache read within its deadline instead of holding the official reader', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const { fetch } = environment(() => new Promise<Response>(() => { /* Intentionally stalled CacheStorage lookup. */ }));
  const reading = cachedBodyEvidence(['/assets/stalled.js']);
  await vi.advanceTimersByTimeAsync(5001);
  const result = await reading;
  expect(result.limited).toBe('time'); expect(result.files).toEqual([]);
  expect(result.failures[0]?.reason).toContain('time limit');
  expect(fetch).not.toHaveBeenCalled();
});
