import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Wait only for this run's artifact producer, never the aggregate that includes
 * this phone job. Waiting spends the existing twenty-minute job budget.
 * @param {string} repository @param {string} run
 * @param {{read?:(path:string)=>Promise<unknown>,now?:()=>number,wait?:(ms:number)=>Promise<void>}} [ports] */
export async function waitPhoneProducer(repository, run, ports = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository) || !/^[1-9][0-9]*$/u.test(run) || !Number.isSafeInteger(Number(run)))
    throw new Error('Invalid phone producer identity');
  const read = ports.read ?? (path => {
    const result = spawnSync('gh', ['api', path, '--jq', '[.jobs[] | {name,status,conclusion,started_at,run_id}]'], {timeout:12000,encoding:'utf8'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Phone producer query failed: ${result.stderr}`);
    return Promise.resolve(/** @type {unknown} */ (JSON.parse(result.stdout)));
  });
  const now = ports.now ?? Date.now;
  const wait = ports.wait ?? (ms => new Promise(resolve => {setTimeout(resolve,ms);}));
  for (;;) {
    const rows = await read(`repos/${repository}/actions/runs/${run}/jobs?per_page=100&filter=latest`);
    if (!Array.isArray(rows)) throw new Error('Invalid phone producer job inventory');
    /** @type {unknown[]} */
    const values = rows;
    const jobs = values.map(row => {
      if (typeof row !== 'object' || row === null || !('name' in row) || !('status' in row)
        || !('conclusion' in row) || !('started_at' in row) || !('run_id' in row))
        throw new Error('Invalid phone producer job row');
      return row;
    });
    const self = jobs.filter(row => row.name === 'phone-route');
    const producers = jobs.filter(row => row.name === 'prepare');
    const own = self[0];
    if (self.length !== 1 || own === undefined || own.run_id !== Number(run) || own.status !== 'in_progress'
      || typeof own.started_at !== 'string' || producers.length > 1)
      throw new Error('Phone producer wait is not the current job');
    const started = Date.parse(own.started_at), remaining = started + 20*60*1000 - now();
    if (!Number.isFinite(started) || remaining <= 0 || remaining > 20*60*1000)
      throw new Error('Phone producer wait exhausted its original job deadline');
    const producer = producers[0];
    if (producer !== undefined) {
      if (producer.run_id !== Number(run) || typeof producer.status !== 'string' || !['queued','in_progress','completed'].includes(producer.status))
        throw new Error('Invalid phone artifact producer');
      if (producer.status === 'completed') {
        if (producer.conclusion !== 'success') throw new Error(`Phone artifact producer failed: ${String(producer.conclusion)}`);
        return;
      }
    }
    await wait(Math.min(5000,remaining));
  }
}

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
