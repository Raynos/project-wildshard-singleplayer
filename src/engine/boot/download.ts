/** Actual page transport, independent of legacy step-completion credits. */
export interface DownloadSnapshot {
  networkBytes: number; cachedBytes: number; pendingBytes: number;
  filesDone: number; filesTotal: number; unclassifiedBytes: number;
}
interface File { bytes: number; complete: boolean }
export interface DownloadTiming {
  name: string; startTime: number; transferSize: number; encodedBodySize: number;
  workerStart: number; serverTiming: readonly { name: string; duration: number }[];
  responseEnd?: number; source?: 'worker';
}
/** One loading attempt owns its declarations and receipts; no body tees or retained payloads. */
export class DownloadAccounting {
  private readonly files = new Map<string, File>();
  private readonly seen = new Set<string>();
  private readonly received = new Set<string>();
  private readonly cache = new Map<string, number>();
  private readonly addressed = new Map<string, Set<File>>();
  private network = 0;
  private browserCache = 0;
  private unknown = 0;
  private completed = 0;
  private activity = 0;
  /** Body-read activity is a stall signal, never a network byte credit. */
  noteRead(bytes: number): void { if (bytes > 0) this.activity++; }
  get progressVersion(): number { return this.activity; }
  private readonly base: string;
  private readonly since: number;
  constructor(base: string, since = 0) { this.base = base; this.since = since; }
  private url(input: string): string { const url = new URL(input, this.base); url.search = ''; url.hash = ''; return url.href; }
  /** Declare only files this path will read; product callers supply exact index sizes. */
  declare(input: string, bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid download declaration');
    const key = this.url(input), file = this.files.get(key);
    if (file !== undefined) { file.bytes = Math.max(file.bytes, bytes); return; }
    const hash = /[a-f0-9]{64}/u.exec(key)?.[0];
    const declared = { bytes, complete: this.received.has(key) || (hash !== undefined && this.cache.has(hash)) };
    this.files.set(key, declared);
    if (hash !== undefined) {
      let addresses = this.addressed.get(hash);
      if (addresses === undefined) { addresses = new Set(); this.addressed.set(hash, addresses); }
      addresses.add(declared);
    }
  }
  /** Verified disk reads are separate from network receipts and credited once per immutable address. */
  cached(key: string, bytes: number, url?: string): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid cached byte receipt');
    this.cache.set(key, Math.max(this.cache.get(key) ?? 0, bytes));
    this.activity++;
    for (const file of this.addressed.get(key) ?? []) file.complete = true;
    if (url !== undefined) {
      this.declare(url, bytes);
      const file = this.files.get(this.url(url)); if (file !== undefined) file.complete = true;
    }
  }
  /** Resource Timing covers modules, images, fonts and undeclared fetches, including early buffered entries. */
  resource(entry: DownloadTiming): void {
    if ((entry.responseEnd ?? entry.startTime) < this.since || !/^https?:/u.test(entry.name)) return;
    // The synthetic page response is the same file: only its worker receipt
    // owns transport bytes and file completion, including an HTTP-cache hit.
    if (entry.serverTiming.some(timing => timing.name === 'ws-receipt')) return;
    const id = `${entry.source ?? 'page'}:${entry.name}:${entry.startTime}`; if (this.seen.has(id)) return;
    this.seen.add(id); this.completed++;
    this.received.add(this.url(entry.name));
    const file = this.files.get(this.url(entry.name)); if (file !== undefined) file.complete = true;
    const hit = entry.serverTiming.some(timing => timing.name === 'ws-cache');
    if (hit) {
      const bytes = entry.serverTiming.find(timing => timing.name === 'ws-cache')?.duration ?? 0;
      this.browserCache += bytes > 0 ? bytes : entry.encodedBodySize;
    }
    else if (entry.workerStart === 0 && entry.transferSize === 0) this.browserCache += entry.encodedBodySize;
    else if (entry.transferSize > 0) this.network += entry.transferSize;
    else if (entry.serverTiming.some(timing => timing.name === 'ws-network')) {
      const receipt = entry.serverTiming.find(timing => timing.name === 'ws-network');
      this.network += receipt !== undefined && receipt.duration > 0 ? receipt.duration : entry.encodedBodySize;
    }
    else this.unknown += entry.encodedBodySize;
  }
  snapshot(): DownloadSnapshot {
    let pendingBytes = 0, pendingFiles = 0, cachedBytes = this.browserCache;
    for (const file of this.files.values()) if (!file.complete) { pendingBytes += file.bytes; pendingFiles++; }
    for (const bytes of this.cache.values()) cachedBytes += bytes;
    return { networkBytes: this.network, cachedBytes, pendingBytes, filesDone: this.completed + this.cache.size,
      filesTotal: this.completed + this.cache.size + pendingFiles, unclassifiedBytes: this.unknown };
  }
}
let active: DownloadAccounting | undefined;
const observers = new Set<DownloadAccounting>();
let installed = false;
const earlyWorker: DownloadTiming[] = [];
function accountingTargets(visit: (accounting: DownloadAccounting) => void): void {
  if (active !== undefined) visit(active);
  for (const accounting of observers) if (accounting !== active) visit(accounting);
}
/** Validate worker transport batches before converting their monotonic clock to this page. */
export function receiveWorkerDownloads(value: unknown, pageOrigin: number): void {
  if (typeof value !== 'object' || value === null || !('type' in value) || value.type !== 'WS_WORKER_DOWNLOAD'
    || !('origin' in value) || typeof value.origin !== 'number' || !('timings' in value) || !Array.isArray(value.timings)) return;
  for (const timing of value.timings) receiveWorkerTiming(timing, value.origin - pageOrigin);
}
function receiveWorkerTiming(timing: unknown, offset: number): void {
  if (typeof timing !== 'object' || timing === null || !('name' in timing) || typeof timing.name !== 'string'
    || !('startTime' in timing) || typeof timing.startTime !== 'number'
    || !('responseEnd' in timing) || typeof timing.responseEnd !== 'number'
    || !('transferSize' in timing) || typeof timing.transferSize !== 'number'
    || !('encodedBodySize' in timing) || typeof timing.encodedBodySize !== 'number') return;
  if (offset + timing.responseEnd < 0) return;
  const receipt: DownloadTiming = { name: timing.name, startTime: offset + timing.startTime,
    responseEnd: offset + timing.responseEnd, transferSize: timing.transferSize,
    encodedBodySize: timing.encodedBodySize, workerStart: 0, serverTiming: [], source: 'worker' };
  if (active === undefined && observers.size === 0) { if (!installed) earlyWorker.push(receipt); }
  else accountingTargets(accounting => { accounting.resource(receipt); });
}
/** Explicitly install the active attempt, and restore only while this instance still owns the slot. */
export function installDownloadAccounting(accounting: DownloadAccounting): () => void {
  active = accounting; installed = true;
  for (const receipt of earlyWorker) accounting.resource(receipt);
  earlyWorker.length = 0;
  return () => { if (active === accounting) active = undefined; };
}
export function currentDownloadAccounting(): DownloadAccounting | undefined { return active; }

/** Observe page activity for a disposable mid-play panel without replacing the boot's accounting.
 * The observer's own start time excludes previous completed Resource Timing receipts. */
export function observeDownloadAccounting(accounting: DownloadAccounting): () => void {
  observers.add(accounting);
  return () => { observers.delete(accounting); };
}

/** Expected wire size for a file this path will read; product indexes supply exact sizes. */
export function declareDownloadFile(url: string, bytes: number): void { accountingTargets(accounting => { accounting.declare(url, bytes); }); }
/** Verified immutable cache reads stay separate from downloaded bytes. */
export function recordCachedDownload(key: string, bytes: number, url?: string): void { accountingTargets(accounting => { accounting.cached(key, bytes, url); }); }
/** Actual body reads reset the stall timer without mislabelling decoded bytes as network transport. */
export function noteDownloadRead(bytes: number): void { accountingTargets(accounting => { accounting.noteRead(bytes); }); }

