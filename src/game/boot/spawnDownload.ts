import {readSpawnManifest, readSpawnManifestAddress, type SpawnManifestAddress} from '@wildshard/format/spawnManifest';

/** This leaf statically imports no engine, renderer or worker. The title can start it on
 * the tap; Loading later adopts the same progress rather than recounting IO. */
export interface SpawnDownloadSnapshot {
  /** False while native cache presence is unresolved; zero is not yet an observed transfer fact. */
  readonly progressKnown?: boolean;
  readonly totalBytes: number; readonly completedBytes: number; readonly cachedBytes: number;
  readonly filesTotal: number; readonly filesDone: number; readonly complete: boolean; readonly error: string | null;
}
export interface SpawnDownloadPorts {
  readonly fetch: (url: string, signal: AbortSignal, init?: RequestInit) => Promise<Response>;
  readonly cached: (url: string) => Promise<Response | undefined>;
  /** Native bulk metadata only: returned URLs must have complete 200 bodies. */
  readonly present?: (urls: readonly string[]) => Promise<ReadonlySet<string>>;
  /** First install has no controller. Publish into the same worker cache. */
  readonly store?: (url: string, response: Response) => Promise<void>;
}
export interface SpawnDownload {
  readonly ready: Promise<void>; readonly snapshot: () => SpawnDownloadSnapshot;
  readonly subscribe: (listener: (snapshot: SpawnDownloadSnapshot) => void) => () => void;
  readonly resolve: (url: string) => string; readonly cancel: () => void;
}
async function readSpawnFile(url: string, maximum: number, ports: SpawnDownloadPorts, signal: AbortSignal,
  read?: (bytes: number) => void, held?: Response): Promise<{bytes: Uint8Array; copy: Response | undefined}> {
  // Keep title composition lazy; share the real loading-card retry only once
  // the selected entry starts reading its declared content.
  const {readContent} = await import('@wildshard/engine/boot/contentRead');
  let cached = held, copy: Response | undefined;
  try {
    const bytes = await readContent(url, maximum, {signal, ...(read === undefined ? {} : {read}),
      fetch: (address, init) => {
        if (cached !== undefined) {const response = cached; cached = undefined; return Promise.resolve(response);}
        return ports.fetch(address, signal, init);
      }, response: response => {
        void copy?.body?.cancel().catch(() => undefined);
        copy = ports.store === undefined || response === held ? undefined : response.clone();
      }});
    return {bytes, copy};
  } catch (error) {
    void copy?.body?.cancel().catch(() => undefined);
    if (error instanceof Error && error.message === 'Content wire size exceeds cap') throw new Error(`Spawn file size differs: ${new URL(url).pathname}`, {cause: error});
    throw error;
  }
}
/** Exactly one list, one denominator and one completion per file. A complete
 * worker-cache response credits immediately without reading/checksumming it. */
