/**
 * The other shards, downloaded in the background (E158; the user: "skip the download phase when swapping shards and only
 * do the loading phase"). Once this shard is playable, every file another shard's boot reads — for THIS device's tier —
 * is fetched into the service worker's caches, so the first switch to a shard never visited boots from Cache Storage: its
 * loading bar has nothing to download, and it works offline. A revisit already cost ~0 bytes (bench.budget.json "warm
 * transfer"); this makes the FIRST visit a revisit.
 *
 * The list is the boot's own, not a copy of it (`shardBootRequests`): the shard's boot pack parts for this tier, then every
 * file its `bootFiles` declares that the pack does not carry — the files the loading bar counts, which are exactly the
 * files a boot reads (plan.done() throws unless DOWNLOAD is at 100 %), with the network's `?v=` (versionedUrl) applied.
 * test/shard-prefetch.test.ts proves the equality against main.ts's own composition (pack + bootFetches + extraFetches +
 * physics), per shard and per tier.
 *
 * The fetching happens in the worker (src/pwa/sw.js `PREFETCH`): the page posts one URL at a time and the worker checks
 * its cache (a hit costs nothing — so a later session resumes where this one stopped), fetches at low priority and stores
 * the response. The page thread only posts messages, so the game's frames do not pay for it.
 *
 * Polite: starts a few seconds after playable and only when idle; at most CONCURRENCY files in flight; nothing new while
 * the tab is hidden; on Wi-Fi and cellular alike (the user's pick), off on the OS's data saver (Save-Data), without a controlling worker (dev, `?sw=0`, the native shells), and
 * with `?prefetch=0`. The current shard goes first: whatever its own boot fetched before the worker controlled the page
 * (a first visit on a slow link, the ≤ 2.5 s cap in src/boot/sw.ts) is stored now instead of on the next launch.
 *
 * `window.__ws_prefetch` (the bench / tests): `{ state, done }` — `done` resolves with the final report.
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import { CHUNKS } from '../chunks/registry';
import { bootFiles } from './extras';
import { packFor } from './pack';
import { tierUrl, versionedUrl } from './bytes';
import { PUBLIC_BYTES } from './bytes.generated';
import { TIER } from '../core/tier';
import { lutUrl } from '../world/lut';
import { horizonStrips } from '../world/HorizonMatte';
import { LEVER_MODEL_URL } from '../player/LeverRifle';
import { KNIFE_MODEL_URL } from '../pinehollow/life/skinKnife';
import { BIRDS_JSON_URL, BIRDS_URL } from '../pinehollow/life/birdModels';
import { NPC_KINDS, npcModelUrl } from '../pinehollow/quest/npcModels';
import { JOURNAL_SKIN } from '../ui/compendium/shards/pine-hollow';
import { PERSON_FILE, peopleModelUrl, type PersonKey } from '../nalati/campPeopleModels';

/** files in flight at once: the worker's fetches share the pipe with anything the game still asks for */
const CONCURRENCY = 2;
/** after playable: the title's first frames, the menu's first taps and the shader warm-up go first */
const START_DELAY_MS = 4000;
/** one file's longest wait for the worker's answer (a slow link and an 18 MB pack); past it, the worker is presumed gone */
const REPLY_TIMEOUT_MS = 180_000;

/** Every URL `def`'s boot requests on this tier, in the order the boot asks for them, as the network sees them. */
export function shardBootRequests(def: ChunkDef): string[] {
  const files = bootFiles(def);
  const pack = packFor(def);
  const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
  const declared = Object.values(files).flat().filter((p) => !packed.has(p));
  return [...new Set([...(pack ? pack.parts.map((part) => part.url) : []), ...declared])].map(versionedUrl);
}

/**
 * The files a shard reads at boot WITHOUT declaring them to the loading bar — fetched by the world as it comes up (the
 * shard's colour LUT, its painted horizon, Pine Hollow's rifle / knife / birds / NPCs / trophy-wall chalk, Nalati's camp
 * people). Not in `bootFiles` (plan.done() would wait on them), so the bench found them: the first switch still
 * downloaded ~1–4 MB of them. Each name comes from the module that loads it; a file the build does not ship is left out.
 */
export function lateReads(def: ChunkDef): string[] {
  const out: string[] = [];
  const lut = lutUrl(def.slug);
  if (lut !== null) out.push(lut);
  const strips = horizonStrips(def.slug);
  if (strips) { const s = TIER === 'phone' && strips.phone ? strips.phone : strips; out.push(s.day, s.night); }
  if (def.slug === 'pine-hollow') {
    out.push(tierUrl(LEVER_MODEL_URL), tierUrl(KNIFE_MODEL_URL), tierUrl(BIRDS_URL), BIRDS_JSON_URL, ...NPC_KINDS.map((k) => npcModelUrl(k)));
    if (JOURNAL_SKIN.chalk) out.push(JOURNAL_SKIN.chalk.atlas);
  }
  if (def.style === 'painterly') out.push(...Object.keys(PERSON_FILE).filter((k): k is PersonKey => k in PERSON_FILE).map(peopleModelUrl));
  return out.filter((p) => p in PUBLIC_BYTES).map(versionedUrl);
}

/** What the background download fetches for `def`: its boot's requests, then what the world reads as it comes up. */
export function shardPrefetchList(def: ChunkDef): string[] {
  return [...new Set([...shardBootRequests(def), ...lateReads(def)])];
}

