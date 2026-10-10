import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';

it('swims from the real spawn, dives to the reef treasure through held worker input, restores mid-dive and surfaces with a durable gameplay fact', () => {
  const result = driftwoodWitness('reef');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ reef: { status: 'passed', workerExact: true, workerTicks: 60, suffixTicks: 137, surfaced: true,
    pack: { doubloon: 8 }, treasureCount: 1, durableReload: true } });
}, 90_000);
