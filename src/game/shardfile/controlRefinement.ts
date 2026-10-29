import type { Scope } from '@wildshard/engine/app/scope';
import { whenControl } from '@wildshard/engine/boot/prefetch';

interface Point { readonly x: number; readonly z: number }
interface Job {
  readonly id: string; readonly at: Point; readonly order: number; readonly run: () => Promise<void>;
  readonly resolve: (published: boolean) => void; readonly reject: (error: Error) => void;
}

/** MF5 / NP-1 (Jake 10-29: pop-in is worse than a longer load): the loader's spawn-view fence. While it is open, each
 * queue runs, before control, the jobs within `radius` m of its viewer (the spawn ring's L0 tiles, late welds, dressing
 * reads), nearest first; the loader awaits them before its shaders link, so the reveal shows the refined spawn view.
 * Jobs outside it still wait for control. 160 m: Nine's 62.5 m tiles two out plus half a tile (its ring (3,1)-(5,4)). */
export const SPAWN_VIEW_M = 160;
let spawnView: { readonly radius: number } | null = null;
const queues = new Set<ControlRefinement>();
/** Run every queue's spawn-view jobs now and resolve once none is left (a failure rejects, as the job's own promise does). */
export async function prepareSpawnView(radius: number = SPAWN_VIEW_M): Promise<void> {
  spawnView = { radius };
  // what the fence saw, for the loading rulers (a viewer far from its jobs runs nothing)
  performance.mark('wildshard.spawn-view', { detail: [...queues].map(queue => queue.describe()) });
  try {
    for (const queue of queues) queue.wake();
    for (;;) {
      const open = [...queues].filter(queue => queue.spawnViewOpen());
      if (open.length === 0) return;
      await Promise.all(open.map(queue => queue.spawnViewIdle()));
    }
  } finally { spawnView = null; }
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
  private sequence = 0;
  private failure: Error | undefined;
  private idle: (() => void)[] = [];
  constructor(owner: Scope, level: Scope | undefined, position: () => Point, pause: () => Promise<void>) {
    this.owner = owner; this.position = position; this.pause = pause;
    queues.add(this);
    owner.onDispose(() => { queues.delete(this); for (const job of this.waiting.values()) job.resolve(false); this.waiting.clear(); this.known.clear(); this.settle(); });
    if (level === undefined) this.active = true;
    else whenControl(level, owner, () => { owner.raf(() => { owner.raf(() => { this.active = true; this.kick(); }); }); });
  }
  /** Whether the first controlled paint has completed. */
  get ready(): boolean { return this.active && !this.owner.disposed && !this.owner.disposing; }
  add(id: string, at: Point, run: () => Promise<void>): Promise<boolean> {
    if (this.owner.disposed || this.owner.disposing) return Promise.resolve(false);
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (id.length === 0 || this.known.has(id) || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return Promise.reject(new Error('Invalid or duplicate refinement job'));
    const order = this.sequence++; this.known.add(id);
    const result = new Promise<boolean>((resolve, reject) => { this.waiting.set(id, { id, at: { ...at }, order, run, resolve, reject }); });
    this.kick(); return result;
  }
  /** The viewer, the queue's size and its nearest waiting job's distance (prepareSpawnView's mark). */
  describe(): { readonly at: Point; readonly waiting: number; readonly nearest: number | null; readonly active: boolean } {
    const from = this.position(); let nearest: number | null = null;
    for (const job of this.waiting.values()) { const d = Math.hypot(job.at.x - from.x, job.at.z - from.z); if (nearest === null || d < nearest) nearest = d; }
    return { at: { x: Math.round(from.x), z: Math.round(from.z) }, waiting: this.waiting.size, nearest: nearest === null ? null : Math.round(nearest), active: this.active };
  }
  /** The spawn-view fence opened: run what is in view (prepareSpawnView). */
  wake(): void { this.kick(); }
  /** A spawn-view job waits or runs before control. */
  spawnViewOpen(): boolean { return !this.active && !this.owner.disposed && !this.owner.disposing && (this.busy || this.inView() !== undefined); }
  /** Resolves once this queue has no spawn-view job waiting or running. */
  spawnViewIdle(): Promise<void> {
    if (!this.spawnViewOpen()) return Promise.resolve();
    return new Promise(resolve => { this.idle.push(resolve); });
  }
  private settle(): void { const waiters = this.idle; this.idle = []; for (const resolve of waiters) resolve(); }
  /** Before control, the nearest waiting job inside the open spawn-view fence. */
  private inView(): Job | undefined {
    if (spawnView === null || this.waiting.size === 0) return undefined;
    const from = this.position(), radius = spawnView.radius;
    if (!Number.isFinite(from.x) || !Number.isFinite(from.z)) return undefined;
    const distance = (job: Job): number => (job.at.x - from.x) ** 2 + (job.at.z - from.z) ** 2;
    return [...this.waiting.values()].filter(job => distance(job) <= radius * radius)
      .sort((a, b) => distance(a) - distance(b) || a.order - b.order)[0];
  }
  private kick(): void {
    if (this.busy || this.scheduled || this.owner.disposed || this.owner.disposing || this.waiting.size === 0) return;
    if (!this.active && this.inView() === undefined) return;
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
        // before control only the spawn view runs (MF5); after it, everything, nearest first
        const job = this.active ? [...this.waiting.values()].sort((a, b) => distance(a) - distance(b) || a.order - b.order)[0] : this.inView();
        if (job === undefined) break;
        this.waiting.delete(job.id);
        try {
          await job.run();
          this.known.delete(job.id);
          job.resolve(!this.owner.disposed && !this.owner.disposing);
          if (this.waiting.size > 0 && !this.owner.disposed && !this.owner.disposing) await this.pause();
        } catch (error) {
          if (this.owner.disposed || this.owner.disposing) { job.resolve(false); break; }
          const refusal = error instanceof Error ? error : new Error('Refinement failed', { cause: error });
          this.failure = refusal; job.reject(refusal);
          for (const queued of this.waiting.values()) queued.reject(refusal);
          this.waiting.clear(); this.known.clear(); break;
        }
      }
    } catch (error) {
      const refusal = error instanceof Error ? error : new Error('Refinement failed', { cause: error });
      this.failure = refusal;
      for (const queued of this.waiting.values()) queued.reject(refusal);
      this.waiting.clear(); this.known.clear();
    } finally { this.busy = false; this.settle(); if (this.active) this.kick(); }
  }
}
