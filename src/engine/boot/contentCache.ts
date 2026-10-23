import * as v from 'valibot';
import { Scope } from '../app/scope';

const address = /^[a-f0-9]{64}$/u;
const count = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const indexSchema = v.record(v.pipe(v.string(), v.regex(address)), v.strictObject({ bytes: count, used: count }));
type Entry = v.InferOutput<typeof indexSchema>[string];
/** Explicit persistent storage ports; constructing the cache installs no service or fetch interception. */
export interface ContentCachePorts {
  storage: { open: (name: string) => Promise<Pick<Cache, 'match' | 'put' | 'delete' | 'keys'>> };
  origin: string; hash: (bytes: Uint8Array) => Promise<string>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  maxBytes?: number; maxEntries?: number; reserveBytes?: number; now?: () => number;
  /** Optional lifecycle listener; installed only while metadata is dirty, removed after a flush. */
  pagehide?: EventTarget;
}
/** Aggregate wire bytes on disk; decoded CPU/GPU allocations belong to their session owners. */
export interface ContentCacheStats { bytes: number; entries: number }
/** Version-independent, origin-wide immutable bytes shared by every content source and visited instance. */
export const CONTENT_CACHE_NAME = 'ws-content-v0';
const MAX_FILE = 25_000_000, MAX_INDEX = 2_000_000;

async function read(response: Response, maximum: number): Promise<Uint8Array> {
  if (!response.ok) throw new Error('Unavailable cached content');
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.length; if (bytes > maximum) throw new Error('Cached content exceeds wire cap');
      chunks.push(part.value);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(bytes); let at = 0;
  for (const chunk of chunks) { result.set(chunk, at); at += chunk.length; }
  return result;
}

