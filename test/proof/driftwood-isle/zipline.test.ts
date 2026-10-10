import * as v from 'valibot';
import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';

it('walks from the real spawn to the zipline and restores its native and worker carry through an earned durable landing', () => {
  const result = driftwoodWitness('zipline');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ compatible: false, zipline: { status: 'passed', approachedFromSpawn: true, resumedFrom: 'lookout', prefixTicks: 0, checkpointCaptured: true,
    workerTicks: 60, workerExact: true, landed: true, durableReload: true, ziplineCount: 1 } });
  const { zipline } = v.parse(v.object({ zipline: v.object({ launchTick: v.number(), restoreTick: v.number(),
    suffixTicks: v.number(), hash: v.string(), replayHash: v.string() }) }), report);
  expect(zipline.launchTick).toBeGreaterThan(0);
  expect(zipline.restoreTick).toBeGreaterThan(zipline.launchTick);
  expect(zipline.suffixTicks).toBeGreaterThan(60);
  expect(zipline.hash).toBe(zipline.replayHash);
}, 90_000);
