#!/usr/bin/env node
// SF67 loading audit: rank the main-thread long tasks of a capture.mjs trace and name their owners.
//   node progress/loading/audit-2026-10-08/analyze.mjs --dir=<capture out> --dist=<served dist> [--min=50] > tasks.json
// For every top-level renderer-main task over --min ms between the load document's navigationStart and playable:
// its page time, the loading step running then (capture.mjs's step log), the trace's own sub-events (GC, compile,
// layout, style), and the V8 samples inside it: top self frames and top inclusive app frames, source-mapped through
// the build's hidden source maps (dist/assets/*.js.map).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve(process.cwd(), 'package.json'));
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const DIR = resolve(arg('dir', '.'));
const DIST = resolve(arg('dist', 'dist'));
const MIN = Number(arg('min', '50'));
const ONLY = arg('only', '');

const maps = new Map();
function mapFrame(url, line, col) {
  const m = /\/assets\/([^?#]+\.js)/.exec(url ?? '');
  if (!m) return null;
  const file = resolve(DIST, 'assets', m[1]);
  if (!maps.has(file)) maps.set(file, existsSync(`${file}.map`) ? new TraceMap(readFileSync(`${file}.map`, 'utf8')) : null);
  const tm = maps.get(file);
  if (!tm) return { src: m[1], line: line + 1, name: null };
  let p; try { p = originalPositionFor(tm, { line: line + 1, column: Math.max(0, col) }); } catch { p = {}; }
  if (!p.source) return { src: m[1], line: line + 1, name: null };
  return { src: p.source.replace(/^(\.\.\/)+/, '').replace(/^.*node_modules\/\.pnpm\/[^/]+\/node_modules\//, 'npm:'), line: p.line, name: p.name };
}

function analyze(base) {
  const rec = JSON.parse(readFileSync(resolve(DIR, `${base}.json`), 'utf8'));
  const trace = JSON.parse(readFileSync(resolve(DIR, `${base}.trace.json`), 'utf8'));
  const ev = Array.isArray(trace) ? trace : trace.traceEvents;
  const mains = new Set();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain') mains.add(`${e.pid}:${e.tid}`);
  // the load document's time origin: capture.mjs marks 'ws-audit-origin' at performance.now() = markAt in every document;
  // the last mark on the renderer main thread is the load document's
  const marks = ev.filter((e) => e.name === 'ws-audit-origin' && mains.has(`${e.pid}:${e.tid}`)).sort((a, b) => a.ts - b.ts);
  const mark = marks.at(-1);
  if (!mark) throw new Error(`${base}: no ws-audit-origin mark`);
  const key = `${mark.pid}:${mark.tid}`;
  const origin = mark.ts - (rec.markAt ?? 0) * 1000;
  const endTs = origin + ((rec.playMs ?? 60000) + 500) * 1000;
  const pageMs = (ts) => (ts - origin) / 1000;
  const stepAt = (ms) => { let s = ''; for (const [t, text] of rec.steps) { if (t <= ms && !text.startsWith('LOADEL')) s = text.split(' | ')[0]; } return s; };
  // tasks
  const onMain = ev.filter((e) => `${e.pid}:${e.tid}` === key && e.ph === 'X');
  const tasks = onMain.filter((e) => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur >= MIN * 1000 && e.ts >= origin - 50000 && e.ts <= endTs)
    .sort((a, b) => a.ts - b.ts);
  // nested tasks can duplicate (RunTask inside ThreadControllerImpl::RunTask): keep outermost
  const top = []; for (const t of tasks) { const last = top.at(-1); if (last && t.ts >= last.ts && t.ts + t.dur <= last.ts + last.dur) continue; top.push(t); }
  // CPU profile samples for that thread
  const nodes = new Map(); const samples = []; // [ts, nodeId]
  const profIds = new Set(ev.filter((e) => e.name === 'Profile' && `${e.pid}:${e.tid}` === key).map((e) => e.id));
  const startOf = new Map(ev.filter((e) => e.name === 'Profile' && profIds.has(e.id)).map((e) => [e.id, e.args.data.startTime]));
  const cursor = new Map();
  for (const e of ev) {
    if (e.name !== 'ProfileChunk' || !profIds.has(e.id)) continue;
    const d = e.args.data; const cp = d.cpuProfile ?? {};
    for (const n of cp.nodes ?? []) nodes.set(`${e.id}:${n.id}`, { cf: n.callFrame, parent: n.parent === undefined ? null : `${e.id}:${n.parent}` });
    let t = cursor.get(e.id) ?? startOf.get(e.id) ?? 0;
    const ids = cp.samples ?? []; const deltas = d.timeDeltas ?? [];
    for (let i = 0; i < ids.length; i++) { t += deltas[i] ?? 0; samples.push([t, `${e.id}:${ids[i]}`]); }
    cursor.set(e.id, t);
  }
  samples.sort((a, b) => a[0] - b[0]);
  const frameKey = (cf) => { const m = mapFrame(cf.url, cf.lineNumber, cf.columnNumber); const fn = cf.functionName || '(anon)';
    if (m) return `${m.name && m.name !== fn ? `${fn}~${m.name}` : fn} ${m.src}:${m.line}`;
    return cf.url ? `${fn} ${basename(cf.url).slice(0, 40)}:${cf.lineNumber + 1}` : fn; };
  const keyCache = new Map(); const fk = (id) => { if (!keyCache.has(id)) keyCache.set(id, frameKey(nodes.get(id).cf)); return keyCache.get(id); };
  const isApp = (k) => /(^|\s)src\//.test(k);
  const out = [];
  let si = 0;
  for (const t of top) {
    const t0 = t.ts, t1 = t.ts + t.dur;
    while (si < samples.length && samples[si][0] < t0) si++;
    const self = new Map(), incl = new Map(), appLeaf = new Map(); let n = 0;
    for (let j = si; j < samples.length && samples[j][0] <= t1; j++) {
      n++;
      let id = samples[j][1]; const seen = new Set(); let leaf = true; let firstApp = null;
      while (id && nodes.has(id)) {
        const k = fk(id);
        if (leaf) { self.set(k, (self.get(k) ?? 0) + 1); leaf = false; }
        if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + 1); }
        if (firstApp === null && isApp(k)) firstApp = k;
        id = nodes.get(id).parent;
      }
      if (firstApp) appLeaf.set(firstApp, (appLeaf.get(firstApp) ?? 0) + 1);
    }
    const sub = {}; for (const e of onMain) { if (e.ts < t0 || e.ts > t1 || e === t) continue;
      const nm = /GC|Scavenge|MarkCompact/.test(e.name) ? 'gc' : /compile|Compile/.test(e.name) ? 'v8compile' : /Layout|UpdateLayoutTree|RecalculateStyles|Paint|PrePaint/.test(e.name) ? 'layout/style' : /EvaluateScript|v8.run|ParseHTML/.test(e.name) ? e.name : null;
      if (nm) sub[nm] = Math.round((sub[nm] ?? 0) + e.dur / 1000); }
    const pct = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => [k, Math.round((100 * v) / Math.max(1, n))]);
    const ms = pageMs(t0);
    out.push({ atMs: Math.round(ms), durMs: Math.round(t.dur / 1000), step: stepAt(ms), samples: n, sub, appLeaf: pct(appLeaf), self: pct(self),
      inclApp: pct(new Map([...incl.entries()].filter(([k]) => isApp(k)))) });
  }
  return { base, shard: rec.shard, cache: rec.cache, cpu: rec.cpu, readyMs: rec.readyMs, playMs: rec.playMs, heapMB: rec.heapMB, programs: rec.programs,
    phases: phases(rec.steps), longTasks: out, totalLongMs: out.reduce((s, t) => s + t.durMs, 0) };
}
function phases(steps) { const ph = []; for (const [t, s] of steps) { if (s.startsWith('LOADEL')) continue; const k = s.split(' | ')[0]; if (ph.at(-1)?.[0] !== k) ph.push([k, t]); } return ph; }

if (!process.argv.some((a) => a.startsWith('--sim='))) {
const bases = readdirSync(DIR).filter((f) => f.endsWith('.trace.json')).map((f) => f.replace('.trace.json', '')).filter((b) => !ONLY || b.includes(ONLY));
const results = bases.map(analyze);
console.log(JSON.stringify(results, null, 1));
}

// --sim: the Simulator's untimed ScriptProfiler aggregate (sim.mjs): share of all JS samples per first app frame
export function simAggregate(file) {
  const s = JSON.parse(readFileSync(file, 'utf8'));
  const traces = s.profile?.samples?.stackTraces ?? [];
  const leaf = new Map(), incl = new Map();
  for (const t of traces) {
    let first = null; const seen = new Set();
    for (const f of t.stackFrames) {
      const m = mapFrame(f.url, (f.line ?? 1) - 1, (f.column ?? 1) - 1);
      const k = m ? `${f.name || '(anon)'} ${m.src}:${m.line}` : `${f.name || '(anon)'} ${(f.url ?? '').split('/').pop()}`;
      if (first === null && /(^|\s)src\//.test(k)) first = k;
      if (/(^|\s)src\//.test(k) && !seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + 1); }
    }
    const k = first ?? (t.stackFrames.length ? '(vendor / native)' : '(idle / program)');
    leaf.set(k, (leaf.get(k) ?? 0) + 1);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, +(100 * v / Math.max(1, traces.length)).toFixed(1)]);
  return { file: basename(file), samples: traces.length, ready: s.ready, gaps: s.gaps, steps: s.steps, firstApp: top(leaf), inclusive: top(incl) };
}
if (arg('sim', '')) console.log(JSON.stringify(arg('sim', '').split(',').map(simAggregate), null, 1));
