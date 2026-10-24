import * as v from 'valibot';
import { Scope } from '../app/scope';
import { diagnosticNow } from '../core/clock';
import type { ContentCache } from './contentCache';
import { ContentCacheQueue, isCacheRead } from './contentCacheQueue';
import { waitFor } from './waits';
import { receiveWorkerDownloads } from './download';
import { CONTENT_CACHE_WIRE_CAP, CacheCommandSchema, CachePinCommandSchema, CacheReplySchema, CacheReplyEnvelopeSchema, CacheValueSchemas, type CacheCommand, type CacheOperation, type CacheValue, type FetchedContent } from './contentCacheProtocol';

export interface CacheWorkerPort extends EventTarget {
  postMessage: (message: unknown) => void;
  terminate: () => void;
}
type Store = Pick<ContentCache, 'get' | 'holds' | 'put' | 'pin' | 'flush' | 'stats'>;
type Timer = ReturnType<Scope['timeout']>;
interface Queued { command: CacheCommand; resolve: (value: CacheValue) => void; reject: (error: Error) => void }
interface Pending extends Queued { deadline: number }
interface Lease { hashes: string[]; release?: () => void }
interface WorkerOptions { worker?: () => CacheWorkerPort; pagehide?: EventTarget; requestMs?: number; idleMs?: number; lifeMs?: number }
/** One bounded worker owns disk IO while alive. Failure terminates it before
 * requests replay through one shared, SHA-verifying existing cache instance.
 * A planned retirement (idle, lifetime, pagehide) only ends that worker: the
 * next request starts a fresh one. */
