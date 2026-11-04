import {packsBookPath, readSpawnManifest, readSpawnManifestAddress, type SpawnManifestAddress} from '@wildshard/format/spawnManifest';

/** This leaf statically imports no engine, renderer or worker. The title can start it on
 * the tap; Loading later adopts the same progress rather than recounting IO. */
export interface SpawnDownloadSnapshot {
  /** False while native cache presence is unresolved; zero is not yet an observed transfer fact. */
  readonly progressKnown?: boolean;
  /** Compressed representation facts for text only; decoded reads keep their original bounds/progress. */
  readonly wire?: {readonly totalBytes: number; readonly completedBytes: number; readonly cachedBytes: number};
  readonly totalBytes: number; readonly completedBytes: number; readonly cachedBytes: number;
  readonly filesTotal: number; readonly filesDone: number; readonly complete: boolean; readonly error: string | null;
  /** Bytes streamed so far, verified or not: progress for the stuck-boot watch, never shown as downloaded. */
  readonly streamedBytes?: number;
}
export interface SpawnDownloadPorts {
  readonly fetch: (url: string, signal: AbortSignal, init?: RequestInit) => Promise<Response>;
  readonly cached: (url: string) => Promise<Response | undefined>;
  /** Native bulk metadata only: returned URLs must have complete 200 bodies. */
  readonly present?: (urls: readonly string[]) => Promise<ReadonlySet<string>>;
  /** First install has no controller. Publish into the same worker cache. */
  readonly store?: (url: string, response: Response) => Promise<void>;
  /** DL5 (Debug 'Loading: runtime packs', default off): read the manifest's parts instead of their loose files. */
  readonly packs?: boolean;
  /** Publish one part member under its own URL, whatever controls the page: members never pass the worker. */
  readonly keep?: (url: string, response: Response) => Promise<void>;
  /** Runtime packs: the manifest must be a whole-level one, which always carries its part table (sp-x9). */
  readonly whole?: boolean;
  /** DL18: the held-parts index beside Cache Storage (part hash → the member URLs `keep` stored from it) and the
   * cache's keys. A part whose members are all listed and still keyed is held: its members credit without a lookup. */
  readonly held?: {readonly read: () => Promise<HeldParts>; readonly write: (index: HeldParts) => Promise<void>; readonly keys: () => Promise<ReadonlySet<string>>};
}
export type HeldParts = Readonly<Record<string, readonly string[]>>;

/** DL5: part members by their exact URL until control, so this page's own reads of them (product reads, engine
 * fetches) are answered from the part instead of the network. A member that failed is null and reads fall through. */
const members = new Map<string, Promise<Uint8Array<ArrayBuffer> | null>>();
/** DL13's default-path slice (DL22): before the worker controls the page, its reads of a file the spawn download stored go
 * to the network again (the page's HTTP cache evicted them: Pine re-fetched 25.4 MB before control). Until control, a GET
 * of a stored URL is answered from that same store. */
const storedUrls = new Set<string>();
let storeRead: ((url: string) => Promise<Response | undefined>) | null = null;
let layer: typeof fetch | null = null;
const TYPES: Readonly<Record<string, string>> = {json: 'application/json', glb: 'model/gltf-binary', wasm: 'application/wasm',
  ktx2: 'image/ktx2', bin: 'application/octet-stream', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml'};
const typeOf = (url: string): string => TYPES[/\.([a-z0-9]+)(?:\?|$)/u.exec(url)?.[1] ?? ''] ?? 'application/octet-stream';
/** A GET of a member URL waits for its bytes, and of a stored URL reads the store; anything else, a retry, a failed member
 *  or a store miss goes to the network. */
function installMemberLayer(): boolean {
  // Installed once per page, and again only if something replaced it (tests do); a page without fetch gets none.
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return false;
  if (layer !== null && window.fetch === layer) return true;
  const network = window.fetch.bind(window);
  layer = async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase(), cache = init?.cache ?? request?.cache;
    if ((members.size > 0 || storedUrls.size > 0) && method === 'GET' && cache !== 'reload' && cache !== 'no-store') {
      const url = new URL(input instanceof Request ? input.url : input instanceof URL ? input.href : input, location.href).href;
      const bytes = await members.get(url);
      if (bytes !== null && bytes !== undefined) return new Response(bytes, {status: 200, headers: {'content-type': typeOf(url), 'content-length': String(bytes.length)}});
      if (storedUrls.has(url) && storeRead !== null) {
        const hit = await storeRead(url).catch(() => undefined);
        if (hit?.status === 200) return hit;
      }
    }
    return network(input, init);
  };
  window.fetch = layer;
  return true;
}
async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Control: the level is complete and its reads are done, so the member bytes go. */
export function releaseSpawnMembers(): void { members.clear(); storedUrls.clear(); storeRead = null; }
/** Debug 'Loading: runtime packs / shardfile' (DL16, default shardfile): set by the composition root before a spawn
 * download starts; this leaf reads no engine setting itself. */
