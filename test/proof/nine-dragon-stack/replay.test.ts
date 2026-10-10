import { expect, it } from 'vitest';
import { nineWitness } from './native';

it.each([
  { name: 'ride', tick: 400, suffix: 60, at: { swing: 1 } },
  { name: 'crossing', tick: 940, suffix: 144, at: { phase: 'zip', lifts: true } },
] as const)('restores the committed $name checkpoint exactly and replays its short suffix to identical canonical state', ({ name, tick, suffix, at }) => {
  const result = nineWitness(`replay-${name}`);
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { replay: { hash: string; replayHash: string } };
  expect(report).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true, checkpoint: { tick, ...at }, suffixTicksExecuted: suffix, ticksExecuted: 2 * suffix, workerTicks: suffix, workerExact: true } });
  expect(report.replay.replayHash).toBe(report.replay.hash);
}, 60_000);
