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
interface ModuleBank {
  readonly text: string;
  readonly files: readonly (readonly [string, number])[];
  readonly groups: object;
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
    admitted = { text, files, groups }; moduleBanks.set(element, admitted);
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

/** Prepare only compiler-selected code in parallel, without executing modules.
 * Original import sites still install in order and own their retry/failure policy. */
export function preloadModuleFiles(input: unknown): void {
  const files = readModuleFiles(input);
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
  preloadAdmittedModuleFiles(selection.files);
}
