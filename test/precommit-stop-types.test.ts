// oxlint-disable-next-line import/no-nodejs-modules -- Real children prove completed-test refusal and owned cleanup.
import { spawn } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- All commands run in this checkout without fixture assets.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node executable as the commit worker.
import { execPath } from 'node:process';
import { expect, test } from 'vitest';
import { runCommitJobs, type CommitResult } from '../scripts/precommit-jobs.mjs';
import { relatedTestFailed } from '../scripts/precommit-related.mjs';

const root = resolve('.');

test('a completed own test refusal drains warm types and preserves a foreign child', async () => {
  const controller = new AbortController();
  const control = spawn(execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const closed = new Promise<void>(_resolve => { control.once('close', () => { _resolve(); }); });
  const observed: CommitResult[] = [];
  const started = performance.now();
  try {
    const results = await runCommitJobs(root, [
      { name: 'related tests', command: [execPath, '-e', 'console.log("all selected cases completed");console.error("CF1 TEST FAILURE: own-token test/value.test.ts: red");process.exitCode=1'] },
      { name: 'warm types', command: [execPath, '-e', 'setInterval(()=>{},1000)'] },
    ], started + 5000, undefined, controller.signal, result => {
      observed.push(result);
      if (relatedTestFailed(result, 'own-token')) controller.abort();
    });
    console.info(`SW11 completed-red wall ${Math.round(performance.now() - started)} ms`);
    expect(results[0]).toMatchObject({ code: 1, timedOut: false });
    expect(results[0]?.output).toContain('all selected cases completed');
    expect(results[1]).toMatchObject({ code: 130, timedOut: false, cancelled: true });
    expect(observed.filter(result => result.name === 'related tests')).toHaveLength(1);
    const pid = control.pid;
    if (pid === undefined) throw new Error('Missing independent control');
    expect(() => process.kill(pid, 0)).not.toThrow();
  } finally { control.kill('SIGKILL'); await closed; }
});

test('successful tests and nested fixture reds leave warm types running to completion', async () => {
  for (const nested of [false, true]) {
    const controller = new AbortController();
    const results = await runCommitJobs(root, [
      { name: 'related tests', command: [execPath, '-e', nested ? 'console.error("CF1 TEST FAILURE: nested-token test/value.test.ts: red");process.exitCode=1' : 'console.log("all selected cases completed")'] },
      { name: 'warm types', command: [execPath, '-e', 'setTimeout(()=>console.log("types completed"),50)'] },
    ], performance.now() + 3000, undefined, controller.signal, result => {
      if (relatedTestFailed(result, 'own-token')) controller.abort();
    });
    expect(results[1]).toMatchObject({ code: 0, timedOut: false, output: 'types completed\n' });
    expect(controller.signal.aborted).toBe(false);
  }
});

test('a failed spawn is observed once and keeps its original nonzero result', async () => {
  const observed: CommitResult[] = [];
  const results = await runCommitJobs(root, [{ name: 'missing worker', command: [resolve('tmp/no-such-sw11-worker')] }],
    performance.now() + 1000, undefined, undefined, result => { observed.push(result); });
  expect(results[0]).toMatchObject({ code: 1, timedOut: false });
  expect(observed).toHaveLength(1);
  expect(observed[0]).toEqual(results[0]);
});
