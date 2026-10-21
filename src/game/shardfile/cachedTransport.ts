import { boundedResponse } from './product';

/** URL caches are hints: only bounded bytes with an independently expected hash can replace a request. */
export async function cachedTransport(storage: Pick<CacheStorage, 'match'>, url: string, maximum: number,
  hash: (bytes: Uint8Array) => Promise<string>, accepts: (hash: string) => boolean): Promise<{ bytes: Uint8Array; hash: string } | null> {
  try {
    const response = await storage.match(url);
    if (response === undefined) return null;
    const bytes = await boundedResponse(response, maximum), actual = await hash(bytes);
    return accepts(actual) ? { bytes, hash: actual } : null;
  } catch { return null; } // Evicted, stale or unavailable URL caches fall through to ordinary verified transport.
}
