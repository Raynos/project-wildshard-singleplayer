// DL20: a packed level download's parts and loose fallbacks reach the telemetry store, so the loose copies retire only
// after a week of live boots with none.
import { expect, test } from 'vitest';
import { cleanTelemetryRecord } from '../api/_telemetryRecord';

test('a download.parts event keeps its shard and its three counts', () => {
  const record = cleanTelemetryRecord({ kind: 'analytics', build: 'b', install: 'i',
    events: [{ name: 'download.parts', data: { level: 'pine-hollow', parts: 7, failed: 1, fallback: 3 } }] });
  expect(record).toMatchObject({ kind: 'analytics', events: [{ name: 'download.parts', data: { shard: 'pine-hollow', parts: 7, failed: 1, fallback: 3 } }] });
});
