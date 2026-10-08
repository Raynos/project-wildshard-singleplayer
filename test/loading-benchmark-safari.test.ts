import { expect, it } from 'vitest';
import { safariReport, safariEntryPolicy } from '../scripts/loading-benchmark/safari-data.mjs';

const capture = { shard: '_template', cache: 'cold', status: 'ok', tapEpoch: 1000, data: { origin: 1010, installedAt: 1, url: 'http://fixture/?chunk=_template', play: 300, observerSupported: false, steps: [{ at: 5, phase: 'admission.descriptor' }, { at: 50, phase: 'props' }], tasks: [] } } as const;
it('Safari report fences the new document and keeps unsupported task attribution missing instead of zero', () => {
  const result = safariReport('pin', [capture, { ...capture, cache: 'warm', status: 'GPU restart' }]);
  expect(result.runs).toHaveLength(1);
  expect(result.runs[0]?.timeToPlayableMs).toBe(310);
  expect(result.runs[0]?.phases.at(-1)).toEqual({ name: 'props', startMs: 60, endMs: 310, owner: 'loading phase: props (wall time, not CPU attribution)' });
  expect(result.runs[0]?.longTasks).toEqual([]);
  expect(result.missing.join(' ')).toContain('observer unavailable');
  expect(result.missing.join(' ')).toContain('GPU restart');
  expect(() => safariReport('pin', [{ ...capture, tapEpoch: 1020 }])).toThrow('document fence');
  expect(() => safariReport('pin', [{ ...capture, data: { ...capture.data, url: 'http://fixture/' } }])).toThrow('document fence');
});
it('includes observed tasks strictly above 50ms and excludes post-play samples without calling gaps tasks', () => {
  const report = safariReport('pin', [{ ...capture, data: { ...capture.data, observerSupported: true, tasks: [{ at: 20, duration: 50 }, { at: 80, duration: 51 }, { at: 301, duration: 90 }] } }]);
  expect(report.runs[0]?.longTasks).toEqual([{ startMs: 90, durationMs: 51, owner: 'unattributed: Safari long-task observer has no sampled app owner' }]);
});

it('uses the admitted picker mode and refuses an unknown shard before timing a control', () => {
  expect(safariEntryPolicy('_template')).toEqual({ developer: true, entry: 'shardfile', selector: '.ws-menu-shardfile' });
  for (const shard of ['far-reach', 'sunscar-dunes', 'nine-dragon-stack']) expect(safariEntryPolicy(shard)).toEqual({ developer: true, entry: 'legacy', selector: '.ws-menu-play' });
  for (const shard of ['driftwood-isle', 'nalati-grasslands', 'pine-hollow']) expect(safariEntryPolicy(shard)).toEqual({ developer: false, entry: 'legacy', selector: '.ws-menu-play' });
  expect(() => safariEntryPolicy('unknown')).toThrow('Unknown benchmark shard');
});
