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
