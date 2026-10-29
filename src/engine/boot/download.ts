import { diagnosticNow } from '../core/clock';

export type LoadingWaitKind = 'work' | 'file' | 'admission' | 'worker' | 'wasm' | 'shader';
/** One live operation, from first HTML through runtime adoption. Bytes describe
 * observed activity only; they never credit the verified download ledger. */
export interface LoadingWaitEntry {
  id: number; label: string; kind: LoadingWaitKind; step: string | null; owner: symbol | null;
  startedAt: number; progressAt: number; loadedBytes: number; totalBytes: number | null;
  deadlineMs: number; retry: (() => void) | null; progress: string; inline: boolean;
  /** Exact transport identity for diagnostics; never the human work caption. */
  resource?: string;
}
export interface LoadingWaitState { version: 1; sequence: number; pending: Map<number, LoadingWaitEntry> }
const loadingWaitKey = Symbol.for('engine.loading.waits.v1');
function isLoadingWaitState(value: unknown): value is LoadingWaitState {
  return typeof value === 'object' && value !== null && 'version' in value && value.version === 1
    && 'sequence' in value && typeof value.sequence === 'number' && Number.isSafeInteger(value.sequence)
    && 'pending' in value && Object.prototype.toString.call(value.pending) === '[object Map]';
}
/** The first-document script installs this exact data contract. Bare harnesses
 * create it on first use; importing the module installs no service. */
export function loadingWaitState(target: object = typeof document === 'undefined' ? globalThis : document): LoadingWaitState {
  const value: unknown = Reflect.get(target, loadingWaitKey);
  if (value !== undefined) {
    if (!isLoadingWaitState(value)) throw new Error('Invalid loading wait registry');
    return value;
  }
  const state: LoadingWaitState = { version: 1, sequence: 0, pending: new Map() };
  Reflect.set(target, loadingWaitKey, state); return state;
}
export type LoadingWaitOptions = Partial<Pick<LoadingWaitEntry, 'kind' | 'step' | 'owner' | 'startedAt' | 'progressAt' | 'loadedBytes' | 'totalBytes' | 'deadlineMs' | 'retry' | 'inline' | 'resource'>>;
/** Register already-started work without changing its lifetime or concurrency. */
export function beginLoadingWait(label: string, options: LoadingWaitOptions = {}): number {
  const state = loadingWaitState(), id = ++state.sequence, now = diagnosticNow();
  state.pending.set(id, { id, label, kind: options.kind ?? 'work', step: options.step ?? null, owner: options.owner ?? null,
    startedAt: options.startedAt ?? now, progressAt: options.progressAt ?? now, loadedBytes: options.loadedBytes ?? 0,
    totalBytes: options.totalBytes ?? null, deadlineMs: options.deadlineMs ?? 8000, retry: options.retry === undefined
      ? typeof location === 'undefined' ? null : () => { location.reload(); } : options.retry,
    progress: '', inline: options.inline ?? false, ...(options.resource === undefined ? {} : {resource: options.resource}) });
  return id;
}
/** Only real byte growth or a semantic progress-key change renews the deadline. */
export function reportLoadingWait(id: number, update: Partial<Pick<LoadingWaitEntry, 'label' | 'loadedBytes' | 'totalBytes' | 'progress' | 'owner' | 'step'>>, now: number = diagnosticNow()): void {
  const row = loadingWaitState().pending.get(id); if (row === undefined) return;
  if ((update.loadedBytes !== undefined && update.loadedBytes > row.loadedBytes)
    || (update.progress !== undefined && row.progress !== '' && update.progress !== row.progress)) row.progressAt = now;
  Object.assign(row, update);
}
export function finishLoadingWait(id: number): void { loadingWaitState().pending.delete(id); }
/** Adopt the same inline fallback and bind early promises to the real attempt.
 * Neither adoption nor a new renderer resets any pending operation's clock. */
