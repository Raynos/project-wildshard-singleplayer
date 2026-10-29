import { Scope } from '@wildshard/engine/app/scope';
import { boundedResponse } from './product';
import { waitFor } from '@wildshard/engine/boot/waits';
import { productResourceRole } from './resourceRole';

function discardResponse(response: Response | undefined): void {
  void response?.body?.cancel().catch(() => undefined);
}

/** The browser operation is not cancellable; its observer and late body are. */
function hintResponse(storage: Pick<CacheStorage, 'match'>, url: string, signal?: AbortSignal): Promise<Response | undefined> {
  const lookup = storage.match(url);
  if (signal === undefined) return lookup;
  const owner = new Scope('url-cache-response');
  const stopped = new Promise<undefined>(resolve => {
    owner.onDispose(() => { resolve(undefined); });
    owner.listen(signal, 'abort', () => { owner.dispose(); }, { once: true });
    if (signal.aborted) owner.dispose();
  });
  const ready = lookup.then(response => {
    if (signal.aborted) { discardResponse(response); return undefined; }
    return response;
  });
  return Promise.race([ready, stopped]).finally(() => { owner.dispose(); });
}

/** G881: trust an exact content/version key; a size mismatch falls through to the normal transport. */
export async function cachedTransport(storage: Pick<CacheStorage, 'match'>, url: string, maximum: number,
  expected: { hash: string; bytes?: number }, signal?: AbortSignal): Promise<{ bytes: Uint8Array; hash: string } | null> {
  const cancelled = (): boolean => signal?.aborted === true;
  try {
    if (cancelled()) return null;
    if (!/^[a-f0-9]{64}$/u.test(expected.hash)) return null;
    const address = new URL(url), version = address.searchParams.get('v');
    const named = /\/([a-f0-9]{64})\.[a-z0-9]+$/u.exec(address.pathname)?.[1];
    if (named !== undefined && named !== expected.hash || version !== null && version !== expected.hash.slice(0, 8)) return null;
    const label = productResourceRole(url);
    const response = await waitFor(`URL cache ${label}`, hintResponse(storage, url, signal), 'file');
    if (response === undefined) return null;
    if (cancelled()) { discardResponse(response); return null; }
    const bytes = await boundedResponse(response, maximum);
    if (cancelled()) return null;
    return expected.bytes === undefined || bytes.length === expected.bytes ? { bytes, hash: expected.hash } : null;
  } catch { return null; } // Evicted, stale or unavailable URL caches fall through to ordinary verified transport.
}
