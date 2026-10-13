import * as v from 'valibot';
import { Scope } from '../app/scope';
import type { ContentCache } from './contentCache';
import { CONTENT_CACHE_WIRE_CAP, CacheCommandSchema, CacheReplySchema, validCacheValue, type CacheOperation, type CacheValue } from './contentCacheProtocol';

export interface CacheWorkerPort extends EventTarget {
  postMessage: (message: unknown) => void;
  terminate: () => void;
}
type Store = Pick<ContentCache, 'get' | 'put' | 'pin' | 'flush' | 'stats'>;
type Timer = ReturnType<Scope['timeout']>;
interface Pending { operation: CacheOperation; resolve: (value: CacheValue) => void; reject: (error: Error) => void; timer: Timer }
interface Lease { hashes: string[]; release?: () => void }
interface WorkerOptions { worker?: () => CacheWorkerPort; pagehide?: EventTarget; requestMs?: number; idleMs?: number; lifeMs?: number }
/** One bounded worker owns disk IO while alive. Failure terminates it before
 * requests replay through one shared, SHA-verifying existing cache instance. */
export class ContentCacheWorker {
  private readonly scope = new Scope('content-cache-worker');
  private worker: CacheWorkerPort | undefined;
  private failed = false;
  private sequence = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly leases = new Map<number, Lease>();
  private idle: Timer | undefined;
  private closing: Promise<void> | undefined;
  private fallbackTail = Promise.resolve();
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
      this.scope.listen(worker, 'message', event => { this.receive(event); });
      this.scope.listen(worker, 'error', () => { this.failover(); });
      this.scope.listen(worker, 'messageerror', () => { this.failover(); });
      this.scope.timeout(this.lifeMs, () => { void this.close(); });
    } catch { this.failover(); }
  }
  private async onFallback(operation: CacheOperation): Promise<CacheValue> {
    switch (operation.op) {
      case 'get': return this.fallback.get(operation.hash);
      case 'has': { const bytes = await this.fallback.get(operation.hash); return bytes !== null && bytes.length === operation.bytes; }
      case 'put': return this.fallback.put(operation.hash, operation.bytes);
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
      default: throw new Error('Unknown cache operation');
    }
  }
  private queueFallback(operation: CacheOperation): Promise<CacheValue> {
    const result = this.fallbackTail.then(() => this.onFallback(operation));
    // A refused write must not prevent subsequent checked operations.
    this.fallbackTail = result.then(() => undefined, () => undefined);
    return result;
  }
  private failover(): void {
    if (this.failed) return;
    this.failed = true; this.worker?.terminate(); this.worker = undefined;
    this.scope.dispose();
    // Install every still-live lease before any replay can evict disk bytes.
    for (const lease of this.leases.values()) lease.release = this.fallback.pin(lease.hashes);
    const pending = [...this.pending.values()]; this.pending.clear();
    for (const row of pending) void this.settleFallback(row);
  }
  private async settleFallback(row: Pending): Promise<void> {
    try { row.resolve(await this.queueFallback(row.operation)); }
    catch (error: unknown) { row.reject(error instanceof Error ? error : new Error(String(error))); }
  }
  private receive(event: Event): void {
    if (!(event instanceof MessageEvent)) { this.failover(); return; }
    const reply = v.safeParse(CacheReplySchema, event.data);
    if (!reply.success) { this.failover(); return; }
    const row = this.pending.get(reply.output.id);
    if (row === undefined) { this.failover(); return; }
    if (reply.output.ok && !validCacheValue(row.operation.op, reply.output.value)) { this.failover(); return; }
    this.scope.cancelTimer(row.timer); this.pending.delete(reply.output.id);
    if (reply.output.ok) {
      if (row.operation.op === 'release') this.leases.delete(row.operation.lease);
      row.resolve(reply.output.value);
    }
    else row.reject(new Error(reply.output.error)); // A verified refusal is not an infrastructure failure.
    if (this.pending.size === 0 && this.closing === undefined) {
      this.scope.cancelTimer(this.idle);
      this.idle = this.scope.timeout(this.idleMs, () => { void this.close(); });
    }
  }
  private request(operation: CacheOperation): Promise<CacheValue> {
    if (this.closing !== undefined) return this.closing.then(() => this.queueFallback(operation));
    this.start();
    if (this.failed) return this.queueFallback(operation);
    if (this.pending.size >= 64) { this.failover(); return this.queueFallback(operation); }
    this.scope.cancelTimer(this.idle);
    const id = ++this.sequence, command = v.parse(CacheCommandSchema, { id, ...operation });
    return new Promise((resolve, reject) => {
      const timer = this.scope.timeout(this.requestMs, () => { this.failover(); });
      this.pending.set(id, { operation, resolve, reject, timer });
      try { this.worker?.postMessage(command); } catch { this.failover(); }
    });
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
  async put(hash: string, input: Uint8Array): Promise<boolean> {
    // Snapshot before any await, and never transfer/detach caller-owned data.
    if (input.length > CONTENT_CACHE_WIRE_CAP) throw new Error('Invalid immutable content bytes');
    const bytes = Uint8Array.from(input), value = await this.request({ op: 'put', hash, bytes });
    if (typeof value === 'boolean') return value;
    throw new Error('Invalid cache write result');
  }
  pin(hashes: Iterable<string>): () => void {
    const rows = [...new Set(hashes)], lease = ++this.sequence;
    v.parse(CacheCommandSchema, { id: lease, op: 'pin', lease, hashes: rows });
    const owned: Lease = { hashes: rows }; this.leases.set(lease, owned);
    void this.request({ op: 'pin', lease, hashes: rows }).catch(() => { this.failover(); });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      void this.request({ op: 'release', lease }).catch(() => { this.failover(); });
    };
  }
  async stats(): Promise<{ bytes: number; entries: number }> {
    const value = await this.request({ op: 'stats' });
    if (typeof value === 'object' && value !== null && !(value instanceof Uint8Array)) return value;
    throw new Error('Invalid cache accounting result');
  }
  async flush(): Promise<void> { await this.request({ op: 'flush' }); }
  /** Drain and flush before bounded idle/lifetime/pagehide termination. Failed
   * workers and deadlines settle through the existing checked fallback. */
  close(): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    if (this.worker === undefined) { this.failover(); this.closing = this.queueFallback({ op: 'flush' }).then(() => undefined); return this.closing; }
    const finish = this.request({ op: 'flush' });
    this.closing = finish.then(() => { this.failover(); return undefined; }, () => { this.failover(); return undefined; });
    return this.closing;
  }
}
