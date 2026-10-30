import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise report artifact publication in the owned test scratch root.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the test's owned scratch filenames.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The maintained Vitest scratch adapter owns this root.
import { tmpdir } from 'node:os';
import { frameFloorDrawReport, frameFloorDrawMarkdown, writeFrameFloorDrawReport, type FloorDrawRecord } from '../scripts/frame-floor-draw-report.mjs';

const slugs = ['nine-dragon-stack', 'pine-hollow', 'driftwood-isle'];
function record(): FloorDrawRecord {
  return { sha: 'a'.repeat(40), runId: 'draw-reading-1', when: '2026-10-30T21:00:00Z', complete: true, drawBudgetMode: 'report-only',
    surface: 'desktop', chromiumCpuRate: 4, settings: { tier: 'phone' }, shards: slugs,
    results: [{ surface: 'desktop', rows: slugs.map((shard, index) => ({ shard, complete: true, metadata: { settings: { tier: 'phone' } },
      rows: [{ pose: { name: 'spawn' }, frames: 2, drawSamples: [{ draws: 150 + index, renderMs: 4.5 }, { draws: 100, renderMs: 3.01 }] },
        { pose: { name: 'standing' }, frames: 1, drawSamples: [{ draws: 120, renderMs: 3.6 }] }] })) }] };
}

test('all three shard/pose rows retain paired worst frames and source-bound report-only misses', () => {
  const input = record(), before = structuredClone(input), report = frameFloorDrawReport(input);
  expect(report).toMatchObject({ schema: 1, sha: 'a'.repeat(40), runId: 'draw-reading-1', blocking: false, complete: true, drawLimit: 150, cpuLimitUs: 30 });
  expect(report.shards.map(row => [row.shard, row.poses, row.validDrawSamples, row.frames, row.status])).toEqual(slugs.map(shard => [shard, 2, 3, 3, 'MISS']));
  expect(report.shards.map(row => row.maxDraws)).toEqual([150, 151, 152]);
  // No pooled ratio: the one 100-draw frame is 30.1 us, even though the combined ratio passes.
  expect(report.shards[0]?.maxRenderCpuUsPerDraw).toBeCloseTo(30.1);
  expect(report.poses).toHaveLength(6); expect(report.poses[1]?.status).toBe('PASS');
  const markdown = frameFloorDrawMarkdown(report);
  for (const slug of slugs) expect(markdown).toContain(slug);
  expect(markdown).toContain('Report-only'); expect(markdown).toContain('30.1'); expect(markdown).toContain('MISS');
  expect(input).toEqual(before);
});

test('missing shard, sample, render CPU and duplicate readings cannot claim complete coverage', () => {
  for (const kind of ['shard', 'sample', 'cpu', 'zero', 'duplicate']) {
    const input = record(), surface = input.results[0], reading = surface?.rows[0];
    if (surface === undefined || reading === undefined) throw new Error('Missing report fixture');
    const rows = [...surface.rows];
    if (kind === 'shard') rows.pop();
    if (kind === 'duplicate') rows.push(reading);
    if (kind === 'sample') rows[0] = { ...reading, rows: [{ frames: 2, drawSamples: [{ draws: 100, renderMs: 1 }] }] };
    if (kind === 'cpu') rows[0] = { ...reading, rows: [{ frames: 1, drawSamples: [{ draws: 100, renderMs: Number.NaN }] }] };
    if (kind === 'zero') rows[0] = { ...reading, rows: [{ frames: 1, drawSamples: [{ draws: 0, renderMs: 0 }] }] };
    input.results = [{ ...surface, rows }];
    const report = frameFloorDrawReport(input);
    expect(report.complete, kind).toBe(false);
    expect(report.shards.some(row => row.status === 'INCOMPLETE'), kind).toBe(true);
  }
});

test('1x and Simulator retain actual cost but never earn a 4x CPU pass or extrapolation', () => {
  for (const surface of ['desktop', 'sim']) {
    const input = record(), original = input.results[0]; if (original === undefined) throw new Error('Missing surface');
    input.surface = surface; input.chromiumCpuRate = surface === 'sim' ? 4 : 1;
    input.results = [{ ...original, surface, rows: [{ shard: slugs[0] ?? '', complete: true, rows: [{ frames: 1, drawSamples: [{ draws: 150, renderMs: 4.5 }] }] }] }];
    input.shards = [slugs[0] ?? ''];
    const report = frameFloorDrawReport(input);
    expect(report.poses[0]).toMatchObject({ cpuRate: 1, status: 'NOT MEASURED', budget: { maxRenderCpuUsPerDraw: 30, cpuApplied: false, cpuPass: null } });
  }
});

test('writes sibling JSON/Markdown and appends CI summary without overwriting the raw floor record', () => {
  const root = mkdtempSync(join(tmpdir(), 'frame-draw-report-'));
  try {
    const output = join(root, 'floor.json'), summary = join(root, 'summary.md');
    writeFileSync(output, 'raw floor record'); writeFileSync(summary, 'prior CI summary\n');
    const paths = writeFrameFloorDrawReport(record(), output, summary);
    expect(readFileSync(output, 'utf8')).toBe('raw floor record');
    expect(paths).toEqual({ json: join(root, 'floor-draw-budget.json'), markdown: join(root, 'floor-draw-budget.md') });
    expect(JSON.parse(readFileSync(paths.json, 'utf8'))).toMatchObject({ blocking: false, complete: true, sha: 'a'.repeat(40) });
    expect(readFileSync(summary, 'utf8')).toBe(`prior CI summary\n${readFileSync(paths.markdown, 'utf8')}`);
    expect(() => writeFrameFloorDrawReport(record(), join(root, 'unsafe'))).toThrow('main floor JSON');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
