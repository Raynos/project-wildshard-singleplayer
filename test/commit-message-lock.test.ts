// oxlint-disable-next-line import/no-nodejs-modules -- Exercise actual Git concurrency in disposable repositories.
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('preserves message ownership, times hooks and releases on abort with a bounded queue', () => {
  const output = execFileSync('python3', ['test/fixtures/commit-message-lock.py', 'scripts/commit-message-lock.py'], { encoding: 'utf8', timeout: 15_000 });
  const rows: unknown = JSON.parse(output);
  expect(rows).toEqual([
    expect.objectContaining({ scenario: 'overlap' }),
    expect.objectContaining({ scenario: 'timeout' }),
    expect.objectContaining({ scenario: 'abort' }),
  ]);
});
