// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the workflow's actual shell without contacting GitHub.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each workflow fixture owns a tiny directory under tmp.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture executables.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The workflow shell needs the ordinary Node executable on PATH.
import { env } from 'node:process';
import { expect, test } from 'vitest';

const smoke = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
const sha = 'a'.repeat(40);

function sourceScript(): string {
  const step = smoke.split('      - name: Select the exact successful main push build\n')[1]?.split('      - uses: actions/download-artifact@v4')[0];
  const script = step?.split('        run: |\n')[1];
  if (script === undefined) throw new Error('Missing source selection shell');
  return script.split('\n').map(line => line.replace(/^ {10}/u, '')).join('\n');
}

function runSource(watchStatus: number, sourceSha = sha) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/smoke-dispatch-'));
  try {
    writeFileSync(resolve(root, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\nif [ "$1:$2" = run:watch ]; then exit "$WATCH_STATUS"; fi\nprintf "%s" "$SOURCE_JSON"\n');
    writeFileSync(resolve(root, 'timeout'), '#!/bin/sh\nshift\nexec "$@"\n');
    chmodSync(resolve(root, 'gh'), 0o755);
    chmodSync(resolve(root, 'timeout'), 0o755);
    writeFileSync(resolve(root, 'calls'), '');
    writeFileSync(resolve(root, 'output'), '');
    const result = spawnSync('bash', ['-e', '-c', sourceScript()], {
      cwd: root, encoding: 'utf8', timeout: 10_000,
      env: { ...env, PATH: `${root}:${env['PATH'] ?? ''}`, CALLS: resolve(root, 'calls'),
        GITHUB_OUTPUT: resolve(root, 'output'), AUTOMATIC: 'true', SOURCE_RUN: '123', JOB_PROOF_RUN: '',
        TESTED_SHA: sha, GITHUB_REPOSITORY: 'owner/repo', WATCH_STATUS: String(watchStatus),
        SOURCE_JSON: JSON.stringify({ id: 123, event: 'push', head_branch: 'main', head_sha: sourceSha,
          head_repository: { full_name: 'owner/repo' }, path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'success' }) },
    });
    return { status: result.status, error: result.stderr, calls: readFileSync(resolve(root, 'calls'), 'utf8'), output: readFileSync(resolve(root, 'output'), 'utf8') };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('only a fully successful push dispatches all six exact-artifact smoke legs', () => {
  const dispatch = deploy.split('\n  dispatch-boot-smoke:\n')[1];
  expect(dispatch).toContain('needs: [build-and-deploy, typecheck-lint, derived-docs, generated-inputs, products, behaviour, behaviour-products]');
  expect(dispatch).toContain("if: github.event_name == 'push'");
  expect(dispatch).toContain('-f sha="$GITHUB_SHA" -f source_run="$GITHUB_RUN_ID" -f automatic=true');
  expect(deploy).toContain('run: python3 scripts/ci-fail-fast.py -- pnpm run docs');
  expect(smoke).not.toMatch(/^ {2}workflow_run:/mu);
  expect(smoke).toContain('part: [boot-public, boot-developer, boot-grid, hover-chromium, hover-webkit, explorer]');
  expect(smoke).toContain('needs: [build, boot-smoke]');
  expect(smoke).toMatch(/JOB_PROOF_RUN: \$\{\{ !inputs\.automatic && inputs\.source_run \|\| '' \}\}/u);
});

test('automatic queue replacement preserves one complete six-leg workflow', () => {
  const header = smoke.split('\njobs:\n')[0];
  expect(header).toMatch(/^concurrency:\n {2}group: boot-smoke-cohort-\$\{\{ inputs\.automatic && 'main' \|\| inputs\.sha \|\| github\.sha \}\}\n {2}cancel-in-progress: false$/mu);
  // Per-leg groups let newer runs replace different pending legs, leaving
  // neither exact-SHA workflow with every required proof. Only the release
  // dispatch keeps its independent job lock after the full cohort finishes.
  const proofJobs = smoke.split('\njobs:\n')[1]?.split('\n  release:\n')[0];
  expect(proofJobs).toBeDefined();
  expect(proofJobs).not.toMatch(/^ {4}concurrency:/mu);
  expect(smoke).toContain('fail-fast: false');
  expect(smoke).toContain('group: boot-smoke-release');
});

test('automatic smoke waits for its exact successful parent before accepting its artifact run', () => {
  const result = runSource(0);
  expect(result.status, result.error).toBe(0);
  expect(result.calls.split('\n')).toEqual(['run watch 123 --repo owner/repo --exit-status --interval 5', 'api repos/owner/repo/actions/runs/123', '']);
  expect(result.output).toBe('run=123\n');
});

test('a failed parent or mismatched artifact SHA cannot enter the browser proof', () => {
  const failed = runSource(1);
  expect(failed.status).not.toBe(0);
  expect(failed.calls).not.toContain('api ');
  expect(failed.output).toBe('');
  const mismatch = runSource(0, 'b'.repeat(40));
  expect(mismatch.status).not.toBe(0);
  expect(mismatch.error).toContain('Artifact source is not the exact successful main push CI');
  expect(mismatch.output).toBe('');
});