/** Hash-verified Cache Storage with durable LRU, quota headroom and leases for active critical content. */
export class ContentCache {
  private readonly ports: ContentCachePorts;
  private readonly root: string;
  private readonly maximum: number;
  private readonly entries: number;
  private readonly reserve: number;
  private cache: Pick<Cache, 'match' | 'put' | 'delete' | 'keys'> | undefined;
  private opening: Promise<Pick<Cache, 'match' | 'put' | 'delete' | 'keys'>> | undefined;
  private index: Record<string, Entry> = {};
  private readonly lru = new Map<string, Entry>();
  private totalBytes = 0;
  private clock = 0;
  private dirty = false;
  private readonly scope = new Scope('content-cache');
  private flushTimer: ReturnType<typeof setTimeout> | 0 | undefined;
  private readonly onPagehide = (): void => { void this.flush(); };
  private removePagehide: (() => void) | undefined;
  private pendingFlush: Promise<void> | undefined;
  private tail = Promise.resolve();
  private readonly pinned = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<Uint8Array>>();
  private readonly pendingWrites = new Set<Promise<boolean>>();
  constructor(ports: ContentCachePorts) {
    this.ports = ports; this.root = new URL('/__ws_content__/v0/', ports.origin).href;
    // G554: room for the grid's whole known set (~650 MB, ~6k files), still capped at a quarter of the origin's quota
    this.maximum = ports.maxBytes ?? 1536 * 1024 * 1024; this.entries = ports.maxEntries ?? 10_000; this.reserve = ports.reserveBytes ?? 32 * 1024 * 1024;
    if (![this.maximum, this.entries, this.reserve].every((n) => Number.isSafeInteger(n) && n >= 0) || this.entries > 10000) throw new Error('Invalid content cache limits');
  }
  private key(hash: string): string { if (!address.test(hash)) throw new Error('Invalid content hash'); return new URL(hash, this.root).href; }
  private used(): number {
    const now = this.ports.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid cache clock');
    this.clock = Math.max(now, this.clock + 1); return this.clock;
  }
  private serial<T>(run: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(run); this.tail = result.then(() => undefined, () => undefined); return result;
  }
  private open(): Promise<Pick<Cache, 'match' | 'put' | 'delete' | 'keys'>> {
    if (this.cache !== undefined) return Promise.resolve(this.cache);
    if (this.opening !== undefined) return this.opening;
    const pending = this.initialize();
    this.opening = pending;
    void pending.catch(() => { if (this.opening === pending) this.opening = undefined; });
    return pending;
  }
  private async initialize(): Promise<Pick<Cache, 'match' | 'put' | 'delete' | 'keys'>> {
    const cache = await this.ports.storage.open(CONTENT_CACHE_NAME);
    const index = await cache.match(new URL('index', this.root).href);
    if (index !== undefined) {
      try { const parsed = v.safeParse(indexSchema, JSON.parse(new TextDecoder().decode(await read(index, MAX_INDEX)))); if (parsed.success) this.index = parsed.output; }
      catch { this.index = {}; }
    }
    // Recover committed bytes if a quota failure prevented the following metadata write.
    const keys = await cache.keys(), actual = new Set<string>();
    for (const request of keys) {
      if (!request.url.startsWith(this.root)) continue;
      const hash = request.url.slice(this.root.length); if (!address.test(hash)) continue;
      actual.add(hash);
      if (this.index[hash] === undefined) {
        const response = await cache.match(request), bytes = Number(response?.headers.get('x-ws-bytes')), used = Number(response?.headers.get('x-ws-used'));
        if (response !== undefined && response.headers.has('x-ws-bytes') && response.headers.has('x-ws-used') && Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= MAX_FILE && Number.isSafeInteger(used) && used >= 0) this.index[hash] = { bytes, used };
        else { await cache.delete(request); actual.delete(hash); }
      }
    }
    for (const hash of Object.keys(this.index)) if (!actual.has(hash)) delete this.index[hash];
    // Recover durable access order once; ordinary operations maintain it in place.
    const entries = Object.entries(this.index).sort(([a, left], [b, right]) => left.used - right.used || (a < b ? -1 : a > b ? 1 : 0));
    this.lru.clear(); this.totalBytes = 0;
    for (const [hash, entry] of entries) {
      this.lru.set(hash, entry); this.totalBytes += entry.bytes;
      this.clock = Math.max(this.clock, entry.used);
    }
    const budget = await this.budget();
    while (this.statsNow().bytes > budget || this.statsNow().entries > this.entries) if (!await this.evict(cache, '')) break;
    await this.metadata(cache); this.cache = cache; return cache;
  }
  private statsNow(): ContentCacheStats { return { entries: this.lru.size, bytes: this.totalBytes }; }
  private remember(hash: string, entry: Entry): void {
    this.totalBytes += entry.bytes - (this.index[hash]?.bytes ?? 0);
    this.index[hash] = entry;
    this.lru.delete(hash); this.lru.set(hash, entry);
  }
  private forget(hash: string): void {
    const entry = this.index[hash];
    if (entry === undefined) return;
    this.totalBytes -= entry.bytes;
    delete this.index[hash]; this.lru.delete(hash);
  }
  private metadataChanged(): void {
    this.dirty = true;
    if (this.flushTimer !== undefined) return;
    const target = this.ports.pagehide;
    if (target !== undefined) {
      this.scope.listen(target, 'pagehide', this.onPagehide);
      this.removePagehide = () => { this.scope.unlisten(target, 'pagehide', this.onPagehide); };
    }
    this.flushTimer = this.scope.timeout(2000, () => { this.flushTimer = undefined; void this.flush(); });
  }
  /** Coalesce index writes; immutable blob writes remain durable before returning. Pagehide/close force the index. */
  flush(): Promise<void> {
    if (this.pendingFlush !== undefined) return this.pendingFlush;
    const pending = Promise.allSettled(this.pendingWrites).then(() => this.serial(async () => {
      if (this.dirty && this.cache !== undefined) await this.metadata(this.cache);
    }));
    this.pendingFlush = pending;
    void pending.finally(() => { if (this.pendingFlush === pending) this.pendingFlush = undefined; });
    return pending;
  }
  private async metadata(cache: Pick<Cache, 'put'>): Promise<void> {
    this.scope.cancelTimer(this.flushTimer);
    this.flushTimer = undefined;
    this.removePagehide?.(); this.removePagehide = undefined;
    this.dirty = false;
    // Asset entries carry recovery metadata. An index failure cannot turn good immutable bytes into a failed load.
    await cache.put(new URL('index', this.root).href, Response.json(this.index)).catch(() => undefined);
  }
  private async evict(cache: Pick<Cache, 'delete'>, except: string): Promise<boolean> {
    for (const hash of this.lru.keys()) {
      if (hash === except || this.pinned.has(hash)) continue;
      await cache.delete(this.key(hash)); this.forget(hash); this.metadataChanged(); return true;
    }
    return false;
  }
  private async budget(): Promise<number> {
    const estimate = await this.ports.estimate?.().catch(() => undefined);
    if (estimate?.quota === undefined || !Number.isFinite(estimate.quota) || estimate.quota < 0) return this.maximum;
    const usage = estimate.usage ?? 0;
    if (!Number.isFinite(usage) || usage < 0) return this.maximum;
    return Math.max(0, Math.min(this.maximum, Math.floor(estimate.quota / 4), this.statsNow().bytes + Math.floor(estimate.quota - usage - this.reserve)));
  }
  /** Reads bypass writes and return owned, hash-checked bytes. LRU repairs join the write queue. */
  async get(hash: string): Promise<Uint8Array | null> {
    const key = this.key(hash);
    const cache = await this.open().catch(() => undefined); if (cache === undefined) return null;
    const response = await cache.match(key);
    if (response === undefined && this.index[hash] === undefined) return null;
    let bytes: Uint8Array | undefined;
    try { if (response !== undefined) bytes = await read(response, MAX_FILE); }
    catch { bytes = undefined; }
    if (bytes === undefined || await this.ports.hash(bytes) !== hash) { this.repair(hash, cache); return null; }
    const length = bytes.length;
    void this.serial(() => {
      // An intervening eviction must not be resurrected by an older read.
      if (this.index[hash] !== undefined) { this.remember(hash, { bytes: length, used: this.used() }); this.metadataChanged(); }
    }).catch(() => undefined);
    return bytes;
  }
  private repair(hash: string, cache: Pick<Cache, 'match' | 'delete'>): void {
    void this.serial(async () => {
      // Recheck after pending writes: an old miss/corrupt response cannot erase a new durable put.
      const key = this.key(hash), response = await cache.match(key);
      if (response !== undefined) {
        try { if (await this.ports.hash(await read(response, MAX_FILE)) === hash) return; }
        catch { /* Invalid disk bytes are removed below. */ }
        await cache.delete(key);
      }
      this.forget(hash); this.metadataChanged();
    }).catch(() => undefined);
  }
  /** Refuses mismatched bytes. Unavailable disk capacity returns false while an online load can still continue.
   * `keep` (a prefetch, G554) never evicts anything to make room: it stores what fits and returns false otherwise. */
  async put(hash: string, input: Uint8Array, keep = false): Promise<boolean> {
    const key = this.key(hash), bytes = Uint8Array.from(input);
    if (bytes.length > MAX_FILE || await this.ports.hash(bytes) !== hash) throw new Error('Invalid immutable content bytes');
    return this.serial(async () => {
      const cache = await this.open().catch(() => undefined); if (cache === undefined) return false;
      const budget = await this.budget();
      if (bytes.length > budget || this.entries === 0) return false;
      const before = this.index[hash], used = this.used();
      while (this.statsNow().bytes - (before?.bytes ?? 0) + bytes.length > budget || this.statsNow().entries + Number(before === undefined) > this.entries) {
        if (keep || !await this.evict(cache, hash)) return false;
      }
      for (;;) {
        try { await cache.put(key, new Response(bytes, { headers: { 'x-ws-bytes': String(bytes.length), 'x-ws-used': String(used) } })); break; }
        catch (error) {
          if (keep || typeof error !== 'object' || error === null || !('name' in error) || error.name !== 'QuotaExceededError' || !await this.evict(cache, hash)) return false;
        }
      }
      this.remember(hash, { bytes: bytes.length, used }); this.metadataChanged(); return true;
    });
  }
  /** The index alone says the address is stored with this size: no read, no re-hash (a prefetch's skip check). */
  async holds(hash: string, bytes: number): Promise<boolean> {
    this.key(hash);
    await this.open().catch(() => undefined); return this.index[hash]?.bytes === bytes;
  }
  /** Share verified downloads through background persistence; flush awaits writes, offline misses never fetch. */
  async load(hash: string, download: () => Promise<Uint8Array>, offline = false): Promise<Uint8Array> {
    this.key(hash);
    const cached = await this.get(hash); if (cached !== null) return cached;
    if (offline) throw new Error('Content is unavailable offline');
    const existing = this.inflight.get(hash); if (existing !== undefined) return Uint8Array.from(await existing);
    const pending = (async () => {
      const bytes = Uint8Array.from(await download());
      if (bytes.length > MAX_FILE || await this.ports.hash(bytes) !== hash) throw new Error('Invalid immutable content bytes');
      return bytes;
    })();
    this.inflight.set(hash, pending);
    // Retain the shared download through persistence, but let its verified
    // response build now. A failed cache write never fails valid online bytes.
    const stored = pending.then(bytes => this.put(hash, bytes));
    this.pendingWrites.add(stored);
    const settled = (): void => { this.pendingWrites.delete(stored); this.inflight.delete(hash); };
    void stored.then(settled, settled);
    return Uint8Array.from(await pending);
  }
  /** Reference-counted leases protect active critical bytes from this cache's LRU eviction. */
  pin(hashes: Iterable<string>): () => void {
    const unique = new Set(hashes); for (const hash of unique) this.key(hash);
    for (const hash of unique) this.pinned.set(hash, (this.pinned.get(hash) ?? 0) + 1);
    let released = false;
    return () => { if (released) return; released = true; for (const hash of unique) { const remaining = (this.pinned.get(hash) ?? 1) - 1; if (remaining === 0) this.pinned.delete(hash); else this.pinned.set(hash, remaining); } };
  }
  /** Last published disk accounting; flush first to include pending mutations and read repairs. */
  async stats(): Promise<ContentCacheStats> { await this.open(); return this.statsNow(); }
}
