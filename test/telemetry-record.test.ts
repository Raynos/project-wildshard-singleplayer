import { expect, test } from 'vitest';
import { cleanTelemetryRecord } from '../api/_telemetryRecord';

/** One analytics record carrying a single download.parts event with `data`. */
function parts(data: Record<string, unknown>): Record<string, string | number> | undefined {
  const record = cleanTelemetryRecord({ kind: 'analytics', build: 'b', install: 'i', events: [{ name: 'download.parts', data: { level: 'nine', ...data } }] });
  if (record === null || record.kind !== 'analytics') throw new Error('download.parts record refused');
  return record.events[0]?.data;
}

// DL20 (sp-x1's offline control): a missing or malformed count is an 'unknown' boot, never a silent 0
test('a download.parts count that is missing or not a nonnegative integer makes the boot unknown, never 0', () => {
  expect(parts({ parts: 7, failed: 1 })).toEqual({ shard: 'nine', counts: 'unknown' });
  expect(parts({ parts: 7, failed: 0, fallback: 'unknown' })).toEqual({ shard: 'nine', counts: 'unknown' });
  expect(parts({})).toEqual({ shard: 'nine', counts: 'unknown' });
  expect(parts({ parts: 7, failed: -1, fallback: 0 })).toEqual({ shard: 'nine', counts: 'unknown' });
  expect(parts({ parts: 7.5, failed: 0, fallback: 0 })).toEqual({ shard: 'nine', counts: 'unknown' });
});

test('well-formed counts, the outcome and the loose fetches made are kept', () => {
  expect(parts({ parts: 7, failed: 1, fallback: 3, fetched: 3, outcome: 'failed' }))
    .toEqual({ shard: 'nine', parts: 7, failed: 1, fallback: 3, fetched: 3, outcome: 'failed' });
  expect(parts({ parts: 7, failed: 0, fallback: 0 })).toEqual({ shard: 'nine', parts: 7, failed: 0, fallback: 0 });
  expect(parts({ parts: 7, failed: 0, fallback: 0, fetched: 'x', outcome: 'other' })).toEqual({ shard: 'nine', parts: 7, failed: 0, fallback: 0 });
});
