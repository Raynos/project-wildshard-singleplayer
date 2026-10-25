import * as v from 'valibot';
import { ContentCache } from './contentCache';
import { ContentCacheQueue } from './contentCacheQueue';
import { readContentResponse as bounded } from './readContentResponse';
import { CacheCommandSchema, type CacheCommand, type CacheValue, type FetchedContent } from './contentCacheProtocol';

const cache = new ContentCache({ storage: caches, origin: self.location.origin,
  hash: async bytes => {
    const input = bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : Uint8Array.from(bytes).buffer;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }, estimate: () => navigator.storage.estimate(),
});
const leases = new Map<number, () => void>();
type FetchCommand = Extract<CacheCommand, { op: 'fetch' }>;
// Receipts are read as soon as their body lands; a roomy buffer, cleared well before it fills, keeps later ones.
performance.setResourceTimingBufferSize(4096);
/** The browser's own network receipt of `url` (its latest read), for the page's download accounting. */
function timing(url: string): FetchedContent['timing'] {
  const entries = performance.getEntriesByName(url, 'resource'), entry = entries[entries.length - 1];
  if (performance.getEntriesByType('resource').length > 1024) performance.clearResourceTimings();
  return entry instanceof PerformanceResourceTiming ? { name: url, startTime: entry.startTime, responseEnd: entry.responseEnd,
    transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize } : null;
}
/** Read, verify and store one immutable file without the page touching its stream, hash or store copy (G639). The URL
 * cache is a hint like the page's (cachedTransport); the content cache's put re-hashes the bytes and refuses a mismatch. */
async function fetchVerified(command: FetchCommand): Promise<FetchedContent> {
  const url = new URL(command.url);
  if (url.origin !== self.location.origin) throw new Error('Cache reads stay on this origin');
  let body: Uint8Array<ArrayBuffer> | null = null, cached = false, receipt: FetchedContent['timing'] = null;
  if (command.urlCache === true) {
    try {
      const response = await caches.match(url.href);
      if (response !== undefined) { body = await bounded(response, command.bytes); cached = body.length === command.bytes; if (!cached) body = null; }
    } catch { body = null; } // An evicted or stale URL cache falls through to the network.
  }
  if (body === null) {
    body = await bounded(await fetch(url.href, command.keep === true ? { cache: 'no-store' } : undefined), command.bytes);
    receipt = timing(url.href);
  }
  if (body.length !== command.bytes) throw new Error('Read differs from its declared size');
  let stored: boolean;
  try { stored = await cache.put(command.hash, body, command.keep === true); }
  catch (error) {
    // A stale URL cache entry is only a hint: read the network once before refusing.
    if (!cached) throw error;
    return fetchVerified({ ...command, urlCache: false });
  }
  return { fetched: command.reply === 'bytes' ? body : null, stored, cached, origin: performance.timeOrigin, timing: receipt };
}
async function perform(command: CacheCommand): Promise<CacheValue> {
  switch (command.op) {
    case 'get': return cache.get(command.hash);
    case 'has': { const bytes = await cache.get(command.hash); return bytes !== null && bytes.length === command.bytes; }
    case 'holds': return cache.holds(command.hash, command.bytes);
    case 'put': return cache.put(command.hash, command.bytes, command.keep === true);
    case 'stats': return cache.stats();
    case 'flush': await cache.flush(); return null;
    case 'pin':
      if (leases.has(command.lease)) throw new Error('Duplicate cache lease');
      leases.set(command.lease, cache.pin(command.hashes)); return null;
    case 'release': leases.get(command.lease)?.(); leases.delete(command.lease); return null;
    case 'fetch': return fetchVerified(command);
    default: throw new Error('Unknown cache operation');
  }
}
const queue = new ContentCacheQueue();
self.onmessage = (event: MessageEvent<unknown>): void => {
  const command = v.parse(CacheCommandSchema, event.data);
  void queue.run(command.op, async () => {
    try {
      const value = await perform(command);
      const bytes = value instanceof Uint8Array ? value : typeof value === 'object' && value !== null && 'fetched' in value ? value.fetched : null;
      const transfer = bytes !== null && bytes.buffer instanceof ArrayBuffer ? [bytes.buffer] : [];
      self.postMessage({ id: command.id, ok: true, value }, { transfer });
    } catch (error: unknown) {
      self.postMessage({ id: command.id, ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 2048) }, { transfer: [] });
    }
    return undefined;
  });
};
