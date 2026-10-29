import { readContent, type ContentReadOptions } from '@wildshard/engine/boot/contentRead';
import { ASSET_CACHE_NAME } from '@wildshard/engine/pwa/cacheNames';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';

/** No page cache owner: ordinary fetch reaches the service worker's exact URL
 * store. Before its first controller, publish the same complete response there. */
export async function readAsset(url: string, bytes: number | undefined, options: ContentReadOptions,
  controllerlessStore?: { open: (name: string) => Promise<Pick<Cache, 'put'>> }): Promise<Uint8Array> {
  let copy: Response | undefined;
  try {
    const result = await readContent(url, bytes ?? limits.sourceBytes, { ...options,
      ...(bytes === undefined ? {} : { expectedBytes: bytes }), response: response => {
      options.response?.(response);
      void copy?.body?.cancel().catch(() => undefined); copy = undefined;
      if (controllerlessStore !== undefined && response.ok) copy = response.clone();
    } });
    options.signal?.throwIfAborted();
    if (copy !== undefined && controllerlessStore !== undefined) {
      try { await (await controllerlessStore.open(ASSET_CACHE_NAME)).put(url, copy); }
      catch { /* Disk denial never rejects complete online bytes. */ }
    }
    return result;
  } finally { void copy?.body?.cancel().catch(() => undefined); }
}
