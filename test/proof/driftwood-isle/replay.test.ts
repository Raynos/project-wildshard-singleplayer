import * as v from 'valibot';
import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';

it('captures the real living Captain and continues exact canonical physics, gameplay and SDK worker effects', () => {
  const result = driftwoodWitness('replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ replay: { status: 'passed', resumedFrom: 'captain', prefixTicks: 0, workerTicks: 60, checkpointCaptured: true, victory: true, workerExact: true, encounter: { boss: { state: 'fight', attempts: 1 } } } });
  const hashes = v.parse(v.object({ replay: v.object({ hash: v.string(), replayHash: v.string() }) }), report);
  expect(hashes.replay.hash).toBe(hashes.replay.replayHash);
}, 90_000);
