// oxlint-disable-next-line import/no-nodejs-modules -- Run the real shell guard against an isolated Git fixture.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('recognizes private indexes without admitting shared aliases or bulk worktree staging', () => {
  expect(execFileSync('python3', ['test/fixtures/sweep-guard.py', '.claude/hooks/guard-git-add-all.sh'], { encoding: 'utf8' }))
    .toContain('private recognition and shared-stage isolation pass');
});
