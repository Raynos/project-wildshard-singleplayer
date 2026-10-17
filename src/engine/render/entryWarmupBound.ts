/**
 * A time bound on an entered frame's warm-up (OP, grid entry hitches, 2026-10-17).
 *
 * `Game.warmEnteredFrame` waits on drawn frames between its batches (`waitForDrawnFrame`), on driver links
 * (`isReady`, `compileAsync`) and on the page's post preparation. None of those waits had a limit: if the loop stopped
 * counting frames (a faulted draw, a dead core system, a held context) or a link never reported complete, the grid's
 * admission waited forever with no issue, the desktop Sky entry the milestone floor caught once (b81c16a21).
 *
 * The bound counts presented time only: each rAF gap adds at most `GAP_CAP_MS`, so a hidden page (no rAF) or an app
 * switch never expires it, and the wait resumes when the page draws again. Past either limit the warm-up rejects with
 * an `EntryWarmupStallError` naming the stage it waited in; the grid records that as the cell's admission issue and
 * the next crossing retries it. `current()` turns false at the same moment, so the abandoned work stops at its next check.
 */
import type { Scope } from '../app/scope';

/** Presented time without one drawn frame before a warm-up gives up (ms). */
export const ENTRY_NO_FRAME_MS = 5000;
/** Presented time a whole warm-up may take (ms): the Simulator's slowest entries take a few seconds. */
export const ENTRY_WARMUP_MS = 30000;
/** The most one rAF gap counts towards presented time (ms): a hidden page's gap is not presented. */
const GAP_CAP_MS = 100;

/** A warm-up that outlived its bound; its message names the stage it was waiting in. */
export class EntryWarmupStallError extends Error {
  override readonly name = 'EntryWarmupStallError';
}

export interface EntryWarmupLimits { readonly noFrameMs: number; readonly totalMs: number }
const DEFAULT_LIMITS: EntryWarmupLimits = { noFrameMs: ENTRY_NO_FRAME_MS, totalMs: ENTRY_WARMUP_MS };

/**
 * Run `work` under the bound. `drawn` is the loop's drawn-frame count; `stage` names the current stage for the message.
 * `work` receives the `current()` fence to use for every yielded step: false once `owner` left or the bound expired.
 * A loop that has not drawn its first frame yet (count 0) is held only by the total limit.
 */
export async function boundEntryWarmup<T>(owner: Scope, drawn: () => number, stage: () => string,
  work: (current: () => boolean) => Promise<T>, limits: EntryWarmupLimits = DEFAULT_LIMITS): Promise<T> {
  let stall: EntryWarmupStallError | null = null;
  const current = (): boolean => stall === null && !owner.disposed;
  const watch = owner.child('entry-warmup-bound');
  const expired = new Promise<never>((_resolve, reject) => {
    let presented = 0, sinceFrame = 0, last = Number.NaN, frames = drawn();
    const tick = (now: number): void => {
      if (!Number.isNaN(last)) {
        const gap = Math.min(GAP_CAP_MS, Math.max(0, now - last));
        presented += gap; sinceFrame += gap;
      }
      last = now;
      const count = drawn();
      if (count !== frames) { frames = count; sinceFrame = 0; }
      const reason = frames > 0 && sinceFrame >= limits.noFrameMs ? `no drawn frame for ${String(Math.round(sinceFrame))} ms`
        : presented >= limits.totalMs ? `over ${String(limits.totalMs)} ms` : null;
      if (reason === null) { watch.raf(tick); return; }
      stall = new EntryWarmupStallError(`Entered-frame warm-up stalled in ${stage()}: ${reason}`);
      reject(stall);
    };
    watch.raf(tick);
  });
  try { return await Promise.race([work(current), expired]); }
  finally { watch.dispose(); }
}
