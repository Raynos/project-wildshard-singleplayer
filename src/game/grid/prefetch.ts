/**
 * G554 (Jake, 2026-10-21): *"the download bar doesn't pre download and pre fetch everything we know that infinite wildshard
 * needs"*. Infinite Wildshard knows its whole set before play: every cell's product (its index, sections, schemas and every
 * blob, commons included, which carry the far tiers, impostors, near rows, ring tiles, edges and minimap). This reads all of
 * it into the content cache on disk, during the grid's loading (nearest cells first) and from the main menu in the
 * background, so nothing the grid can know in advance is fetched later during play.
 *
 * Disk, never memory: nothing is admitted, decoded or claimed in the residency allocator (G534 limits unchanged). It reads
 * only the format-2 index of each product and stores each file under its verified hash with a `keep` write, which never
 * evicts anything (the current shard's bytes stay); the PrefetchQuota guard (navigator.storage) stops the run when the
 * origin's free quota runs out, and a full content cache stops it too, keeping what fit. A file already stored costs one
 * index lookup, so a later launch resumes where this one stopped. Off on Save-Data and offline; a product whose index is
 * from a newer deployment stops the run (the page's own load handles that reload, never this). One run per page: a second
 * start (the grid after the menu) only moves its cells to the front of the queue. Its fetches are not boot waits.
 * `window.__ws_gridPrefetch()` (captures, the bench) returns the counts.
 */
import { PrefetchQuota, PrefetchBytes } from '@wildshard/engine/boot/prefetchQuota';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { readOutputDownloadIndex } from '@wildshard/format/outputDownload';
import { findTitleManifest } from '../shard/titleList';
import type { ProductCache, ProductOptions } from '../shardfile/product';
import { browserContentStore, contentHash } from '../shardfile/contentStore';
import { hashOwnedBytes, prepareContentHash } from '@wildshard/engine/boot/contentHash';
import { ContentCacheWorker } from '@wildshard/engine/boot/contentCacheWorker';
import { builtIndexHashes } from '@wildshard/format/builtIndexes';
import { readCheckedOutputIndex } from '../shardfile/outputIndexChecks';
import type { GridAssembly } from './assembly';

/** Files in flight at once: the page's own reads keep most of the pipe. */
const CONCURRENCY = 2;
/** Payloads, not process memory: worker/store snapshots also consume memory. */
const IN_FLIGHT_BYTES = 32 * 1024 * 1024;
/** Origin quota left free for saves, the app shell and the browser's own caches. */
const HEADROOM = 64 * 1024 * 1024;

/** Read-only progress of the page's one run (the loading screen's download line reads it through an injected port). */
export interface GridPrefetchStatus {
  /** `quota`: the origin's free quota or the content cache ran out (what fit is kept); `stopped`: offline, Save-Data, no
   * storage, a newer deployment; `error`: the run itself failed (one product's failure only skips that product) */
  readonly phase: 'running' | 'done' | 'quota' | 'stopped' | 'error';
  readonly reason: string | null;
  readonly products: number; readonly productsRead: number;
  /** distinct files (by hash) and their wire bytes known from the product indexes read so far */
  readonly knownFiles: number; readonly knownBytes: number;
  /** of those, already on disk before this run looked, and stored by this run */
  readonly presentFiles: number; readonly presentBytes: number; readonly storedFiles: number; readonly storedBytes: number;
  readonly inFlightBytes: number; readonly peakInFlightBytes: number; readonly limitInFlightBytes: number;
}
interface Row { readonly path: string; readonly hash: string; readonly bytes: number }
type PrefetchCache = Required<Pick<ProductCache, 'holds' | 'keepAsset'>> & {
  /** The whole file in the content cache's worker (read, verified, kept): whether it was stored, null where no worker can. */
  readonly fetchKeep?: (url: string, hash: string, bytes: number) => Promise<boolean | null>;
};

