import { expect, it } from 'vitest';
import { pineWitness } from './native';
import compatibility from './compatibility.json';

it('continues the King phase-II checkpoint for 1,200 identical command ticks with canonical state and effects equal', () => {
  const result = pineWitness('replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { replay: { checkpointTick: number; suffixTicksExecuted: number; hash: string } };
  expect(report).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true,
    checkpoint: { state: 'fight', phase: 1 }, suffixTicksExecuted: 1200, restoredReemits: 0 } });
  expect(report.replay.checkpointTick + report.replay.suffixTicksExecuted)
    .toBe(compatibility.replay.checkpointTick + compatibility.replay.suffixTicksExecuted);
  if (process.platform === 'darwin') expect(report.replay.hash).toBe(compatibility.replay.hash);
}, 60_000);
