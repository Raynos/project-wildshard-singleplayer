// node simanalyse.cjs <dir> <mode>: per route, the exit window (route start .. +15 s) against the 10 s before it
const fs = require('fs');
const [dir, mode] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(`${dir}/${mode}.json`, 'utf8'));
const nat = fs.readFileSync(`${dir}/${mode}-native.jsonl`, 'utf8').trim().split('\n').map(JSON.parse).filter((s) => s.type === 'sample');
const T = (s) => Date.parse(s.t) / 1000;
const mb = (b) => (b / 1e6).toFixed(1);
// game pid = highest interval
const pidMax = {}; for (const s of nat) for (const [pid, v] of Object.entries(s.pids)) pidMax[pid] = Math.max(pidMax[pid] ?? 0, v[1]);
const game = Object.entries(pidMax).sort((a, b) => b[1] - a[1])[0][0];
const g = (s) => s.pids[game] ?? [0, 0];
const rows = [];
for (const route of r.routes) {
  const pre = nat.filter((s) => T(s) >= route.start - 10 && T(s) < route.start).map((s) => g(s)[0]);
  const win = nat.filter((s) => T(s) >= route.start && T(s) <= route.start + 15);
  const base = pre.length ? pre.sort((a, b) => a - b)[Math.floor(pre.length / 2)] : NaN;
  const hi = Math.max(...win.map((s) => g(s)[1]));
  const js = r.categories.filter((c) => c.at >= route.start && c.at <= route.start + 15).map((c) => c.c.javascript);
  const jsPre = r.categories.filter((c) => c.at >= route.start - 10 && c.at < route.start).map((c) => c.c.javascript);
  const gcs = r.gcs.filter((x) => x.at >= route.start && x.at <= route.start + 15);
  rows.push({ route: `${route.cycle}:${route.name}`, baseMB: mb(base), exitHighMB: mb(hi), riseMB: mb(hi - base), jsPreMaxMB: jsPre.length ? mb(Math.max(...jsPre)) : null, jsExitMaxMB: js.length ? mb(Math.max(...js)) : null, gcs: `${gcs.filter((x) => x.type === 'full').length} full / ${gcs.filter((x) => x.type !== 'full').length} eden` });
}
const drive = nat.filter((s) => s.phase === 'drive');
const cats = r.categories;
const catMax = {}; for (const c of cats) for (const [k, v] of Object.entries(c.c)) catMax[k] = Math.max(catMax[k] ?? 0, v);
const catMin = {}; for (const c of cats) for (const [k, v] of Object.entries(c.c)) catMin[k] = Math.min(catMin[k] ?? Infinity, v);
console.log(JSON.stringify({ mode, game, errors: r.errors, driveSamples: drive.length, drivePeakIntervalMB: mb(Math.max(...drive.map((s) => g(s)[1]))), driveMedianMB: mb(drive.map((s) => g(s)[0]).sort((a, b) => a - b)[Math.floor(drive.length / 2)]),
  gcCount: { full: r.gcs.filter((x) => x.type === 'full').length, eden: r.gcs.filter((x) => x.type !== 'full').length }, categoryMaxMB: Object.fromEntries(Object.entries(catMax).map(([k, v]) => [k, mb(v)])), categoryMinMB: Object.fromEntries(Object.entries(catMin).map(([k, v]) => [k, mb(v)])), rows }, null, 1));
