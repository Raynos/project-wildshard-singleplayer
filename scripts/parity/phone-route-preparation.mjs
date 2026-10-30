import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** @typedef {{engine:'simulator'|'webkit',status:'pending'|'ready'|'failed',wallMs:number,code:number|null,udid:string|null}} PhonePreparation */

/** Early boot owns the ordinary named-device lease. Failure is published too:
 * the route must not turn a failed preparation into a second boot attempt.
 * @param {string} path @param {'simulator'|'webkit'} engine */
export function preparePhoneSimulator(path, engine) {
  mkdirSync(dirname(path), { recursive:true });
  const started = performance.now();
  /** @type {PhonePreparation} */
  const state = {engine,status:'pending',wallMs:0,code:null,udid:null};
  const publish = () => {
    const pending = `${path}.${process.pid}`;
    writeFileSync(pending, JSON.stringify(state)); renameSync(pending,path);
  };
  publish();
  try {
    const child = engine === 'simulator'
      ? spawnSync('scripts/sim-lane.sh',['lease','wildshard-iphone','10'],{encoding:'utf8',stdio:['ignore','pipe','inherit']})
      : {status:0,stdout:''};
    state.code = child.status;
    state.udid = engine === 'simulator' ? child.stdout?.trim() ?? null : null;
    if (child.status !== 0 || (engine === 'simulator' && !/^[A-F0-9-]{36}$/iu.test(state.udid ?? '')))
      throw new Error(`Simulator preparation failed (${child.status})`);
    state.status = 'ready';
  } catch (error) {
    state.status = 'failed'; throw error;
  } finally {
    state.wallMs = performance.now()-started; publish();
  }
}

/** Observe the exact background job's atomic completion. No warm-up sleep,
 * boot retry or WebKit fallback after a real native startup failure.
 * @param {string} path @returns {Promise<PhonePreparation>} */
export function waitPhonePreparation(path) {
  mkdirSync(dirname(path), {recursive:true});
  return new Promise((resolve,reject) => {
    const watcher = watch(dirname(path),check);
    watcher.on('error',fail);
    function fail(/** @type {unknown} */ error) { watcher.close(); reject(error instanceof Error ? error : new Error(String(error))); }
    function check() {
      let state;
      try { state = /** @type {unknown} */ (JSON.parse(readFileSync(path,'utf8'))); }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
        fail(error); return;
      }
      if (typeof state !== 'object' || state === null || !('engine' in state) || !['simulator','webkit'].includes(String(state.engine))
        || !('status' in state) || !['pending','ready','failed'].includes(String(state.status))
        || !('wallMs' in state) || typeof state.wallMs !== 'number' || !Number.isFinite(state.wallMs) || state.wallMs < 0
        || !('code' in state) || !('udid' in state)) {
        fail(new Error('Invalid Simulator preparation receipt')); return;
      }
      if (state.status === 'pending') return;
      if (state.status !== 'ready' || state.code !== 0 || (state.engine === 'simulator' && (typeof state.udid !== 'string' || !/^[A-F0-9-]{36}$/iu.test(state.udid)))) {
        fail(new Error(`Simulator preparation failed (${String(state.code)})`)); return;
      }
      watcher.close();
      resolve({engine:state.engine === 'simulator'?'simulator':'webkit',status:'ready',wallMs:state.wallMs,code:0,udid:typeof state.udid === 'string'?state.udid:null});
    }
    check();
  });
}