export function downloadSpawnManifest(address: SpawnManifestAddress, ports: SpawnDownloadPorts, base: string): SpawnDownload {
  const controller = new AbortController(), listeners = new Set<(snapshot: SpawnDownloadSnapshot) => void>(), aliases = new Map<string, string>();
  let completedBytes = 0, cachedBytes = 0, filesDone = 0, complete = false, progressKnown = false, error: string | null = null;
  const snapshot = (): SpawnDownloadSnapshot => ({progressKnown, totalBytes: address.totalBytes, completedBytes, cachedBytes,
    filesTotal: address.files, filesDone, complete, error});
  const publish = (): void => { if (!controller.signal.aborted) for (const listener of listeners) listener(snapshot()); };
  const ready = (async () => {
    try {
      const manifestURL = new URL(address.url, base).href, held = await ports.cached(manifestURL);
      const {bytes, copy} = await readSpawnFile(manifestURL, address.bytes, ports, controller.signal, undefined, held);
      if (bytes.length !== address.bytes) {void copy?.body?.cancel().catch(() => undefined); throw new Error('Spawn manifest size differs');}
      const text = new TextDecoder().decode(bytes);
      const manifest = readSpawnManifest(JSON.parse(text));
      if (manifest.totalBytes !== address.totalBytes || manifest.files.length !== address.files) throw new Error('Spawn address differs from manifest');
      if (copy !== undefined) await ports.store?.(manifestURL, copy);
      const files = manifest.files.map(file => {
        const url = new URL(file.url, base); aliases.set(url.pathname, url.href); return {bytes: file.bytes, hash: file.hash, url: url.href};
      });
      const present = await ports.present?.(files.map(file => file.url));
      // Bulk native metadata avoids hundreds of cache IPC calls. Unmapped
      // responses (older synthetic URLs/redirects) retain the exact hit check.
      const cached = await Promise.all(files.map(file => present?.has(file.url) === true ? Promise.resolve(undefined) : ports.cached(file.url)));
      controller.signal.throwIfAborted();
      const missing: typeof files = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index]; if (file === undefined) throw new Error('Missing spawn file');
        if (present?.has(file.url) === true || cached[index]?.status === 200 && !/\btext\/html\b/iu.test(cached[index]?.headers.get('content-type') ?? '')) { completedBytes += file.bytes; cachedBytes += file.bytes; filesDone++; }
        else missing.push(file);
      }
      progressKnown = true;
      if (missing.length === 0) { complete = true; publish(); return; }
      publish(); let cursor = 0;
      await Promise.all(Array.from({length: Math.min(8, missing.length)}, async () => {
        for (let index = cursor++; index < missing.length; index = cursor++) {
          const file = missing[index]; if (file === undefined) throw new Error('Missing spawn demand');
          let received = 0, credited = 0;
          const {bytes: body, copy: cachedCopy} = await readSpawnFile(file.url, file.bytes, {
            ...ports, fetch: (url, signal, init) => {received = 0; return ports.fetch(url, signal, init);},
          }, controller.signal, size => {
            received += size;
            if (received > credited) {completedBytes += received - credited; credited = received; publish();}
          });
          if (body.length !== file.bytes) { void cachedCopy?.body?.cancel().catch(() => undefined); throw new Error(`Spawn file size differs: ${new URL(file.url).pathname}`); }
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

let current: {address: SpawnManifestAddress; download: SpawnDownload; foreground: boolean} | undefined;
function sameAddress(left: SpawnManifestAddress, right: SpawnManifestAddress): boolean {
  return left.url === right.url && left.bytes === right.bytes && left.totalBytes === right.totalBytes && left.files === right.files;
}
/** The selected entry is explicit; no engine import is needed on the title. */
export function startSpawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode = '000'): SpawnDownload | null {
  return spawnDownload(slug, flow, tier, mode, true);
}
/** Title read-ahead borrows this same manifest operation. Leaving the title
 * cancels only an unadopted prefetch, never a tap's foreground download. */
export function prefetchSpawnDownload(slug: string, tier: 'phone' | 'desktop', flow: 'client' | 'grid' = 'client', mode = '000'): {download: SpawnDownload; stop: () => void} | null {
  if (current?.foreground === true) return null;
  const download = spawnDownload(slug, flow, tier, mode, false);
  return download === null ? null : {download, stop: () => {
    if (current?.download === download && !current.foreground) {download.cancel(); current = undefined;}
  }};
}
function spawnSelection(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode: string): {address: SpawnManifestAddress; cacheName: unknown} | null {
  const text = document.getElementById('boot-module-files')?.textContent; if (!text) return null;
  const bank: unknown = JSON.parse(text), get = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  const manifests = get(bank, 'spawnManifests'), roots = flow === 'grid' ? get(get(manifests, flow), mode) : get(manifests, flow);
  const pair = get(get(roots, slug), tier);
  if (pair === undefined) return null;
  return {address: readSpawnManifestAddress(pair), cacheName: get(manifests, 'cacheName')};
}
/** Adopt only a matching complete live operation. This performs no cache or
 * network IO and never promotes a receipt, saved size or inferred progress. */
export function adoptCompletedSpawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode = '000'): SpawnDownload | null {
  const selected = spawnSelection(slug, flow, tier, mode);
  const held = current;
  if (selected === null || held === undefined || !sameAddress(held.address, selected.address) || !held.download.snapshot().complete) return null;
  held.foreground = true;
  return held.download;
}
function spawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode: string, foreground: boolean): SpawnDownload | null {
  const selected = spawnSelection(slug, flow, tier, mode); if (selected === null) return null;
  const {address, cacheName} = selected;
  if (current !== undefined && sameAddress(current.address, address)) {current.foreground ||= foreground; return current.download;}
  const store = typeof caches === 'undefined' ? null : typeof cacheName === 'string' ? caches.open(cacheName) : null;
  const controller = navigator.serviceWorker?.controller;
  const download = downloadSpawnManifest(address, {
    fetch: (url, signal, init) => fetch(url, {...init, signal}),
    cached: async url => typeof caches === 'undefined' ? undefined : store === null ? caches.match(url, {ignoreVary: true}) : (await store).match(url, {ignoreVary: true}),
    ...(store === null ? {} : {present: async (urls: readonly string[]) => {
      const wanted = new Set(urls), found = new Set<string>();
      for (const response of await (await store).matchAll()) if (response.status === 200 && !/\btext\/html\b/iu.test(response.headers.get('content-type') ?? '') && wanted.has(response.url)) found.add(response.url);
      return found;
    }}),
    ...(store === null || controller !== undefined && controller !== null ? {} : {store: async (url: string, response: Response) => {await (await store).put(url, response);}}),
  }, document.baseURI);
  current?.download.cancel(); current = {address, download, foreground}; return download;
}
export function currentSpawnDownload(): SpawnDownload | undefined { return current?.download; }

const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 1 : 2)} MB`;
/** Paint only the existing card's numbers/text, before engine imports. The
 * composition root unsubscribes when Loading adopts this same download. */
export function paintSpawnDownload(download: SpawnDownload, root: HTMLElement): () => void {
  return download.subscribe(row => {
    const percent = row.complete ? 100 : row.progressKnown === false || row.totalBytes === 0 ? null : Math.min(99, Math.floor(row.completedBytes / row.totalBytes * 100));
    root.dataset['download'] = percent === null ? '' : String(percent); root.dataset['entryDownloadBytes'] = String(row.totalBytes);
    root.dataset['declaredBytes'] = String(row.totalBytes); root.dataset['pendingBytes'] = String(row.totalBytes - row.completedBytes);
    root.dataset['cachedBytes'] = String(row.cachedBytes);
    root.dataset['readBytes'] = String(row.completedBytes); root.dataset['readCachedBytes'] = String(row.cachedBytes);
    root.dataset['readUnknownSourceBytes'] = '0'; root.dataset['readsClosed'] = String(row.complete);
    root.dataset['spawnFilesDone'] = String(row.filesDone); root.dataset['spawnFilesTotal'] = String(row.filesTotal);
    const fact = root.querySelector('[data-el="dlFact"]'), pct = root.querySelector('[data-el="dlPct"]'), bar = root.querySelector<HTMLElement>('[data-el="dlBar"]');
    if (fact !== null) fact.textContent = `Spawn view · ${mb(row.completedBytes)}${row.complete ? '' : ` of ${mb(row.totalBytes)}`} · ${mb(row.cachedBytes)} from cache`;
    if (pct !== null) pct.textContent = percent === null ? '—' : String(percent);
    if (bar !== null) bar.style.width = `${percent ?? 0}%`;
  });
}