export class ContentCacheWorker {
  private readonly scope = new Scope('content-cache-worker');
  /** The current worker's listeners and timers, replaced with each worker. */
  private life = new Scope('content-cache-worker-life');
  private worker: CacheWorkerPort | undefined;
  private failed = false;
  private sequence = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly deferred = new Map<number, Queued>();
  private pumping = false;
  private deadline: Timer | undefined;
  private wakeAt = Infinity;
  private readonly leases = new Map<number, Lease>();
  /** Leases whose pin the current worker was sent. */
  private readonly pinned = new Set<number>();
  private idle: Timer | undefined;
  private closing: Promise<void> | undefined;
  private readonly fallbackQueue = new ContentCacheQueue();
  private readonly requestMs: number;
  private readonly idleMs: number;
  private readonly lifeMs: number;
  private readonly fallback: Store;
  private readonly options: WorkerOptions;
  constructor(fallback: Store, options: WorkerOptions = {}) {
    this.fallback = fallback; this.options = options;
    this.requestMs = options.requestMs ?? 15_000; this.idleMs = options.idleMs ?? 30_000; this.lifeMs = options.lifeMs ?? 120_000;
    if (![this.requestMs, this.idleMs, this.lifeMs].every(value => Number.isFinite(value) && value > 0 && value <= 300_000)) throw new Error('Invalid cache worker deadlines');
    if (options.pagehide !== undefined) this.scope.listen(options.pagehide, 'pagehide', () => { void this.close(); });
  }
  private start(): void {
    if (this.worker !== undefined || this.failed) return;
    try {
      const worker = this.options.worker?.() ?? new Worker(new URL('contentCache.worker.ts', import.meta.url), { type: 'module', name: 'content-cache' });
      this.worker = worker;
      this.life.listen(worker, 'message', event => { this.receive(event); });
      this.life.listen(worker, 'error', () => { this.failover('worker error'); });
      this.life.listen(worker, 'messageerror', () => { this.failover('message error'); });
      this.life.timeout(this.lifeMs, () => { void this.close(); });
    } catch { this.failover('worker start'); }
  }
  /** A planned close finished: this worker goes. Reads it still holds (posted while it closed) and lease pins return to
   *  the queue for the next worker, which the next request (or that queue) starts. Until G639 this failed the cache over
   *  to the page thread for the rest of the session, from 30 s idle or 2 min of play on. */
  private retire(): void {
    if (this.failed) return;
    this.worker?.terminate(); this.worker = undefined;
    this.life.dispose(); this.life = new Scope('content-cache-worker-life'); this.idle = undefined;
    this.deadline = undefined; this.wakeAt = Infinity;
    const queued: [number, Queued][] = [...this.pending].map(([id, { command, resolve, reject }]) => [id, { command, resolve, reject }]);
    queued.push(...this.deferred); this.pending.clear(); this.deferred.clear();
    // The successor holds every lease the old worker held before any queued write can evict its bytes.
    const requeued = new Set(queued.flatMap(([, row]) => row.command.op === 'pin' ? [row.command.lease] : []));
    for (const lease of this.pinned) {
      const owned = this.leases.get(lease); if (owned === undefined || requeued.has(lease)) continue;
      const id = ++this.sequence, command = v.parse(CacheCommandSchema, { id, op: 'pin', lease, hashes: owned.hashes });
      this.deferred.set(id, { command, resolve: () => undefined, reject: () => { this.failover('pin refused'); } });
    }
    this.pinned.clear();
    for (const [id, row] of queued) this.deferred.set(id, row);
    this.closing = undefined;
    // Re-pins alone wait for the next request: a held lease must not keep restarting idle workers.
    if (queued.length > 0) { this.start(); this.pump(); }
  }
  private async onFallback(operation: CacheOperation): Promise<CacheValue> {
    switch (operation.op) {
      case 'get': return this.fallback.get(operation.hash);
      case 'has': { const bytes = await this.fallback.get(operation.hash); return bytes !== null && bytes.length === operation.bytes; }
      case 'holds': return this.fallback.holds(operation.hash, operation.bytes);
      case 'put': return this.fallback.put(operation.hash, operation.bytes, operation.keep === true);
      case 'stats': return this.fallback.stats();
      case 'flush': await this.fallback.flush(); return null;
      case 'pin': {
        const lease = this.leases.get(operation.lease);
        if (lease !== undefined && lease.release === undefined) lease.release = this.fallback.pin(lease.hashes);
        return null;
      }
      case 'release': {
        this.leases.get(operation.lease)?.release?.(); this.leases.delete(operation.lease);
        return null;
      }
      case 'fetch': return null; // the caller reads it on the page
      default: throw new Error('Unknown cache operation');
    }
  }
  private queueFallback(operation: CacheOperation): Promise<CacheValue> {
    return this.fallbackQueue.run(operation.op, () => this.onFallback(operation));
  }
  /** The worker is given up for the session: every later read, hash check and write runs on the page thread. A failure's
   *  `reason` is logged once (G639: a phone-4x drive's reads ran on the page thread, 0.85 ms a frame, with no cause on
   *  record); a planned retirement (idle or life close) is not a failure and goes through `retire` instead. */
  private failover(reason: string): void {
    if (this.failed) return;
    console.warn(`[content cache] worker failed over to the page thread: ${reason}`);
    this.failed = true; this.worker?.terminate(); this.worker = undefined;
    this.life.dispose(); this.scope.dispose(); this.deadline = undefined; this.wakeAt = Infinity;
    // Install every still-live lease before any replay can evict disk bytes.
    for (const lease of this.leases.values()) lease.release = this.fallback.pin(lease.hashes);
    const pending = [...this.pending.values(), ...this.deferred.values()];
    this.pending.clear(); this.deferred.clear();
    for (const row of pending) void this.settleFallback(row);
  }
  private async settleFallback(row: Queued): Promise<void> {
    try { row.resolve(await this.queueFallback(row.command)); }
    catch (error: unknown) { row.reject(error instanceof Error ? error : new Error(String(error))); }
  }
  private receive(event: Event): void {
    if (!(event instanceof MessageEvent)) { this.failover('not a message'); return; }
    const reply = v.safeParse(CacheReplyEnvelopeSchema, event.data);
    if (!reply.success) { this.failover('invalid reply'); return; }
    const row = this.pending.get(reply.output.id);
    if (row === undefined) { this.failover(v.safeParse(CacheReplySchema, event.data).success ? 'unknown reply' : 'invalid reply'); return; }
    const value = reply.output.ok ? v.safeParse(CacheValueSchemas[row.command.op], reply.output.value) : undefined;
    if (value !== undefined && !value.success) {
      this.failover(v.safeParse(CacheReplySchema, event.data).success ? `invalid ${row.command.op} value` : 'invalid reply'); return;
    }
    this.pending.delete(reply.output.id);
    if (value?.success === true) {
      if (row.command.op === 'release') { this.leases.delete(row.command.lease); this.pinned.delete(row.command.lease); }
      row.resolve(value.output);
    }
    else if (!reply.output.ok) row.reject(new Error(reply.output.error)); // A verified refusal is not an infrastructure failure.
    this.pump();
    if (this.pending.size === 0) { this.life.cancelTimer(this.deadline); this.deadline = undefined; this.wakeAt = Infinity; }
    if (this.pending.size === 0 && this.deferred.size === 0 && this.closing === undefined) {
      this.life.cancelTimer(this.idle);
      this.idle = this.life.timeout(this.idleMs, () => { void this.close(); });
    }
  }
  /** One wakeup watches posted deadlines. Completed rows leave the map; later deadlines need no fresh timer until it wakes. */
  private watchDeadline(at: number): void {
    if (at >= this.wakeAt) return;
    this.life.cancelTimer(this.deadline); this.wakeAt = at;
    this.deadline = this.life.timeout(Math.max(0, at - diagnosticNow()), () => {
      this.deadline = undefined; this.wakeAt = Infinity;
      // A native timer may round its delay down; its scheduled boundary is due when it fires.
      const now = Math.max(at, diagnosticNow()); let next: Pending | undefined;
      for (const row of this.pending.values()) if (next === undefined || row.deadline < next.deadline) next = row;
      if (next === undefined) return;
      if (next.deadline <= now) {
        const ms = next.command.op === 'fetch' ? this.requestMs * 8 : this.requestMs;
        this.failover(`${next.command.op} took over ${String(ms)} ms`);
      } else this.watchDeadline(next.deadline);
    });
  }
  /** `background` work (a prefetch, G554) is not a boot wait: the loading screen's "now waiting for" never names it. */
  private request(operation: CacheOperation, background = false): Promise<CacheValue> {
    if (background) return this.requestWork(operation);
    return waitFor(`Content cache ${operation.op}${'hash' in operation ? ` ${operation.hash.slice(0, 12)}` : ''}`, this.requestWork(operation), 'worker');
  }
  private requestWork(operation: CacheOperation): Promise<CacheValue> {
    const id = ++this.sequence, command = v.parse(CacheCommandSchema, { id, ...operation });
    return this.requestChecked(command);
  }
  /** Only private commands that already passed the defining schema enter here. */
  private requestChecked(command: CacheCommand): Promise<CacheValue> {
    // Writes wait for a closing worker's drain, then go to its successor (or, after a failure, the page).
    if (this.closing !== undefined && !isCacheRead(command.op)) return this.closing.then(() => this.failed ? this.queueFallback(command) : this.post(command));
    return this.post(command);
  }
  private post(command: CacheCommand): Promise<CacheValue> {
    this.start();
    if (this.failed) return this.queueFallback(command);
    this.life.cancelTimer(this.idle);
    const id = command.id;
    return new Promise((resolve, reject) => {
      this.deferred.set(id, { command, resolve, reject });
      this.pump();
    });
  }
  private pump(): void {
    if (this.pumping || this.failed || this.worker === undefined || this.deferred.size === 0) return;
    const send = this.worker.postMessage.bind(this.worker);
    this.pumping = true;
    // Reserve one posted slot for reads so a full prefetch backlog cannot hide the worker's read bypass. Counted once a
    // pump: re-counting the posted writes for every queued row was ~200 ms of a phone-4x Nine drive.
    let writes = 0;
    for (const row of this.pending.values()) if (!isCacheRead(row.command.op)) writes++;
    try {
      for (const [id, row] of this.deferred) {
        if (this.pending.size >= 64) break;
        const read = isCacheRead(row.command.op);
        if (!read && writes >= 63) continue;
        this.deferred.delete(id);
        if (!read) writes++;
        // Queue time consumes no request deadline; only posted worker work does. A network read gets longer.
        const ms = row.command.op === 'fetch' ? this.requestMs * 8 : this.requestMs;
        const deadline = diagnosticNow() + ms;
        this.pending.set(id, { ...row, deadline }); this.watchDeadline(deadline);
        if (row.command.op === 'pin') this.pinned.add(row.command.lease);
        try { send(row.command); } catch { this.failover('post failed'); }
      }
    } finally { this.pumping = false; }
  }
  async get(hash: string): Promise<Uint8Array | null> {
    const value = await this.request({ op: 'get', hash });
    if (value === null || value instanceof Uint8Array) return value;
    throw new Error('Invalid cache read result');
  }
  async has(hash: string, bytes: number): Promise<boolean> {
    const value = await this.request({ op: 'has', hash, bytes });
    if (typeof value === 'boolean') return value;
    throw new Error('Invalid cache presence result');
  }
  /** Index-only presence (a prefetch's skip check), off the boot waits. */
  async holds(hash: string, bytes: number): Promise<boolean> {
    const value = await this.request({ op: 'holds', hash, bytes }, true);
    if (typeof value === 'boolean') return value;
    throw new Error('Invalid cache presence result');
  }
  /** `keep`: a prefetch write that never evicts. `background`: ordinary persistence outside boot waits. */
  async put(hash: string, input: Uint8Array, keep = false, background = false): Promise<boolean> {
    // Snapshot before any await, and never transfer/detach caller-owned data.
    if (input.length > CONTENT_CACHE_WIRE_CAP) throw new Error('Invalid immutable content bytes');
    const bytes = Uint8Array.from(input), value = await this.request({ op: 'put', hash, bytes, ...(keep ? { keep } : {}) }, keep || background);
    if (typeof value === 'boolean') return value;
    throw new Error('Invalid cache write result');
  }
  /** Read `url` (exactly `bytes` long, SHA-256 `hash`) in the worker: it streams, verifies and stores the file, then
   *  transfers the body (`reply: 'bytes'`) or only says whether it was stored. The page reads no stream, hashes nothing and
   *  copies nothing. `urlCache`: try the URL cache first, as the page's verified transport does. Null once the worker has
   *  failed over: the caller reads it on the page. */
  async fetchVerified(url: string, hash: string, bytes: number, options: { reply: 'bytes' | 'stored'; keep?: boolean; urlCache?: boolean }): Promise<FetchedContent | null> {
    if (this.failed) return null;
    const value = await this.request({ op: 'fetch', url, hash, bytes, reply: options.reply,
      ...(options.keep === true ? { keep: true } : {}), ...(options.urlCache === true ? { urlCache: true } : {}) }, true);
    if (value === null) return null;
    if (typeof value !== 'object' || !('fetched' in value) || (options.reply === 'bytes' && value.fetched?.length !== bytes)) throw new Error('Invalid cache read result');
    if (value.timing !== null) receiveWorkerDownloads({ type: 'WS_WORKER_DOWNLOAD', origin: value.origin, timings: [value.timing] }, performance.timeOrigin);
    return value;
  }
  pin(hashes: Iterable<string>): () => void {
    const rows = [...new Set(hashes)], lease = ++this.sequence;
    const checked = v.parse(CachePinCommandSchema, { id: lease, op: 'pin', lease, hashes: rows });
    const owned: Lease = { hashes: checked.hashes }; this.leases.set(lease, owned);
    // Keep the original separate request ID and its exact defining bound. The
    // detached hashes just passed admission; do not copy/validate them again.
    const command = { ...checked, id: v.parse(CachePinCommandSchema.entries.id, ++this.sequence) };
    void waitFor('Content cache pin', this.requestChecked(command), 'worker').catch(() => { this.failover('pin refused'); });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      void this.request({ op: 'release', lease }).catch(() => { this.failover('release refused'); });
    };
  }
  async stats(): Promise<{ bytes: number; entries: number }> {
    const value = await this.request({ op: 'stats' });
    if (typeof value === 'object' && value !== null && !(value instanceof Uint8Array) && !('fetched' in value)) return value;
    throw new Error('Invalid cache accounting result');
  }
  async flush(): Promise<void> { await this.request({ op: 'flush' }); }
  /** Drain and flush before bounded idle/lifetime/pagehide termination. Failed
   * workers and deadlines settle through the existing checked fallback. */
  close(): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    if (this.worker === undefined) return this.failed ? this.queueFallback({ op: 'flush' }).then(() => undefined) : Promise.resolve();
    // The FIFO flush may wait behind deferred work, but shutdown retains its
    // existing request deadline even before that flush reaches a posted slot.
    const deadline = this.scope.timeout(this.requestMs, () => { this.failover('close took too long'); });
    const finish = this.request({ op: 'flush' });
    const retire = (): void => { this.scope.cancelTimer(deadline); this.retire(); };
    this.closing = finish.then(retire, retire);
    return this.closing;
  }
}