export interface PrefetchEnv {
  search: string;
  /** a service worker controls the page (its caches are where the files go) */
  controlled: boolean;
  /** the OS's data saver (Android Data Saver, Chromium's Save-Data; iOS Low Data Mode does not reach the page) */
  saveData?: boolean;
}

/**
 * Why the background download must not run here, or null when it may. Wi-Fi and cellular alike (the user's pick, E158):
 * only the player's explicit data saver and `?prefetch=0` turn it off — never the connection type.
 */
export function prefetchVeto(env: PrefetchEnv): string | null {
  if (new URLSearchParams(env.search).get('prefetch') === '0') return '?prefetch=0';
  if (!env.controlled) return 'no service worker';
  if (env.saveData === true) return 'Save-Data';
  return null;
}

/** navigator.connection (Chromium / Android): not in every browser, not in the DOM lib */
function connection(): Pick<PrefetchEnv, 'saveData'> {
  const c: unknown = Reflect.get(navigator, 'connection');
  if (typeof c !== 'object' || c === null) return {};
  const saveData: unknown = Reflect.get(c, 'saveData');
  return typeof saveData === 'boolean' ? { saveData } : {};
}

export interface ShardTally { files: number; hit: number; stored: number; failed: number; bytes: number }
export interface PrefetchState {
  status: 'waiting' | 'running' | 'done' | 'skipped' | 'failed';
  reason?: string;
  startedAt: number;
  endedAt: number;
  shards: Record<string, ShardTally>;
}
export interface PrefetchHandle { state: PrefetchState; done: Promise<PrefetchState> }

declare global { interface Window { __ws_prefetch?: PrefetchHandle } }

interface Reply { status: 'hit' | 'stored' | 'failed'; bytes: number }

/** One file through the controlling worker; null when nothing answers (an older worker without PREFETCH, or none). */
function viaWorker(url: string): Promise<Reply | null> {
  const ctl = navigator.serviceWorker.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise<Reply | null>((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => { resolve(null); }, REPLY_TIMEOUT_MS);
    ch.port1.onmessage = (e: MessageEvent<{ type?: unknown; status?: unknown; bytes?: unknown }>) => {
      clearTimeout(timer);
      const { status, bytes } = e.data;
      resolve(e.data.type === 'PREFETCHED' && (status === 'hit' || status === 'stored' || status === 'failed')
        ? { status, bytes: typeof bytes === 'number' ? bytes : 0 } : null);
    };
    ctl.postMessage({ type: 'PREFETCH', url }, [ch.port2]);
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
/** the next idle slot (Safari has no requestIdleCallback: a short timeout stands in) */
const idle = (): Promise<void> => new Promise((resolve) => {
  if ('requestIdleCallback' in window) window.requestIdleCallback(() => { resolve(); }, { timeout: 2000 });
  else setTimeout(resolve, 50);
});
/** resolves while the tab is visible — at once, or on the next visibilitychange that shows it */
const visible = (): Promise<void> => new Promise((resolve) => {
  if (!document.hidden) { resolve(); return; }
  const on = (): void => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); resolve(); } };
  document.addEventListener('visibilitychange', on);
});

/**
 * Start the background download: `active` (the shard on screen) first, then every other shard in title order. Call once
 * the shard is playable. Returns the handle it also puts on `window.__ws_prefetch`.
 */
export function startShardPrefetch(active: ChunkDef): PrefetchHandle {
  const state: PrefetchState = { status: 'waiting', startedAt: 0, endedAt: 0, shards: {} };
  const veto = prefetchVeto({ search: location.search, controlled: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null, ...connection() });
  const finish = (status: PrefetchState['status'], reason?: string): PrefetchState => {
    state.status = status;
    if (reason !== undefined) state.reason = reason;
    state.endedAt = Math.round(performance.now());
    return state;
  };
  const run = async (): Promise<PrefetchState> => {
    if (veto !== null) return finish('skipped', veto);
    await sleep(START_DELAY_MS);
    const order = [active, ...CHUNKS.filter((c) => c.slug !== active.slug)];
    const jobs: { slug: string; url: string }[] = [];
    for (const def of order) {
      const urls = shardPrefetchList(def);
      state.shards[def.slug] = { files: urls.length, hit: 0, stored: 0, failed: 0, bytes: 0 };
      for (const url of urls) jobs.push({ slug: def.slug, url });
    }
    state.status = 'running';
    state.startedAt = Math.round(performance.now());
    const worker = { gone: false }; // an older worker (no PREFETCH) or none: stop asking
    const lane = async (): Promise<void> => {
      for (let job = jobs.shift(); job !== undefined && !worker.gone; job = jobs.shift()) {
        await visible();
        await idle();
        const r = await viaWorker(job.url);
        const t = state.shards[job.slug];
        if (r === null) { worker.gone = true; return; }
        if (t) { t[r.status]++; t.bytes += r.bytes; }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, lane));
    return worker.gone ? finish('failed', 'the service worker did not answer') : finish('done');
  };
  const done = run().catch((e: unknown) => finish('failed', e instanceof Error ? e.message : String(e)));
  const handle: PrefetchHandle = { state, done };
  window.__ws_prefetch = handle;
  return handle;
}
