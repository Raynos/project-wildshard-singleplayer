import { currentLoadingTimeline } from './timeline';
/** Pending asynchronous work is observed without changing its owner, queue or concurrency. */
export type WaitKind = 'work' | 'file' | 'admission' | 'worker' | 'wasm' | 'shader';
export interface BootWait { id: number; label: string; kind: WaitKind; startedAt: number; ageMs: number }
export class WaitRegistry {
  private sequence = 0;
  private readonly pending = new Map<number, Omit<BootWait, 'ageMs'>>();
  private readonly now: () => number;
  constructor(now: () => number = () => performance.now()) { this.now = now; }
  /** Register an already-started operation and remove it on either resolution or rejection. */
  async waitFor<T>(label: string, promise: Promise<T>, kind: WaitKind = 'work'): Promise<T> {
    const id = ++this.sequence;
    this.pending.set(id, { id, label, kind, startedAt: this.now() });
    try { return await promise; }
    finally { this.pending.delete(id); }
  }
  snapshot(): BootWait[] {
    const now = this.now();
    return [...this.pending.values()].map(wait => ({ id: wait.id, label: wait.label, kind: wait.kind,
      startedAt: wait.startedAt, ageMs: Math.max(0, now - wait.startedAt) }));
  }
}

const waits = new WaitRegistry();
/** Observe an existing promise; callers retain their admission, lifetime and concurrency policy. */
export function waitFor<T>(label: string, promise: Promise<T>, kind: WaitKind = 'work'): Promise<T> { return waits.waitFor(label, promise, kind); }
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

