// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real concurrent commits in an owned tiny repository.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the real wrapper and fixture source.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import wrapper from '../scripts/commit.sh?raw';

test('checks release the lease and preserve the captured candidate and working edits', () => {
  const output = execFileSync('python3', ['test/fixtures/commit-snapshot.py', resolve('.'), '-'], {
    encoding: 'utf8', input: wrapper, timeout: 20_000,
  });
  expect(output).toContain('"outsideLock": true');
  expect(output).toContain('"pinnedHead": true');
  expect(output).toContain('"disjointPreserved": true');
  expect(output).toContain('"namedEditsPreserved": true');
  expect(output).toContain('"hookRedsFatal": true');
});
