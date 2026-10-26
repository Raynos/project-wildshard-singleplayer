/**
 * G717 A: the phone tier's initial entry builds its first played frames' programs under the loader.
 *
 * The Shaders step compiles only what the first frame draws. The rest used to build in play: the undrawn programs a few a
 * frame (the in-play warm-up), and the ones a world first draws once its systems run (ground cover filling its instances
 * in). A stock node-program build costs the Simulator 50–110 ms, one slow frame each, so the spawn view missed its 30 fps
 * floor for the first seconds. On the phone tier the boot now runs that warm-up with the loop going under the loader and
 * waits until the drawn frames stop building programs (a run of quiet frames, capped), then lets controls go (the loader
 * keeps its last boot step's line: a painted step after world setup is refused). Desktop
 * and every road crossing are unchanged: crossings never run this boot path.
 */
import type { Game } from '@wildshard/engine/core/Game';
import { precompileLevel } from '@wildshard/engine/render/precompile';
import { diagnosticNow } from '@wildshard/engine/core/clock';

/** drawn frames with no new node build before the settle ends */
const QUIET_FRAMES = 20;
/** the settle never holds the loader longer than this (ms) */
const SETTLE_CAP_MS = 3000;

/** Run the undrawn-program warm-up and wait for the drawn frames' builds to settle, under the loader as it stands (its
 *  boot steps are done: it shows the first frame's last line). Returns what it added (ms) and the node builds it caught. */
export async function settleEntryPrograms(game: Game): Promise<{ ms: number; builds: number }> {
  const start = diagnosticNow(), scope = game.levelScope, built = (): number => game.nodeBuilds?.builds ?? 0, from = built();
  await precompileLevel(game, undefined, { sliceMs: 12, current: () => !scope.disposed });
  let quiet = 0, last = built();
  while (!scope.disposed && quiet < QUIET_FRAMES && diagnosticNow() - start < SETTLE_CAP_MS) {
    await new Promise<void>((resolve) => { scope.raf(() => { resolve(); }); });
    const now = built();
    if (now === last) quiet++; else { quiet = 0; last = now; }
  }
  const result = { ms: diagnosticNow() - start, builds: built() - from };
  performance.mark('wildshard.entry.programs-settled', { detail: result });
  return result;
}
