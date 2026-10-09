import { expect, it } from 'vitest';
import { pineWitness } from './native';

it('continues the King phase-II checkpoint for 1,200 identical command ticks with canonical state and effects equal', () => {
  const result = pineWitness('replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true,
    checkpoint: { state: 'fight', phase: 1 }, suffixTicksExecuted: 1200, restoredReemits: 0 } });
}, 60_000);
