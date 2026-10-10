/**
 * Cooperative slicing for long builds that can run while the game is drawing (op-hitch23, E435 frame floor).
 *
 * A grid cell admits its world on the road, in play, so every synchronous stretch of a builder lands between two drawn
 * frames. A 60 Hz frame leaves about 16.7 ms: the game's own update and render take ~4–7 ms on the desktop, so a build
 * stretch above ~8 ms costs a frame. Builders check `slice.due()` inside their loops and `await slice.yield()` when it
 * is; the yield is a fresh timer task, so a due frame draws between two stretches.
 *
 *   const slice = workSlice();
 *   for (const item of items) { work(item); if (slice.due()) await slice.yield(); }
 */
import { resourceScope } from '../app/resources';
import type { Scope } from '../app/scope';
import { diagnosticNow } from './clock';

/** The longest synchronous stretch a sliced builder runs before it lets a frame through (ms). */
export const WORK_SLICE_MS = 8;

/** One builder's slice clock: `due()` once its stretch has run `budgetMs`, `yield()` to end the stretch. */
export interface WorkSlice {
  /** whether this stretch has used its budget (cheap: one clock read) */
  readonly due: () => boolean;
  /** end the stretch: resolves on a fresh macrotask (the browser may paint first) and restarts the clock */
  readonly yield: () => Promise<void>;
  /** `yield()` when due, else nothing (await it inside a loop: `await slice.check()`) */
  readonly check: () => Promise<void> | undefined;
}

/** Resolve on a fresh timer task, where the browser may draw a due frame first. Not a MessageChannel: Blink dispatches
 *  queued port messages in one task until its own yield threshold, which merged 8 ms slices into ~100 ms tasks with no
 *  frame between them (measured, Nine Dragon's cell entry). Nested timers clamp to 4 ms: idle time, not frame time. */
export function yieldTask(owner?: Scope): Promise<void> {
  return new Promise<void>((resolve) => { (owner ?? resourceScope()).timeout(0, resolve); });
}

/**
 * A slice clock for one sliced build (`budgetMs` defaults to `WORK_SLICE_MS`). `owner` holds its yield timers: by default
 * the ambient owner at each yield; a page-lifetime memo that keeps painting after the build that asked for it (a creature
 * coat) passes the page scope, so a left level's closed scope never strands it mid-yield.
 */
export function workSlice(budgetMs: number = WORK_SLICE_MS, owner?: Scope): WorkSlice {
  let start = diagnosticNow();
  const slice: WorkSlice = {
    due: () => diagnosticNow() - start >= budgetMs,
    yield: async () => { await yieldTask(owner); start = diagnosticNow(); },
    check: () => (slice.due() ? slice.yield() : undefined),
  };
  return slice;
}
