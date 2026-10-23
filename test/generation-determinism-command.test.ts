// oxlint-disable-next-line import/no-nodejs-modules -- Invalid audit commands must refuse before acquiring mirror/build capacity.
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test.each([['--rev=main'], ['--rev=../foreign'], ['--rev=HEAD', '--rev=HEAD'], ['--parallel=0'], ['--parallel=5'], ['--parallel=1', '--parallel=2'], ['--restore']])('refuses unsafe or ambiguous audit arguments before opening a mirror: %j', (...args) => {
  const result = spawnSync(process.execPath, ['scripts/check-generation-determinism.mjs', ...args], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Expected --rev=HEAD|<full-main-sha> and --parallel=1..4');
  expect(result.stdout).not.toContain('generation-determinism: committed');
});
