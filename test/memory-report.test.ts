// oxlint-disable-next-line import/no-nodejs-modules -- Offline report CLI fixtures own only temporary diagnostic inputs/outputs.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep diagnostic fixtures outside the checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve temporary CLI fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real offline CLI, without a browser or Simulator.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Match the committed native-audit receipt encoding.
import { gzipSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Use this Node's executable for the offline CLI fixture.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { emptyMemoryAttribution, nativeMemoryPose, readMemoryAttribution, readMemoryReport, withItemizedMemoryPose, worstMemoryCrossing, type MemoryMeasured } from '../scripts/memory-report-data.mjs';
import { memoryInfographic, memoryOwnerColour } from '../scripts/memory-report-graphic.mjs';
import { memoryReportFromManifest, readMemoryJson } from '../scripts/memory-report.mjs';

const measured = (time = '2026-10-08T00:00:01Z', pid = 42): MemoryMeasured => ({ wc: 600, gl: 100, total: 700, time, pid, source: 'native#road' });
const allocation = { id: 'gpu:1', domain: 'gpu', bytes: 100, owner: 'platform/road', asset: 'atlas', kind: 'texture', precision: 'exact' };
const snapshot = { version: 1, allocations: [allocation, { ...allocation }], totals: { ram: 0, gpu: 100 }, unattributed: { ram: 0, gpu: 0 }, measured: null, accountedBytes: 900 };
const audit = () => ({ closed: true, gamePID: 42, errors: '[]', snapshots: [{ label: 'neutral-road', native: {
  samples: [500, 600, 700].map((footprintBytes, index) => ({ footprintBytes, pid: 42, at: `2026-10-08T00:00:0${index}Z` })),
  memoryCategories: { malloc: 123 },
}, census: { gl: [{ totalBytes: 100, reconciled: true, resources: [{ id: 1, kind: 'texture', bytes: 100, owner: 'platform/road', asset: 'atlas' }] }] }, residency: { cost: { accounted: 900 } } }] });

it('keeps native WC, GPU inventory and allocator totals distinct and deduplicates identities', () => {
  const accounted = readMemoryAttribution(snapshot);
  expect(accounted.total).toBe(900);
  expect(accounted.storageTotals).toEqual({ ram: 0, gpu: 100 });
  expect(() => readMemoryAttribution({ ...snapshot, totals: { ram: 0, gpu: 200 } })).toThrow('do not reconcile');
  const pose = nativeMemoryPose(audit(), 'neutral-road', 'road', 'receipt');
  expect(pose.measured).toEqual({ ...measured(), source: 'receipt' });
  expect(pose.accounted.storageTotals).toEqual({ ram: null, gpu: 100 });
  expect(pose.evidence?.['native']).toEqual(audit().snapshots[0]?.native);
  expect(pose.missing).toContain('RAM owner attribution unavailable in this historical native audit');
});

it('excludes failed audits and refuses stale or cross-process native samples', () => {
  expect(nativeMemoryPose({ ...audit(), failure: 'GPU restart' }, 'neutral-road', 'road', 'receipt').measured).toBeNull();
  expect(nativeMemoryPose({ ...audit(), closed: false }, 'neutral-road', 'road', 'receipt').measured).toBeNull();
  const stale = audit();
  const pose = stale.snapshots.at(0);
  if (pose === undefined) throw new Error('Missing fixture pose');
  for (const row of pose.native.samples) row.at = '2026-10-08T00:00:00Z';
  expect(() => nativeMemoryPose(stale, 'neutral-road', 'road', 'receipt')).toThrow('fresh fixed-PID');
  expect(() => nativeMemoryPose({ ...audit(), gamePID: 43 }, 'neutral-road', 'road', 'receipt')).toThrow('fresh fixed-PID');
});

it('requires a complete matched crossing window and preserves the actual peak owner sample', () => {
  const samples = [0, 1, 2].map(index => ({ measured: { ...measured(`2026-10-08T00:00:0${index}Z`), wc: 600 + index, total: 700 + index }, glTime: `2026-10-08T00:00:0${index}Z`, accounted: readMemoryAttribution(snapshot) }));
  expect(worstMemoryCrossing(samples, true).measured?.total).toBe(702);
  expect(worstMemoryCrossing(samples, false).measured).toBeNull();
  expect(worstMemoryCrossing(samples.slice(0, 1), true).measured).toBeNull();
  expect(worstMemoryCrossing(samples.map(row => ({ ...row, glTime: '2026-10-08T00:00:10Z' })), true).measured).toBeNull();
  expect(worstMemoryCrossing(samples.map((row, index) => ({ ...row, measured: { ...row.measured, pid: index + 42 } })), true).measured).toBeNull();
  expect(worstMemoryCrossing([samples[0], samples[2]].filter(row => row !== undefined), true).measured).toBeNull();
});

it('reuses original itemization without turning the WC remainder or transplanted heap into measured resident storage', () => {
  const situation = { id: 'road', wcBytes: 600, glBytes: 100, vmmapPid: 42, vmmapRegionsDirtyBytes: { malloc: 2000 }, blocks: [
    { side: 'GPU', owner: 'Platform', system: 'road', conf: 'M', bytes: 100 },
    { side: 'RAM', owner: 'Engine', system: 'Rapier WASM capacity', conf: 'M', bytes: 50 },
    { side: 'RAM', owner: 'Pine Hollow', system: 'audio PCM', conf: 'E', bytes: 100 },
    { side: 'RAM', owner: 'Unknown owner', system: 'WC remainder', conf: 'U', bytes: 450 },
  ] };
  const pose = withItemizedMemoryPose(nativeMemoryPose(audit(), 'neutral-road', 'road', 'receipt'), { situations: [situation] }, 'road', 'itemized.json');
  expect(pose.accounted.storageTotals).toEqual({ ram: 150, gpu: 100 });
  expect(pose.accounted.allocations.filter(row => row.domain === 'ram').every(row => row.precision === 'estimate')).toBe(true);
  expect(pose.evidence?.['itemized']).toEqual({ source: 'itemized.json', situation });
  expect(pose.measured?.total).toBe(700);
  expect(() => withItemizedMemoryPose(pose, { situations: [{ ...situation, vmmapPid: 99 }] }, 'road', 'itemized.json')).toThrow('does not match');
});

it('writes missing centre and peak pages, preserves null on old probes and escapes owner text', () => {
  const report = memoryReportFromManifest({ schema: 'memory-report-input/1', pin: 'abc', device: 'iPhone 16 Pro', settings: {}, centres: ['pine-hollow', 'nalati-grasslands'], poses: [] }, '.');
  expect(report.poses.map(pose => pose.name)).toEqual(['road', 'pine-hollow-centre', 'nalati-grasslands-centre', 'worst-crossing']);
  expect(report.poses.every(pose => pose.measured === null && pose.accounted.total === null)).toBe(true);
  const pose = report.poses.at(0);
  if (pose === undefined) throw new Error('Missing road');
  pose.accounted = readMemoryAttribution({ ...snapshot, allocations: [{ ...allocation, owner: '<script>\'"&' }] });
  const svg = memoryInfographic(report, pose);
  expect(svg).toContain('width="1179" height="2556"');
  expect(svg).not.toContain('<script>');
  expect(svg).toContain('&lt;script&gt;');
  expect(svg).toContain('RAM · 0.0 MB');
  expect(memoryInfographic(report, pose)).toBe(svg);
  expect(memoryOwnerColour('engine/audio')).toBe('#f5b84b');
  expect(memoryOwnerColour('engine/Rapier')).toBe('#b48aff');
  expect(memoryOwnerColour('unattributed')).toBe('url(#unknown)');
  expect(() => readMemoryReport({ ...report, cap: { bytes: 2e9 } })).toThrow('1000 MB');
  expect(() => readMemoryReport({ ...report, poses: [{ ...pose, missing: [] }] })).toThrow('state why');
});

it('runs offline on bounded compressed sources and refuses to overwrite previous evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'memory-report-'));
  try {
    const native = join(dir, 'native.json.gz');
    writeFileSync(native, gzipSync(JSON.stringify(audit())));
    expect(readMemoryJson(native)).toEqual(audit());
    const manifest = join(dir, 'input.json');
    writeFileSync(manifest, JSON.stringify({ schema: 'memory-report-input/1', pin: 'abc', device: 'phone', settings: {}, centres: [], poses: [{ name: 'road', native: { file: 'native.json.gz', label: 'neutral-road' } }] }));
    const out = join(dir, 'report');
    const run = () => spawnSync(execPath, ['scripts/memory-report.mjs', `--input=${manifest}`, `--out=${out}`, '--svg-only'], { encoding: 'utf8' });
    expect(run().status).toBe(2);
    const report: unknown = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    expect(readMemoryReport(report).poses.at(0)?.measured?.total).toBe(700);
    expect(readFileSync(join(out, '02-worst-crossing.svg'), 'utf8')).toContain('MEASUREMENT MISSING');
    expect(run().status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('accepts the approved minimal report shape but never confuses unavailable storage with zero', () => {
  const accounted = emptyMemoryAttribution();
  const { storageTotals, ...minimal } = readMemoryAttribution(snapshot);
  expect(storageTotals.gpu).toBe(100);
  const report = readMemoryReport({ schema: 'memory-report/1', pin: 'abc', device: 'phone', settings: {}, cap: { bytes: 1e9 }, poses: [{ name: 'road', measured: measured(), accounted: minimal, missing: [] }] });
  expect(report.poses.at(0)?.accounted.storageTotals.gpu).toBe(100);
  expect(accounted.storageTotals.ram).toBeNull();
});