/** The verified disk cache owns persistence; HTTP must not retain a second body. */
export async function readGridPrefetch(url: string, maximum: number, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > IN_FLIGHT_BYTES) throw new Error('Invalid prefetch body size');
  const response = await fetcher(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Prefetch read failed: ${url}`);
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) throw new Error('Prefetched file exceeds its declared size');
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
function saveData(): boolean {
  const connection: unknown = Reflect.get(navigator, 'connection');
  return typeof connection === 'object' && connection !== null && Reflect.get(connection, 'saveData') === true;
}

/** The grid's distinct slugs, nearest cell to `at` first (the home cell, then its neighbours, then the rest). */
export function gridPrefetchOrder(assembly: Pick<GridAssembly, 'cells'>, at: Readonly<{ x: number; z: number }>): string[] {
  const near = [...assembly.cells].sort((a, b) => Math.hypot(a.origin.x - at.x, a.origin.z - at.z) - Math.hypot(b.origin.x - at.x, b.origin.z - at.z));
  return [...new Set(near.map(cell => cell.slug))];
}

class GridPrefetch {
  private readonly memory = new PrefetchBytes(IN_FLIGHT_BYTES);
  private readonly queue: string[] = [];
  private readonly known = new Set<string>();
  private readonly hashes = new Set<string>();
  private status: Omit<{ -readonly [K in keyof GridPrefetchStatus]: GridPrefetchStatus[K] }, 'inFlightBytes' | 'peakInFlightBytes' | 'limitInFlightBytes'> = { phase: 'running', reason: null,
    products: 0, productsRead: 0, knownFiles: 0, knownBytes: 0, presentFiles: 0, presentBytes: 0, storedFiles: 0, storedBytes: 0 };
  /** Queue these slugs ahead of the rest (already read ones are skipped); start the run if it is not running. */
  prioritize(slugs: readonly string[]): void {
    const fresh = slugs.filter(id => !this.known.has(id) || this.queue.includes(id));
    for (const id of fresh) { const at = this.queue.indexOf(id); if (at !== -1) this.queue.splice(at, 1); this.known.add(id); }
    this.queue.unshift(...fresh); this.status.products = this.known.size;
  }
  snapshot(): GridPrefetchStatus { return { ...this.status, inFlightBytes: this.memory.usedBytes,
    peakInFlightBytes: this.memory.peakBytes, limitInFlightBytes: this.memory.limit }; }
  stop(reason: string, phase: 'quota' | 'stopped' | 'error' = 'stopped'): void {
    if (this.status.reason === null) { this.status.reason = reason; this.status.phase = phase; }
  }
  async run(): Promise<void> {
    try {
      if (saveData()) { this.stop('save-data'); return; }
      const quota = await PrefetchQuota.open({ persist: () => navigator.storage.persist(), estimate: () => navigator.storage.estimate() }, HEADROOM);
      if (quota === null) { this.stop('no storage estimate'); return; }
      for (let next = this.queue.shift(); next !== undefined && this.status.reason === null; next = this.queue.shift()) {
        if (!navigator.onLine) { this.stop('offline'); return; }
        try { await this.product(next, quota); }
        catch (error: unknown) { console.warn(`[grid prefetch] ${next} skipped`, error); } // one product's failure skips only it
        this.status.productsRead++;
      }
      if (this.status.reason === null) this.status.phase = 'done';
    } finally {
      // Only product() reads the hash history. This page's one run is over;
      // later prioritization/status reads retain scalar counts, not file hashes.
      this.hashes.clear();
    }
  }
  private async product(id: string, quota: PrefetchQuota): Promise<void> {
    const manifest = findTitleManifest(id), descriptor = manifest?.shardfile ?? manifest?.gridShardfile;
    if (descriptor === undefined) return;
    const url = new URL(descriptor, location.href), base = new URL('.', url).href;
    prepareContentHash();
    if (typeof caches === 'undefined') { this.stop('no content cache'); return; }
    const content = browserContentStore(caches), indexes = import.meta.env.DEV ? null : builtIndexHashes();
    const holds: PrefetchCache['holds'] = (hash, size) => content.holds(hash, size);
    const keepAsset: PrefetchCache['keepAsset'] = (hash, body) => content.put(hash, body, true);
    // The page never sees a prefetched body: the worker reads, verifies and keeps it (G639).
    const fetchKeep = content instanceof ContentCacheWorker ? async (file: string, hash: string, size: number): Promise<boolean | null> =>
      (await content.fetchVerified(file, hash, size, { reply: 'stored', keep: true }))?.stored ?? null : undefined;
    const bytes = await readGridPrefetch(url.href, limits.sourceBytes);
    if (indexes !== null && !indexes.has(await contentHash(bytes))) { this.stop('a newer deployment'); return; }
    const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    // A known build's complete index was checked above; this only schedules
    // verified disk copies. Unverified input needs checked Node ingestion.
    const index = indexes === null ? await readCheckedOutputIndex(input) : readOutputDownloadIndex(input);
    const listed: Row[] = [...index.sections, ...index.schemas, ...index.files.map(file => ({ path: file.path, hash: file.hash, bytes: file.compressed }))];
    // a commons blob or a shared section is listed by several products: count and store it once
    const rows = listed.filter(row => { if (this.hashes.has(row.hash)) return false; this.hashes.add(row.hash); return true; });
    this.status.knownFiles += rows.length; this.status.knownBytes += rows.reduce((sum, row) => sum + row.bytes, 0);
    let next = 0;
    const lane = async (): Promise<void> => {
      for (let row = rows[next++]; row !== undefined && this.status.reason === null; row = rows[next++]) await this.file(row, base, { holds, keepAsset, ...(fetchKeep === undefined ? {} : { fetchKeep }) }, quota, contentHash, hashOwnedBytes);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, lane));
  }
  /** Each file's digest runs in the page's hash worker (the bytes go there and back); the page digests only when no
   *  worker can. Hashing every prefetched file on the page was 617 ms of Pine's grid entry at 4x CPU (G639). */
  private async file(row: Row, base: string, cache: PrefetchCache, quota: PrefetchQuota, hash: (bytes: Uint8Array) => Promise<string>,
    hashOwned: ProductOptions['hashOwned']): Promise<void> {
    if (await cache.holds(row.hash, row.bytes)) { this.status.presentFiles++; this.status.presentBytes += row.bytes; return; }
    const reservation = await quota.reserve(row.bytes);
    if (reservation === null) { this.stop('storage quota', 'quota'); return; }
    let stored = 0, release: (() => void) | undefined, bytes: Uint8Array | undefined;
    try {
      release = await this.memory.reserve(row.bytes);
      if (this.status.reason !== null) return;
      const url = new URL(row.path, base).href;
      const kept = await cache.fetchKeep?.(url, row.hash, row.bytes) ?? null;
      if (kept !== null) { if (kept) stored = row.bytes; else this.stop('content cache full', 'quota'); return; }
      bytes = await readGridPrefetch(url, row.bytes);
      let actual: string | undefined;
      if (bytes.length !== row.bytes) throw new Error('Prefetched file differs from its index');
      if (hashOwned !== undefined) {
        try { ({ hash: actual, bytes } = await hashOwned(bytes)); }
        catch { if (bytes.byteLength !== row.bytes) bytes = await readGridPrefetch(url, row.bytes); } // a failed transfer: read it again
      }
      if (bytes.length !== row.bytes || (actual ?? await hash(bytes)) !== row.hash) throw new Error('Prefetched file differs from its index');
      if (await cache.keepAsset(row.hash, bytes)) stored = bytes.length; else this.stop('content cache full', 'quota');
    } finally { bytes = undefined; release?.(); reservation.finish(stored); }
    if (stored > 0) { this.status.storedFiles++; this.status.storedBytes += stored; }
  }
}

declare global { interface Window { __ws_gridPrefetch?: () => GridPrefetchStatus | null } }
let current: GridPrefetch | null = null;
/** Start (or re-prioritize) the page's one whole-set prefetch; it runs on its own and never throws into the caller. */
export function startGridPrefetch(slugs: readonly string[]): void {
  if (typeof caches === 'undefined' || !('storage' in navigator)) return;
  const running = current;
  if (running !== null) { running.prioritize(slugs); return; }
  const run = new GridPrefetch(); current = run; run.prioritize(slugs);
  window.__ws_gridPrefetch = gridPrefetchStatus; // captures and the bench read the counts
  void (async (): Promise<void> => {
    try { await run.run(); }
    catch (error: unknown) { run.stop(error instanceof Error ? error.message : String(error), 'error'); console.warn('[grid prefetch] stopped', error); }
  })();
}
/** The run's counts (null before any start): for the loading screen's download line and captures. */
export function gridPrefetchStatus(): GridPrefetchStatus | null { return current?.snapshot() ?? null; }
