// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real wrapper and an independently held file lock.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the tiny owned Git fixture.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

test('queued commits split wait from work without renewing the budget or hiding hook reds', () => {
  const output = execFileSync('python3', ['test/fixtures/commit-timing.py', resolve('.')], {
    encoding: 'utf8', timeout: 10_000,
  });
  expect(output).toContain('"budgetIncludesWait": true');
  expect(output).toContain('"hookRedRefuses": true');
});
