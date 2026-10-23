import { boundedResponse } from './product';
import { waitFor } from '@wildshard/engine/boot/waits';

/** URL caches are hints: only bounded bytes with an independently expected hash can replace a request. */
export async function cachedTransport(storage: Pick<CacheStorage, 'match'>, url: string, maximum: number,
  hash: (bytes: Uint8Array) => Promise<string>, accepts: (hash: string) => boolean,
  hashOwned?: (bytes: Uint8Array) => Promise<{ bytes: Uint8Array; hash: string }>): Promise<{ bytes: Uint8Array; hash: string } | null> {
  try {
    const label = url;
    const response = await waitFor(`URL cache ${label}`, storage.match(url), 'file');
    if (response === undefined) return null;
    const original = await boundedResponse(response, maximum);
    let bytes = original, actual: string;
    if (hashOwned === undefined) actual = await waitFor(`Hash ${label}`, hash(bytes), 'worker');
    else {
      try { ({ bytes, hash: actual } = await waitFor(`Hash ${label}`, hashOwned(new Uint8Array(original)), 'worker')); }
      catch { bytes = original; actual = await waitFor(`Hash ${label} fallback`, hash(bytes), 'worker'); }
    }
    return bytes.length === original.length && accepts(actual) ? { bytes, hash: actual } : null;
  } catch { return null; } // Evicted, stale or unavailable URL caches fall through to ordinary verified transport.
}
