// oxlint-disable-next-line import/no-nodejs-modules -- Execute the exact candidate Python policy in its native interpreter.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import source from '../scripts/push_batch.py?raw';

test('over-cap batches split before an explicit step-only CI handoff', () => {
  expect(execFileSync('python3', ['test/test_push_batch.py', '--candidate-stdin'], {
    input: source, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
  })).toBe('');
});
