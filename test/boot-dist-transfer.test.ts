// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual CI artifact pack/restore commands.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the workflow transport boundary as well as real archives.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('exact per-leg archives preserve bytes and refuse corrupt, missing, mixed or unsafe transfers without retry', () => {
  const result = spawnSync('python3', ['test/test_boot_dist.py'], { encoding: 'utf8', timeout: 10_000 });
  expect(result.status, result.stderr + result.stdout).toBe(0);
  expect(result.stderr).toContain('Ran 11 tests');
});

test('smoke downloads each exact source-run leg directly without a full-dist relay or retry', () => {
  const workflow = readFileSync('.github/workflows/boot-smoke.yml', 'utf8');
  const central = workflow.split('\n  boot-smoke:\n')[0];
  expect(central).toContain('name: boot-dist-manifest');
  expect(central).not.toContain('boot-dist.tar');
  expect(central).not.toContain('actions/upload-artifact');
  expect(workflow).toMatch(/run-id: \$\{\{ needs\.build\.outputs\.source_run \}\}/u);
  expect(workflow).toContain('python3 scripts/boot-dist.py restore');
  expect(workflow).toMatch(/continue-on-error: \$\{\{ matrix\.part == 'phone-route' \}\}/u);
  expect(workflow.match(/timeout-minutes: 20/gu)).toHaveLength(2);
  expect(workflow).toContain('part: [boot-public, boot-developer, boot-grid, hover-chromium, hover-webkit, explorer, phone-route]');
});
