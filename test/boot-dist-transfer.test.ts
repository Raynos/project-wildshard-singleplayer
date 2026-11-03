// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual CI artifact pack/restore commands.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the workflow transport boundary as well as real archives.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('unavailable passive Actions clocks preserve both receipts without replacing journey verdicts', () => {
  const result = spawnSync('python3', ['test/test_smoke_timings.py'], { encoding: 'utf8', timeout: 10000 });
  expect(result.status, result.stderr + result.stdout).toBe(0);
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  expect(workflow).not.toContain('\n  phone-route:\n');
  expect(workflow).toContain(`python3 scripts/smoke-timings.py "journeys (\${{ matrix.part }})"`);
});

test('exact per-leg archives preserve bytes and refuse corrupt, missing, mixed or unsafe transfers without retry', () => {
  const result = spawnSync('python3', ['test/test_boot_dist.py'], { encoding: 'utf8', timeout: 10_000 });
  expect(result.status, result.stderr + result.stdout).toBe(0);
});

test('smoke downloads each exact source-run leg directly without a full-dist relay or retry', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const central = workflow.split('\n  journeys:\n')[1]?.split('\n  boot-verdict:\n')[0];
  if(central===undefined)throw new Error('Missing prepared browser wave');
  expect(central).toContain('name: boot-dist-manifest');
  expect(central).not.toContain('boot-dist.tar');
  expect(central).not.toContain('run watch');
  expect(workflow).toMatch(/run-id: \$\{\{ github\.run_id \}\}/u);
  expect(workflow).toContain('python3 scripts/boot-dist.py restore');
  expect(central).toContain('timeout-minutes: 20');
  const parts=/part: \[([^\]]+)\]/u.exec(central)?.[1]?.split(',').map(part=>part.trim());
  const core=['boot-public','boot-developer','boot-grid','hover-chromium','hover-webkit','explorer-a','explorer-b'];
  expect(parts).toHaveLength(core.length);expect(new Set(parts)).toEqual(new Set(core));
  expect(central).toContain(`SMOKE_PART: \${{ (matrix.part == 'explorer-a' || matrix.part == 'explorer-b') && 'explorer' || matrix.part }}`);
  expect(workflow).not.toContain('title-quarantine');
  const runner = readFileSync('scripts/parity/boot-smoke.mjs', 'utf8');
  expect(runner).not.toContain('quarantinedTitle');
  expect(runner).not.toContain('titleOnly');
  expect(runner).toMatch(/^ {4}await observeTitleCapture\(page, join\(out, `\$\{receipt\}-title`\), \(\) => captureBootFrame\(page, 'title', deadline, frames\)\);$/mu);
});

