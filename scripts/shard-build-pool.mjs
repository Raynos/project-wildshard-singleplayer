// Bound CPU-heavy author builds by process; the parent owns cache publication and catalogue admission.
import { spawn } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';

/** @template T @param {readonly T[]} items @param {(item:T,signal:AbortSignal)=>Promise<void>} work */
export async function runShardBuildPool(items, work) {
  const controller = new AbortController();
  let next = 0;
  /** @type {{failed:boolean,failure:unknown}} */
  const state = { failed: false, failure: undefined };
  await Promise.all(Array.from({ length: Math.min(6, items.length) }, async () => {
    while (!controller.signal.aborted && next < items.length) {
      const item = items[next++];
      try { await work(item, controller.signal); }
      catch (error) {
        if (!state.failed) { state.failed = true; state.failure = error; controller.abort(); }
      }
    }
  }));
  if (state.failed) throw state.failure;
}

/** One product per child. Keep the build lease, cache and input-recorder environment.
 * @param {string[]} args @param {AbortSignal} signal @returns {Promise<void>} */
export function runShardBuild(args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', resolvePath(import.meta.dirname,'shardfile-inputs.mjs'), resolvePath(import.meta.dirname, 'wildshard.mjs'), ...args], {
      cwd: resolvePath(import.meta.dirname, '..'), env: process.env, signal, stdio: ['ignore', 'inherit', 'inherit'],
    });
    /** @type {Error|undefined} */
    let failure;
    child.on('error', error => { failure = error; });
    child.on('close', (code, killed) => failure !== undefined ? reject(failure)
      : code === 0 ? resolve() : reject(new Error(`Shard build exited ${String(code ?? killed)}`)));
  });
}
