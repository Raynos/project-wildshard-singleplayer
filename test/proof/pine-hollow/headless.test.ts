import { expect, it } from 'vitest';
import { pineWitness } from './native';

// Each leg resumes one committed gameplay checkpoint; no leg walks more than 10k ticks.
it.each(['dam', 'ridge', 'night', 'king', 'fallen', 'dawn'])('walks the %s leg through native gameplay', name => {
  const result = pineWitness(`slice-${name}`);
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ slug: 'pine-hollow', entry: 'runtime/headless.ts',
    [`slice-${name}`]: { status: 'passed', to: name, alive: true } });
}, 60_000);
