/**
 * Why the last page ended (E179). Jake's iPhone lost Pine Hollow on an ENTER WORLD: the Debug readout went from two
 * resident shards to "nalati-grasslands (playing)" alone, so the page had reloaded, and nothing said whether the game
 * navigated or iOS killed the page. This module makes the next such report conclusive:
 *
 *   markUnload('build pill tap')   before EVERY navigation / reload the game makes on purpose: localStorage
 *                                  `ws.lastUnload` = { reason, t, build, slug, resident }
 *   the alive beat                 every BEAT_MS, sessionStorage `ws.alive` = { t, build, slug, resident, vis };
 *                                  cleared on pagehide (a page that ends normally says so)
 *   lastEnd()                      read once at import (the boot's first module): how the previous page in this tab ended
 *     intentional   a `ws.lastUnload` younger than INTENT_MS: the game navigated, and says why
 *     unexpected    no recent reason but a stale `ws.alive`: the page ended without a pagehide — iOS killed the WebContent
 *                   process (memory) and the web view reloaded it, or the whole app was killed
 *     fresh         neither: a cold launch
 *   `document.wasDiscarded` rides along (Chrome's tab discarding; iOS never sets it).
 *
 * The last non-fresh end is kept in localStorage `ws.lastEnd`, so pause ▸ Settings ▸ Debug ▸ Loading & memory can show it
 * ("Last reload: …", src/ui/Menu.ts) even after a later cold launch. Dependency-free: src/boot/sw.ts and src/boot/entry.ts
 * import it before the game's graph, so its listeners and its timer are the page's, never a shard's.
 *
 *   setAliveSource(() => ({ slug, resident: 'pine-hollow (playing) 178 MB · nalati-grasslands 87 MB' }))   // main.ts
 */

declare const __BUILD_ID__: string;

const UNLOAD_KEY = 'ws.lastUnload';
const ALIVE_KEY = 'ws.alive';
const END_KEY = 'ws.lastEnd';
/** a reason written this long before the next boot still explains it */
const INTENT_MS = 10_000;
/** the alive beat's period */
const BEAT_MS = 3000;

export interface AliveInfo { slug: string; resident: string }
interface Stamp { t: number; build: string; slug: string; resident: string }
interface Unload extends Stamp { reason: string }
interface Alive extends Stamp { vis: string }
export interface LastEnd {
  kind: 'intentional' | 'unexpected' | 'fresh';
  /** what ended it, in words */
  reason: string;
  /** when the old page ended (its reason's stamp, or its last beat), epoch ms; 0 for a fresh launch */
  at: number;
  /** what was resident then ('' unknown) */
  resident: string;
  /** the build that page ran */
  build: string;
  /** when the page this describes booted (epoch ms) */
  bootedAt: number;
  /** `document.wasDiscarded` at this boot */
  discarded: boolean;
  /** the navigation type of this boot (navigate / reload / back_forward) */
  nav: string;
}

const build = (): string => { try { return __BUILD_ID__.split('-')[0] ?? ''; } catch { return ''; } };
const store = (kind: 'local' | 'session'): Storage | null => { try { return kind === 'local' ? localStorage : sessionStorage; } catch { return null; } };
const readJson = (s: Storage | null, key: string): unknown => { try { const v = s?.getItem(key); return v === null || v === undefined ? null : JSON.parse(v) as unknown; } catch { return null; } };
const writeJson = (s: Storage | null, key: string, v: unknown): void => { try { s?.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked: this record is lost */ } };
const str = (o: unknown, k: string): string => { const v: unknown = typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined; return typeof v === 'string' ? v : ''; };
const num = (o: unknown, k: string): number => { const v: unknown = typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined; return typeof v === 'number' && Number.isFinite(v) ? v : 0; };

/** a page (not a unit test's node, which imports the modules that import this one) */
const inPage = typeof document !== 'undefined' && typeof window !== 'undefined';

let source: (() => AliveInfo) | null = null;
/** what the alive beat and markUnload record: the running shard and the resident list (main.ts, once the host exists) */
export function setAliveSource(fn: () => AliveInfo): void { source = fn; beat(); }

function stamp(): Stamp {
  let info: AliveInfo = { slug: '', resident: '' };
  try { if (source) info = source(); } catch { /* recorded without it */ }
  return { t: Date.now(), build: build(), slug: info.slug, resident: info.resident };
}

/** the game is about to navigate / reload on purpose: say why, first (the next boot reads it) */
export function markUnload(reason: string): void {
  const u: Unload = { reason, ...stamp() };
  writeJson(store('local'), UNLOAD_KEY, u);
  console.info(`[lastEnd] unloading: ${reason}`);
}

