/** The phone spawn view finishes linking under loading; undrawn programs stay deferred. */
import type { Game } from '@wildshard/engine/core/Game';
import { liveWarmPacing, precompileLevel } from '@wildshard/engine/render/precompile';
import { boundEntryWarmup, ENTRY_NO_FRAME_MS, EntryWarmupStallError } from '@wildshard/engine/render/entryWarmupBound';
import { diagnosticNow } from '@wildshard/engine/core/clock';

/** FC2: counted offscreen draws of the spawn view (the real formats, nothing presented) with no new node builds before spawn
 *  is ready. A live frame used to be the probe (20 quiet drawn frames under the loader); one draw builds and links what
 *  the view draws, so three quiet ones settle it. */
const QUIET_DRAWS = 3;
/** Presented time the spawn view may take to link before the reveal goes ahead (ms): WebKit settles in ~1 s, Chromium
 *  phone 4x in ~3 s and 6x in ~9 s; 10x needs over 30 s. PL17: a slower device reveals after ~3 s of wall time and the
 *  in-play warm-up links the rest (G815), where the old 12 s cost the phone preset ~13 s on every entry, cold and warm.
 *  Presented time counts each rAF gap up to 100 ms, and 10x frames take 100-270 ms, so 2 s presented is ~2.9 s wall. */
const SPAWN_LINK_MS = 2000;

/** Compile only the spawn view and observe its real rendered programs, under the entry bound. Linking before the reveal
 * only smooths the first seconds of play: a device too slow to finish inside the bound (a CPU-throttled phone, where
 * each node build takes several hundred ms) reveals with what has linked and the in-play warm-up links the rest. A
 * stall is never a load error (G830, G837); `stalled` names the stage it stopped in, for the loading rulers. */
export async function settleEntryPrograms(game: Game): Promise<{ ms: number; builds: number; stalled: string | null }> {
  const start = diagnosticNow(), scope = game.levelScope, built = (): number => game.nodeBuilds?.builds ?? 0, from = built();
  let phase = 'spawn-program-links', stalled: string | null = null;
  try {
    let ticks = 0; // FC2: no frame is presented under the loader; the bound's progress is its own tick
    await boundEntryWarmup(scope, () => ++ticks, () => phase, async current => {
      // QA3 (G837): WebKit's live pacing, as every in-play warm-up has: a few programs issued a frame and each link polled
      // with backoff. Without it the step issued the whole spawn view, then asked its links' status; each ask is a
      // synchronous GPU-process round trip behind every queued compile, so one frame waited for them all (68 s on an iPhone).
      await precompileLevel(game, undefined, { sliceMs: 12, current, owner: scope, drawnOnly: true, warmPost: true, ...liveWarmPacing() });
      phase = 'spawn-program-settle';
      let quiet = 0, last = built();
      while (quiet < QUIET_DRAWS && current()) {
        game.offscreenDraw();
        await new Promise<void>(resolve => { scope.raf(() => { resolve(); }); });
        const now = built();
        if (now === last) quiet++; else { quiet = 0; last = now; }
      }
      if (!current()) throw new Error('Spawn program warm-up owner left');
    }, { noFrameMs: ENTRY_NO_FRAME_MS, totalMs: SPAWN_LINK_MS });
  } catch (error) {
    if (!(error instanceof EntryWarmupStallError) || scope.disposed) throw error;
    stalled = error.message;
  }
  const result = { ms: diagnosticNow() - start, builds: built() - from, stalled };
  performance.mark('wildshard.entry.programs-settled', { detail: result });
  return result;
}
