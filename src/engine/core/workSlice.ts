/**
 * Cooperative slicing for long builds that can run while the game is drawing (op-hitch23, E435 frame floor).
 *
 * A grid cell admits its world on the road, in play, so every synchronous stretch of a builder lands between two drawn
 * frames. A 60 Hz frame leaves about 16.7 ms: the game's own update and render take ~4–7 ms on the desktop, so a build
 * stretch above ~8 ms costs a frame. Builders check `slice.due()` inside their loops and `await slice.yield()` when it
 * is; the yield is a fresh timer task, or, in play with a frame due (`framePacing.ts`), a wait until the engine loop has drawn
 * it: Blink may run timer tasks back to back before its rendering update.
 *
 *   const slice = workSlice();
 *   for (const item of items) { work(item); if (slice.due()) await slice.yield(); }
 */
import { resourceScope } from '../app/resources';
import type { Scope } from '../app/scope';
import { diagnosticNow } from './clock';
import { frameBudgetSpent, paceYield, presenting } from './framePacing';

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

// Live construction checks the shared budget at every hop. A message turn therefore cannot
// batch unchecked work, unlike an unpaced message loop; it avoids spending that budget on
// the browser's nested-timer clamp. The drawn-frame barrier still ends every spent slice.
function buildTurn(owner: Scope): Promise<void> {
  if (!presenting() || typeof globalThis.MessageChannel !== 'function') return yieldTask(owner);
  return new Promise<void>(resolve => {
    const channel = new MessageChannel(), turn = owner.child('build-turn');
    let delivered = false;
    turn.onDispose(() => { channel.port1.close(); channel.port2.close(); if (!delivered) resolve(); });
    turn.listen(channel.port1, 'message', () => { delivered = true; turn.dispose(); owner.run(resolve); }, { once: true });
    channel.port1.start(); channel.port2.postMessage(0);
  });
}

/**
 * A world build's pause between its pieces (op-hitch45, E435 frame floor): a fresh task of `owner`, or, in play with a
 * frame due (`framePacing.ts`, the `buildPacing` Developer tool), a wait until the engine loop has drawn it. A plain timer
 * hop is not enough there: WebKit drew no frame across Nine Dragon's ~15 back-to-back `timeout(0)` build tasks (a 233 ms
 * frame on the iOS Simulator). Pacing off, it is exactly the timer task. Rejects when `owner` has closed (before or after
 * the pause): an unloaded cell stops building. Live cheap pieces use message tasks within the existing shared budget;
 * the loading screen, unpaced mode and Node retain timer tasks.
 */
export async function buildYield(owner: Scope): Promise<void> {
  const live = (): void => { if (owner.disposed) throw new Error('build stopped: its scope has closed'); };
  live();
  await paceYield(() => buildTurn(owner), owner, WORK_SLICE_MS);
  live();
}

/**
 * A slice clock for one sliced build (`budgetMs` defaults to `WORK_SLICE_MS`). `owner` holds its yield timers: by default
 * the ambient owner at each yield; a page-lifetime memo that keeps painting after the build that asked for it (a creature
 * coat) passes the page scope, so a left level's closed scope never strands it mid-yield.
 */
export function workSlice(budgetMs: number = WORK_SLICE_MS, owner?: Scope): WorkSlice {
  let start = diagnosticNow();
  const slice: WorkSlice = {
    // in play the budget is also the frame's (op-hitch44): every build running at once shares it, so a second build's
    // stretch never follows the first one's before the frame they both owe is drawn
    due: () => { const now = diagnosticNow(); return now - start >= budgetMs || frameBudgetSpent(budgetMs, now); },
    // in play with a frame due, the stretch ends only once the loop has drawn it (op-hitch26: timer tasks ran back to back)
    yield: async () => { await paceYield(() => yieldTask(owner), owner, budgetMs); start = diagnosticNow(); },
    check: () => (slice.due() ? slice.yield() : undefined),
  };
  return slice;
}