let alive = true;
function beat(): void {
  if (!alive) return;
  if (!inPage) return;
  const a: Alive = { ...stamp(), vis: document.visibilityState };
  writeJson(store('session'), ALIVE_KEY, a);
}

function classify(): LastEnd {
  const now = Date.now();
  const local = store('local'), session = store('session');
  const u = readJson(local, UNLOAD_KEY), a = readJson(session, ALIVE_KEY);
  try { local?.removeItem(UNLOAD_KEY); } catch { /* read once either way */ }
  const discarded = inPage && Reflect.get(document, 'wasDiscarded') === true;
  let nav = '';
  try { const e: unknown = performance.getEntriesByType('navigation')[0]; nav = str(e, 'type'); } catch { /* old WebKit */ }
  const base = { bootedAt: now, discarded, nav };
  const ut = num(u, 't');
  if (u !== null && now - ut < INTENT_MS) return { kind: 'intentional', reason: str(u, 'reason'), at: ut, resident: str(u, 'resident'), build: str(u, 'build'), ...base };
  if (a !== null) {
    const where = str(a, 'vis') === 'hidden' ? 'in the background' : 'on screen';
    return { kind: 'unexpected', reason: `page ended unexpectedly ${where} (likely iOS killed it for memory)`, at: num(a, 't'), resident: str(a, 'resident'), build: str(a, 'build'), ...base };
  }
  if (u !== null) return { kind: 'intentional', reason: `${str(u, 'reason')} (${Math.round((now - ut) / 1000)} s before this load)`, at: ut, resident: str(u, 'resident'), build: str(u, 'build'), ...base };
  return { kind: 'fresh', reason: 'fresh launch', at: 0, resident: '', build: '', ...base };
}

const thisEnd: LastEnd = classify();
if (thisEnd.kind !== 'fresh' || thisEnd.discarded) writeJson(store('local'), END_KEY, thisEnd);
if (thisEnd.kind !== 'fresh') console.info(`[lastEnd] the previous page: ${thisEnd.reason}${thisEnd.resident === '' ? '' : ` · resident ${thisEnd.resident}`}`);

/** how the previous page in this tab ended (this boot's reading) */
export function lastEnd(): LastEnd { return thisEnd; }

/** the latest non-fresh end on this device (this boot's, or an earlier one's), null if none was ever recorded */
export function lastRecordedEnd(): LastEnd | null {
  if (thisEnd.kind !== 'fresh') return thisEnd;
  const e = readJson(store('local'), END_KEY);
  if (e === null) return null;
  const kind = str(e, 'kind');
  return {
    kind: kind === 'intentional' || kind === 'unexpected' ? kind : 'fresh', reason: str(e, 'reason'), at: num(e, 'at'), resident: str(e, 'resident'),
    build: str(e, 'build'), bootedAt: num(e, 'bootedAt'), discarded: Reflect.get(e as object, 'discarded') === true, nav: str(e, 'nav'),
  };
}

/** the Debug readout's line: "Last reload: <reason> · 2 min ago · resident <list>" */
export function lastEndLine(now = Date.now()): string {
  const e = lastRecordedEnd();
  if (e === null) return 'Last reload: none recorded';
  const ago = (ms: number): string => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))} s ago` : ms < 90 * 60_000 ? `${Math.round(ms / 60_000)} min ago` : `${Math.round(ms / 3_600_000)} h ago`);
  const when = e.at > 0 ? ago(now - e.at) : ago(now - e.bootedAt);
  const was = e === thisEnd ? '' : ' (before an earlier launch)';
  return `Last reload: ${e.reason}${was} · ${when}${e.resident === '' ? '' : ` · resident ${e.resident}`}${e.build === '' ? '' : ` · build ${e.build}`}${e.discarded ? ' · wasDiscarded' : ''}${e.nav === '' ? '' : ` · nav ${e.nav}`}`;
}

// the beat: the page's own timer (this module loads before any shard scope exists)
if (inPage) {
  beat();
  setInterval(beat, BEAT_MS);
  // back on screen after a pagehide that did not end the page (iOS can send one on an app switch): beating again
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') alive = true; beat(); });
  // a page that ends normally takes its marker with it; a bfcache return (pageshow persisted) puts it back
  window.addEventListener('pagehide', () => { alive = false; try { store('session')?.removeItem(ALIVE_KEY); } catch { /* nothing to clear */ } });
  window.addEventListener('pageshow', (e) => { if (e.persisted) { alive = true; beat(); } });
}
