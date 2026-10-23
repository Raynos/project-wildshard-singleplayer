// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns tiny Git trees and real checker children.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the committed checker supplied to the fixture.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

test('staged ratchet compares missing entries to HEAD and honors new staged entries', () => {
  expect(execFileSync('python3', ['test/fixtures/precommit-ratchet.py', resolve('scripts/precommit-checks.mjs')],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })).toContain('8 staged ratchet regressions passed');
});
