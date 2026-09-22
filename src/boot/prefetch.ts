/**
 * Every file the boot will read, requested up front (docs/plans/LOAD-PERF.md: "fetch everything up front in
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

/** Queue `paths` now; the first plain GET of each is served the prefetched response. Returns how many were queued. */
export function prefetch(paths: readonly string[]): number {
  const fetchNow = window.fetch.bind(window);
  const queue = [...new Set(paths)];
  const queued = new Set(queue);
  const started = new Map<string, Promise<Response>>();
  let active = 0;
  const start = (p: string): Promise<Response> => {
    queued.delete(p);
    active++;
    // read to the end here: the download finishing (not its headers) is what frees the slot for the next file
    const res = fetchNow(p)
      .then(async (r) => (r.ok ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r))
      .finally(() => { active--; pump(); });
    res.catch(() => undefined); // a failed prefetch is re-asked for (and its error surfaced) by the step that needs it
    started.set(p, res);
    return res;
  };
  function pump(): void {
    for (let free = CONCURRENCY - active; free > 0;) {
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
