import { startPageServices } from './pageServices';
import { persistHomeScreen } from '#engine/saves/runtime';
/**
 * The page's module entry. Everything the game imports statically is evaluated in ONE task when a module graph
 * runs: three.js plus the ~150 game modules at once was a 115–157 ms long task at 4× CPU before the first boot step
 * (project/archive/2026-09-22-load-perf.md, "longest main-thread task ≤ 100 ms"). Importing three.js first, in its own task, leaves
 * the game's own graph (src/main.ts) to evaluate against a three that already ran — two tasks under the line. The
 * title shell is already painted from index.html, so nothing waits on this but the boot itself.
 *
 * Both imports can fail before the error modal is armed (main.ts arms it): a chunk the host no longer serves, a network
 * gone mid-boot. src/engine/boot/stuck.ts watches the promise so that never leaves a frozen loader (E144).
 *
 * E188: a network gone mid-boot is the common one. main is ~1.1 MB gzipped, and on LTE a hand-over drops it mid-file;
 * WebKit reports that as "Importing a module script failed" and, unlike Chromium, fetches the file again on the next
 * import() of the same URL. Two more tries, a beat apart, make a dropped connection a slower boot instead of the
 * stuck card. A module that fetched fine but threw is not run twice: the engine keeps it errored and rethrows at once.
 */
import { guardBoot } from '#engine/boot/stuck';
import { inspectPreviousBoot, previousBootLine, previousBootLevel } from '#engine/boot/bootTrace';
import { setting } from '#engine/ui/Settings';
import { Scope } from '#engine/app/scope';

const entryScope = new Scope('entry');
const task = (): Promise<void> => new Promise((resolve) => { entryScope.timeout(0, resolve); });
const sleep = (ms: number): Promise<void> => new Promise((resolve) => { entryScope.timeout(ms, resolve); });

/** `load()`, and again after 0.8 s and 2.5 s if it rejects: the last try's rejection is the one stuck.ts sees */
async function retried<T>(load: () => Promise<T>): Promise<T> {
  for (const wait of [800, 2500]) {
    try { return await load(); } catch { await sleep(wait); }
  }
  return load();
}

/** The plain home URL paints only the title. No renderer, world, or Three.js is imported until a shard is chosen. */
startPageServices();
persistHomeScreen();
const search = new URLSearchParams(location.search);
// Do not depend on the sibling sw.ts module finishing first; both entry points share the same consumed record.
inspectPreviousBoot();
// Safari may reload the same document after WebContent dies. Keep that automatic retry on the
// renderer-free title until the player chooses a shard again.
const rescueBoot = previousBootLine() !== '' && search.get('chunk') === previousBootLevel();
if (rescueBoot) {
  history.replaceState(history.state, '', new URL('/', location.origin));
  // index.html picked the loading shell from the original URL before this module ran.
  document.documentElement.classList.add('title-first');
  document.querySelector<HTMLElement>('.ws-resume')?.classList.remove('show');
}
const titleOnly = rescueBoot || search.size === 0 || (search.size === 1 && search.has('v'));

/** resolves once the title or the selected shard's entry has been evaluated */
export const entered: Promise<unknown> = setting('calibrate') === 'run' ? import('#engine/calibrate/entry').then((m) => m.enterCalibration()) : titleOnly ? retried(() => import('#engine/ui/StartTitle')) : (async () => {
  const { initializeTier } = await retried(() => import('#engine/core/tier'));
  await initializeTier();
  await retried(() => import('three'));
  await task();
  return retried(() => import('./main'));
})();
guardBoot(entered);

/** Composition root: select authored content and inject reusable kit recipes. */
export async function start(): Promise<void> {
  const [{ game }, kit, { loadBootRuntime }, { sharedCombatCues }] = await Promise.all([
    import('#game'), import('#kit'), import('#engine'), import('#kit/audio/combatCues'),
  ]);
  const manifest = game.shard;
  kit.installKitSpecies();
  const engine = await loadBootRuntime();
  const { startSession } = await import('#game/session/session');
  await startSession(manifest, engine, {
    items: kit.KIT_ITEMS,
    tools: [kit.HOVERBOARD_TOOL],
    combatCues: (audio, silent) => sharedCombatCues(kit.sharedWeaponVoices(audio), silent),
  });
}
