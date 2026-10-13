// oxlint-disable-next-line import/no-nodejs-modules -- Verify the real hook's captured pipes and detached processes.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the isolated process fixture to this hook's source.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';

it('closes captured post-hook pipes while all detached workers remain alive', () => {
  const output = execFileSync('python3', ['test/fixtures/post-commit-pipes.py', cwd()], {
    encoding: 'utf8', timeout: 15_000,
  });
  const result: unknown = JSON.parse(output);
  expect(result).toEqual({ returnedBeforeWorkersExit: true, workers: ['ledger', 'push', 'ratchet'] });
});
