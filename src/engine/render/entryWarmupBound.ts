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
/** D196: presented time the destination's content (its kit / afterKit / play hooks and the reads behind them) may take
 *  before the warm-up proper starts (ms). Those hooks have no time bound of their own, so a network hang still ends
 *  here, as an `EntryContentStallError` naming the stage; a Fast4G Pine entry's hooks take ~16-25 s. */
export const ENTRY_CONTENT_MS = 180000;
/** The most one rAF gap counts towards presented time (ms): a hidden page's gap is not presented. */
const GAP_CAP_MS = 100;

/** A warm-up that outlived its bound; its message names the stage it was waiting in. */
export class EntryWarmupStallError extends Error {
  override readonly name: string = 'EntryWarmupStallError';
}
/** The content a warm-up waits for (`contentMs`) outlived its network-time bound (D196). */
export class EntryContentStallError extends EntryWarmupStallError {
  override readonly name: string = 'EntryContentStallError';
}

/** `contentMs` (D196): the work first waits for content under this bound and calls `startWarm()` when it has it; only
 *  then does `totalMs` start counting. Absent, `totalMs` counts from the start and `startWarm` does nothing. The
 *  no-frame limit holds throughout. */
export interface EntryWarmupLimits { readonly noFrameMs: number; readonly totalMs: number; readonly contentMs?: number }
const DEFAULT_LIMITS: EntryWarmupLimits = { noFrameMs: ENTRY_NO_FRAME_MS, totalMs: ENTRY_WARMUP_MS };

/**
 * Run `work` under the bound. `drawn` is the loop's drawn-frame count; `stage` names the current stage for the message.
 * `work` receives the `current()` fence to use for every yielded step: false once `owner` left or the bound expired,
 * and `startWarm()`, which ends a `contentMs` wait and starts the warm-up's own `totalMs` clock.
 * A loop that has not drawn its first frame yet (count 0) is held only by the total limit.
 */
export async function boundEntryWarmup<T>(owner: Scope, drawn: () => number, stage: () => string,
  work: (current: () => boolean, startWarm: () => void) => Promise<T>, limits: EntryWarmupLimits = DEFAULT_LIMITS): Promise<T> {
  if (owner.disposed) throw new Error('Shader warm-up owner left');
  let stall: EntryWarmupStallError | null = null;
  const current = (): boolean => stall === null && !owner.disposed;
  // D196: with `contentMs`, the clock first bounds the wait for content; `startWarm` hands it to the warm-up's own limit
  let waitingContent = limits.contentMs !== undefined, startWarm = (): void => undefined;
  const watch = owner.child('entry-warmup-bound');
  const expired = new Promise<never>((_resolve, reject) => {
    watch.onDispose(() => { reject(new Error('Shader warm-up owner left')); });
    let presented = 0, sinceFrame = 0, last = Number.NaN, frames = drawn();
    const tick = (now: number): void => {
      if (!Number.isNaN(last)) {
        const gap = Math.min(GAP_CAP_MS, Math.max(0, now - last));
        presented += gap; sinceFrame += gap;
      }
      last = now;
      const count = drawn();
      if (count !== frames) { frames = count; sinceFrame = 0; }
      const content = waitingContent && limits.contentMs !== undefined;
      const limit = content ? limits.contentMs ?? limits.totalMs : limits.totalMs;
      const reason = frames > 0 && sinceFrame >= limits.noFrameMs ? `no drawn frame for ${String(Math.round(sinceFrame))} ms`
        : presented >= limit ? `over ${String(limit)} ms` : null;
      if (reason === null) { watch.raf(tick); return; }
      const error = content && reason.startsWith('over') ? new EntryContentStallError(`Entered-frame content stalled in ${stage()}: ${reason}`)
        : new EntryWarmupStallError(`Entered-frame warm-up stalled in ${stage()}: ${reason}`);
      stall = error;
      reject(error);
    };
    startWarm = (): void => { if (waitingContent) { waitingContent = false; presented = 0; } };
    watch.raf(tick);
  });
  // Capture a synchronous preparation failure too, before disposing the watch rejects its wait.
  const running = new Promise<T>(resolve => { resolve(work(current, () => { startWarm(); })); });
  try { return await Promise.race([running, expired]); }
  finally { watch.dispose(); }
}
