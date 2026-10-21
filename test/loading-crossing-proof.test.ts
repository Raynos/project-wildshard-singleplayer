import { expect, it } from 'vitest';
import { crossingReport } from '../scripts/loading-benchmark/crossing.mjs';

it('requires both transfers and complete phase sums', () => {
  const timing = { requestedAt: 0, readyAt: 100, start: 200, checkpointEnd: 210, commitEnd: 220, end: 230 };
  const rows = ['prepare', 'boundary', 'checkpoint', 'commit', 'activate'].map((key, i) => ({
    key, label: key, ms: [100, 100, 10, 10, 10][i] ?? 0,
  }));
  const good = { done: true, errors: [], timings: [{ ...timing, from: 'home', to: null },
    { ...timing, from: null, to: 'home' }], rows: [rows, rows] };
  expect(crossingReport(good).failures).toEqual([]);
  expect(crossingReport({ ...good, timings: good.timings.slice(0, 1) }).failures.length).toBeGreaterThan(0);
  expect(crossingReport({ ...good, rows: [rows.slice(1), rows] }).failures).toContain('Missing labelled crossing phase');
  expect(crossingReport({ ...good, rows: [rows.map(row => ({ ...row, ms: row.ms + 10 })), rows] }).failures).toContain('Crossing phase sum differs from wall time');
});