let packsOn = false;
export function setSpawnPacks(on: boolean): void { packsOn = on; }
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
  let wireCompleted = 0, wireCached = 0, wireTotal = address.wireBytes;
  // DL21: a part's chunks as they arrive, before its members verify (the stuck-boot watch's progress, never shown as read)
  let streamedBytes = 0;
  const snapshot = (): SpawnDownloadSnapshot => ({...(wireTotal === undefined ? {} : {wire: {totalBytes: wireTotal, completedBytes: wireCompleted, cachedBytes: wireCached}}), progressKnown, totalBytes: address.totalBytes, completedBytes, cachedBytes,
    filesTotal: address.files, filesDone, complete, error, streamedBytes: streamedBytes + completedBytes});
  const publish = (): void => { if (!controller.signal.aborted) for (const listener of listeners) listener(snapshot()); };
  const ready = (async () => {
    try {
      const manifestURL = new URL(address.url, base).href, held = await ports.cached(manifestURL);
      const {bytes, copy} = await readSpawnFile(manifestURL, address.bytes, ports, controller.signal, undefined, held);
      if (bytes.length !== address.bytes) {void copy?.body?.cancel().catch(() => undefined); throw new Error('Spawn manifest size differs');}
      const text = new TextDecoder().decode(bytes);
      const manifest = readSpawnManifest(JSON.parse(text));
      if (manifest.totalBytes !== address.totalBytes || manifest.wireBytes !== address.wireBytes || manifest.files.length !== address.files) throw new Error('Spawn address differs from manifest');
      // A default manifest never carries a part table, so it cannot pass as the whole level.
      if (ports.whole === true && manifest.parts === undefined) throw new Error('Packs manifest has no part table');
      if (copy !== undefined) await ports.store?.(manifestURL, copy);
      const files = manifest.files.map(file => {
        const url = new URL(file.url, base); aliases.set(url.pathname, url.href); return {bytes: file.bytes, hash: file.hash, wireBytes: file.wireBytes ?? 0, url: url.href};
      });
      // DL18: on a warm visit the held-parts index and the cache's keys answer every packed member at once; the few
      // loose files left are looked up one by one, so no bulk read of the cache runs.
      const parts = ports.packs === true ? manifest.parts : undefined, heldFiles = new Set<string>();
      // DL15 (sp-x9): on the packs path the wire is each part's q11 body, not its members' loose q3 sizes. A member's
      // wire is its share of its part's body by decoded bytes, so a part's members sum to exactly that body.
      if (wireTotal !== undefined && parts !== undefined && parts.length > 0 && parts.every(part => part.wireBytes !== undefined)) {
        for (const part of parts) {
          const listed = part.members.reduce((sum, [at]) => sum + (files[at]?.bytes ?? 0), 0), body = part.wireBytes ?? 0;
          let left = body;
          part.members.forEach(([at], row) => {
            const file = files[at]; if (file === undefined) return;
            file.wireBytes = row === part.members.length - 1 ? left : Math.floor(body * file.bytes / Math.max(1, listed)); left -= file.wireBytes;
          });
        }
        wireTotal = files.reduce((sum, file) => sum + file.wireBytes, 0);
      }
      let heldIndex: HeldParts = {}, keys: ReadonlySet<string> = new Set();
      if (parts !== undefined && ports.held !== undefined) {
        [heldIndex, keys] = await Promise.all([ports.held.read().catch(() => ({})), ports.held.keys()]);
        for (const part of parts) {
          const stored = new Set(heldIndex[part.hash]), urls = part.members.map(([at]) => files[at]?.url ?? '');
          if (urls.every(url => stored.has(url) && keys.has(url))) for (const url of urls) heldFiles.add(url);
        }
      }
      // A key only proves an entry exists. Each held member is credited only when its entry is a 200, not a page, and
      // exactly its listed length (the header `keep` wrote, else the body); any other entry is fetched again with its
      // part (sp-x9's review of 77f9b5489f).
      const unfit = new Set<string>();
      await Promise.all(files.map(async file => {
        if (!heldFiles.has(file.url) || await heldMember(await ports.cached(file.url), file.bytes)) return;
        heldFiles.delete(file.url); unfit.add(file.url);
      }));
      const rest = files.filter(file => !heldFiles.has(file.url) && !unfit.has(file.url));
      const present = heldFiles.size > 0 && rest.length <= 64 ? undefined : await ports.present?.(rest.map(file => file.url));
      // Bulk native metadata avoids hundreds of cache IPC calls. Unmapped
      // responses (older synthetic URLs/redirects) retain the exact hit check.
      const cached = await Promise.all(files.map(file => heldFiles.has(file.url) || unfit.has(file.url) || present?.has(file.url) === true ? Promise.resolve(undefined) : ports.cached(file.url)));
      controller.signal.throwIfAborted();
      const missing: typeof files = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index]; if (file === undefined) throw new Error('Missing spawn file');
        if (unfit.has(file.url)) missing.push(file);
        else if (heldFiles.has(file.url) || present?.has(file.url) === true || cached[index]?.status === 200 && !/\btext\/html\b/iu.test(cached[index]?.headers.get('content-type') ?? '')) { completedBytes += file.bytes; cachedBytes += file.bytes; wireCompleted += file.wireBytes; wireCached += file.wireBytes; filesDone++; }
        else missing.push(file);
      }
      progressKnown = true;
      // An uncontrolled page (the `store` port exists only then) reads these from the store until control (read once).
      const serve = (url: string): void => {
        if (ports.store === undefined) return;
        if (storeRead === null) { if (!installMemberLayer()) return; storeRead = ports.cached; }
        storedUrls.add(url);
      };
      for (const file of files) if (!missing.includes(file)) serve(file.url);
      if (missing.length === 0) { complete = true; publish(); return; }
      publish(); let cursor = 0;
      // DL5: every part holding a missing member at once; members are cut out as their bytes land. A part that fails
      // hands its unfinished members to the loose loop below (its files stay deployed).
      let loose = missing;
      if (parts !== undefined && parts.length > 0) {
        installMemberLayer();
        const wanted = new Set(missing), left = new Set<number>(), stored = new Map<string, readonly string[]>();
        await Promise.all(parts.map(async part => {
          const order = part.members.filter(([index]) => {const file = files[index]; return file !== undefined && wanted.has(file);});
          if (order.length === 0) return;
          const settle = new Map<number, (bytes: Uint8Array<ArrayBuffer> | null) => void>(), done = new Set<number>();
          for (const [index] of order) {
            const file = files[index]; if (file === undefined) continue;
            members.set(file.url, new Promise(resolve => {settle.set(index, resolve);}));
          }
          try {
            const response = await ports.fetch(new URL(part.url, base).href, controller.signal);
            if (!response.ok || response.body === null) throw new Error(`Spawn part unavailable: ${part.url}`);
            const body = new Uint8Array(part.bytes), reader = response.body.getReader();
            let at = 0, next = 0;
            for (;;) {
              const chunk = await reader.read(); if (chunk.done) break;
              if (at + chunk.value.byteLength > part.bytes) {void reader.cancel(); throw new Error(`Spawn part longer than listed: ${part.url}`);}
              body.set(chunk.value, at); at += chunk.value.byteLength;
              // a slow part still shows it moves: every chunk publishes, as a loose file's read does (verified bytes
              // still credit only per member)
              streamedBytes += chunk.value.byteLength; publish();
              for (let row = order[next]; row !== undefined; row = order[next]) {
                const [index, offset] = row, file = files[index]; if (file === undefined || offset + file.bytes > at) break;
                // DL13: a member is a view into its part (no copy): page reads and the keep share the part's bytes
                const member = body.subarray(offset, offset + file.bytes); next++;
                // The part's bytes are only trusted per member: each must match its manifest row before it is kept or read.
                if (await sha256(member) !== file.hash) throw new Error(`Spawn part member differs: ${part.url}`);
                await ports.keep?.(file.url, new Response(member, {headers: {'content-type': typeOf(file.url), 'content-length': String(member.length)}}));
                settle.get(index)?.(member); done.add(index);
                completedBytes += file.bytes; wireCompleted += file.wireBytes; filesDone++; publish();
              }
            }
            if (at !== part.bytes) throw new Error(`Spawn part size differs: ${part.url}`);
            // Every member of the part is now stored (kept here, or already credited): the index may name it.
            // A part shared by another entry keeps that entry's members too, while they are still keyed.
            if (ports.keep !== undefined) stored.set(part.hash, [...new Set([...(heldIndex[part.hash] ?? []).filter(url => keys.has(url)),
              ...part.members.map(([member]) => files[member]?.url ?? '')])]);
          } catch {
            // Settle first: a page read already waiting on a member must fall through, even when this download aborts.
            for (const [index] of order) if (!done.has(index)) {left.add(index); settle.get(index)?.(null);}
            controller.signal.throwIfAborted();
          }
        }));
        controller.signal.throwIfAborted();
        // One index write per download: this download's stored parts, plus earlier entries whose members are all
        // still keyed (the worker prunes old builds' files, so an entry never outlives its members).
        if (stored.size > 0 && ports.held !== undefined) {
          const kept = Object.entries(heldIndex).filter(([hash, urls]) => !stored.has(hash) && urls.every(url => keys.has(url)));
          await ports.held.write(Object.fromEntries([...kept, ...stored])).catch(() => undefined);
        }
        loose = missing.filter(file => !parts.some(part => part.members.some(([index]) => files[index] === file)) || left.has(files.indexOf(file)));
      }
      await Promise.all(Array.from({length: Math.min(8, loose.length)}, async () => {
        for (let index = cursor++; index < loose.length; index = cursor++) {
          const file = loose[index]; if (file === undefined) throw new Error('Missing spawn demand');
          let received = 0, credited = 0;
          const {bytes: body, copy: cachedCopy} = await readSpawnFile(file.url, file.bytes, {
            ...ports, fetch: (url, signal, init) => {received = 0; return ports.fetch(url, signal, init);},
          }, controller.signal, size => {
            received += size;
            if (received > credited) {completedBytes += received - credited; credited = received; publish();}
          });
          if (body.length !== file.bytes) { void cachedCopy?.body?.cancel().catch(() => undefined); throw new Error(`Spawn file size differs: ${new URL(file.url).pathname}`); }
          if (cachedCopy !== undefined) { await ports.store?.(file.url, cachedCopy); serve(file.url); }
          wireCompleted += file.wireBytes; filesDone++; publish();
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

let current: {key: string; download: SpawnDownload; foreground: boolean} | undefined;
const addressKey = (address: SpawnManifestAddress): string =>
  `${address.url}|${address.bytes}|${address.totalBytes}|${address.files}|${address.wireBytes ?? ''}`;
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
const get = (value: unknown, key: string): unknown => typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
function bookSelection(book: unknown, slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode: string): SpawnManifestAddress | null {
  const roots = flow === 'grid' ? get(get(book, flow), mode) : get(book, flow), pair = get(get(roots, slug), tier);
  return pair === undefined ? null : readSpawnManifestAddress(pair);
}
function spawnSelection(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode: string): {address: SpawnManifestAddress; cacheName: unknown} | null {
  const text = document.getElementById('boot-module-files')?.textContent; if (!text) return null;
  const manifests = get(JSON.parse(text), 'spawnManifests'), address = bookSelection(manifests, slug, flow, tier, mode);
  return address === null ? null : {address, cacheName: get(manifests, 'cacheName')};
}
/** DL16: the packs book (the whole level with its parts) is this build's own file, fetched only with Runtime packs on,
 * so the default page carries nothing for an off row. */
declare const __BUILD_ID__: string;
let packsBook: {readonly url: string; readonly book: Promise<unknown>} | undefined;
const PACKS_BOOK_MS = 20_000;
function readPacksBook(): Promise<unknown> {
  const url = new URL(`/${packsBookPath(__BUILD_ID__)}`, document.baseURI).href;
  if (packsBook?.url === url) return packsBook.book;
  const book = (async () => {
    try {
      // DL21 (E526): a stalled book is a named refusal with the loading card's retry, never an endless wait.
      // The limit covers the body too (sp-x9): a stalled body is the same named refusal.
      const signal = AbortSignal.timeout(PACKS_BOOK_MS), stalled = (error: unknown): never => {
        throw signal.aborted ? new Error(`Packs book did not arrive in ${PACKS_BOOK_MS / 1000} s`) : error;
      };
      const response = await fetch(url, {signal}).catch(stalled);
      if (!response.ok) throw new Error(`Packs book unavailable (${response.status})`);
      const value: unknown = await response.json().catch(stalled);
      // Bound to its purpose and this build: a valid default book or another build's book is refused (sp-x9).
      if (get(value, 'book') !== 'packs' || get(value, 'build') !== __BUILD_ID__) throw new Error('Packs book is not this build\'s whole-level book');
      return value;
    } catch (error) {
      if (packsBook?.url === url) packsBook = undefined; // a failed read is not kept: the next attempt fetches again
      throw error;
    }
  })();
  packsBook = {url, book};
  return book;
}
/** Adopt only a matching complete live operation. This performs no cache or
 * network IO and never promotes a receipt, saved size or inferred progress. */
export function adoptCompletedSpawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode = '000'): SpawnDownload | null {
  const key = packsOn ? `packs:${flow}|${slug}|${tier}|${mode}` : (() => { const selected = spawnSelection(slug, flow, tier, mode); return selected === null ? null : addressKey(selected.address); })();
  const held = current;
  if (key === null || held === undefined || held.key !== key || !held.download.snapshot().complete) return null;
  held.foreground = true;
  return held.download;
}
/** DL18: the held-parts index's own key in the asset cache; no page or worker route serves it. */
const HELD_PARTS = new URL('/__wildshard/spawn-held-parts', typeof location === 'undefined' ? 'http://localhost/' : location.href).href;
/** A held member's cache entry is usable: a 200 that is not a page, exactly `bytes` long. `keep` writes the decoded
 * length as Content-Length; an entry the network wrote may carry its encoded length instead, so its body is measured. */
async function heldMember(response: Response | undefined, bytes: number): Promise<boolean> {
  if (response?.status !== 200 || /\btext\/html\b/iu.test(response.headers.get('content-type') ?? '')) return false;
  const length = response.headers.get('content-length');
  if (length !== null && response.headers.get('content-encoding') === null) { void response.body?.cancel().catch(() => undefined); return Number(length) === bytes; }
  return (await response.arrayBuffer()).byteLength === bytes;
}
async function readHeldParts(response: Response | undefined): Promise<HeldParts> {
  const value: unknown = response === undefined ? {} : await response.json();
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string[]] =>
    /^[a-f0-9]{64}$/u.test(entry[0]) && Array.isArray(entry[1]) && entry[1].every(url => typeof url === 'string')));
}
function downloadPorts(cacheName: unknown, packs: boolean): SpawnDownloadPorts {
  const store = typeof caches === 'undefined' ? null : typeof cacheName === 'string' ? caches.open(cacheName) : null;
  const controller = navigator.serviceWorker?.controller;
  return {
    fetch: (url, signal, init) => fetch(url, {...init, signal}),
    cached: async url => typeof caches === 'undefined' ? undefined : store === null ? caches.match(url, {ignoreVary: true}) : (await store).match(url, {ignoreVary: true}),
    ...(store === null ? {} : {present: async (urls: readonly string[]) => {
      const wanted = new Set(urls), found = new Set<string>();
      for (const response of await (await store).matchAll()) if (response.status === 200 && !/\btext\/html\b/iu.test(response.headers.get('content-type') ?? '') && wanted.has(response.url)) found.add(response.url);
      return found;
    }}),
    ...(store === null || controller !== undefined && controller !== null ? {} : {store: async (url: string, response: Response) => {await (await store).put(url, response);}}),
    ...(store === null || !packs ? {} : {packs: true, keep: async (url: string, response: Response) => {await (await store).put(url, response);}}),
    ...(packs ? {whole: true} : {}),
    ...(store === null || !packs ? {} : {held: {
      read: async () => readHeldParts(await (await store).match(HELD_PARTS)),
      write: async (index: HeldParts) => {await (await store).put(HELD_PARTS, Response.json(index));},
      keys: async () => new Set((await (await store).keys()).map(request => request.url)),
    }}),
  };
}
/** A download whose manifest is known only after the packs book arrives; until then its progress is unknown. */
function lateDownload(inner: Promise<SpawnDownload>): SpawnDownload {
  let resolved: SpawnDownload | undefined, failure: string | null = null, cancelled = false;
  const listeners = new Map<(snapshot: SpawnDownloadSnapshot) => void, () => void>();
  const waiting = (): SpawnDownloadSnapshot => ({progressKnown: false, totalBytes: 0, completedBytes: 0, cachedBytes: 0, filesTotal: 0, filesDone: 0, complete: false, error: failure});
  const ready = (async () => {
    let download: SpawnDownload;
    try { download = await inner; } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      for (const listener of listeners.keys()) listener(waiting());
      throw error;
    }
    resolved = download;
    if (cancelled) download.cancel();
    for (const listener of listeners.keys()) listeners.set(listener, download.subscribe(listener));
    await download.ready;
  })();
  void ready.catch(() => undefined);
  return {ready, snapshot: () => resolved?.snapshot() ?? waiting(),
    subscribe: listener => {
      listeners.set(listener, resolved?.subscribe(listener) ?? (() => undefined));
      if (resolved === undefined) listener(waiting());
      return () => {listeners.get(listener)?.(); listeners.delete(listener);};
    },
    resolve: url => resolved?.resolve(url) ?? new URL(url, document.baseURI).href,
    cancel: () => {cancelled = true; resolved?.cancel(); for (const off of listeners.values()) off(); listeners.clear();}};
}
function spawnDownload(slug: string, flow: 'client' | 'grid', tier: 'phone' | 'desktop', mode: string, foreground: boolean): SpawnDownload | null {
  const selected = spawnSelection(slug, flow, tier, mode); if (selected === null) return null;
  const key = packsOn ? `packs:${flow}|${slug}|${tier}|${mode}` : addressKey(selected.address);
  if (current !== undefined && current.key === key) {current.foreground ||= foreground; return current.download;}
  // Runtime packs: this entry's whole-level manifest from the packs book. A missing, unreadable or entry-less book
  // fails the download (admission waits on it and refuses control with the reason); it never runs the default set and
  // reports it complete, which would break the whole-level rule (sp-x9's review of 40bc516d5c).
  const download = !packsOn ? downloadSpawnManifest(selected.address, downloadPorts(selected.cacheName, false), document.baseURI)
    : lateDownload((async () => {
      const address = bookSelection(await readPacksBook(), slug, flow, tier, mode);
      if (address === null) throw new Error(`Packs book has no ${flow} entry for ${slug} (${tier}, ${mode})`);
      if (address.url === selected.address.url) throw new Error('Packs book names the default manifest');
      return downloadSpawnManifest(address, downloadPorts(selected.cacheName, true), document.baseURI);
    })());
  current?.download.cancel(); current = {key, download, foreground}; return download;
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
    root.dataset['streamedBytes'] = String(row.streamedBytes ?? row.completedBytes);
    const fact = root.querySelector('[data-el="dlFact"]'), pct = root.querySelector('[data-el="dlPct"]'), bar = root.querySelector<HTMLElement>('[data-el="dlBar"]');
    const text = row.wire ?? row;
    if (fact !== null) fact.textContent = `Spawn view · ${mb(text.completedBytes)}${row.complete ? '' : ` of ${mb(text.totalBytes)}`} · ${mb(text.cachedBytes)} from cache`;
    if (pct !== null) pct.textContent = percent === null ? '—' : String(percent);
    if (bar !== null) bar.style.width = `${percent ?? 0}%`;
  });
}
