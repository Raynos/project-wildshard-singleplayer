// SF57 (sf57-spike): the game WebContent transients of a recorded leg — a sample's interval high (or footprint) above the
// median sampled footprint of the three samples on either side — placed on the route that was running (run.log lines are
// logged at each route's start). Reads the receipt's .br archives. It grades nothing.
// node transients.mjs <dir> <cells|road>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const [dir, leg = 'cells'] = process.argv.slice(2);
const read = (file) => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : brotliDecompressSync(readFileSync(join(dir, `${file}.br`))).toString('utf8');
const result = JSON.parse(read(`shipped-${leg}.json`));
const pid = String(result.gamePid);
const driveStart = Date.parse(result.driveStarted) / 1000;
const native = read(`shipped-${leg}-native.jsonl`).trim().split('\n').map((line) => JSON.parse(line)).filter((row) => row.type === 'sample' && /^(drive|settle)/u.test(row.phase));
const starts = readFileSync(join(dir, 'run.log'), 'utf8').split('\n').filter((line) => line.startsWith('{') && line.includes('"route"')).map((line) => JSON.parse(line));
const legStarts = []; let previous = -1; let block = 0;
for (const row of starts) { if (row.seconds < previous) block++; previous = row.seconds; legStarts.push({ ...row, block }); }
const mine = legStarts.filter((row) => row.block === (leg === 'cells' ? 0 : 1));
const footprint = native.map((row) => row.pids[pid]?.[0] ?? 0), high = native.map((row) => row.pids[pid]?.[1] ?? 0);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rows = [];
for (let i = 3; i < native.length - 3; i++) {
  const t = Math.max(high[i], footprint[i]) - median([...footprint.slice(i - 3, i), ...footprint.slice(i + 1, i + 4)]);
  const at = Date.parse(native[i].t) / 1000 - driveStart;
  const route = mine.filter((row) => row.seconds <= at).at(-1);
  rows.push({ mb: Math.round(t / 1e5) / 10, at: Math.round(at * 10) / 10, route: route ? `c${route.cycle} ${route.route} +${(at - route.seconds).toFixed(1)} s` : null });
}
rows.sort((a, b) => b.mb - a.mb);
console.log(JSON.stringify({ leg, gamePid: result.gamePid, samples: native.length, top: rows.slice(0, 8),
  atLeast20MB: rows.filter((row) => row.mb >= 20).length, atLeast40MB: rows.filter((row) => row.mb >= 40).length }, null, 1));
