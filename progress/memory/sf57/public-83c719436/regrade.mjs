// SF57 regrade of a recorded qualifying leg from its raw samples with the current grader (scripts/soak/route.ts), exactly
// the worker's own join and gradeSoak call (scripts/soak/soak.mjs), keeping the recorded verdict beside the new one.
// node regrade.mjs <dir> <cells|road>   (reads shipped-<leg>.json and its raw .jsonl, or their .br archives)
// Since the gl.at grader (sf57-spike), a joined sample is timed by max(native timestamp, gl.at) against the recorded drive
// boundaries (driveStarted, driveStarted + seconds); the sampler's tags themselves are never edited. `moved` lists every
// sample whose phase the gl.at rule changed relative to the native-timestamp-only rule.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { gradeSoak, soakDriveBounds, soakPhaseByTime } from '../../../../scripts/soak/route.ts';
import { joinSoakSamples, soakLapMemory } from '../../../../scripts/soak/owned.mjs';

const [dir, leg = 'cells'] = process.argv.slice(2);
const read = (file) => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : brotliDecompressSync(readFileSync(join(dir, `${file}.br`))).toString('utf8');
const lines = (file) => read(file).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const result = JSON.parse(read(`shipped-${leg}.json`));
const samples = joinSoakSamples(lines(`shipped-${leg}-native.jsonl`), lines(`shipped-${leg}-gl.jsonl`), result.gamePid ?? null, lines(`shipped-${leg}-gl-events.jsonl`));
const drive = soakDriveBounds(result);
const timed = soakPhaseByTime(samples, drive);
const nativeOnly = soakPhaseByTime(samples.map(({ gl: _gl, ...row }) => row), drive);
const mb = (bytes) => Math.round(bytes / 1e5) / 10;
const moved = timed.flatMap((row, index) => row.phase === nativeOnly[index]?.phase ? []
  : [{ elapsed: row.elapsed, glAt: row.gl?.at, nativeOnlyPhase: nativeOnly[index]?.phase, phase: row.phase, footprintMB: mb(row.footprint), glMB: row.gl ? mb(row.gl.totalBytes) : null }]);
const grade = gradeSoak({ drive, samples, windows: result.windows, seconds: result.seconds ?? 0, circuits: result.circuits ?? 0,
  evictions: result.evictions.length, errors: result.errors, leak: result.leak?.after ? result.leak : null,
  expected: result.expected ?? [], entries: result.entries, crossroads: result.crossroads, engineBase: result.engineBase,
  rehearsal: result.grade.rehearsal, leg, contentCut: result.contentCut ?? null });
const functionalPass = result.failure === undefined && result.errors.length === 0 && (result.seconds ?? 0) >= grade.requiredSeconds
  && result.routes.length > 0 && result.routes.every((route) => route.failures.length === 0) && grade.sampling && grade.leakZero;
const pick = (g) => ({ memoryPass: g.memoryPass, gatePass: g.gatePass, sampling: g.sampling, recovery: g.recovery, calibration: g.calibration,
  leakZero: g.leakZero, peakBytes: g.peakBytes, loadingPeakBytes: g.loadingPeakBytes, ratios: g.ratios, loops: g.loops, baselineDeltaBytes: g.baselineDeltaBytes,
  admitted: g.admitted, refused: g.refused, crossroads: g.crossroads, rehearsal: g.rehearsal });
console.log(JSON.stringify({ leg, sha: result.sha, grader: 'phase by max(native timestamp, gl.at)', moved, recorded: { functionalPass: result.functionalPass, ...pick(result.grade) },
  regraded: { functionalPass, ...pick(grade) }, drive, perLap: soakLapMemory(timed, result.circuits ?? 0) }, null, 1));
