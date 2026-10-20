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
