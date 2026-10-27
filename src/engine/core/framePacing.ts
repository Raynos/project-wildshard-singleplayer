/**
 * Frame pacing for builds that run while the game is drawing (op-hitch26, E435 frame floor, G294).
 *
 * A grid cell admits its world on the road, in play: every synchronous stretch of a builder lands between two drawn frames.
 * The engine's loop reports each frame it draws (`noteFrameDrawn`); while it keeps drawing, the page is *presenting*, and a
 * sliced build ends a stretch with `paceYield()`: a plain macrotask while the next frame is not yet due, or — when it is —
 * a wait until the loop has drawn one. A timer or message hop alone does not guarantee that: Blink may run several queued
 * tasks back to back before its rendering update (measured on Nine Dragon's cell entry, op-hitch23 / op-hitch26).
 *
 * Not presenting (the loading screen, a frozen title, Node bakers and tests): nothing changes, every yield is the caller's
 * own macrotask and `presenting()` is false, so a loader keeps its own budgets. Quiet frame floors back pacing on by default.
 * Pacing follows the loop's recent drawn frames; importing this module does not draw or schedule a frame.
 */
import type { Scope } from '../app/scope';
import { resourceScope } from '../app/resources';
import { diagnosticNow } from './clock';

/** A page that drew a frame within this long is presenting: its builds pace themselves to its frames (ms). */
const PRESENTING_MS = 250;
/** A frame counts as due this long before its interval has run out (timestamp jitter, the loop's own start-up). */
const DUE_SLACK_MS = 2;
/** A paced wait never outlasts this, whatever the loop does (a hidden page, a lost context, a gated frame). */
const WAIT_CAP_MS = 100;
/** Construction remains below half a 60 Hz display slot, even when the game draws less often. */
const BUILD_FRAME_MS = 1000 / 60;

let lastDrawn = Number.NEGATIVE_INFINITY;
let lastFrameAt = Number.NEGATIVE_INFINITY;
let lastVsyncAt = Number.NEGATIVE_INFINITY;
/** Declared capped cadence, or the fastest observed uncapped cadence; legacy completion-only calls smooth it. */
let interval = 1000 / 60;
/** G580 T5: while the traveller waits at a grid cell's wall for its build (`setBuildHeld`), a build stretch may run this
 *  long past the last drawn frame, and a due frame no longer ends it: the slower waiting frames cost no movement (ms). */
export const HELD_BUILD_MS = 24;
let held = false;
/** Whether the traveller waits for the build (a grid cell's loading screen shows); the grid sets it, off by default. */
export function setBuildHeld(on: boolean): void { held = on; }
/** A build stretch's budget: `budgetMs`, or HELD_BUILD_MS while the traveller is held. */
export function heldBudget(budgetMs: number): number { return held ? Math.max(budgetMs, HELD_BUILD_MS) : budgetMs; }
/** Whether the traveller is held at a grid cell's wall (`setBuildHeld`). */
export function buildHeld(): boolean { return held; }

/** Report completion and, when available, its rAF timestamp and active fps cap (0 = uncapped).
 * Build deadlines start at the vsync, not after the frame's work; missed vsyncs never relax an uncapped deadline.
 * `cadenceAt` is the capped loop recovery anchor: builders share its next deadline after a late frame.
 * Actual rAF stamps still determine uncapped display cadence; omitted anchors preserve the original deadline.
 * A completion-only caller retains the original smoothed interval. */
export function noteFrameDrawn(at: number = diagnosticNow(), frameAt?: number, capFps?: number, cadenceAt?: number): void {
  const start = cadenceAt ?? frameAt ?? at;
  // The synchronous first draw can land midway between vsyncs. Only two actual rAF stamps establish cadence.
  const gap = capFps === 0 ? (frameAt === undefined ? Number.POSITIVE_INFINITY : frameAt - lastVsyncAt) : start - lastFrameAt;
  if (capFps !== undefined && capFps > 0) interval = 1000 / capFps;
  else if (gap > 4 && gap < 70) interval = capFps === 0 ? Math.min(interval, gap) : interval + (gap - interval) * 0.2;
  lastVsyncAt = frameAt ?? Number.NEGATIVE_INFINITY;
  lastFrameAt = start; lastDrawn = at;
}

