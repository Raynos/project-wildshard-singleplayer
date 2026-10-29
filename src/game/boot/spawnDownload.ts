import {readSpawnManifest, readSpawnManifestAddress, type SpawnManifestAddress} from '@wildshard/format/spawnManifest';

/** This leaf imports no engine, renderer or worker. The title can start it on
 * the tap; Loading later adopts the same progress rather than recounting IO. */
export interface SpawnDownloadSnapshot {
  readonly totalBytes: number; readonly completedBytes: number; readonly cachedBytes: number;
  readonly filesTotal: number; readonly filesDone: number; readonly complete: boolean; readonly error: string | null;
}
export interface SpawnDownloadPorts {
  readonly fetch: (url: string, signal: AbortSignal) => Promise<Response>;
  readonly cached: (url: string) => Promise<Response | undefined>;
  /** First install has no controller. Publish into the same worker cache. */
  readonly store?: (url: string, response: Response) => Promise<void>;
}
export interface SpawnDownload {
  readonly ready: Promise<void>; readonly snapshot: () => SpawnDownloadSnapshot;
  readonly subscribe: (listener: (snapshot: SpawnDownloadSnapshot) => void) => () => void;
  readonly resolve: (url: string) => string; readonly cancel: () => void;
}
/** Exactly one list, one denominator and one completion per file. A complete
 * worker-cache response credits immediately without reading/checksumming it. */
export function downloadSpawnManifest(address: SpawnManifestAddress, ports: SpawnDownloadPorts, base: string): SpawnDownload {
  const controller = new AbortController(), listeners = new Set<(snapshot: SpawnDownloadSnapshot) => void>(), aliases = new Map<string, string>();
  let completedBytes = 0, cachedBytes = 0, filesDone = 0, complete = false, error: string | null = null;
  const snapshot = (): SpawnDownloadSnapshot => ({totalBytes: address.totalBytes, completedBytes, cachedBytes,
    filesTotal: address.files, filesDone, complete, error});
  const publish = (): void => { if (!controller.signal.aborted) for (const listener of listeners) listener(snapshot()); };
  const ready = (async () => {
    try {
      const manifestURL = new URL(address.url, base).href, held = await ports.cached(manifestURL);
      const response = held ?? await ports.fetch(manifestURL, controller.signal), copy = held === undefined && ports.store !== undefined ? response.clone() : undefined;
      if (!response.ok) throw new Error(`Spawn manifest unavailable (${response.status})`);
      const text = await response.text();
      if (new TextEncoder().encode(text).length !== address.bytes) throw new Error('Spawn manifest size differs');
      const manifest = readSpawnManifest(JSON.parse(text));
      if (manifest.totalBytes !== address.totalBytes || manifest.files.length !== address.files) throw new Error('Spawn address differs from manifest');
      if (copy !== undefined) await ports.store?.(manifestURL, copy);
      const files = manifest.files.map(file => {
        const url = new URL(file.url, base); aliases.set(url.pathname, url.href); return {bytes: file.bytes, hash: file.hash, url: url.href};
      });
      // One concurrent native presence census, not serial cache-body reads.
      const cached = await Promise.all(files.map(file => ports.cached(file.url)));
      controller.signal.throwIfAborted();
      const missing: typeof files = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index]; if (file === undefined) throw new Error('Missing spawn file');
        if (cached[index]?.status === 200) { completedBytes += file.bytes; cachedBytes += file.bytes; filesDone++; }
        else missing.push(file);
      }
      if (missing.length === 0) { complete = true; publish(); return; }
      publish(); let cursor = 0;
      await Promise.all(Array.from({length: Math.min(8, missing.length)}, async () => {
        for (let index = cursor++; index < missing.length; index = cursor++) {
          const file = missing[index]; if (file === undefined) throw new Error('Missing spawn demand');
          const body = await ports.fetch(file.url, controller.signal);
          if (!body.ok || body.body === null) throw new Error(`Spawn file unavailable (${body.status}): ${new URL(file.url).pathname}`);
          const cachedCopy = ports.store === undefined ? undefined : body.clone();
          const reader = body.body.getReader(); let received = 0;
          try {
            for (;;) {
              const part = await reader.read(); if (part.done) break;
              received += part.value.length;
              if (received > file.bytes) throw new Error(`Spawn file size differs: ${new URL(file.url).pathname}`);
              completedBytes += part.value.length; publish();
            }
          } catch (failure) { void cachedCopy?.body?.cancel().catch(() => undefined); await reader.cancel().catch(() => undefined); throw failure; }
          finally { reader.releaseLock(); }
          if (received !== file.bytes) { void cachedCopy?.body?.cancel().catch(() => undefined); throw new Error(`Spawn file size differs: ${new URL(file.url).pathname}`); }
          if (cachedCopy !== undefined) await ports.store?.(file.url, cachedCopy);
          filesDone++; publish();
        }
      }));
      controller.signal.throwIfAborted(); complete = true; publish();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure); publish(); controller.abort(); throw failure;
    }
  })();
  // The tap starts work before its composition root reaches the await. Keep
  // its original rejection for that await without a premature global report.
  void ready.catch(() => undefined);
  return {ready, snapshot, subscribe: listener => {listeners.add(listener); listener(snapshot()); return () => {listeners.delete(listener);};},
    resolve: input => {const url = new URL(input, base); return url.origin === new URL(base).origin ? aliases.get(url.pathname) ?? url.href : url.href;}, cancel: () => {controller.abort(); listeners.clear();}};
}

