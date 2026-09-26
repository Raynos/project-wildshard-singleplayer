/**
 * The page's module entry. Everything the game imports statically is evaluated in ONE task when a module graph
 * runs: three.js plus the ~150 game modules at once was a 115–157 ms long task at 4× CPU before the first boot step
 * (project/archive/2026-09-22-load-perf.md, "longest main-thread task ≤ 100 ms"). Importing three.js first, in its own task, leaves
 * the game's own graph (src/main.ts) to evaluate against a three that already ran — two tasks under the line. The
 * title shell is already painted from index.html, so nothing waits on this but the boot itself.
 *
 * Both imports can fail before the error modal is armed (main.ts arms it): a chunk the host no longer serves, a network
 * gone mid-boot. src/boot/stuck.ts watches the promise so that never leaves a frozen loader (E144).
 *
 * E188: a network gone mid-boot is the common one. main is ~1.1 MB gzipped, and on LTE a hand-over drops it mid-file;
 * WebKit reports that as "Importing a module script failed" and, unlike Chromium, fetches the file again on the next
 * import() of the same URL. Two more tries, a beat apart, make a dropped connection a slower boot instead of the
 * stuck card. A module that fetched fine but threw is not run twice: the engine keeps it errored and rethrows at once.
 */
import { guardBoot } from './stuck';

const task = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/** `load()`, and again after 0.8 s and 2.5 s if it rejects: the last try's rejection is the one stuck.ts sees */
async function retried<T>(load: () => Promise<T>): Promise<T> {
  for (const wait of [800, 2500]) {
    try { return await load(); } catch { await sleep(wait); }
  }
  return load();
}

/** resolves once src/main.ts has been evaluated (its `main()` is then running) */
export const entered: Promise<unknown> = (async () => {
  await retried(() => import('three'));
  await task();
  return retried(() => import('../main'));
})();
guardBoot(entered);
