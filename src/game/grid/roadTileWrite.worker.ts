import { ASSET_CACHE_NAME } from '@wildshard/engine/pwa/cacheNames';

/** DL11: the road archive's Cache Storage writes, off the page thread. Same URL, body and headers as cacheAsset. */
self.onmessage = (event: MessageEvent<unknown>): void => {
  const message: unknown = event.data;
  if (typeof message !== 'object' || message === null) return;
  const id: unknown = Reflect.get(message, 'id'), url: unknown = Reflect.get(message, 'url'), bytes: unknown = Reflect.get(message, 'bytes');
  if (typeof id !== 'number' || typeof url !== 'string' || !(bytes instanceof Uint8Array) || !(bytes.buffer instanceof ArrayBuffer)) return;
  const body = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  void (async (): Promise<void> => {
    let ok = false;
    try {
      await (await caches.open(ASSET_CACHE_NAME)).put(url, new Response(body, {
        headers: { 'content-type': 'application/octet-stream', 'content-length': String(body.length) },
      }));
      ok = true;
    } catch { /* A refused write answers false, as cacheAsset does. */ }
    self.postMessage({ id, ok }, { transfer: [] });
  })();
};
