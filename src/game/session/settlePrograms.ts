/** The phone spawn view finishes linking under loading; undrawn programs stay deferred. */
import type { Game } from '@wildshard/engine/core/Game';
import { precompileLevel, waitForDrawnFrame } from '@wildshard/engine/render/precompile';
import { boundEntryWarmup } from '@wildshard/engine/render/entryWarmupBound';
import { diagnosticNow } from '@wildshard/engine/core/clock';

/** Actual drawn frames with no new node builds before spawn is ready. */
const QUIET_FRAMES = 20;

/** Compile only the spawn view and observe its real rendered programs. The existing
 * entry bound rejects a stall; reaching a deadline never admits unfinished shaders. */
export async function settleEntryPrograms(game: Game): Promise<{ ms: number; builds: number }> {
  const start = diagnosticNow(), scope = game.levelScope, built = (): number => game.nodeBuilds?.builds ?? 0, from = built();
  let phase = 'spawn-program-links';
  await boundEntryWarmup(scope, () => game.frameCount, () => phase, async current => {
    await precompileLevel(game, undefined, { sliceMs: 12, current, owner: scope, drawnOnly: true, warmPost: true });
    phase = 'spawn-program-settle';
    let quiet = 0, last = built();
    while (quiet < QUIET_FRAMES && current()) {
      await waitForDrawnFrame(scope, () => game.frameCount, current);
      const now = built();
      if (now === last) quiet++; else { quiet = 0; last = now; }
    }
    if (!current()) throw new Error('Spawn program warm-up owner left');
  });
  const result = { ms: diagnosticNow() - start, builds: built() - from };
  performance.mark('wildshard.entry.programs-settled', { detail: result });
  return result;
}
