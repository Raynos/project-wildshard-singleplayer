// oxlint-disable-next-line import/no-nodejs-modules -- Run the Python kernel-sampler fixture under Node, without a Simulator.
import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';

it('keeps phase maxima separate from opt-in per-sample kernel highs', () => {
  const output = execFileSync('python3', ['test/fixtures/soak/native-interval.py'], { encoding: 'utf8', timeout: 30_000 });
  expect(output).toBe('');
});
