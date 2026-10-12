// oxlint-disable-next-line import/no-nodejs-modules -- Select the committed native hash policy in this Node-only replay test.
import process from 'node:process';
import { expect, it } from 'vitest';
import { signalWitness } from './native';
import compatibility from './compatibility.json';

it('restores her storm-phase checkpoint exactly and the suffix to her fall matches, in process and in the shipping worker', () => {
  const result = signalWitness('replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { replay: { hash: string; replayHash: string; checkpointTick: number; suffixTicksExecuted: number; victoryTick: number } };
  expect(report).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true, checkpoint: { state: 'fight', phase: 1 }, workerExact: true,
    suffixFacts: ['sunscar.signal', 'sunscar.matriarch'], suffixCoins: 25 } });
  expect(report.replay.replayHash).toBe(report.replay.hash);
  expect(report.replay.suffixTicksExecuted).toBeLessThanOrEqual(10_000);
  const { ticksExecuted, victoryTick, hash } = compatibility.headless;
  expect({ ticksExecuted: report.replay.checkpointTick + report.replay.suffixTicksExecuted,
    victoryTick: report.replay.victoryTick }).toEqual({ ticksExecuted, victoryTick });
  // Committed native hashes are Darwin-normative; other hosts replay their locally generated native state.
  if (process.platform === 'darwin') expect(report.replay.hash).toBe(hash);
}, 120_000);