export function adoptLoadingWait(root: HTMLElement, owner: symbol, step: string | null): number {
  const state = loadingWaitState(), previous = Number(root.dataset['loadingWaitId']);
  const row = state.pending.get(previous);
  const id = row?.inline === true ? previous : beginLoadingWait('Application modules');
  const adopted = state.pending.get(id);
  if (adopted === undefined) throw new Error('Missing adopted loading wait');
  adopted.inline = false; adopted.owner = owner; adopted.step = step; adopted.progress = '';
  delete root.dataset['loadingWaitId'];
  for (const pending of state.pending.values()) if (pending.owner === null && !pending.inline) { pending.owner = owner; pending.step = step; }
  return id;
}

/** Actual page transport, independent of legacy step-completion credits. */
export interface DownloadSnapshot {
  networkBytes: number; cachedBytes: number; pendingBytes: number;
  filesDone: number; filesTotal: number; unclassifiedBytes: number; unclassifiedFiles: number;
  /** the files this load declared (exact index sizes) and how much of them has arrived, from the wire or the cache */
  declaredBytes: number; declaredDoneBytes: number; declaredFiles: number; declaredFilesDone: number;
  /** Compiler-known bytes whose individual file declarations have not arrived yet. */
  unitemizedBytes?: number;
  /** Fixed compiled entry content total, independent of late file discovery. */
  expectedBytes?: number;
  /** Canonical input bytes satisfied by a successfully restored derived result;
   * these are neither network nor original-body cache reads. */
  restoredBytes?: number;
  /** Actual bodies delivered during this entry, independent of planned banks. */
  reads?: {bytes: number; cachedBytes: number; unknownSourceBytes: number; pendingBytes: number; pendingFiles: number; closed: boolean};
}
interface File { bytes: number; complete: boolean; container?: boolean; restored?: boolean; address: string }
interface ReadBody {bytes: number; cached: boolean | undefined; sourceAt: number}
export interface DownloadTiming {
  name: string; startTime: number; transferSize: number; encodedBodySize: number; decodedBodySize?: number;
  workerStart: number; serverTiming: readonly { name: string; duration: number }[];
  responseEnd?: number; source?: 'worker';
  responseStatus?: number;
}
/** One loading attempt owns its declarations and receipts; no body tees or retained payloads. */
export class DownloadAccounting {
  private readsEnabled = false;
  private readsClosed = false;
  private readonly bodies = new Map<string, ReadBody>();
  private readonly requests = new Map<string, number>();
  private readonly packMembers = new Map<string, {pack: string; bytes: number}>();
  private readonly consumedMembers = new Map<string, Set<string>>();
  /** Observe selected reads, rather than treating a whole product as demand. */
  trackReads(): void { this.readsEnabled = true; }
  /** The native entry barrier closes this observation window, not its IO. */
  closeReads(): void { if (this.readsEnabled) this.readsClosed = true; }
  beginRead(input: string): () => void {
    if (!this.readsEnabled || this.readsClosed) return () => undefined;
    const key = this.url(input); this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
    return () => { const count = this.requests.get(key) ?? 0; if (count <= 1) this.requests.delete(key); else this.requests.set(key, count - 1); };
  }
  /** Content-body evidence only; this never invents network transfer bytes. */
  read(input: string, bytes: number, cached?: boolean, at: number = diagnosticNow()): void {
    if (!this.readsEnabled || this.readsClosed) return;
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid delivered body size');
    const key = this.url(input), prior = this.bodies.get(key);
    if (prior === undefined) this.bodies.set(key, {bytes, cached, sourceAt: at});
    else {
      prior.bytes = Math.max(prior.bytes, bytes);
      if (cached !== undefined && (prior.cached === undefined || at < prior.sourceAt)) { prior.cached = cached; prior.sourceAt = at; }
    }
    const receipt = this.bodies.get(key);
    if (receipt !== undefined && this.files.get(key)?.container === true) for (const member of this.consumedMembers.get(key) ?? []) {
      const body = this.bodies.get(member);
      if (body !== undefined) this.read(member, body.bytes, receipt.cached, receipt.sourceAt);
    }
  }
  private expected: number | undefined;
  /** This attempt's build-owned denominator is immutable. It grants no receipt. */
  expect(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || this.expected !== undefined && this.expected !== bytes) throw new Error('Invalid fixed download total');
    this.expected = bytes;
  }
  private readonly files = new Map<string, File>();
  private readonly groups = new Map<string, number>();
  /** Receipts change completion, never the directory's declared remainder. */
  private groupRemainder: number | undefined;
  private readonly banks = new Map<string, number>();
  private readonly seen = new Set<string>();
  private readonly received = new Set<string>();
  private readonly cache = new Map<string, number>();
  private readonly addressed = new Map<string, Set<File>>();
  private network = 0;
  private browserCache = 0;
  private readonly unknown = new Map<string, { url: string; bytes: number }>();
  private readonly bodyHints = new Map<string, number>();
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
    if (file !== undefined) {
      if (bytes > file.bytes) { file.bytes = bytes; this.groupRemainder = undefined; }
      return;
    }
    this.groupRemainder = undefined;
    const hash = /[a-f0-9]{64}/u.exec(key)?.[0];
    const declared = { bytes, complete: this.received.has(key) || (hash !== undefined && this.cache.has(hash)), address: key };
    this.files.set(key, declared);
    if (hash !== undefined) {
      let addresses = this.addressed.get(hash);
      if (addresses === undefined) { addresses = new Set(); this.addressed.set(hash, addresses); }
      addresses.add(declared);
    }
  }
  /** A transport envelope has wire activity, but its declared members already
   * own content bytes. Counting both makes cold and warm content incomparable. */
  container(input: string, bytes: number): void {
    this.declare(input, bytes);
    const file = this.files.get(this.url(input)); if (file !== undefined) file.container = true;
  }
  /** The verified envelope and its members represent the same content bytes. */
  pack(input: string, bytes: number, members: readonly {readonly hash: string; readonly bytes: number}[]): void {
    this.container(input, bytes);
    const pack = this.url(input);
    for (const member of members) this.packMembers.set(member.hash, {pack, bytes: member.bytes});
  }
  /** Reserve an exact compiler-known directory total before its index is read.
   * File declarations replace the reserve byte for byte; only receipts credit completion. */
  reserve(input: string, bytes: number): void {
    const url = new URL(input, this.base);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || url.origin !== new URL(this.base).origin
      || url.search !== '' || url.hash !== '' || !url.pathname.endsWith('/')) throw new Error('Invalid download reserve');
    const key = url.href, previous = this.groups.get(key);
    if (previous !== undefined) {
      if (previous !== bytes) throw new Error('Changed download reserve');
      return;
    }
    for (const other of this.groups.keys()) if (key.startsWith(other) || other.startsWith(key)) throw new Error('Overlapping download reserves');
    let known = 0;
    for (const [name, file] of this.files) if (name.startsWith(key)) known += file.bytes;
    if (known > bytes) throw new Error('Download reserve understates declared files');
    this.groups.set(key, bytes);
    this.groupRemainder = undefined;
  }
  /** A detached per-home file list is fetched once after selection. Its exact
   * compiler total stays pending until the complete list replaces it atomically. */
  reserveBank(id: string, bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.banks.has(id)) throw new Error('Invalid download bank reserve');
    this.banks.set(id, bytes);
  }
  itemizeBank(id: string, input: unknown): void {
    const rows = readDownloadFiles(input), total = this.banks.get(id);
    if (total === undefined || rows.reduce((sum, row) => sum + row[1], 0) !== total
      || new Set(rows.map(row => this.url(row[0]))).size !== rows.length) throw new Error('Download bank total differs');
    // No partial declaration if a malformed suffix or overlap was supplied.
    if (rows.some(row => this.files.has(this.url(row[0])))) throw new Error('Download bank overlaps declared files');
    this.banks.delete(id);
    for (const [url, bytes] of rows) this.declare(url, bytes);
  }
  /** Verified disk reads are separate from network receipts and credited once per immutable address. */
  cached(key: string, bytes: number, url?: string): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid cached byte receipt');
    this.cache.set(key, Math.max(this.cache.get(key) ?? 0, bytes));
    this.activity++;
    for (const file of this.addressed.get(key) ?? []) { file.complete = true; this.read(file.address, bytes, true); }
    if (url !== undefined) {
      this.declare(url, bytes);
      const file = this.files.get(this.url(url)); if (file !== undefined) file.complete = true;
      this.read(url, bytes, true);
    }
  }
  /** iPhone downloads I5: a member read from its pack completes without a receipt of its own (the pack's receipt
   *  carries the bytes). */
  packed(input: string, identity?: string): void {
    const key = this.url(input), file = this.files.get(key); if (file !== undefined) file.complete = true;
    const hash = identity ?? /[a-f0-9]{64}/u.exec(key)?.[0], member = hash === undefined ? undefined : this.packMembers.get(hash);
    if (member !== undefined) {
      let consumed = this.consumedMembers.get(member.pack);
      if (consumed === undefined) { consumed = new Set(); this.consumedMembers.set(member.pack, consumed); }
      consumed.add(key);
      const receipt = this.bodies.get(member.pack);
      this.read(key, member.bytes, receipt?.cached, receipt?.sourceAt);
    }
    this.activity++;
  }
  /** A validated derived result replaces this exact canonical input. */
  restored(input: string, bytes: number): void {
    this.declare(input, bytes);
    const file = this.files.get(this.url(input));
    if (file !== undefined && !file.complete) { file.complete = true; file.restored = true; }
    this.activity++;
  }
  /** Resource Timing covers modules, images, fonts and undeclared fetches, including early buffered entries. */
  resource(entry: DownloadTiming): void {
    if ((entry.responseEnd ?? entry.startTime) < this.since || !/^https?:/u.test(entry.name)) return;
    // The synthetic page response is the same file: only its worker receipt
    // owns transport bytes and file completion, including an HTTP-cache hit.
    const url = this.url(entry.name);
    const body = Math.max(entry.encodedBodySize, entry.serverTiming.find(timing => timing.name === 'ws-network')?.duration ?? 0);
    if (body > 0) this.bodyHints.set(url, Math.max(this.bodyHints.get(url) ?? 0, body));
    const cacheHit = entry.serverTiming.some(timing => timing.name === 'ws-cache')
      || entry.workerStart === 0 && entry.transferSize === 0 && entry.encodedBodySize > 0;
    const origin = cacheHit ? true : entry.transferSize > 0 || entry.serverTiming.some(timing => timing.name === 'ws-network') ? false : undefined;
    const delivered = entry.decodedBodySize !== undefined && entry.decodedBodySize > 0 ? entry.decodedBodySize : this.files.get(url)?.bytes ?? body;
    if ((entry.responseStatus === undefined || entry.responseStatus < 400) && Number.isSafeInteger(delivered) && delivered > 0) this.read(url, delivered, origin, entry.startTime);
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
    else if (entry.workerStart === 0 && entry.transferSize === 0 && entry.encodedBodySize > 0) this.browserCache += entry.encodedBodySize;
    else if (entry.transferSize > 0) this.network += entry.transferSize;
    // A response length is not a wire receipt. WebKit can expose an all-zero
    // worker timing: retain the unknown transfer, including late body/index hints.
    else this.unknown.set(id, { url, bytes: body });
  }
  private reservedRemainder(): number {
    if (this.groupRemainder !== undefined) return this.groupRemainder;
    let remainder = 0;
    this.groups.forEach((bytes, prefix) => {
      let known = 0;
      this.files.forEach((file, name) => { if (name.startsWith(prefix)) known += file.bytes; });
      // An unexpected extra file remains visible as real growth; a reserve never
      // hides later declarations or manufactures a completed file/byte receipt.
      remainder += Math.max(0, bytes - known);
    });
    this.groupRemainder = remainder;
    return remainder;
  }
  snapshot(): DownloadSnapshot {
    let pendingBytes = 0, pendingFiles = 0, cachedBytes = this.browserCache, declaredBytes = 0, declaredFiles = 0, restoredBytes = 0;
    this.files.forEach(file => { if (file.container === true) return; declaredFiles++; declaredBytes += file.bytes; if (file.restored === true) restoredBytes += file.bytes; if (!file.complete) { pendingBytes += file.bytes; pendingFiles++; } });
    let unitemizedBytes = this.reservedRemainder();
    this.banks.forEach(bytes => { unitemizedBytes += bytes; });
    declaredBytes += unitemizedBytes; pendingBytes += unitemizedBytes;
    this.cache.forEach(bytes => { cachedBytes += bytes; });
    let unclassifiedBytes = 0;
    this.unknown.forEach(receipt => { unclassifiedBytes += Math.max(receipt.bytes,
      this.bodyHints.get(receipt.url) ?? 0); });
    let readBytes = 0, readCachedBytes = 0, unknownSourceBytes = 0, readPendingBytes = 0, readPendingFiles = 0;
    for (const [url, body] of this.bodies) { if (this.files.get(url)?.container === true) continue;
      readBytes += body.bytes; if (body.cached === true) readCachedBytes += body.bytes; else if (body.cached === undefined) unknownSourceBytes += body.bytes; }
    if (!this.readsClosed) for (const key of this.requests.keys()) if (!this.bodies.has(key)) { readPendingBytes += this.files.get(key)?.bytes ?? 0; readPendingFiles++; }
    return { networkBytes: this.network, cachedBytes, pendingBytes, filesDone: this.completed + this.cache.size,
      filesTotal: this.completed + this.cache.size + pendingFiles, unclassifiedBytes, unclassifiedFiles: this.unknown.size,
      declaredBytes, declaredDoneBytes: declaredBytes - pendingBytes, declaredFiles, declaredFilesDone: declaredFiles - pendingFiles,
      ...(this.expected === undefined ? {} : {expectedBytes: this.expected}), ...(restoredBytes === 0 ? {} : {restoredBytes}), ...(unitemizedBytes === 0 ? {} : { unitemizedBytes }),
      ...(!this.readsEnabled ? {} : {reads: {bytes: readBytes, cachedBytes: readCachedBytes, unknownSourceBytes, pendingBytes: readPendingBytes, pendingFiles: readPendingFiles, closed: this.readsClosed}}) };
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
    encodedBodySize: timing.encodedBodySize, workerStart: 0, serverTiming: [], source: 'worker',
    ...('decodedBodySize' in timing && typeof timing.decodedBodySize === 'number' ? {decodedBodySize: timing.decodedBodySize} : {}) };
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

