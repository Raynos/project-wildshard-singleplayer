// SF57 what-if, NOT a verdict: the road leg's grade if each sample took its phase from the LATER of its native timestamp
// and its joined GL reading's timestamp (gl.at). The recorded worker verdict in shipped-road.json stands.
// node road-whatif.mjs <dir>   (reads shipped-road.json and its raw .jsonl, or their .br archives)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { gradeSoak, soakDriveBounds } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/route.ts';
import { joinSoakSamples } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/owned.mjs';

const [dir] = process.argv.slice(2);
const read = (file) => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : brotliDecompressSync(readFileSync(join(dir, `${file}.br`))).toString('utf8');
const lines = (file) => read(file).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const result = JSON.parse(read('shipped-road.json'));
const drive = soakDriveBounds(result);
const raw = joinSoakSamples(lines('shipped-road-native.jsonl'), lines('shipped-road-gl.jsonl'), result.gamePid ?? null, lines('shipped-road-gl-events.jsonl'));
const moved = [];
const samples = raw.map((row) => {
  const at = Math.max(row.elapsed, row.gl?.at ?? row.elapsed);
  if (/^(drive|settle)/u.test(row.phase) && row.elapsed <= drive.end && at > drive.end) { moved.push({ elapsed: row.elapsed, glAt: row.gl?.at, glBytes: row.gl?.totalBytes }); return { ...row, phase: 'unloaded' }; }
  return row;
});
const grade = gradeSoak({ drive, samples, windows: result.windows, seconds: result.seconds ?? 0, circuits: result.circuits ?? 0,
  evictions: result.evictions.length, errors: result.errors, leak: result.leak?.after ? result.leak : null,
  expected: result.expected ?? [], entries: result.entries, crossroads: result.crossroads, engineBase: result.engineBase,
  rehearsal: result.grade.rehearsal, leg: 'road', contentCut: result.contentCut ?? null });
const mb = (bytes) => Math.round(bytes / 1e5) / 10;
console.log(JSON.stringify({ whatIf: 'phase by max(native timestamp, gl.at); not a verdict', moved, memoryPass: grade.memoryPass, gatePass: grade.gatePass, recovery: grade.recovery,
  loops: grade.loops.map((loop) => ({ cycle: loop.cycle, complete: loop.complete, peakMB: mb(loop.peakBytes), troughMB: mb(loop.troughBytes) })) }, null, 1));
