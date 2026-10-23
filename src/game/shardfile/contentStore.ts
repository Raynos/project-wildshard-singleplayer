import { ContentCache } from '@wildshard/engine/boot/contentCache';
import { ContentCacheWorker } from '@wildshard/engine/boot/contentCacheWorker';

/** SHA-256 over an owned ArrayBuffer, usable by WebKit without Node or SDK dependencies. */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer : Uint8Array.from(bytes).buffer;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
const browserContentStores = new WeakMap<Pick<CacheStorage, 'open'>, ContentCache | ContentCacheWorker>();
const retiredProductStores = new WeakSet();
async function retireDescriptorCache(storage: Partial<Pick<CacheStorage, 'delete'>>): Promise<void> {
  try { await storage.delete?.('ws-shardfile-products-v0'); }
  catch (error) { console.warn('[shardfile] old descriptor cache eviction failed', error); }
}
/** Prefetch and admission share the identical worker, fallback and durable writer. */
export function browserContentStore(storage: Pick<CacheStorage, 'open'> & Partial<Pick<CacheStorage, 'delete'>>): ContentCache | ContentCacheWorker {
  if (!retiredProductStores.has(storage)) {
    retiredProductStores.add(storage);
    void retireDescriptorCache(storage);
  }
  let content = browserContentStores.get(storage);
  if (content === undefined) {
    const fallback = new ContentCache({ storage, origin: location.origin, hash: contentHash, estimate: () => navigator.storage.estimate(), pagehide: window });
    // Injected stores keep their exact ports; only the real page CacheStorage
    // belongs to the worker. All product wrappers share one writer/fallback.
    content = typeof caches !== 'undefined' && storage === caches && typeof CacheStorage !== 'undefined' && storage instanceof CacheStorage && typeof Worker !== 'undefined'
      ? new ContentCacheWorker(fallback, { pagehide: window }) : fallback;
    browserContentStores.set(storage, content);
  }
  return content;
}
