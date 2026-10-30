import type { Scope } from '@wildshard/engine/app/scope';
import { whenControl } from '@wildshard/engine/boot/prefetch';
import { pageScope } from '@wildshard/engine/app/resources';
import { streamingDistance, streamingVisible, type StreamingPoint, type StreamingView } from './streamingView';

type Point = StreamingPoint;
interface Job {
  readonly id: string; readonly at: Point; readonly order: number; readonly run: () => Promise<void>;
  readonly resolve: (published: boolean) => void; readonly reject: (error: Error) => void;
}

/** MF5 / NT8: the loader awaits spatial jobs in the real camera frustum within
 * a 3-D radius before reveal. Published boxes are conservative; unbounded
 * catalogue/recipe jobs keep the radius fence. Camera-less owners retain their
 * original viewer-distance order. 221 m retains the former 5 x 5 ring reach. */
export const SPAWN_VIEW_M = 221;
let spawnView: { readonly radius: number; readonly reference: 'camera' | 'player' } | null = null;
const queues = new Set<ControlRefinement>();
/** The first boot fence precedes camera posing and explicitly keeps the player
 * reference. Later fences and controlled streaming use the real camera. */
export function spawnViewUsesCamera(): boolean { return spawnView?.reference !== 'player'; }
/** A spawn-view job waits or runs in some queue (the tile driver's settle stops when none does). */
export function spawnViewBusy(): boolean { return [...queues].some(queue => queue.spawnViewOpen()); }
/** Run every queue's spawn-view jobs now and resolve once none is left (a failure rejects, as the job's own promise does). */
export async function prepareSpawnView(radius: number = SPAWN_VIEW_M, settle?: () => void | Promise<void>, reference: 'camera' | 'player' = 'camera'): Promise<void> {
  spawnView = { radius, reference };
  if (settle !== undefined) {
    // the content a frame asks for while the fence is open (the tile driver attaches only ready content) queues its jobs
    // a few tasks after it: let them arrive before the queues are read
    await settle();
    for (let turn = 0; turn < 3; turn++) await new Promise<void>(resolve => { pageScope.timeout(0, resolve); });
    performance.mark('wildshard.spawn-view.settled', { detail: [...queues].map(queue => queue.describe()) });
  }
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

/** One resident's low-priority refinement cursor. Outside the loader fence,
 * controlled paint precedes reads; visible jobs lead, then 3-D eye distance.
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
  constructor(owner: Scope, level: Scope | undefined, position: () => Point, pause: () => Promise<void>, private readonly view?: () => StreamingView | null) {
    this.owner = owner; this.position = position; this.pause = pause;
    queues.add(this);
    owner.onDispose(() => { queues.delete(this); for (const job of this.waiting.values()) job.resolve(false); this.waiting.clear(); this.known.clear(); this.settle(); });
    if (level === undefined) this.active = true;
    else whenControl(level, owner, () => { owner.raf(() => { owner.raf(() => { this.active = true; this.kick(); }); }); });
  }
  /** Whether the first controlled paint has completed, or the loader's spawn-view fence is open (MF5): either way the
   *  tile driver may attach this queue's content, and its jobs queue (only in-view ones run before control). */
  get ready(): boolean { return (this.active || spawnView !== null) && !this.owner.disposed && !this.owner.disposing; }
  add(id: string, at: Point, run: () => Promise<void>): Promise<boolean> {
    if (this.owner.disposed || this.owner.disposing) return Promise.resolve(false);
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (id.length === 0 || this.known.has(id) || !Number.isFinite(at.x) || !Number.isFinite(at.z) || (at.y !== undefined && !Number.isFinite(at.y))
      || (at.bounds !== undefined && (!at.bounds.min.every(Number.isFinite) || !at.bounds.max.every(Number.isFinite)
        || at.bounds.min.some((n, i) => n > (at.bounds?.max[i] ?? -Infinity))))) return Promise.reject(new Error('Invalid or duplicate refinement job'));
    const order = this.sequence++; this.known.add(id);
    const result = new Promise<boolean>((resolve, reject) => { this.waiting.set(id, { id, at: { ...at }, order, run, resolve, reject }); });
    this.kick(); return result;
  }
  /** The viewer, the queue's size and its nearest waiting job's distance (prepareSpawnView's mark). */
  describe(): { readonly at: Point; readonly waiting: number; readonly nearest: number | null; readonly active: boolean } {
    const view = spawnViewUsesCamera() ? this.view?.() ?? null : null, from = view?.eye ?? this.position(); let nearest: number | null = null;
    for (const job of this.waiting.values()) {
      const d = view === null ? Math.hypot(job.at.x - from.x, job.at.z - from.z) : Math.sqrt(streamingDistance(job.at, view));
      if (nearest === null || d < nearest) nearest = d;
    }
    return { at: { x: Math.round(from.x), z: Math.round(from.z), ...(from.y === undefined ? {} : { y: Math.round(from.y) }) },
      waiting: this.waiting.size, nearest: nearest === null ? null : Math.round(nearest), active: this.active };
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
  private inView(): Job | undefined { return this.select(true); }
  private select(beforeControl: boolean): Job | undefined {
    if (this.waiting.size === 0 || (beforeControl && spawnView === null)) return undefined;
    const view = spawnViewUsesCamera() ? this.view?.() ?? null : null, from = view?.eye ?? this.position();
    if (!Number.isFinite(from.x) || !Number.isFinite(from.z)) throw new Error('Invalid refinement viewer');
    let best: Job | undefined, bestSeen = false, bestDistance = Infinity;
    for (const job of this.waiting.values()) {
      const distance = view === null ? (job.at.x - from.x) ** 2 + (job.at.z - from.z) ** 2 : streamingDistance(job.at, view);
      const seen = view !== null && streamingVisible(job.at, view);
      // Unbounded catalogue/recipe jobs retain the conservative radius fence.
      // Spatial jobs use their whole published box, never only its centre.
      if (beforeControl && (distance > (spawnView?.radius ?? 0) ** 2 || (view !== null && job.at.bounds !== undefined && !seen))) continue;
      if (best === undefined || (seen && !bestSeen) || (seen === bestSeen && (distance < bestDistance || (distance === bestDistance && job.order < best.order)))) {
        best = job; bestSeen = seen; bestDistance = distance;
      }
    }
    return best;
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
        // The current camera is sampled again after every yielded job.
        const job = this.active ? this.select(false) : this.inView();
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
