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
 * The Developer tool `buildPacing` (pause ▸ Settings ▸ Developer ▸ Performance) can switch it off: `presenting()` is then
 * always false and every caller runs exactly as it did before. `Game` wires the page's setting; importing this module alone
 * does not enable pacing.
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

let lastDrawn = Number.NEGATIVE_INFINITY;
let lastFrameAt = Number.NEGATIVE_INFINITY;
let enabled = false;
/** Declared capped cadence, or the fastest observed uncapped cadence; legacy completion-only calls smooth it. */
let interval = 1000 / 60;

/** Report completion and, when available, its rAF timestamp and active fps cap (0 = uncapped).
 * Build deadlines start at the vsync, not after the frame's work; missed vsyncs never relax an uncapped deadline.
 * A completion-only caller retains the original smoothed interval. */
export function noteFrameDrawn(at: number = diagnosticNow(), frameAt?: number, capFps?: number): void {
  const start = frameAt ?? at, gap = start - lastFrameAt;
  if (capFps !== undefined && capFps > 0) interval = 1000 / capFps;
  else if (gap > 4 && gap < 70) interval = capFps === 0 ? Math.min(interval, gap) : interval + (gap - interval) * 0.2;
  lastFrameAt = start; lastDrawn = at;
}

/** Turn the pacing on or off (the `buildPacing` Developer tool; `Game` wires it). Off, `presenting()` is always false. */
export function setFramePacing(on: boolean): void { enabled = on; }

/** Whether pacing is on and the engine loop is drawing frames: a build now runs between drawn frames, in play. */
export function presenting(now: number = diagnosticNow()): boolean { return enabled && now - lastDrawn < PRESENTING_MS; }

/** Whether a presenting page's next frame is due (its interval since the last drawn frame has run out). */
export function frameDue(now: number = diagnosticNow()): boolean {
  return presenting(now) && now - lastFrameAt >= interval - DUE_SLACK_MS;
}

/**
 * Whether a presenting page's build work since its last drawn frame has used `budgetMs` (op-hitch44): the budget is the
 * frame's, shared by every sliced build running at once. Each slice's own clock alone let several builds (a herd's coats,
 * the ground's arrays, the terrain) each run their stretch back to back, so no frame was drawn for 100-130 ms.
 */
export function frameBudgetSpent(budgetMs: number, now: number = diagnosticNow()): boolean {
  return presenting(now) && (now - lastDrawn >= budgetMs || frameDue(now));
}

/** The reported or inferred interval between drawn frames (ms); completion-only callers retain smoothing. */
export function frameInterval(): number { return interval; }

/** Resolve after the loop has drawn a frame later than now (rAF, then a timer task after its paint), or after `WAIT_CAP_MS`. */
export function nextDrawnFrame(owner?: Scope): Promise<void> {
  const scope = owner ?? resourceScope(), since = lastDrawn, start = diagnosticNow();
  return new Promise<void>((resolve) => {
    const check = (): void => {
      if (lastDrawn > since || diagnosticNow() - start >= WAIT_CAP_MS || typeof globalThis.requestAnimationFrame !== 'function') { resolve(); return; }
      // rAF alone resumes before the paint: a timer task after it runs once the frame has gone out
      scope.raf(() => { scope.timeout(0, check); });
    };
    check();
  });
}

/**
 * End a build stretch: when presenting and a frame is due, wait for the loop to draw it; otherwise `plain()` (the caller's
 * own macrotask hop: a timer, a MessageChannel). `budgetMs`: also wait once the builds since the last drawn frame have used
 * that much of it (`frameBudgetSpent`), so concurrent sliced builds share one frame's budget.
 */
export function paceYield(plain: () => Promise<void>, owner?: Scope, budgetMs?: number): Promise<void> {
  const now = diagnosticNow();
  return frameDue(now) || (budgetMs !== undefined && frameBudgetSpent(budgetMs, now)) ? nextDrawnFrame(owner) : plain();
}
