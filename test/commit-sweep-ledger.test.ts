// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual post-hook and private-index Git process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Pass this checkout to the owned temporary fixture.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';

it('defers the ledger until its parent exits and preserves attribution and foreign staging', () => {
  const output = execFileSync('python3', ['test/fixtures/commit-sweep-ledger.py', cwd()], {
    encoding: 'utf8', timeout: 20_000,
  });
  const results: unknown = JSON.parse(output);
  expect(results).toEqual([true, false].map(attributed => ({ attributed, parentExited: true,
    sourceMessagePreserved: true, foreignIndexPreserved: true, ledgerOnly: true })));
});
