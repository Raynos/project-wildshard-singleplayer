import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Bounded scheduling preserves input order and drains every started task before throwing.
 * @template T,R @param {T[]} items @param {number} jobs @param {(item:T,index:number,slot:number)=>Promise<R>} task @param {(slot:number)=>Promise<void>} [onIdle] */
export async function parallel(items, jobs, task, onIdle) {
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error('usage: --jobs must be 1..8');
  /** @type {R[]} */ const results = [];
  /** @type {unknown[]} */ const errors = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async (_, slot) => {
    try {while (next < items.length && errors.length === 0) {
      const index = next++, item = items[index];
      try { results[index] = await task(item, index, slot); } catch (error) { errors.push(error); }
    }}finally{try{await onIdle?.(slot);}catch(error){errors.push(error);}}
  }));
  if (errors.length > 0) throw errors[0];
  return results;
}

/** @param {string} root @param {string} angle */
async function open(root, angle) {
  const launcher = join(root, 'scripts/parity/lane-browser.mjs');
  const child = process.platform === 'darwin'
    ? spawn(join(root, 'scripts/browser-lane.sh'), ['--max', '90', process.execPath, launcher, angle], { stdio: ['pipe', 'pipe', 'inherit'] })
    : spawn(process.execPath, [launcher, angle], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = createInterface({ input: child.stdout });
  try {
    const endpoint = await new Promise((resolve, reject) => {
      lines.on('line', (line) => { if (line.startsWith('ws://')) resolve(line); });
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`lane browser exited before launch: ${code}`)));
    });
    const browser = await chromium.connect(String(endpoint));
    return { browser, close: async () => {
      try { await browser.close(); } finally {
        lines.close(); child.stdin.end(); child.stdout.destroy();
        if (child.exitCode === null) await new Promise((resolve) => { child.once('exit', resolve); });
      }
    } };
  } catch (error) { lines.close(); child.stdin.end(); child.stdout.destroy(); throw error; }
}

/** Each persistent browser is held by its own lane subprocess; contexts are used sequentially per slot.
 * @param {string} root @param {number} jobs @param {string} angle */
export function browserPool(root, jobs, angle) {
  /** @type {Map<number,ReturnType<typeof open>>} */ const slots = new Map();
  const browser = async (/** @type {number} */ slot) => {
    let promise = slots.get(slot);
    if (!promise) { promise = open(root, angle); slots.set(slot, promise); }
    return (await promise).browser;
  };
  const release=async(/** @type {number} */slot)=>{const promise=slots.get(slot);slots.delete(slot);if(promise)await (await promise).close();};
  return { browser, release, close: async () => {
    const settled = await Promise.allSettled(slots.values());
    const closed = await Promise.allSettled(settled.filter((r) => r.status === 'fulfilled').map((r) => r.value.close()));
    for (const result of closed) if (result.status === 'rejected') throw result.reason;
  } };
}
