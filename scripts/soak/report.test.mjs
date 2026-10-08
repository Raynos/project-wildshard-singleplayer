import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const format of ['modern', 'historical']) void test(`reports ${format} continuous receipts without fabricating missing readings or legs`, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'sf57-report-'));
  const names = format === 'modern' ? ['shipped-cells', 'shipped-road'] : ['shipped'];
  try {
    for (const name of names) {
      const leg = name.endsWith('-road') ? 'road' : 'cells';
      writeFileSync(join(scratch, `${name}.json`), JSON.stringify({ sha: 'fixture', seconds: 1, circuits: 0, driveStarted: '2026-10-04T00:00:00Z',
        ...(format === 'modern' ? { leg } : {}), windows: [], evictions: [], errors: [], leak: null, expected: [], entries: [], crossroads: [] }));
      writeFileSync(join(scratch, `${name}-native.jsonl`), `${JSON.stringify({ type: 'sample', t: '2026-10-04T00:00:00Z', phase: 'drive', footprint: 400_000_000 })}\n`);
      writeFileSync(join(scratch, `${name}-gl.jsonl`), '');
    }
    execFileSync(process.execPath, ['scripts/soak/report.mjs', `--from=${scratch}`, `--out=${join(scratch, 'out')}`]);
    const summary = JSON.parse(readFileSync(join(scratch, 'out', 'summary.json'), 'utf8'));
    assert.deepEqual(summary.missingReceipts, format === 'modern' ? [] : ['shipped-road.json']);
    assert.equal(summary.layouts.length, names.length);
    for (const [index, name] of names.entries()) {
      const run = summary.layouts[index];
      assert.equal(run.layout, 'shipped'); assert.equal(run.leg, name.endsWith('-road') ? 'road' : 'cells');
      assert.equal(run.grade.memoryPass, false); assert.equal(run.grade.gatePass, false); assert.equal(run.grade.missingGlSamples, 1);
      assert.equal(run.missing.length, 1); assert.equal(run.missing[0].nearestGlSeconds, null);
      assert.equal(run.originalReceipt, `${name}-original.json`);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

void test('regrading preserves the fixed game PID and leaves prewarmed WebContent and GPU outside the ruler', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'sf57-fixed-pid-'));
  try {
    writeFileSync(join(scratch, 'dev-cells.json'), JSON.stringify({ sha: 'fixture', gamePid: 7, leg: 'cells', seconds: 1, circuits: 0,
      driveStarted: '2026-10-04T00:00:00Z', windows: [], evictions: [], errors: [], leak: null, expected: [], entries: [], crossroads: [] }));
    writeFileSync(join(scratch, 'dev-cells-native.jsonl'), `${JSON.stringify({ type: 'sample', t: '2026-10-04T00:00:00Z', phase: 'drive',
      footprint: 700_000_000, interval: 710_000_000, gpu: 90_000_000, pids: { 7: [500_000_000, 510_000_000], 9: [200_000_000, 200_000_000] } })}\n`);
    writeFileSync(join(scratch, 'dev-cells-gl.jsonl'), `${JSON.stringify({ at: Date.parse('2026-10-04T00:00:00Z') / 1000,
      totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 300_000_000, cycle: 0 })}\n`);
    execFileSync(process.execPath, ['scripts/soak/report.mjs', `--from=${scratch}`, `--out=${join(scratch, 'out')}`]);
    const report = JSON.parse(readFileSync(join(scratch, 'out/summary.json'), 'utf8')).layouts[0];
    assert.equal(report.gamePid, 7); assert.equal(report.grade.peakBytes, 610_000_000);
    assert.equal(report.perLap[0].allWebContentPeakBytes, 700_000_000); assert.equal(report.perLap[0].gpuProcessPeakBytes, 90_000_000);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