/** Expected content-body bytes before HTTP compression, not measured wire size.
 * Product indexes describe the encoded file itself; JS/CSS facts describe code. */
export function declareDownloadFile(url: string, bytes: number): void { accountingTargets(accounting => { accounting.declare(url, bytes); }); }
/** Record a container's transport without adding its members' content twice. */
export function declareDownloadContainer(url: string, bytes: number): void { accountingTargets(accounting => { accounting.container(url, bytes); }); }
/** Observed pack membership; only actual member consumption credits content. */
export function declareDownloadPack(url: string, bytes: number, members: readonly {readonly hash: string; readonly bytes: number}[]): void {
  accountingTargets(accounting => { accounting.pack(url, bytes, members); });
}
/** Reserve only a selected directory, never another home's bytes or completion. */
export function reserveDownloadGroup(url: string, bytes: number): void { accountingTargets(accounting => { accounting.reserve(url, bytes); }); }
/** Reserve and then itemize a compiler-owned per-home asset list. */
export function reserveDownloadBank(id: string, bytes: number): (input: unknown) => void {
  const targets: DownloadAccounting[] = [];
  accountingTargets(accounting => { accounting.reserveBank(id, bytes); targets.push(accounting); });
  return input => { for (const accounting of targets) accounting.itemizeBank(id, input); };
}
/** Detached compiler-owned URL/body-size rows, validated before publication. */
export function readDownloadFiles(input: unknown): readonly (readonly [string, number])[] {
  if (!Array.isArray(input) || input.length > 8192) throw new Error('Invalid download file bank');
  const rows: [string, number][] = [];
  for (const row of input) {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('Invalid download file row');
    const url: unknown = row[0], bytes: unknown = row[1];
    if (typeof url !== 'string' || !/^\/assets\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/u.test(url)
      || url.split('/').some(part => part === '.' || part === '..')
      || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid download file row');
    rows.push([url, bytes]);
  }
  return rows;
}
/** Detached compiler-owned URL/body-size rows; usable by the build and page. */
export function readModuleFiles(input: unknown): readonly (readonly [string, number])[] {
  if (!Array.isArray(input) || input.length > 4096) throw new Error('Invalid boot module bank');
  const files: [string, number][] = [];
  for (const row of input) {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('Invalid boot module file');
    const url: unknown = row[0], bytes: unknown = row[1];
    if (typeof url !== 'string' || !/^\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css)$/u.test(url)
      || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid boot module file');
    files.push([url, bytes]);
  }
  return files;
}
/** Admit a compiler-owned static module bank completely before publishing its
 * declarations. These are body sizes, never invented network/cache receipts. */
export function declareModuleFiles(input: unknown): void {
  for (const [url, bytes] of readModuleFiles(input)) declareDownloadFile(url, bytes);
}
/** Verified immutable cache reads stay separate from downloaded bytes. */
export function recordCachedDownload(key: string, bytes: number, url?: string): void { accountingTargets(accounting => { accounting.cached(key, bytes, url); }); }
/** I5: a declared file served from its pack is complete; the pack's own receipt counts the bytes. */
export function recordPackedDownload(url: string, hash?: string): void { accountingTargets(accounting => { accounting.packed(url, hash); }); }
/** Successful derived restoration satisfies named inputs without a wire/cache credit. */
export function recordRestoredDownload(url: string, bytes: number): void { accountingTargets(accounting => { accounting.restored(url, bytes); }); }
/** Actual delivered bodies, with cache provenance only when the reader knows. */
export function recordReadDownload(url: string, bytes: number, cached?: boolean): void { accountingTargets(accounting => { accounting.read(url, bytes, cached); }); }
/** Observe an already-started demand without changing its lifetime. */
export function beginDownloadRead(url: string): () => void {
  const releases: (() => void)[] = []; accountingTargets(accounting => { releases.push(accounting.beginRead(url)); });
  return () => { for (const release of releases) release(); };
}
/** Actual body reads reset the stall timer without mislabelling decoded bytes as network transport. */
export function noteDownloadRead(bytes: number): void { accountingTargets(accounting => { accounting.noteRead(bytes); }); }

interface ModuleBank {
  readonly text: string;
  readonly files: readonly (readonly [string, number])[];
  readonly groups: object;
  readonly published: WeakMap<DownloadAccounting, Set<readonly [string, number]>>;
}
interface ModuleSelection { readonly bank: ModuleBank; readonly files: readonly (readonly [string, number])[] }
const moduleBanks = new WeakMap<Element, ModuleBank>();

/** Resolve the complete selected bank before publishing any prefix. */
function selectedModuleFiles(kinds: readonly string[]): ModuleSelection | undefined {
  if (typeof document === 'undefined' || kinds.length === 0) return undefined;
  const element = document.getElementById('boot-module-files');
  if (element === null) return undefined; // Source and isolated fixtures have no compiler inventory.
  const text = element.textContent;
  let admitted = moduleBanks.get(element);
  if (admitted === undefined || admitted.text !== text) {
    const input: unknown = JSON.parse(text);
    if (typeof input !== 'object' || input === null) throw new Error('Missing client module inventory');
    const bank: unknown = Reflect.get(input, 'optional');
    if (typeof bank !== 'object' || bank === null) throw new Error('Missing optional client module inventory');
    const files = readModuleFiles(Reflect.get(bank, 'files')), groups: unknown = Reflect.get(bank, 'groups');
    if (typeof groups !== 'object' || groups === null) throw new Error('Missing client module groups');
    // Privately parsed rows never escape. Changed text or a replacement element
    // must pass the complete bank admission again, including unselected files.
    admitted = { text, files, groups, published: new WeakMap() }; moduleBanks.set(element, admitted);
  }
  const { files, groups } = admitted;
  const selected = new Map<number, readonly [string, number]>();
  for (const kind of new Set(kinds)) {
    const rows: unknown = Reflect.get(groups, kind);
    if (!Object.hasOwn(groups, kind) || !Array.isArray(rows) || rows.length > 4096) throw new Error('Missing selected client module group');
    for (const index of rows) {
      if (typeof index !== 'number' || !Number.isSafeInteger(index)) throw new Error('Invalid selected client module index');
      const file = files[index]; if (file === undefined) throw new Error('Missing selected client module file');
      selected.set(index, file);
    }
  }
  return { bank: admitted, files: [...selected.values()] };
}

/** Check compiler selection without installing a ledger or fetching code.
 * Original import/admission barriers stay with their callers. */
export function readModuleGroups(kinds: readonly string[]): readonly (readonly [string, number])[] {
  return selectedModuleFiles(kinds)?.files ?? [];
}

function publishModuleSelection(selection: ModuleSelection): void {
  accountingTargets(accounting => {
    let published = selection.bank.published.get(accounting);
    if (published === undefined) { published = new Set(); selection.bank.published.set(accounting, published); }
    for (const file of selection.files) {
      if (published.has(file)) continue;
      accounting.declare(file[0], file[1]);
      published.add(file);
    }
  });
}

/** Declare selected graphs without starting their reads. Privately admitted
 * facts publish once per ledger; new attempts and observers still get them. */
export function declareModuleGroups(kinds: readonly string[]): void {
  const selection = selectedModuleFiles(kinds);
  if (selection !== undefined) publishModuleSelection(selection);
}

/** Prepare only compiler-selected code in parallel, without executing modules.
 * Original import sites still install in order and own their retry/failure policy. */
export function preloadModuleFiles(input: unknown): void {
  const files = readModuleFiles(input);
  for (const [url, bytes] of files) declareDownloadFile(url, bytes);
  preloadAdmittedModuleFiles(files);
}
function preloadAdmittedModuleFiles(files: readonly (readonly [string, number])[]): void {
  if (typeof document === 'undefined') return;
  const present = new Set([...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map(link => link.href));
  for (const [url] of files) {
    if (!url.endsWith('.js')) continue;
    const href = new URL(url, document.baseURI).href;
    if (present.has(href)) continue;
    present.add(href);
    const link = document.createElement('link'); link.rel = 'modulepreload'; link.crossOrigin = 'anonymous'; link.href = href;
    document.head.append(link);
  }
}
/** Admission of every selected row precedes every preload and declaration. */
export function preloadModuleGroups(kinds: readonly string[]): void {
  const selection = selectedModuleFiles(kinds);
  if (selection === undefined) return;
  publishModuleSelection(selection);
  preloadAdmittedModuleFiles(selection.files);
}
