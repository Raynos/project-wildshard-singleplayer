// Bound CPU-heavy author builds by process; the parent owns cache publication and catalogue admission.
import { spawn } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import {shardfileCacheRoot} from './shardfile-cache.mjs';

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
      cwd: resolvePath(import.meta.dirname, '..'), env: {...process.env,WILDSHARD_WORLD_TEXTURE_CACHE:process.env.WILDSHARD_WORLD_TEXTURE_CACHE??resolvePath(shardfileCacheRoot(),'.world-textures-v1')}, signal, stdio: ['ignore', 'inherit', 'pipe'],
    });
    // Forward all diagnostics, retaining only a bounded tail for the pool's error.
    let stderrTail = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (/** @type {string} */ chunk) => {
      process.stderr.write(chunk);
      stderrTail = (stderrTail + chunk).slice(-8192);
    });
    /** @type {Error|undefined} */
    let failure;
    child.on('error', error => { failure = error; });
    child.on('close', (code, killed) => failure !== undefined ? reject(failure)
      : code === 0 ? resolve() : reject(new Error(`Shard build exited ${String(code ?? killed)} (${args[1] ?? 'unknown product'})\n${stderrTail.trim() || 'Child stderr was empty'}`)));
  });
}
