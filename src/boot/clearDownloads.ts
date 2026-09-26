/**
 * Debug ▸ Clear downloads (E172, the user: "I need a button to nuke the cache so i can test it"; their pick 1: downloads
 * only). Throws away every downloaded game file so the next load is a true first visit — and nothing the player made:
 *
 *   gone   every Cache Storage cache (the worker's ws-immutable / ws-static-* / ws-shell-*, and any other), the service
 *          worker's registration, the KTX2 "set complete" markers (`ws.ktx2set.*`, src/boot/shardPrefetch.ts — so Auto
 *          boots with images again, E157 B), and the origin's HTTP cache (`/clear-cache.json` answers with
 *          `Clear-Site-Data: "cache"`, vercel.json: the worker's fetches go through the HTTP cache, and the immutable
 *          `/assets/**` year would otherwise answer the "cold" load from disk);
 *   kept   localStorage otherwise — saves, quest progress, settings (`ws.settings.v1`), developer mode, the review
 *          login — and IndexedDB (the game keeps none today).
 *
 * The order is what makes the reload cold: the background download is stopped first (its in-flight files would put
 * entries back into a deleted cache), the worker is UNREGISTERED before the caches go (a navigation after unregister is
 * no longer handled by it, so the reload cannot be served by the old worker), and the caches are deleted and re-checked
 * until none is left. The caller then reloads (the Debug registry row, src/ui/debugOptions.ts) — the new page registers a fresh worker, as on a
 * first visit.
 *
 *   await storageUsed()            → bytes the origin holds (navigator.storage.estimate), or null
 *   const r = await clearDownloads()   → { before, after, cached, caches, workers, markers } — also kept in sessionStorage for the
 *                                        next page (`lastClear()`), which shows it in the Debug card
 */

export interface ClearReport {
  /** navigator.storage.estimate().usage before / after (null: not available). The browser settles `after` lazily (Chrome
   *  still counts a deleted cache while the old worker holds it open), so the freed bytes are `cached` */
  before: number | null;
  after: number | null;
  /** what the worker's caches held just before they went (its VERSION reply, src/boot/sw.ts), or null */
  cached: number | null;
  /** caches deleted */
  caches: number;
  /** service-worker registrations unregistered */
  workers: number;
  /** localStorage download markers removed */
  markers: number;
  /** the HTTP cache was asked to clear (the Clear-Site-Data fetch answered) */
  httpCache: boolean;
  at: number;
}

/** sessionStorage, deliberately not `ws.`-prefixed localStorage (the native save mirror copies every ws.* key) */
const REPORT_KEY = 'wsClearDownloads';
/** the localStorage keys that are download bookkeeping, not the player's */
const MARKER_PREFIXES = ['ws.ktx2set.'];
/** the file whose response carries `Clear-Site-Data: "cache"` (vercel.json); `?sw=0` so no worker answers it */
const CLEAR_HTTP_URL = '/clear-cache.json?sw=0';

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
/** `p`, or undefined after `ms` */
const within = <T>(p: Promise<T>, ms: number): Promise<T | undefined> => Promise.race([p, wait(ms).then(() => undefined)]);

export async function storageUsed(): Promise<number | null> {
  try {
    const e = await within(navigator.storage.estimate(), 3000);
    return typeof e?.usage === 'number' ? e.usage : null;
  } catch { return null; }
}

export async function clearDownloads(): Promise<ClearReport> {
  const before = await storageUsed();
  // 1. the background download: no new file, and the ones in flight answered (or given up on) before the caches go
  await within(window.__ws_prefetch?.stop() ?? Promise.resolve(), 3000);
  // what is about to be freed: the worker's own count of its caches (before it is unregistered)
  const held = await within(window.__ws_sw?.version() ?? Promise.resolve(null), 5000);
  const cached = typeof held?.bytes === 'number' ? held.bytes : null;
  // 2. the worker, before its caches: the reload must not be handled by it
  let workers = 0;
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const done = await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      workers = done.filter(Boolean).length;
    } catch { /* no worker API here (a native shell): nothing registered */ }
  }
  // 3. every cache; a put that was already under way can re-create one, so look again until none is left
  let deleted = 0;
  if (typeof caches !== 'undefined') {
    for (let pass = 0; pass < 4; pass++) {
      const keys = await caches.keys();
      if (keys.length === 0 && pass > 0) break;
      for (const k of keys) if (await caches.delete(k)) deleted++;
      await wait(250);
    }
  }
  // 4. the KTX2 "set complete" markers: Auto must not boot KTX2 against files that are gone
  let markers = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== null && MARKER_PREFIXES.some((p) => k.startsWith(p))) keys.push(k); }
    for (const k of keys) { localStorage.removeItem(k); markers++; }
  } catch { /* storage off: no markers were written either */ }
  // 5. the HTTP cache (Clear-Site-Data: "cache"): offline this fails, and the reload is cold for Cache Storage only
  let httpCache = false;
  try { httpCache = (await within(fetch(CLEAR_HTTP_URL, { cache: 'no-store' }), 5000))?.ok === true; } catch { /* offline */ }
  const report: ClearReport = { before, after: await storageUsed(), cached, caches: deleted, workers, markers, httpCache, at: Date.now() };
  try { sessionStorage.setItem(REPORT_KEY, JSON.stringify(report)); } catch { /* the next page just will not say it */ }
  return report;
}

/** the last clear's report, when this tab's previous page cleared (the Debug card says what was freed) */
export function lastClear(): ClearReport | null {
  try {
    const raw = sessionStorage.getItem(REPORT_KEY);
    if (raw === null) return null;
    const r = JSON.parse(raw) as Partial<ClearReport>;
    return typeof r.at === 'number' && typeof r.caches === 'number' ? { before: r.before ?? null, after: r.after ?? null, cached: r.cached ?? null, caches: r.caches, workers: r.workers ?? 0, markers: r.markers ?? 0, httpCache: r.httpCache === true, at: r.at } : null;
  } catch { return null; }
}

/** the bytes a clear freed: what the caches held, else the drop in the storage estimate */
export function freedBytes(r: ClearReport): number | null {
  return r.cached ?? (r.before !== null && r.after !== null ? Math.max(0, r.before - r.after) : null);
}

/** `n` bytes as the menu prints them */
export const mbText = (n: number | null): string => (n === null ? '? MB' : `${(n / 1e6).toFixed(n < 10e6 ? 1 : 0)} MB`);
