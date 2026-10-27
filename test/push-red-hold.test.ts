// oxlint-disable-next-line import/no-nodejs-modules -- Run the actual Python prefix policy on candidate-index bytes.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import source from '../scripts/push_red_hold.py?raw';

test('red publication keeps only the newest marked fix prefix', () => {
  const output = execFileSync('python3', ['test/test_push_red_hold.py', '--candidate-stdin'], {
    input: source, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
  });
  expect(output).toBe('');
});