/** Whether the engine loop is drawing frames: a build now runs between drawn frames, in play. */
export function presenting(now: number = diagnosticNow()): boolean { return now - lastDrawn < PRESENTING_MS; }

/** Whether a presenting page's next frame is due (its interval since the last drawn frame has run out). */
export function frameDue(now: number = diagnosticNow()): boolean {
  return presenting(now) && now - lastFrameAt >= interval - DUE_SLACK_MS;
}

/**
 * Whether a presenting page's build work since its last drawn frame has used `budgetMs`, at most a quarter of the game frame and half a 60 Hz display slot: the budget is the
 * frame's, shared by every sliced build running at once. Each slice's own clock alone let several builds (a herd's coats,
 * the ground's arrays, the terrain) each run their stretch back to back, so no frame was drawn for 100-130 ms.
 */
export function frameBudgetSpent(budgetMs: number, now: number = diagnosticNow()): boolean {
  if (held) return presenting(now) && now - lastDrawn >= heldBudget(budgetMs);
  // D110: a frame that overran its interval (drawn after the next was due: a phone at 4x CPU) is due the moment it lands,
  // so the due rule would end every slice before it starts and no sliced build would run again; after such a frame the
  // builds get their ordinary slice instead
  const overran = lastDrawn - lastFrameAt >= interval - DUE_SLACK_MS;
  return presenting(now) && (now - lastDrawn >= Math.min(budgetMs, interval / 4, BUILD_FRAME_MS / 2) || (!overran && frameDue(now)));
}


/** Resolve after a later drawn frame (rAF, then a scoped task), or its cap. Retirement also settles the wait;
 * the awaiting builder must reach its own cancellation fence rather than hang on a removed frame callback. */
export function nextDrawnFrame(owner?: Scope): Promise<void> {
  const scope = owner ?? resourceScope(), since = lastDrawn, start = diagnosticNow();
  return new Promise<void>((resolve) => {
    let done = false, forget = (): void => undefined;
    const finish = (): void => { if (done) return; done = true; forget(); resolve(); };
    forget = scope.capture('disposers', finish);
    const check = (): void => {
      if (done) return;
      if (lastDrawn > since || diagnosticNow() - start >= WAIT_CAP_MS || typeof globalThis.requestAnimationFrame !== 'function') { finish(); return; }
      // A task after rAF leaves paint first. A nested timer costs 4 ms of the next build's frame before any work starts.
      scope.raf(() => {
        if (typeof globalThis.MessageChannel !== 'function') { scope.timeout(0, check); return; }
        const channel = new MessageChannel(), turn = scope.child('frame-turn');
        turn.onDispose(() => { channel.port1.close(); channel.port2.close(); });
        turn.listen(channel.port1, 'message', () => { turn.dispose(); scope.run(check); }, { once: true });
        channel.port1.start(); channel.port2.postMessage(0);
      });
    };
    check();
  });
}

/**
 * End a build stretch: when presenting and a frame is due, wait for the loop to draw it; otherwise `plain()` (the caller's
 * own macrotask hop: a timer, a MessageChannel). `budgetMs`: also wait once the builds since the last drawn frame have used
 * that much of it (`frameBudgetSpent`), so concurrent sliced builds share one frame's budget. Queued live tasks recheck
 * this fence on delivery, before admitting their awaiting continuation.
 */
export function paceYield(plain: () => Promise<void>, owner?: Scope, budgetMs?: number): Promise<void> {
  const now = diagnosticNow();
  if (yieldDue(budgetMs, now)) return nextDrawnFrame(owner);
  const turn = plain();
  // Other builders can spend the frame while this task is queued. A message/timer hop alone must not admit its
  // awaiting continuation on the stale pre-hop budget. Loading and Node keep the original promise/turn unchanged.
  return presenting(now) ? turn.then(() => owner?.disposed !== true && yieldDue(budgetMs, diagnosticNow()) ? nextDrawnFrame(owner) : undefined) : turn;
}

function yieldDue(budgetMs: number | undefined, now: number): boolean {
  return !held && frameDue(now) || (budgetMs !== undefined && frameBudgetSpent(budgetMs, now));
}
