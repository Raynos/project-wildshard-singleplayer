// oxlint-disable-next-line import/no-nodejs-modules -- Verify real index metadata, flags and exact committed Git objects.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate only the tiny owned fixture and actual wrapper.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import wrapper from '../scripts/commit.sh?raw';

test('patch commits retain clean stat metadata without borrowing peer stages or hidden flags', () => {
  const output = execFileSync('python3', ['test/fixtures/commit-index-refresh.py', resolve('.'), '-', 'strict'], {
    encoding: 'utf8', input: wrapper, timeout: 10_000,
  });
  expect(output).toContain('"candidateHiddenFlags": []');
  expect(output).toContain('"peerStagePreserved": true');
  expect(output).toContain('"peerWorkingPreserved": true');
});
