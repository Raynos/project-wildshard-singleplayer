import { spawn } from 'node:child_process';

/** @typedef {{name: string, command: string[], cwd?: string}} CommitJob */
/** @typedef {{name: string, code: number, timedOut: boolean, output: string}} CommitResult */

/** Every child shares one wall deadline, including its complete process group.
 * @param {string} root @param {CommitJob[]} jobs @param {number} deadline
 * @param {Record<string, string | undefined>} env @returns {Promise<CommitResult[]>} */
export function runCommitJobs(root, jobs, deadline, env = process.env) {
  return Promise.all(jobs.map(job => new Promise(resolve => {
    const executable = job.command.at(0);
    if (executable === undefined) { resolve({ name: job.name, code: 1, timedOut: false, output: 'Empty commit command' }); return; }
    const child = spawn(executable, job.command.slice(1), { cwd: job.cwd ?? root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', timedOut = false;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    /** @param {string} value */
    const append = value => { output += value; };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) output += String(error); }
      }
    }, Math.max(0, deadline - performance.now()));
    child.once('error', error => { clearTimeout(timer); resolve({ name: job.name, code: 1, timedOut, output: output + error.message }); });
    child.once('close', code => { clearTimeout(timer); resolve({ name: job.name, code: timedOut ? 124 : code ?? 1, timedOut, output }); });
  })));
}

/** Related selection is push-only; fixture inventories have explicit inputs.
 * @param {readonly string[]} changed @returns {string[]} */
export function commitGuards(changed) {
  const touches = (/** @type {RegExp} */ pattern) => changed.some(file => pattern.test(file));
  return [
    ...(touches(/^src\/(?:format|sdk)\//u) ? ['test/schema-reference.test.ts'] : []),
    ...(touches(/^(?:lint\/(?:host-callbacks\.mjs|wildshard-plugin\.js)|scripts\/gen-host-catalogue\.mjs|test\/host-callbacks\.test\.ts)$/u) ? ['test/host-callbacks.test.ts'] : []),
    ...(touches(/^(?:lint\/(?:shardfile-boundaries\.mjs|wildshard-plugin\.js)|test\/shardfile-boundaries\.test\.ts)$/u) ? ['test/shardfile-boundaries.test.ts'] : []),
    ...(touches(/^(?:src\/(?:engine|game|format|sdk)\/|scripts\/(?:platform-chargebacks|inline-platform|host-approvals|g571-hosts|shard-components|shard-platform)[^/]*\.|docs\/HOST-BAR\.md$|test\/platform-chargebacks\.test\.ts$)/u) ? ['test/platform-chargebacks.test.ts'] : []),
    ...(touches(/^(?:src\/shards\/(?:nalati-grasslands|nine-dragon-stack)\/|src\/game\/shard\/manifest\.ts$|scripts\/(?:authored-manifest|manifest-declaration)\.|test\/(?:manifest-declarations\.test\.ts|fixtures\/manifest-declarations\.json)$)/u) ? ['test/manifest-declarations.test.ts'] : []),
  ];
}
