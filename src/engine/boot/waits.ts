import { currentLoadingTimeline } from './timeline';
import { diagnosticNow } from '../core/clock';
import { beginLoadingWait, finishLoadingWait, loadingWaitState, reportLoadingWait, type LoadingWaitState, type LoadingWaitEntry, type LoadingWaitKind } from './download';
import { pageScope } from '../app/resources';
/** Pending asynchronous work is observed without changing its owner, queue or concurrency. */
export type WaitKind = LoadingWaitKind;
export interface BootWait extends LoadingWaitEntry { ageMs: number }
export class WaitRegistry {
  private readonly state: () => LoadingWaitState;
  private readonly now: () => number;
  constructor(now: () => number = diagnosticNow, state?: () => LoadingWaitState) {
    this.now = now; const own: LoadingWaitState = { version: 1, sequence: 0, pending: new Map() };
    this.state = state ?? (() => own);
  }
  /** Register an already-started operation and remove it on either resolution or rejection. */
  async waitFor<T>(label: string, promise: Promise<T>, kind: WaitKind = 'work', step: string | null = null, owner: symbol | null = null, resource?: string): Promise<T> {
    const state = this.state(), id = ++state.sequence, now = this.now();
    state.pending.set(id, { id, label, kind, step, owner, startedAt: now, progressAt: now, loadedBytes: 0, totalBytes: null,
      retry: null, progress: '', inline: false,
      ...(resource === undefined ? {} : {resource}) });
    try { return await promise; }
    finally { state.pending.delete(id); }
  }
  snapshot(): BootWait[] {
    const now = this.now();
    const rows: BootWait[] = [];
    for (const wait of this.state().pending.values()) rows.push({ ...wait, ageMs: Math.max(0, now - wait.startedAt) });
    return rows;
  }
}

const waits = new WaitRegistry(diagnosticNow, loadingWaitState);
/** Observe an existing promise; callers retain their admission, lifetime and concurrency policy. */
export function waitFor<T>(label: string, promise: Promise<T>, kind: WaitKind = 'work', resource?: string): Promise<T> {
  const timeline = currentLoadingTimeline();
  return waits.waitFor(label, promise, kind, timeline?.snapshot().current ?? null, timeline?.waitOwner ?? null, resource);
}
/** Prefer waits of the displayed step, then its newest nested work. Unrelated page work never supplies the footer. */
export function loadingStepWaits(pending: readonly BootWait[], display: string | null, current: string | null, owner: symbol | null = null): readonly BootWait[] {
  const displayed = display === null ? [] : pending.filter(wait => wait.owner === owner && wait.step === display);
  return displayed.length > 0 ? displayed : current === null ? [] : pending.filter(wait => wait.owner === owner && wait.step === current);
}
/** Live page waits in registration order, including an age from the same monotonic clock. */
export function bootWaits(): readonly BootWait[] { return waits.snapshot(); }
/** Account for all awaits at a semantic boundary, including work between the older bootstrap steps. DL21 (E526): a step
 *  that reads files names them on the card while it runs ('Reading 12 files · 4.1 MB'), so a step that fetches what the
 *  spawn download did not carry never sits unchanged. */
export async function loadingStage<T>(key: string, work: () => T | Promise<T>): Promise<T> {
  const timeline = currentLoadingTimeline(), stage = timeline?.begin(key);
  const reads = timeline === undefined ? null : stageReads(key, timeline.waitOwner);
  try { return await work(); }
  finally { reads?.(); stage?.end(); }
}
/** This page's same-origin fetches since `since` (resource timing), as a count and transferred bytes. */
function readsSince(since: number): { readonly files: number; readonly bytes: number } {
  let files = 0, bytes = 0;
  for (const entry of performance.getEntriesByType('resource')) {
    if (!(entry instanceof PerformanceResourceTiming) || entry.startTime < since || entry.initiatorType !== 'fetch' || !entry.name.startsWith(location.origin)) continue;
    files++; bytes += entry.transferSize || entry.encodedBodySize;
  }
  return { files, bytes };
}
let timingBuffer = false;
/** A wait of the stage's own step that counts its reads once it has one; the returned stop removes it. */
function stageReads(step: string, owner: symbol): () => void {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function' || typeof location === 'undefined') return () => undefined;
  // The default buffer (250) fills early in a level's boot and would freeze the count.
  if (!timingBuffer) { timingBuffer = true; performance.setResourceTimingBufferSize(20_000); }
  const since = diagnosticNow(), scope = pageScope.child('loading.reads');
  let id: number | null = null;
  const tick = (): void => {
    const { files, bytes } = readsSince(since); if (files === 0) return;
    const label = `Reading ${files} files · ${(bytes / 1e6).toFixed(1)} MB`;
    if (id === null) id = beginLoadingWait(label, { kind: 'work', step, owner, loadedBytes: bytes });
    else reportLoadingWait(id, { label, loadedBytes: bytes });
  };
  scope.interval(250, tick);
  return () => { scope.dispose(); if (id !== null) finishLoadingWait(id); };
}
/** Count actual completed units on the stage that starts this operation, without advancing work on a timer. */
export function loadingUnits(label: string, total: number): (done: number, detail?: string) => void {
  const timeline = currentLoadingTimeline(), key = timeline?.snapshot().current;
  return (done, detail) => {
    if (key === null || key === undefined) return;
    timeline?.report(key, `${label} ${done} / ${total}${detail ? ` · ${detail}` : ''}`, done, total);
  };
}

