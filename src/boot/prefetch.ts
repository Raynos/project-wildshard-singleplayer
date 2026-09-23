/**
 * Every file the boot will read, requested up front (project/archive/2026-09-22-load-perf.md: "fetch everything up front in
 * parallel, then build as each arrives"). The steps still ask for their files in their own order — through
 * fetchImage, three's FileLoader / ImageBitmapLoader, the baked-terrain reader — and the first GET of a
 * prefetched path is handed the prefetched response (in flight, downloaded, or started on the spot when it
 * was still queued) instead of a new request. A step's CPU work so overlaps the downloads of the steps after
 * it, where each step used to start its fetches only once the previous one had finished building.
 *
 * The queue runs in manifest order (sky → baked → terrain → trees → cabins → props, the order the steps need
 * them) with `CONCURRENCY` downloads at a time: enough to keep the pipe full at 4G latency, few enough that
 * the first step's files are not starved by the last step's — all ~90 at once finished everything together
 * at the end of the download and left every step's build for after it.
 *
 * Installed after the byte counter (src/boot/bytes.ts): the prefetch goes through the counted fetch, so the
 * DOWNLOAD track moves as the bytes really arrive. Installed after the service worker controls the page, so
 * every response still lands in its cache (the second launch stays all-cache).
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import type { ChunkFiles } from './bytes';

const CONCURRENCY = 6;
/**
 * The art + audio queue (prefetchAfter): ~150 files, most of them 3–30 KB one-shots, after the pack has the pipe to itself.
 * At 6 in flight a 4G round trip (~170 ms) per small file left the pipe idle between them; the world's files are in by
 * then, so nothing downstream is starved by more at once.
 */
const EXTRA_CONCURRENCY = 16;

/**
 * The declared files this shard's boot really reads, in step order. The boot manifest (src/boot/manifest.ts)
 * declares the engine-fixed cabins / props, the textured terrain's layers and the tree textures for every
 * shard; an open-water shard builds no cabins or props, a low-poly one reads only its baked terrain and a
 * treeless one (ChunkTrees.factory 'none') no tree textures — prefetching the whole manifest downloaded
 * Driftwood's boot plus 14 MB of Pine Hollow's.
 */
export function bootFetches(def: ChunkDef, files: ChunkFiles): string[] {
  const terrain = def.style === 'lowpoly' ? files.terrain.filter((f) => f.startsWith('/assets/baked/')) : files.terrain;
  const trees = def.trees.factory === 'none' ? [] : files.trees;
  const homestead = def.ocean === undefined ? [...files.cabins, ...files.props] : [];
  return [...files.sky, ...files.baked, ...terrain, ...trees, ...homestead];
}
const pathOf = (url: string): string => { try { return new URL(url, location.href).pathname; } catch { return url; } };

/** path → settles when the queue has downloaded it (src/boot/extras.ts waits on these instead of jumping the queue) */
const landed = new Map<string, { done: Promise<void>; settle: () => void }>();
const landing = (p: string): { done: Promise<void>; settle: () => void } => {
  let e = landed.get(p);
  if (!e) { let settle: () => void = () => undefined; const done = new Promise<void>((resolve) => { settle = resolve; }); e = { done, settle }; landed.set(p, e); }
  return e;
};
/**
 * Resolves once the queue has downloaded `url` (or failed to): the next GET of it is then answered from memory. A path
 * that was never queued resolves at once. Waiting here keeps the queue's order and concurrency — a plain early fetch()
 * would start the file on the spot, ahead of the files the world's steps need first.
 */
export function whenPrefetched(url: string): Promise<void> { return landed.get(pathOf(url))?.done ?? Promise.resolve(); }

/**
 * Queue `paths` once `after` has settled (the boot pack streamed): the art and the audio wait for the shard's own files
 * instead of splitting the pipe with them. `whenPrefetched` already knows them, so nobody jumps the queue meanwhile.
 */
export function prefetchAfter(paths: readonly string[], after: Promise<unknown>): void {
  for (const p of paths) landing(p);
  void (async () => {
    try { await after; } catch { /* a failed pack frees the pipe all the same */ }
    prefetch(paths, EXTRA_CONCURRENCY);
  })();
}

/** Queue `paths` now; the first plain GET of each is served the prefetched response. Returns how many were queued. */
export function prefetch(paths: readonly string[], concurrency = CONCURRENCY): number {
  const fetchNow = window.fetch.bind(window);
  const queue = [...new Set(paths)];
  const queued = new Set(queue);
  for (const p of queue) landing(p);
  const started = new Map<string, Promise<Response>>();
  let active = 0;
  const start = (p: string): Promise<Response> => {
    queued.delete(p);
    active++;
    // read to the end here: the download finishing (not its headers) is what frees the slot for the next file
    const res = fetchNow(p)
      .then(async (r) => (r.ok ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r))
      .finally(() => { active--; landing(p).settle(); pump(); });
    res.catch(() => undefined); // a failed prefetch is re-asked for (and its error surfaced) by the step that needs it
    started.set(p, res);
    return res;
  };
  function pump(): void {
    for (let free = concurrency - active; free > 0;) {
      const p = queue.shift();
      if (p === undefined) return;
      if (queued.has(p)) { void start(p); free--; }
    }
  }
  pump();
  window.fetch = (input, init) => {
    const req = input instanceof Request ? input : null;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const p = pathOf(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (method !== 'GET') return fetchNow(input, init);
    const hit = started.get(p) ?? (queued.has(p) ? start(p) : undefined); // asked for before its turn: now
    if (hit === undefined) return fetchNow(input, init);
    started.delete(p); // a body is read once: a second ask for the same file makes its own request
    return hit.then((r) => (r.ok ? r : fetchNow(input, init)), () => fetchNow(input, init));
  };
  return queued.size + started.size;
}
