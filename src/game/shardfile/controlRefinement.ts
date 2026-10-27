import type { Scope } from '@wildshard/engine/app/scope';
import { whenControl } from '@wildshard/engine/boot/prefetch';

interface Point { readonly x: number; readonly z: number }
interface Job {
  readonly id: string; readonly at: Point; readonly order: number; readonly run: () => Promise<void>;
  readonly resolve: (published: boolean) => void; readonly reject: (error: Error) => void;
}

/** One resident's low-priority refinement cursor. The first controlled paint
 * precedes every read; each next job follows the current viewer, nearest first.
 * Retirement drains the started job and cancels queued publication. */
export class ControlRefinement {
  private readonly waiting = new Map<string, Job>();
  private readonly known = new Set<string>();
  private readonly owner: Scope;
  private readonly position: () => Point;
  private readonly pause: () => Promise<void>;
  private active = false;
  private scheduled = false;
  private busy = false;
  private failure: Error | undefined;
  constructor(owner: Scope, level: Scope | undefined, position: () => Point, pause: () => Promise<void>) {
    this.owner = owner; this.position = position; this.pause = pause;
    owner.onDispose(() => { for (const job of this.waiting.values()) job.resolve(false); this.waiting.clear(); });
    if (level === undefined) this.active = true;
    else whenControl(level, owner, () => { owner.raf(() => { owner.raf(() => { this.active = true; this.kick(); }); }); });
  }
  /** Whether the first controlled paint has completed. */
  get ready(): boolean { return this.active && !this.owner.disposed && !this.owner.disposing; }
  add(id: string, at: Point, run: () => Promise<void>): Promise<boolean> {
    if (this.owner.disposed || this.owner.disposing) return Promise.resolve(false);
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (id.length === 0 || this.known.has(id) || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return Promise.reject(new Error('Invalid or duplicate refinement job'));
    const order = this.known.size; this.known.add(id);
    const result = new Promise<boolean>((resolve, reject) => { this.waiting.set(id, { id, at: { ...at }, order, run, resolve, reject }); });
    this.kick(); return result;
  }
  private kick(): void {
    if (!this.active || this.busy || this.scheduled || this.owner.disposed || this.owner.disposing || this.waiting.size === 0) return;
    this.scheduled = true;
    queueMicrotask(() => { this.scheduled = false; void this.drain(); });
  }
  private async drain(): Promise<void> {
    if (this.busy || this.owner.disposed || this.owner.disposing) return;
    this.busy = true;
    try {
      while (this.waiting.size > 0 && !this.owner.disposed && !this.owner.disposing) {
        const from = this.position();
        if (!Number.isFinite(from.x) || !Number.isFinite(from.z)) throw new Error('Invalid refinement viewer');
        const distance = (job: Job): number => (job.at.x - from.x) ** 2 + (job.at.z - from.z) ** 2;
        const job = [...this.waiting.values()].sort((a, b) => distance(a) - distance(b) || a.order - b.order)[0];
        if (job === undefined) break;
        this.waiting.delete(job.id);
        try {
          await job.run();
          job.resolve(!this.owner.disposed && !this.owner.disposing);
          if (this.waiting.size > 0 && !this.owner.disposed && !this.owner.disposing) await this.pause();
        } catch (error) {
          if (this.owner.disposed || this.owner.disposing) { job.resolve(false); break; }
          const refusal = error instanceof Error ? error : new Error('Refinement failed', { cause: error });
          this.failure = refusal; job.reject(refusal);
          for (const queued of this.waiting.values()) queued.reject(refusal);
          this.waiting.clear(); break;
        }
      }
    } catch (error) {
      const refusal = error instanceof Error ? error : new Error('Refinement failed', { cause: error });
      this.failure = refusal;
      for (const queued of this.waiting.values()) queued.reject(refusal);
      this.waiting.clear();
    } finally { this.busy = false; }
  }
}
