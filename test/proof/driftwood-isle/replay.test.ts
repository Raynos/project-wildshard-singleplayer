import * as v from 'valibot';
import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';
import compatibility from './compatibility.json';

it('captures the real living Captain and continues exact canonical physics, gameplay and SDK worker effects', () => {
  const result = driftwoodWitness('replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ replay: { status: 'passed', resumedFrom: 'captain', prefixTicks: 0, workerTicks: 60, checkpointCaptured: true, victory: true, workerExact: true, encounter: { boss: { state: 'fight', attempts: 1 } } } });
  const hashes = v.parse(v.object({ replay: v.object({ hash: v.string(), replayHash: v.string(), checkpointTick: v.number(), suffixTicksExecuted: v.number() }) }), report);
  expect(hashes.replay.hash).toBe(hashes.replay.replayHash);
  expect(hashes.replay.suffixTicksExecuted).toBeLessThanOrEqual(10_000);
  expect(hashes.replay.checkpointTick + hashes.replay.suffixTicksExecuted)
    .toBe(compatibility.replay.checkpointTick + compatibility.replay.suffixTicksExecuted);
  if (process.platform === 'darwin') expect(hashes.replay.hash).toBe(compatibility.replay.hash);
}, 90_000);
