// SF57 regrade of a recorded qualifying leg from its raw samples with the current grader (scripts/soak/route.ts), exactly
// the worker's own join and gradeSoak call (scripts/soak/soak.mjs), keeping the recorded verdict beside the new one.
// node regrade.mjs <dir> <cells|road>   (reads shipped-<leg>.json and its raw .jsonl, or their .br archives)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { gradeSoak } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/route.ts';
import { joinSoakSamples, soakLapMemory } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/owned.mjs';

const [dir, leg = 'cells'] = process.argv.slice(2);
const read = (file) => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : brotliDecompressSync(readFileSync(join(dir, `${file}.br`))).toString('utf8');
const lines = (file) => read(file).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const result = JSON.parse(read(`shipped-${leg}.json`));
const samples = joinSoakSamples(lines(`shipped-${leg}-native.jsonl`), lines(`shipped-${leg}-gl.jsonl`), result.gamePid ?? null, lines(`shipped-${leg}-gl-events.jsonl`));
const grade = gradeSoak({ samples, windows: result.windows, seconds: result.seconds ?? 0, circuits: result.circuits ?? 0,
  evictions: result.evictions.length, errors: result.errors, leak: result.leak?.after ? result.leak : null,
  expected: result.expected ?? [], entries: result.entries, crossroads: result.crossroads, engineBase: result.engineBase,
  rehearsal: result.grade.rehearsal, leg, contentCut: result.contentCut ?? null });
const functionalPass = result.failure === undefined && result.errors.length === 0 && (result.seconds ?? 0) >= grade.requiredSeconds
  && result.routes.length > 0 && result.routes.every((route) => route.failures.length === 0) && grade.sampling && grade.leakZero;
const pick = (g) => ({ memoryPass: g.memoryPass, gatePass: g.gatePass, sampling: g.sampling, recovery: g.recovery, calibration: g.calibration,
  leakZero: g.leakZero, peakBytes: g.peakBytes, loadingPeakBytes: g.loadingPeakBytes, ratios: g.ratios, loops: g.loops, baselineDeltaBytes: g.baselineDeltaBytes,
  admitted: g.admitted, refused: g.refused, crossroads: g.crossroads, rehearsal: g.rehearsal });
console.log(JSON.stringify({ leg, sha: result.sha, recorded: { functionalPass: result.functionalPass, ...pick(result.grade) },
  regraded: { functionalPass, ...pick(grade) }, perLap: soakLapMemory(samples, result.circuits ?? 0) }, null, 1));
