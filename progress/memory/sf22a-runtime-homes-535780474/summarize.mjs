#!/usr/bin/env node
// SF22a E435: retain both rulers; labelled GL is a same-pin proxy, not GPU-process RSS.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const root = import.meta.dirname;
const read = (path) => existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : gunzipSync(readFileSync(join(root, `${path}.gz`))).toString('utf8');
const json = (path) => JSON.parse(read(path));
const jsonl = (path) => read(path).split('\n').filter(Boolean).map((line) => JSON.parse(line));
const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const spread = (values) => ({ median: median(values), min: Math.min(...values), max: Math.max(...values) });
const gl = json('gl/summary.json');
const shards = ['far-reach', 'nine-dragon-stack'].map((slug) => {
  const runs = Array.from({ length: 3 }, (_, i) => {
    const round = i + 1;
    const inspector = jsonl(`simulator/${slug}-r${round}.inspector.jsonl`);
    const native = jsonl(`simulator/${slug}-r${round}.native.jsonl`).find((row) => row.type === 'summary');
    const result = inspector.find((row) => row.kind === 'summary')?.result;
    if (!native || result?.error || native.lost.length > 0) throw new Error(`incomplete Simulator run ${slug}/${round}`);
    const phases = Object.fromEntries(['loading', 'play', 'explorer'].map((phase) => {
      const reading = inspector.find((row) => row.kind === 'settled' && row.phase === phase)?.result;
      if (!reading) throw new Error(`missing settled reading ${slug}/${round}/${phase}`);
      return [phase, { nativeMB: reading.nativeGB * 1000, inspectorMB: reading.inspectorGB * 1000,
        nativePeakMB: native.phases[phase].gameHighGB * 1000, nativePeakUpperMB: native.phases[phase].gameHighGB * 1000 + 0.5, nativeSpreadMB: [reading.minGB * 1000, reading.maxGB * 1000] }];
    }));
    const census = gl.find((row) => row.slug === slug && row.round === round);
    if (!census || census.errors.length > 0) throw new Error(`incomplete GL run ${slug}/${round}`);
    for (const phase of ['play', 'explorer']) {
      const gpu = census.phases.find((row) => row.phase === phase);
      if (!gpu) throw new Error('missing GL phase');
      phases[phase].glMB = gpu.maxBytes / 1e6;
      phases[phase].combinedMB = phases[phase].nativeMB + phases[phase].glMB;
    }
    return { round, identity: result.identity, explorerIdentity: result.explorerIdentity, phases };
  });
  const phases = Object.fromEntries(['loading', 'play', 'explorer'].map((phase) => [phase, {
    nativeMB: spread(runs.map((row) => row.phases[phase].nativeMB)),
    inspectorMB: spread(runs.map((row) => row.phases[phase].inspectorMB)),
    nativePeakMB: Math.max(...runs.map((row) => row.phases[phase].nativePeakMB)),
    ...(phase === 'loading' ? {} : { glMB: spread(runs.map((row) => row.phases[phase].glMB)),
      combinedMB: spread(runs.map((row) => row.phases[phase].combinedMB)),
      conservativeUpperMB: Math.max(...runs.map((row) => row.phases[phase].nativePeakUpperMB)) + Math.max(...runs.map((row) => row.phases[phase].glMB)) }),
  }]));
  const accountedBytes = Math.ceil((phases.play.nativeMB.median + phases.play.glMB.median - 299) * 1e6 / 1.11);
  if (!Number.isSafeInteger(accountedBytes) || accountedBytes <= 0) throw new Error(`invalid measured content ${slug}`);
  return { slug, runs, phases, runtimeCost: { webContentMB: phases.play.nativeMB.median, glMB: phases.play.glMB.median, engineBaseMB: 299,
    rev: '5357804745121cdda8f9492b62d3266244f4ac1b', device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
    evidence: 'progress/memory/sf22a-runtime-homes-535780474/summary.json' }, accountedBytes,
    playingAdmissionMB: (300_000_000 + 80_000_000 + Math.ceil(1.11 * accountedBytes)) / 1e6,
    conservativeCapMarginMB: 1000 - Math.max(phases.play.conservativeUpperMB, phases.explorer.conservativeUpperMB) };
});
const summary = { sha: '5357804745121cdda8f9492b62d3266244f4ac1b', instrumentation: { glSourceLabelFix: '932576d0a', peakRoundingUpperMB: 0.5 }, memoryProtocol: json('simulator/report.json').memoryProtocol,
  settings: { tex: 'auto', developer: true, variants: 'shipped defaults; no Debug overrides' },
  coverage: { coldRuns: 3, playSeconds: 30, explorerSeconds: 30, captureLocations: false },
  calibration: { engineBaseMB: 299, evidence: 'progress/memory/sf22a-2026-10-04.json', remeasured: false },
  limitation: 'Simulator relative memory; same-pin Chromium phone-tier labelled GL proxy. No physical-iPhone claim.', shards };
writeFileSync(join(root, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(shards.map(({ slug, phases, accountedBytes, playingAdmissionMB, conservativeCapMarginMB }) => ({ slug, phases, accountedBytes, playingAdmissionMB, conservativeCapMarginMB })), null, 2));
