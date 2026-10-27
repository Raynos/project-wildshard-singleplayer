// oxlint-disable-next-line import/no-nodejs-modules -- Run the tracked checker-source isolation controls.
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('committed checker entry ignores staged/loose poison while ordinary source remains live', () => {
  const result = spawnSync('python3', ['-m','unittest','discover','-s','test','-p','test_commit_checker_snapshot.py'], {encoding:'utf8'});
  expect(result.error).toBeUndefined();
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stderr).toContain('Ran 3 tests');
  expect(result.stderr).toContain('OK');
});
