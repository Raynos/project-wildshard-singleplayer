import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual exact-source reporting and blocking workflows.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual legacy-owner guard in tiny isolated fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the fixture directory owned by this case.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture on the same real Node runtime.
import process from 'node:process';
import { quarantineSource } from '../scripts/quarantine-source.mjs';

const sha = 'a'.repeat(40), expected = { run: '123', sha, repository: 'owner/repo' };
const run = { id: 123, head_sha: sha, event: 'push', head_branch: 'main',
  head_repository: { full_name: 'owner/repo' }, path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'failure' };
const generated = { name: 'generated-inputs', run_id: 123, status: 'completed', conclusion: 'success' };
const products = { ...generated, name: 'products' };

test('optional reports use both successful exact-run producers even when another check is red', () => {
  expect(quarantineSource(run, [{ jobs: [generated] }, { jobs: [products,
    { ...generated, name: 'behaviour (1)', conclusion: 'failure' }] }], expected)).toEqual({ run: '123', sha });
});

test('a different run, tree, fork, branch or workflow cannot supply quarantine products', () => {
  for (const changed of [{ ...run, id: 124 }, { ...run, head_sha: 'b'.repeat(40) },
    { ...run, head_repository: { full_name: 'fork/repo' } }, { ...run, event: 'pull_request' },
    { ...run, head_branch: 'feature' }, { ...run, path: '.github/workflows/other.yml' }, { ...run, status: 'in_progress' }]) {
    expect(() => quarantineSource(changed, [{ jobs: [generated, products] }], expected)).toThrow();
  }
});

test('missing, failed, duplicated, partial or foreign producer jobs refuse before restoration', () => {
  for (const jobs of [[generated], [products], [generated, products, products],
    [generated, { ...products, run_id: 124 }], [generated, { ...products, conclusion: 'failure' }],
    [generated, { ...products, status: 'in_progress', conclusion: null }],
    [{ ...generated, conclusion: 'failure' }, products]]) {
    expect(() => quarantineSource(run, [{ jobs }], expected)).toThrow('complete successful');
  }
});

test('push reporters leave the aggregate while PR reporting and strict producer identity remain', () => {
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const report = readFileSync('.github/workflows/test-quarantine.yml', 'utf8');
  const embedded = deploy.split('\n  behaviour-quarantine:\n')[1]?.split('\n  dispatch-boot-smoke:\n')[0];
  expect(embedded).toContain("if: github.event_name == 'pull_request'");
  expect(embedded).not.toContain("if: github.event_name == 'push'");
  for (const job of [embedded, report]) {
    expect(job).toContain('continue-on-error: true');
    expect(job).toContain('timeout-minutes: 20');
    expect(job).toContain('shard: [1, 2]');
    expect(job).toContain('WS_TEST_COHORT: quarantine');
    expect(job).toContain('scripts/test-quarantine.json');
    expect(job).toContain(`vitest run --shard=\${{ matrix.shard }}/2 --passWithNoTests`);
  }
  expect(report).toContain('workflow_run:');
  expect(report).toContain('types: [completed]');
  expect(report).toContain('cancel-in-progress: false');
  expect(report).toContain("github.event.workflow_run.event == 'push'");
  expect(report).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
  expect(report).toContain('HEAD:scripts/quarantine-source.mjs');
  expect(report).toContain("Source has no push quarantine reporter");
  expect(report).toContain(`run-id: \${{ steps.source.outputs.run }}`);
  expect(report).toContain('GITHUB_SHA="$SOURCE_SHA" GITHUB_RUN_ID="$SOURCE_RUN" python3 scripts/ci-products.py unpack');
  expect(report.indexOf('node scripts/quarantine-source.mjs')).toBeLessThan(report.indexOf('uses: actions/download-artifact@v4'));
  const dispatch = deploy.split('\n  dispatch-boot-smoke:\n')[1];
  expect(dispatch).not.toContain('needs: behaviour-quarantine');
  expect(deploy).toContain('products, behaviour, behaviour-products]');
});

test('an older source must retain its real embedded push reporter before external reporting can defer', () => {
  const workflow = readFileSync('.github/workflows/test-quarantine.yml', 'utf8');
  const body = workflow.split("node --input-type=module <<'NODE'\n")[1]?.split('          NODE\n')[0];
  if (body === undefined) throw new Error('Missing original reporting-owner guard');
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/quarantine-owner-'));
  try {
    mkdirSync(resolve(root, '.github/workflows'), { recursive: true });
    for (const [source, status] of [
      ["\n  behaviour-quarantine:\n    if: github.event_name == 'push' || github.event_name == 'pull_request'\n", 0],
      ["\n  behaviour-quarantine:\n    if: github.event_name == 'pull_request'\n", 1],
      ['\n  products:\n    steps: []\n', 1],
    ] as const) {
      writeFileSync(resolve(root, '.github/workflows/deploy.yml'), source);
      const result = spawnSync(process.execPath, ['--input-type=module', '--eval', body], { cwd: root, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(status);
      if (status !== 0) expect(result.stderr).toContain('Source has no push quarantine reporter');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
