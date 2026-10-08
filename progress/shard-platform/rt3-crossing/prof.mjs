// Summarise a cpuprofile: the longest single tasks (contiguous non-idle runs) and, inside them, the heaviest inclusive
// frames mapped back to source through the build's source maps.  node prof.mjs <profile> <distAssetsDir> [topTasks]
import { readFileSync, existsSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer/node_modules';
const { TraceMap, originalPositionFor } = await import('/Users/raynos/projects/games/wildshard-singleplayer/node_modules/.pnpm/@jridgewell+trace-mapping@0.3.31/node_modules/@jridgewell/trace-mapping/dist/trace-mapping.mjs');
const [file, dir, topN = '3'] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const nodes = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const maps = new Map();
const where = (cf) => {
  const name = cf.url.split('/').pop(); if (!name) return cf.functionName || '(native)';
  if (!maps.has(name)) { const m = `${dir}/${name}.map`; maps.set(name, existsSync(m) ? new TraceMap(readFileSync(m, 'utf8')) : null); }
  const tm = maps.get(name); if (!tm) return `${cf.functionName} ${name}`;
  const o = originalPositionFor(tm, { line: cf.lineNumber + 1, column: cf.columnNumber });
  return `${o.name ?? cf.functionName ?? '?'} ${(o.source ?? '').replace(/^.*\/src\//u, 'src/')}:${o.line}`;
};
// tasks: runs of consecutive samples whose leaf is not (idle)/(program)
const idle = new Set(p.nodes.filter(n => ['(idle)'].includes(n.callFrame.functionName) && n.callFrame.url === '').map(n => n.id));
let t = p.startTime; const tasks = []; let cur = null;
p.samples.forEach((s, i) => { t += p.timeDeltas[i]; const busy = !idle.has(s) || nodes.get(s).callFrame.functionName === '(garbage collector)';
  if (busy) { if (!cur) cur = { start: t, end: t, samples: [] }; cur.end = t; cur.samples.push([s, p.timeDeltas[i + 1] ?? 0]); } else if (cur) { tasks.push(cur); cur = null; } });
if (cur) tasks.push(cur);
tasks.sort((a, b) => (b.end - b.start) - (a.end - a.start));
for (const task of tasks.slice(0, Number(topN))) {
  const incl = new Map();
  for (const [s, dt] of task.samples) { const seen = new Set(); let x = s; while (nodes.has(x)) { const k = where(nodes.get(x).callFrame); if (!seen.has(k)) { incl.set(k, (incl.get(k) ?? 0) + dt / 1000); seen.add(k); } x = parent.get(x); } }
  console.log(`\nTASK ${((task.end - task.start) / 1000).toFixed(0)} ms at +${((task.start - p.startTime) / 1e6).toFixed(1)} s`);
  for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${v.toFixed(0).padStart(6)} ${k}`);
}
