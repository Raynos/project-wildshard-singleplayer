// oxlint-disable-next-line import/no-nodejs-modules -- Reproduce private-index races with actual Git processes.
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('refuses stale trees and foreign paths without losing a newer landing', () => {
  const output = execFileSync('python3', ['test/fixtures/commit-index.py', 'scripts/check-commit-index.py'], { encoding: 'utf8', timeout: 15_000 });
  const receipt: unknown = JSON.parse(output);
  expect(receipt).toEqual({ race: 'refused', fresh: 'passed', rollback: 'scoped', foreign_intent: 'refused', moved_parent: 'refused', between_hooks: 'refused' });
});
