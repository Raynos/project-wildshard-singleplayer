/** Actual page transport, independent of legacy step-completion credits. */
export interface DownloadSnapshot {
  networkBytes: number; cachedBytes: number; pendingBytes: number;
  filesDone: number; filesTotal: number; unclassifiedBytes: number;
}
interface File { bytes: number; complete: boolean }
export interface DownloadTiming {
  name: string; startTime: number; transferSize: number; encodedBodySize: number;
  workerStart: number; serverTiming: readonly { name: string; duration: number }[];
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
    if (entry.startTime < this.since || !/^https?:/u.test(entry.name)) return;
    const id = `${entry.name}:${entry.startTime}`; if (this.seen.has(id)) return;
    this.seen.add(id); this.completed++;
    this.received.add(this.url(entry.name));
    const file = this.files.get(this.url(entry.name)); if (file !== undefined) file.complete = true;
    const hit = entry.serverTiming.some(timing => timing.name === 'ws-cache');
    if (hit || (entry.workerStart === 0 && entry.transferSize === 0)) this.browserCache += entry.encodedBodySize;
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
/** Explicitly install the active attempt, and restore only while this instance still owns the slot. */
export function installDownloadAccounting(accounting: DownloadAccounting): () => void {
  active = accounting;
  return () => { if (active === accounting) active = undefined; };
}
export function currentDownloadAccounting(): DownloadAccounting | undefined { return active; }
