// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual pre-checkout admission glue without GitHub.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove each isolated fake-CLI directory.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned fixture files.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import workflow from '../.github/workflows/deploy.yml?raw';

const sha = 'a'.repeat(40);
const job = (status: string, conclusion: string | null) => ({
  name: 'prepare', run_id: 123, run_attempt: 2, head_sha: sha, status, conclusion,
});
const inventory = (jobs: unknown[]) => ({ total_count: jobs.length, jobs });

function execute(data: unknown, apiExit = 0, event = 'push') {
  const section = workflow.split('\n  fixtures:\n')[1]?.split('\n  behaviour:\n')[0];
  const block = section?.split('      - name: Admit optional fixtures for this prepare\n')[1]?.split('\n      - ')[0];
  const code = block?.split('        run: |\n')[1]?.split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
  if (code === undefined) throw new Error('Missing actual fixture admission');
  const directory = resolve(mkdtempSync('tmp/fixture-admission-'));
  try {
    const bin = resolve(directory, 'bin'), output = resolve(directory, 'output'), summary = resolve(directory, 'summary');
    mkdirSync(bin);
    writeFileSync(resolve(directory, 'response'), JSON.stringify(data));
    writeFileSync(resolve(bin, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$@" >> "$ADMISSION_CALLS"\ncat "$ADMISSION_RESPONSE"\nexit "$ADMISSION_EXIT"\n', { mode: 0o755 });
    const calls = resolve(directory, 'calls');
    const result = spawnSync('bash', ['-e', '-c', code], {
      cwd: directory, encoding: 'utf8', timeout: 5000,
      env: { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`,
        GITHUB_REPOSITORY: 'Raynos/project-wildshard-singleplayer', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2',
        GITHUB_EVENT_NAME: event,
        GITHUB_SHA: sha, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
        ADMISSION_RESPONSE: resolve(directory, 'response'), ADMISSION_CALLS: calls, ADMISSION_EXIT: String(apiExit) },
    });
    return { status: result.status, stderr: result.stderr, stdout: result.stdout,
      output: existsSync(output) ? readFileSync(output, 'utf8') : '',
      summary: existsSync(summary) ? readFileSync(summary, 'utf8') : '',
      calls: existsSync(calls) ? readFileSync(calls, 'utf8') : '' };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('pending and successful prepares retain the parallel fixture path before checkout', () => {
  for (const status of ['queued', 'pending', 'waiting', 'in_progress', 'completed']) {
    const result = execute(inventory([job(status, status === 'completed' ? 'success' : null)]));
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('run=true\n');
    expect(result.summary).toContain('run 123 attempt 2');
    expect(result.calls).toBe('api\nrepos/Raynos/project-wildshard-singleplayer/actions/runs/123/attempts/2/jobs?per_page=100\n');
  }
});

test('only an exact terminal failed cancelled or skipped prepare skips optional fixture work', () => {
  for (const conclusion of ['failure', 'cancelled', 'skipped']) {
    const result = execute(inventory([job('completed', conclusion)]));
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toBe('run=false\n');
    expect(result.summary).toContain(`prepare completed/${conclusion}`);
  }
});

test('missing ambiguous foreign truncated and uncertain evidence cannot admit fixture work', () => {
  const valid = job('completed', 'success');
  const invalid = [null, [], {}, inventory([]), inventory([valid, valid]),
    inventory([{ ...valid, run_id: 124 }]), inventory([{ ...valid, run_attempt: 1 }]),
    inventory([{ ...valid, head_sha: 'b'.repeat(40) }]),
    { ...inventory([valid]), total_count: 101 }, inventory([null]),
    inventory([job('completed', null)]), inventory([job('completed', 'neutral')]),
    inventory([job('in_progress', 'failure')]), inventory([job('foreign', null)])];
  for (const data of invalid) {
    const result = execute(data);
    expect(result.status).not.toBe(0);
    expect(result.output).toBe('');
    expect(result.stderr).toContain('Optional fixture admission unavailable');
  }
});

test('unavailable API evidence fails closed after one read without polling or exposing its body', () => {
  const result = execute({ private: 'untrusted response' }, 1);
  expect(result.status).not.toBe(0);
  expect(result.output).toBe('');
  expect(result.calls.split('\n').filter(line => line === 'api')).toHaveLength(1);
  expect(result.stdout + result.stderr).not.toContain('untrusted response');
});

test('pull requests keep their merge-checkout fixture path without querying head-SHA jobs', () => {
  const result = execute(null, 1, 'pull_request');
  expect(result.status, result.stderr).toBe(0);
  expect(result.output).toBe('run=true\n');
  expect(result.calls).toBe('');
  const unsupported = execute(null, 0, 'workflow_dispatch');
  expect(unsupported.status).not.toBe(0);
  expect(unsupported.calls).toBe('');
  expect(unsupported.output).toBe('');
});

test('admission precedes every expensive optional step while behavior keeps its producer gate and fallback', () => {
  const fixtures = workflow.split('\n  fixtures:\n')[1]?.split('\n  behaviour:\n')[0];
  if (fixtures === undefined) throw new Error('Missing fixtures job');
  const steps = fixtures.split('\n      - ').slice(1);
  expect(steps[0]).toContain('name: Admit optional fixtures for this prepare');
  expect(steps[0]).not.toContain('actions/checkout');
  for (const step of steps.slice(1)) expect(step).toContain("if: steps.admission.outputs.run == 'true'");
  const behavior = workflow.split('\n  behaviour:\n')[1]?.split(/\n {2}[a-z][\w-]*:\n/u)[0];
  expect(behavior).toContain('needs: [prepare, fixtures]');
  const admission = /^ {4}if: (.+)$/mu.exec(behavior ?? '')?.[1];
  expect(admission).toContain("needs.prepare.result == 'success'");
  expect(admission).not.toContain('needs.fixtures');
  expect(behavior).toContain('continue-on-error: true');
});