let current: {url: string; download: SpawnDownload; foreground: boolean} | undefined;
/** The selected entry is explicit; no engine import is needed on the title. */
export function startSpawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode = '000'): SpawnDownload | null {
  return spawnDownload(slug, flow, tier, mode, true);
}
/** Title read-ahead borrows this same manifest operation. Leaving the title
 * cancels only an unadopted prefetch, never a tap's foreground download. */
export function prefetchSpawnDownload(slug: string, tier: 'phone' | 'desktop'): {download: SpawnDownload; stop: () => void} | null {
  if (current?.foreground === true) return null;
  const download = spawnDownload(slug, 'client', tier, '000', false);
  return download === null ? null : {download, stop: () => {
    if (current?.download === download && !current.foreground) {download.cancel(); current = undefined;}
  }};
}
function spawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode: string, foreground: boolean): SpawnDownload | null {
  const text = document.getElementById('boot-module-files')?.textContent; if (!text) return null;
  const bank: unknown = JSON.parse(text), get = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  const manifests = get(bank, 'spawnManifests'), roots = flow === 'grid' ? get(get(manifests, flow), mode) : get(manifests, flow);
  const pair = get(get(roots, slug), tier);
  if (pair === undefined) return null;
  const address = readSpawnManifestAddress(pair);
  if (current?.url === address.url) {current.foreground ||= foreground; return current.download;}
  const cacheName = get(manifests, 'cacheName');
  const store = typeof caches === 'undefined' ? null : typeof cacheName === 'string' ? caches.open(cacheName) : null;
  const controller = navigator.serviceWorker?.controller;
  const download = downloadSpawnManifest(address, {
    fetch: (url, signal) => fetch(url, {signal}),
    cached: async url => typeof caches === 'undefined' ? undefined : store === null ? caches.match(url, {ignoreVary: true}) : (await store).match(url, {ignoreVary: true}),
    ...(store === null || controller !== undefined && controller !== null ? {} : {store: async (url: string, response: Response) => {await (await store).put(url, response);}}),
  }, document.baseURI);
  current?.download.cancel(); current = {url: address.url, download, foreground}; return download;
}
export function currentSpawnDownload(): SpawnDownload | undefined { return current?.download; }

const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 1 : 2)} MB`;
/** Paint only the existing card's numbers/text, before engine imports. The
 * composition root unsubscribes when Loading adopts this same download. */
export function paintSpawnDownload(download: SpawnDownload, root: HTMLElement): () => void {
  return download.subscribe(row => {
    const percent = row.complete ? 100 : row.totalBytes === 0 ? 0 : Math.min(99, Math.floor(row.completedBytes / row.totalBytes * 100));
    root.dataset['download'] = String(percent); root.dataset['entryDownloadBytes'] = String(row.totalBytes);
    root.dataset['readBytes'] = String(row.completedBytes); root.dataset['readCachedBytes'] = String(row.cachedBytes);
    root.dataset['readUnknownSourceBytes'] = '0'; root.dataset['readsClosed'] = String(row.complete);
    root.dataset['spawnFilesDone'] = String(row.filesDone); root.dataset['spawnFilesTotal'] = String(row.filesTotal);
    const fact = root.querySelector('[data-el="dlFact"]'), pct = root.querySelector('[data-el="dlPct"]'), bar = root.querySelector<HTMLElement>('[data-el="dlBar"]');
    if (fact !== null) fact.textContent = `Spawn view · ${mb(row.completedBytes)}${row.complete ? '' : ` of ${mb(row.totalBytes)}`} · ${mb(row.cachedBytes)} from cache`;
    if (pct !== null) pct.textContent = String(percent);
    if (bar !== null) bar.style.width = `${percent}%`;
  });
}
