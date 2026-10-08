// SF57 Pine restart rate: ten cold first crossings, same pin/settings/route, one leased Simulator.
// node scripts/soak/pine-rate.mjs <borrowed base> <new output directory> <runtime revision>
// Start only after the coordinator's GPU quiet and exclusive preview/helper handoff.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { summarizePineAllocations } from './pine-events.mjs';

/** Keep entry outcomes separate from ordinary renderer teardown and boot/harness failures. */
export function classifyPineEntry(result) {
  const started = typeof result.driveStarted === 'string';
  const settled = result.diagnosticEntry?.instance === 'pine-hollow' && result.diagnosticEntry.settledSeconds === 20;
  const losses = (result.diagnostics ?? []).filter(row => row.kind === 'contextlost' && row.gameCanvas === true
    && row.target?.connected === true && (!settled || row.at <= result.diagnosticEntry.at));
  return { entryStarted: started, entryLoss: started && losses.length > 0, bootLoss: !started && losses.length > 0,
    entryCompleted: settled && losses.length === 0 && result.routes?.length === 1 && result.routes[0].failures?.length === 0,
    loss: losses[0] ?? null, teardownFailure: settled ? result.failure ?? null : null,
    failure: result.failure ?? null, uploadOverflow: result.uploadOverflow ?? 0 };
}

async function main() {
  const [base, outArg, revision] = process.argv.slice(2);
  if (!base || !outArg || !revision) throw new Error('Supply borrowed preview, fresh output directory and fixed runtime revision');
  const root = resolvePath(import.meta.dirname, '../..'), out = resolvePath(outArg);
  if (existsSync(out)) throw new Error('Rate evidence already exists; use a fresh output directory');
  const sha = execFileSync('git', ['rev-parse', revision], { cwd: root, encoding: 'utf8' }).trim();
  const version = await (await fetch(new URL('version.json', base))).json();
  if (!version.build.startsWith(sha.slice(0, 7))) throw new Error('Rate preview revision mismatch');
  const sources = ['scripts/soak/pine-rate.mjs', 'scripts/soak/pine-events.mjs', 'scripts/soak/soak.mjs', 'scripts/soak/gl.mjs', 'scripts/soak/owned.mjs',
    'scripts/soak/route.ts', 'scripts/parity/glbytes.mjs', 'scripts/parity/resources.mjs', 'scripts/frame-floor-grid.mjs',
    'scripts/debug-settings.mjs', 'scripts/sim-mem-phases.py', 'scripts/ios-memory-watchdog.py'];
  const fingerprints = () => Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(join(root, file))).digest('hex')]));
  const frozen = fingerprints();
  mkdirSync(out, { recursive: true });
  const report = { purpose: 'Ten cold Pine entries; intermittent Simulator GPU diagnosis, never a phone cap/soak/saving proof',
    sha, version, sourceFingerprints: frozen, harness: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    settings: { developer: true, tier: 'phone', renderScale: 2, memorySaver: 'default from fixed runtime', mute: true }, attempts: [] };
  const save = () => writeFileSync(join(out, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  save();
  for (let attempt = 1; attempt <= 10; attempt++) {
    if (JSON.stringify(fingerprints()) !== JSON.stringify(frozen)) throw new Error('Diagnostic source changed during the fixed protocol');
    if (JSON.stringify(await (await fetch(new URL('version.json', base))).json()) !== JSON.stringify(version)) throw new Error('Rate preview changed');
    const directory = join(out, `attempt-${String(attempt).padStart(2, '0')}`); mkdirSync(directory);
    const manifest = { sha, out: directory, bases: [{ layout: 'dev', base, version }], contentCut: null,
      routeScope: 'prepared', dryRun: true, legs: ['cells'], rehearsal: true, diagnosticFirstCrossing: true, device: 'sf57-sp-x3-pine-rate' };
    const manifestPath = join(directory, 'manifest.json'); writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(directory, 'GO'), '');
    const status = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(root, 'scripts/soak/soak.mjs'), `--prepared=${manifestPath}`, '--borrowed-preview'], { cwd: root, stdio: 'inherit' });
      child.on('error', reject); child.on('close', (code, signal) => { resolve({ code, signal }); });
    });
    const path = join(directory, 'dev-cells.json');
    const result = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { failure: 'No completed worker evidence' };
    const row = { attempt, directory, status, ...classifyPineEntry(result) };
    const readRows = file => existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    row.allocations = summarizePineAllocations(readRows(join(directory, 'dev-cells-gl-events.jsonl')),
      readRows(join(directory, 'dev-cells-gl-uploads.jsonl')), readRows(join(directory, 'dev-cells-native.jsonl')),
      row.loss?.at ?? result.diagnosticEntry?.at ?? Date.now() / 1000,
      typeof result.driveStarted === 'string' ? Date.parse(result.driveStarted) / 1000 : Infinity);
    report.attempts.push(row);
    report.counts = { coldBoots: report.attempts.length, entryAttempts: report.attempts.filter(value => value.entryStarted).length,
      entryLosses: report.attempts.filter(value => value.entryLoss).length, completedEntries: report.attempts.filter(value => value.entryCompleted).length,
      bootLosses: report.attempts.filter(value => value.bootLoss).length,
      unresolved: report.attempts.filter(value => !value.entryLoss && !value.entryCompleted && !value.bootLoss).length };
    save(); console.log(JSON.stringify({ attempt, ...report.counts }));
    if (JSON.stringify(fingerprints()) !== JSON.stringify(frozen)) throw new Error('Diagnostic source changed during an attempt');
  }
  report.closed = true; save();
}
if (process.argv[1] === import.meta.filename) await main();
