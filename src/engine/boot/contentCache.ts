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
  /** Optional lifecycle listener; installed only while read ages are dirty, removed after a flush. */
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
  private index: Record<string, Entry> = {};
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
  constructor(ports: ContentCachePorts) {
    this.ports = ports; this.root = new URL('/__ws_content__/v0/', ports.origin).href;
    this.maximum = ports.maxBytes ?? 256 * 1024 * 1024; this.entries = ports.maxEntries ?? 2048; this.reserve = ports.reserveBytes ?? 32 * 1024 * 1024;
    if (![this.maximum, this.entries, this.reserve].every((n) => Number.isSafeInteger(n) && n >= 0) || this.entries > 10000) throw new Error('Invalid content cache limits');
  }
  private key(hash: string): string { if (!address.test(hash)) throw new Error('Invalid content hash'); return new URL(hash, this.root).href; }
  private used(): number {
    const now = this.ports.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid cache clock');
    this.clock = Math.max(now, this.clock + 1); return this.clock;
  }
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const result = this.tail.then(run); this.tail = result.then(() => undefined, () => undefined); return result;
  }
  private async open(): Promise<Pick<Cache, 'match' | 'put' | 'delete' | 'keys'>> {
    if (this.cache !== undefined) return this.cache;
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
    this.clock = Object.values(this.index).reduce((latest, entry) => Math.max(latest, entry.used), this.clock);
    this.cache = cache;
    const budget = await this.budget();
    while (this.statsNow().bytes > budget || this.statsNow().entries > this.entries) if (!await this.evict(cache, '')) break;
    await this.metadata(cache); return cache;
  }
  private statsNow(): ContentCacheStats { const values = Object.values(this.index); return { entries: values.length, bytes: values.reduce((sum, entry) => sum + entry.bytes, 0) }; }
  private readAgeChanged(): void {
    this.dirty = true;
    if (this.flushTimer !== undefined) return;
    const target = this.ports.pagehide;
    if (target !== undefined) {
      this.scope.listen(target, 'pagehide', this.onPagehide);
      this.removePagehide = () => { this.scope.unlisten(target, 'pagehide', this.onPagehide); };
    }
    this.flushTimer = this.scope.timeout(2000, () => { this.flushTimer = undefined; void this.flush(); });
  }
  /** Coalesce read-age writes; explicit writes/evictions and pagehide flush without waiting for the read window. */
  flush(): Promise<void> {
    if (this.pendingFlush !== undefined) return this.pendingFlush;
    const pending = this.serial(async () => {
      if (this.dirty && this.cache !== undefined) await this.metadata(this.cache);
    });
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
    const victim = Object.entries(this.index).filter(([hash]) => hash !== except && !this.pinned.has(hash))
      .sort(([a, left], [b, right]) => left.used - right.used || (a < b ? -1 : a > b ? 1 : 0))[0];
    if (victim === undefined) return false;
    await cache.delete(this.key(victim[0])); delete this.index[victim[0]]; return true;
  }
  private async budget(): Promise<number> {
    const estimate = await this.ports.estimate?.().catch(() => undefined);
    if (estimate?.quota === undefined || !Number.isFinite(estimate.quota) || estimate.quota < 0) return this.maximum;
    const usage = estimate.usage ?? 0;
    if (!Number.isFinite(usage) || usage < 0) return this.maximum;
    return Math.max(0, Math.min(this.maximum, Math.floor(estimate.quota / 4), this.statsNow().bytes + Math.floor(estimate.quota - usage - this.reserve)));
  }
  /** Reads return owned bytes and recheck their hash; corrupt or browser-evicted entries become misses. */
  get(hash: string): Promise<Uint8Array | null> {
    const key = this.key(hash);
    return this.serial(async () => {
      const cache = await this.open().catch(() => undefined); if (cache === undefined) return null;
      const response = await cache.match(key);
      if (response === undefined) { if (this.index[hash] !== undefined) { delete this.index[hash]; await this.metadata(cache); } return null; }
      let bytes: Uint8Array;
      try { bytes = await read(response, MAX_FILE); }
      catch { await cache.delete(key); delete this.index[hash]; await this.metadata(cache); return null; }
      if (await this.ports.hash(bytes) !== hash) { await cache.delete(key); delete this.index[hash]; await this.metadata(cache); return null; }
      this.index[hash] = { bytes: bytes.length, used: this.used() }; this.readAgeChanged(); return bytes;
    });
  }
  /** Refuses mismatched bytes. Unavailable disk capacity returns false while an online load can still continue. */
  async put(hash: string, input: Uint8Array): Promise<boolean> {
    const key = this.key(hash), bytes = Uint8Array.from(input);
    if (bytes.length > MAX_FILE || await this.ports.hash(bytes) !== hash) throw new Error('Invalid immutable content bytes');
    return this.serial(async () => {
      const cache = await this.open().catch(() => undefined); if (cache === undefined) return false;
      const budget = await this.budget();
      if (bytes.length > budget || this.entries === 0) return false;
      const before = this.index[hash], used = this.used();
      while (this.statsNow().bytes - (before?.bytes ?? 0) + bytes.length > budget || this.statsNow().entries + Number(before === undefined) > this.entries) {
        if (!await this.evict(cache, hash)) { await this.metadata(cache); return false; }
      }
      for (;;) {
        try { await cache.put(key, new Response(bytes, { headers: { 'x-ws-bytes': String(bytes.length), 'x-ws-used': String(used) } })); break; }
        catch (error) {
          if (typeof error !== 'object' || error === null || !('name' in error) || error.name !== 'QuotaExceededError' || !await this.evict(cache, hash)) { await this.metadata(cache); return false; }
        }
      }
      this.index[hash] = { bytes: bytes.length, used }; await this.metadata(cache); return true;
    });
  }
  /** One network read per concurrent immutable address; offline misses never try the network. */
  async load(hash: string, download: () => Promise<Uint8Array>, offline = false): Promise<Uint8Array> {
    this.key(hash);
    const cached = await this.get(hash); if (cached !== null) return cached;
    if (offline) throw new Error('Content is unavailable offline');
    const existing = this.inflight.get(hash); if (existing !== undefined) return Uint8Array.from(await existing);
    const pending = (async () => { const bytes = Uint8Array.from(await download()); await this.put(hash, bytes); return bytes; })();
    this.inflight.set(hash, pending);
    try { return Uint8Array.from(await pending); } finally { this.inflight.delete(hash); }
  }
  /** Reference-counted leases protect active critical bytes from this cache's LRU eviction. */
  pin(hashes: Iterable<string>): () => void {
    const unique = new Set(hashes); for (const hash of unique) this.key(hash);
    for (const hash of unique) this.pinned.set(hash, (this.pinned.get(hash) ?? 0) + 1);
    let released = false;
    return () => { if (released) return; released = true; for (const hash of unique) { const remaining = (this.pinned.get(hash) ?? 1) - 1; if (remaining === 0) this.pinned.delete(hash); else this.pinned.set(hash, remaining); } };
  }
  /** Persistent disk accounting, excluding the small LRU index and all decoded render allocations. */
  stats(): Promise<ContentCacheStats> { return this.serial(async () => { await this.open(); return this.statsNow(); }); }
}
