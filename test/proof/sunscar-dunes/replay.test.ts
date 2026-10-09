import { expect, it } from 'vitest';
import { signalWitness } from './native';

it('restores her storm-phase checkpoint byte-exactly and the suffix to her fall matches, in process and in the shipping worker', () => {
  const result = signalWitness('replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { replay: { hash: string; replayHash: string } };
  expect(report).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true, checkpoint: { state: 'fight', phase: 1 }, workerExact: true,
    suffixFacts: ['sunscar.signal', 'sunscar.matriarch'], suffixCoins: 25 } });
  expect(report.replay.replayHash).toBe(report.replay.hash);
}, 120_000);
