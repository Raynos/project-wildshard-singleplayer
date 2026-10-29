import { currentLoadingTimeline } from './timeline';
import { diagnosticNow } from '../core/clock';
import { beginDownloadRead, loadingWaitState, type LoadingWaitState, type LoadingWaitEntry, type LoadingWaitKind } from './download';
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
      deadlineMs: 8000, retry: typeof location === 'undefined' ? null : () => { location.reload(); }, progress: '', inline: false,
      ...(resource === undefined ? {} : {resource}) });
    const release = resource === undefined || kind !== 'file' && kind !== 'worker' ? undefined : beginDownloadRead(resource);
    try { return await promise; }
    finally { state.pending.delete(id); release?.(); }
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
/** Account for all awaits at a semantic boundary, including work between the older bootstrap steps. */
export async function loadingStage<T>(key: string, work: () => T | Promise<T>): Promise<T> {
  const stage = currentLoadingTimeline()?.begin(key);
  try { return await work(); }
  finally { stage?.end(); }
}
/** Count actual completed units on the stage that starts this operation, without advancing work on a timer. */
export function loadingUnits(label: string, total: number): (done: number, detail?: string) => void {
  const timeline = currentLoadingTimeline(), key = timeline?.snapshot().current;
  return (done, detail) => {
    if (key === null || key === undefined) return;
    timeline?.report(key, `${label} ${done} / ${total}${detail ? ` · ${detail}` : ''}`, done, total);
  };
}

