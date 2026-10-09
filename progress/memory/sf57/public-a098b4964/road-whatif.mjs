// What-if only, never the verdict: the road leg graded with the samples the sampler still tagged 'drive' after the drive
// ended (the teardown had already freed GL to 42.9 MB) moved to 'unloaded'. node road-whatif.mjs [dir]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { gradeSoak } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/route.ts';
import { joinSoakSamples } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/owned.mjs';
const dir = process.argv[2] ?? '.';
const read = (file) => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : brotliDecompressSync(readFileSync(join(dir, `${file}.br`))).toString('utf8');
const lines = (file) => read(file).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const result = JSON.parse(read('shipped-road.json')), ds = Date.parse(result.driveStarted) / 1000;
let moved = 0;
const native = lines('shipped-road-native.jsonl').map((row) => {
  if (row.type !== 'sample' || row.phase !== 'drive' || Date.parse(row.t) / 1000 - ds <= result.seconds) return row;
  moved++; return { ...row, phase: 'unloaded' };
});
const samples = joinSoakSamples(native, lines('shipped-road-gl.jsonl'), result.gamePid, lines('shipped-road-gl-events.jsonl'));
const g = gradeSoak({ samples, windows: result.windows, seconds: result.seconds, circuits: result.circuits, evictions: result.evictions.length, errors: result.errors,
  leak: result.leak?.after ? result.leak : null, expected: result.expected ?? [], entries: result.entries, crossroads: result.crossroads, engineBase: result.engineBase, rehearsal: false, leg: 'road', contentCut: null });
console.log(JSON.stringify({ moved, memoryPass: g.memoryPass, gatePass: g.gatePass, recovery: g.recovery, loops: g.loops.map((l) => [l.cycle, +(l.peakBytes / 1e6).toFixed(1), +(l.troughBytes / 1e6).toFixed(1)]) }));
