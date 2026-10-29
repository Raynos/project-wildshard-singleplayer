/** The phone spawn view finishes linking under loading; undrawn programs stay deferred. */
import type { Game } from '@wildshard/engine/core/Game';
import { liveWarmPacing, precompileLevel } from '@wildshard/engine/render/precompile';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { waitEntryWork } from './entryReadiness';

/** FC2: counted offscreen draws of the spawn view (the real formats, nothing presented) with no new node builds before spawn
 *  is ready. A live frame used to be the probe (20 quiet drawn frames under the loader); one draw builds and links what
 *  the view draws, so three quiet ones settle it. */
const QUIET_DRAWS = 3;
/** Compile the spawn view and observe three unchanged draws before reveal, however long linking takes. */
export async function settleEntryPrograms(game: Game): Promise<{ ms: number; builds: number; stalled: string | null }> {
  const start = diagnosticNow(), scope = game.levelScope, built = (): number => game.nodeBuilds?.builds ?? 0, from = built();
  await waitEntryWork(scope, async current => {
    // QA3 (G837): WebKit's live pacing, as every in-play warm-up has: a few programs issued a frame and each link polled
    // with backoff. Without it the step issued the whole spawn view, then asked its links' status; each ask is a
    // synchronous GPU-process round trip behind every queued compile, so one frame waited for them all (68 s on an iPhone).
    await precompileLevel(game, undefined, { sliceMs: 12, current, owner: scope, drawnOnly: true, warmPost: true, ...liveWarmPacing() });
    let quiet = 0, last = built();
    while (quiet < QUIET_DRAWS && current()) {
      game.offscreenDraw();
      await new Promise<void>(resolve => { scope.raf(() => { resolve(); }); });
      const now = built();
      if (now === last) quiet++; else { quiet = 0; last = now; }
    }
    if (!current()) throw new Error('Spawn program warm-up owner left');
  });
  const result = { ms: diagnosticNow() - start, builds: built() - from, stalled: null };
  performance.mark('wildshard.entry.programs-settled', { detail: result });
  return result;
}
