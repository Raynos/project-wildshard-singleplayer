/**
 * The page's module entry. Everything the game imports statically is evaluated in ONE task when a module graph
 * runs: three.js plus the ~150 game modules at once was a 115–157 ms long task at 4× CPU before the first boot step
 * (project/archive/2026-09-22-load-perf.md, "longest main-thread task ≤ 100 ms"). Importing three.js first, in its own task, leaves
 * the game's own graph (src/main.ts) to evaluate against a three that already ran — two tasks under the line. The
 * title shell is already painted from index.html, so nothing waits on this but the boot itself.
 */
const task = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

/** resolves once src/main.ts has been evaluated (its `main()` is then running) */
export const entered: Promise<unknown> = (async () => {
  await import('three');
  await task();
  return import('../main');
})();
