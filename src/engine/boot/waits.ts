import { currentLoadingTimeline } from './timeline';
import { diagnosticNow } from '../core/clock';
/** Pending asynchronous work is observed without changing its owner, queue or concurrency. */
export type WaitKind = 'work' | 'file' | 'admission' | 'worker' | 'wasm' | 'shader';
export interface BootWait { id: number; label: string; kind: WaitKind; startedAt: number; ageMs: number; step: string | null; owner: symbol | null }
export class WaitRegistry {
  private sequence = 0;
  private readonly pending = new Map<number, Omit<BootWait, 'ageMs'>>();
  private readonly now: () => number;
  constructor(now: () => number = diagnosticNow) { this.now = now; }
  /** Register an already-started operation and remove it on either resolution or rejection. */
  async waitFor<T>(label: string, promise: Promise<T>, kind: WaitKind = 'work', step: string | null = null, owner: symbol | null = null): Promise<T> {
    const id = ++this.sequence;
    this.pending.set(id, { id, label, kind, step, owner, startedAt: this.now() });
    try { return await promise; }
    finally { this.pending.delete(id); }
  }
  snapshot(): BootWait[] {
    const now = this.now();
    return [...this.pending.values()].map(wait => ({ id: wait.id, label: wait.label, kind: wait.kind,
      step: wait.step, owner: wait.owner, startedAt: wait.startedAt, ageMs: Math.max(0, now - wait.startedAt) }));
  }
}

const waits = new WaitRegistry();
/** Observe an existing promise; callers retain their admission, lifetime and concurrency policy. */
export function waitFor<T>(label: string, promise: Promise<T>, kind: WaitKind = 'work'): Promise<T> {
  const timeline = currentLoadingTimeline();
  return waits.waitFor(label, promise, kind, timeline?.snapshot().current ?? null, timeline?.waitOwner ?? null);
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

