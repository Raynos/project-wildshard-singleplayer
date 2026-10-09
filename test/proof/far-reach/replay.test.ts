import { expect, it } from 'vitest';
import { skyWitness } from './native';

it('resumes at the step, raises the bridge, reaches the gale-wall phase, and its checkpoint continues byte-exactly in process and in the shipping worker', () => {
  const result = skyWitness('slice-replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { 'slice-replay': { hash: string; replayHash: string; prefixTicks: number } };
  expect(report).toMatchObject({ 'slice-replay': { status: 'passed', resumedFrom: 'step', prefixFacts: ['far-reach.quest'], checkpointCaptured: true,
    checkpoint: { state: 'fight', phase: 1 }, suffixTicksExecuted: 1500, workerTicks: 60, workerExact: true } });
  expect(report['slice-replay'].replayHash).toBe(report['slice-replay'].hash);
  expect(report['slice-replay'].prefixTicks).toBeLessThanOrEqual(10_000);
}, 120_000);
