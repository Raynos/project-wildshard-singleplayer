#!/usr/bin/env node
// bench-load.mjs — the load-performance ruler (docs/BENCH.md, docs/plans/LOAD-PERF.md §P0).
//
// Builds the production bundle, serves it with `vite preview` on its own port, and opens it in
// headless Chromium under CDP network + CPU throttling, cold (fresh context) then warm (same
// context, second navigation). Per run it records bytes by type (net vs cache), request count,
// time-to-title, time-to-play, per-step timings from the loading log, long tasks, JS heap and
// renderer.info. Writes progress/bench/<build>-<ts>.json + progress/bench/latest.md and prints
// the table. `--ci` compares against bench.budget.json and exits non-zero when over budget.
//
//   pnpm bench                     # wifi,4g × cold,warm at 4× CPU on a fresh build
//   pnpm bench:ci                  # same, exit code = number of budget rows over
//   pnpm bench -- --url=https://wildshard-singleplayer.vercel.app   # live site, no build
//   pnpm bench -- --compare progress/bench/a.json progress/bench/b.json
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = resolve(ROOT, 'progress/bench');
const BUDGET_FILE = resolve(ROOT, 'bench.budget.json');

const NETS = {
  wifi: { latency: 20, down: 30e6 / 8, up: 15e6 / 8 },
  '4g': { latency: 170, down: 9e6 / 8, up: 1.5e6 / 8 },       // Chrome "Fast 4G"
  '3g': { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 },    // Chrome "Fast 3G"
  none: null,
};
const TYPES = ['js', 'css', 'jpg', 'png', 'hdr', 'glb', 'gltf', 'bin', 'ktx2', 'font', 'json', 'html', 'other'];

const HELP = `bench-load — headless load-performance ruler

  node scripts/bench-load.mjs [flags]

  --conditions=wifi,4g   network presets (wifi | 4g | 3g | none), default wifi,4g
  --cache=cold,warm      cold = fresh browser context; warm = second navigation in the same context
  --cpu=4                Emulation.setCPUThrottlingRate (1 = off)
  --runs=1               repeat each condition N times and report the median (p50) per metric
  --timeout=180          seconds per run before it is recorded as "timeout"
  --url=<origin>         bench a live origin instead of building + previewing (skips build/preview)
  --no-build             reuse dist/ as is
  --port=4175            vite preview port
  --viewport=1280x720    page size (DPR 1)
  --gpu=metal            metal = the host GPU through ANGLE (same stack as iOS Safari); swiftshader = software GL
  --ci                   check bench.budget.json; exit code = number of rows over budget
  --compare a.json b.json   print a before/after table of two result files and exit
  --help

Output: progress/bench/<build>-<timestamp>.json, progress/bench/latest.md, table on stdout.`;

// ── args ──
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const has = (name) => argv.includes(`--${name}`);
if (has('help')) { console.log(HELP); process.exit(0); }

const CONDITIONS = flag('conditions', 'wifi,4g').split(',').filter(Boolean);
const CACHES = flag('cache', 'cold,warm').split(',').filter(Boolean);
const CPU = Number(flag('cpu', '4'));
const RUNS = Math.max(1, Number(flag('runs', '1')));
const TIMEOUT_MS = Number(flag('timeout', '180')) * 1000;
const PORT = Number(flag('port', '4175'));
const [VW, VH] = flag('viewport', '1280x720').split('x').map(Number);
const GPU = flag('gpu', 'metal');
const CI = has('ci');
let URL_BASE = flag('url', '');

if (has('compare')) {
  const i = argv.indexOf('--compare');
  const [a, b] = [argv[i + 1], argv[i + 2]];
  if (!a || !b) { console.error('usage: --compare <before.json> <after.json>'); process.exit(2); }
  console.log(compareTable(JSON.parse(readFileSync(resolve(a), 'utf8')), JSON.parse(readFileSync(resolve(b), 'utf8')), basename(a), basename(b)));
  process.exit(0);
}
for (const c of CONDITIONS) if (!(c in NETS)) { console.error(`unknown network preset "${c}" (wifi|4g|3g|none)`); process.exit(2); }

// ── build + preview ──
let preview = null;
if (!URL_BASE) {
  if (!has('no-build')) { console.error('> pnpm build'); execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' }); }
  else if (!existsSync(resolve(ROOT, 'dist/index.html'))) { console.error('dist/ missing; drop --no-build'); process.exit(2); }
  preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  preview.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  URL_BASE = `http://localhost:${PORT}`;
  await waitFor(async () => (await fetch(`${URL_BASE}/version.json`)).ok, 20_000, 'vite preview did not come up');
}
URL_BASE = URL_BASE.replace(/\/$/, '');
const cleanup = () => { if (preview && !preview.killed) preview.kill('SIGTERM'); };
process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(130); });

let build = 'unknown';
try { build = (await (await fetch(`${URL_BASE}/version.json`, { cache: 'no-store' })).json()).build ?? build; } catch {}
console.error(`> bench ${URL_BASE} build=${build} conditions=${CONDITIONS.join(',')} × ${CACHES.join(',')} cpu=${CPU}× gpu=${GPU} runs=${RUNS} viewport=${VW}x${VH}`);

// ── the in-page instrument: installed before any script of the page runs ──
const INIT_SCRIPT = `(() => {
  const W = window; W.__bench_steps = []; W.__bench_long = []; W.__bench_title = 0; W.__bench_play = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__bench_long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  let lastStep = '';
  const readStep = () => {
    const root = document.querySelector('.ws-loading'); if (!root) return null;
    const ds = root.getAttribute('data-step') || root.querySelector('[data-step]')?.getAttribute('data-step');
    if (ds) return { text: ds, bytes: root.getAttribute('data-bytes') || root.querySelector('[data-bytes]')?.getAttribute('data-bytes') || null };
    const log = root.querySelector('.ws-loading-log'); const line = log && log.lastElementChild;
    const text = line ? line.textContent.replace(/^▸\\s*/, '') : (root.querySelector('.ws-loading-label')?.textContent ?? '');
    return { text, bytes: null };
  };
  const onMut = () => { const s = readStep(); if (s && s.text && s.text !== lastStep) { lastStep = s.text; W.__bench_steps.push([Math.round(performance.now()), s.text, s.bytes]); } };
  const start = () => {
    new MutationObserver(onMut).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-step', 'data-bytes'] });
    onMut();
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
  const poll = setInterval(() => {
    if (!W.__bench_title && (document.querySelector('.ws-loading') || document.querySelector('#hud.intro'))) {
      W.__bench_title = -1; requestAnimationFrame(() => requestAnimationFrame(() => { W.__bench_title = Math.round(performance.now()); }));
    }
    if (!W.__bench_play && !document.querySelector('.ws-loading') && W.__world) { W.__bench_play = Math.round(performance.now()); clearInterval(poll); }
  }, 50);
})();`;

const COLLECT = `((assetIndex) => {
  const W = window;
  const typeOf = (u) => { const p = u.split(/[?#]/)[0].toLowerCase(); const m = p.match(/\\.([a-z0-9]+)$/); const e = m ? m[1] : '';
    if (/fonts\\.(gstatic|googleapis)\\.com/.test(u) || /^(woff2?|ttf|otf)$/.test(e)) return 'font';
    if (e === 'jpeg') return 'jpg'; if (e === 'mjs') return 'js'; if (e === 'htm' || e === '' ) return e === '' ? 'other' : 'html';
    return ${JSON.stringify(TYPES)}.includes(e) ? e : 'other'; };
  const bytes = {}; for (const t of ${JSON.stringify(TYPES)}) bytes[t] = { net: 0, cache: 0, opaque: 0, n: 0 };
  let requests = 0, net = 0, cache = 0, opaque = 0, sw = 0;
  const known = (u) => { try { return assetIndex[new URL(u).pathname] || 0; } catch { return 0; } };
  const nav = performance.getEntriesByType('navigation')[0];
  const rs = [...performance.getEntriesByType('resource')];
  const all = nav ? [nav, ...rs] : rs;
  for (const r of all) {
    const t = r === nav ? 'html' : typeOf(r.name); const b = bytes[t]; b.n++; requests++;
    if (r.workerStart > 0 && r.transferSize === 0) sw++;
    if (r.transferSize > 0) { b.net += r.transferSize; net += r.transferSize; }
    else if (r.encodedBodySize > 0 || known(r.name) > 0) { const n = r.encodedBodySize || known(r.name); b.cache += n; cache += n; }
    else { b.opaque++; opaque++; }
  }
  const long = W.__bench_long || []; const maxLong = long.reduce((m, e) => Math.max(m, e[1]), 0);
  const world = W.__world; const renderer = world && world.game && world.game.renderer; const info = renderer && renderer.info;
  return {
    titleMs: W.__bench_title > 0 ? W.__bench_title : null, playMs: W.__bench_play || null,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null, loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
    requests, netBytes: net, cacheBytes: cache, opaqueRequests: opaque, swRequests: sw, bytes,
    longTasks: long.length, longTaskMs: long.reduce((s, e) => s + e[1], 0), longTaskMaxMs: maxLong,
    steps: W.__bench_steps || [],
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    textures: info ? info.memory.textures : null, geometries: info ? info.memory.geometries : null, programs: info ? info.programs.length : null,
    firstFrameMs: world && world.game && world.game.stats && typeof world.game.stats.firstFrameMs === 'number' ? world.game.stats.firstFrameMs : null,
    swController: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    gpu: (() => { try { const gl = (renderer && renderer.getContext()) || document.createElement('canvas').getContext('webgl2'); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { return null; } })(),
    ua: navigator.userAgent, dpr: devicePixelRatio, viewport: [innerWidth, innerHeight],
  };
})()`;

// ── run matrix ──
const browser = await chromium.launch({ headless: true, args: GPU === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let assetIndex = {}; // /assets/<path> → bytes, for the size of responses the HTTP cache / service worker served (they report 0/0)
try { assetIndex = await (await fetch(`${URL_BASE}/asset-index.json`, { cache: 'no-store' })).json(); } catch {}
const runs = []; // { cond, cache, run, status, ...metrics }
try {
  for (const cond of CONDITIONS) {
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, serviceWorkers: 'allow' });
      try {
        for (const cache of ['cold', 'warm']) {
          if (!CACHES.includes(cache) && cache === 'warm') continue;
          const label = `${cond}/${cache}${RUNS > 1 ? ` #${i + 1}` : ''}`;
          const t0 = Date.now();
          const r = await runOnce(ctx, cond, cache, label);
          runs.push({ cond, cache, run: i + 1, ...r });
          console.error(`  ${label.padEnd(14)} ${r.status.padEnd(8)} title ${fmtS(r.titleMs)} · play ${fmtS(r.playMs)} · ${fmtMB(r.netBytes)} net / ${fmtMB(r.cacheBytes)} cache · ${r.requests} req · ${r.longTasks} long (${r.longTaskMaxMs} ms max) · sw=${r.swController} (${((Date.now() - t0) / 1000).toFixed(0)} s wall)`);
          if (cache === 'cold' && !CACHES.includes('cold')) runs.pop(); // cold only run to warm the context
        }
      } finally { await ctx.close(); }
    }
  }
} finally { await browser.close(); cleanup(); }

async function runOnce(ctx, cond, cache, label) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const net = NETS[cond];
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  let wireBytes = 0, wireRequests = 0, fromSW = 0, fromDisk = 0;
  cdp.on('Network.loadingFinished', (e) => { wireBytes += e.encodedDataLength; wireRequests++; });
  cdp.on('Network.responseReceived', (e) => { if (e.response.fromServiceWorker) fromSW++; else if (e.response.fromDiskCache) fromDisk++; });
  await page.addInitScript(INIT_SCRIPT);
  let status = 'ok';
  try {
    await page.goto(`${URL_BASE}/?nolock=1&bench=1`, { waitUntil: 'commit', timeout: TIMEOUT_MS });
    await page.waitForFunction(() => window.__bench_play > 0, null, { timeout: TIMEOUT_MS, polling: 100 });
    // let the first frames land so renderer.info / long tasks settle
    await page.waitForTimeout(1500);
  } catch (e) {
    status = /Timeout/i.test(String(e)) ? 'timeout' : 'error';
    errors.push(String(e.message ?? e).split('\n')[0].slice(0, 200));
  }
  let m = {};
  try { m = await page.evaluate(COLLECT, assetIndex); } catch (e) { errors.push(`collect: ${e.message}`); }
  const shot = resolve(OUT_DIR, `shot-${cond}-${cache}.png`);
  try { mkdirSync(OUT_DIR, { recursive: true }); await page.screenshot({ path: shot }); } catch {}
  if (status === 'ok' && errors.length) status = 'ok*';
  await page.close();
  return { status, label, wireBytes, wireRequests, fromSW, fromDisk, errors, ...m };
}

// ── aggregate: p50 per (cond,cache) across runs ──
const NUMERIC = ['titleMs', 'playMs', 'domContentLoadedMs', 'requests', 'netBytes', 'cacheBytes', 'opaqueRequests', 'swRequests', 'wireBytes', 'wireRequests', 'fromSW', 'fromDisk', 'longTasks', 'longTaskMs', 'longTaskMaxMs', 'heapMB', 'textures', 'geometries', 'programs', 'firstFrameMs'];
const rows = {};
for (const cond of CONDITIONS) for (const cache of CACHES) {
  const key = `${cond}/${cache}`; const rs = runs.filter((r) => r.cond === cond && r.cache === cache);
  if (!rs.length) continue;
  const row = { cond, cache, runs: rs.length, status: rs.every((r) => r.status.startsWith('ok')) ? 'ok' : rs.map((r) => r.status).join(','), swController: rs.some((r) => r.swController) };
  for (const k of NUMERIC) row[k] = p50(rs.map((r) => r[k]).filter((v) => typeof v === 'number'));
  row.bytes = {}; for (const t of TYPES) row.bytes[t] = { net: p50(rs.map((r) => r.bytes?.[t]?.net)), cache: p50(rs.map((r) => r.bytes?.[t]?.cache)), n: p50(rs.map((r) => r.bytes?.[t]?.n)) };
  row.steps = rs[0].steps; // the first run's step trace (ms are illustrative, see docs/BENCH.md)
  row.errors = [...new Set(rs.flatMap((r) => r.errors))];
  rows[key] = row;
}

const result = { build, url: URL_BASE, at: new Date().toISOString(), host: `${process.platform} ${process.arch} node ${process.version}`, cpu: CPU, gpu: runs[0]?.gpu ?? GPU, runsPerCondition: RUNS, viewport: [VW, VH], ua: runs[0]?.ua ?? null, rows, raw: runs };
mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const jsonPath = resolve(OUT_DIR, `${build}-${stamp}.json`);
writeFileSync(jsonPath, JSON.stringify(result, null, 2));

// ── report ──
let md = `## bench ${build} — ${result.at.slice(0, 16).replace('T', ' ')} · ${URL_BASE} · cpu ${CPU}× · ${RUNS} run${RUNS > 1 ? 's (p50)' : ''} · ${VW}×${VH} headless · ${result.gpu}\n\n`;
md += summaryTable(rows);
const first = rows[`${CONDITIONS[0]}/cold`] ?? Object.values(rows)[0];
if (first?.steps?.length) md += `\n### per-step · ${first.cond}/${first.cache}\n\n${stepTable(first)}`;
const errs = Object.values(rows).filter((r) => r.errors.length);
if (errs.length) md += `\n### page errors\n\n${errs.map((r) => `- ${r.cond}/${r.cache}: ${r.errors.join(' · ')}`).join('\n')}\n`;
writeFileSync(resolve(OUT_DIR, 'latest.md'), md);
console.log('\n' + md);
console.error(`> wrote ${rel(jsonPath)} and ${rel(resolve(OUT_DIR, 'latest.md'))}`);

if (CI) {
  const { table, failed } = budgetTable(rows, JSON.parse(readFileSync(BUDGET_FILE, 'utf8')));
  console.log(table);
  console.log(failed ? `\n${failed} budget row${failed > 1 ? 's' : ''} over — see bench.budget.json` : '\nall budgets met');
  process.exit(Math.min(failed, 100));
}
process.exit(0);

// ── tables ──
function summaryTable(rows) {
  const h = ['condition', 'bytes MB net / cache', 'requests', 'title s', 'play s', 'long tasks n / ms / max', 'textures', 'programs', 'heap MB', 'sw'];
  const lines = [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`];
  for (const r of Object.values(rows)) {
    const by = TYPES.filter((t) => r.bytes[t].net > 0 || r.bytes[t].cache > 0).map((t) => `${t} ${fmtMB(r.bytes[t].net + r.bytes[t].cache, 1)}`).join(' · ');
    lines.push(`| ${r.cond}/${r.cache}${r.status !== 'ok' ? ` (${r.status})` : ''} | ${fmtMB(r.netBytes)} / ${fmtMB(r.cacheBytes)}${r.opaqueRequests ? ` (+${r.opaqueRequests} opaque)` : ''}<br><small>${by}</small> | ${na(r.requests)} | ${fmtS(r.titleMs)} | ${fmtS(r.playMs)} | ${na(r.longTasks)} / ${na(r.longTaskMs)} / ${na(r.longTaskMaxMs)} | ${na(r.textures)} | ${na(r.programs)} | ${na(r.heapMB)} | ${r.swController ? `yes (${na(r.swRequests)} req)` : 'no'} |`);
  }
  return lines.join('\n') + '\n';
}
function stepTable(r) {
  const lines = ['| at s | Δ ms | step |', '|---|---|---|'];
  let prev = 0;
  for (const [t, text, bytes] of r.steps) { lines.push(`| ${(t / 1000).toFixed(2)} | ${t - prev} | ${text}${bytes ? ` (${bytes})` : ''} |`); prev = t; }
  if (r.playMs) lines.push(`| ${(r.playMs / 1000).toFixed(2)} | ${r.playMs - prev} | *playable (\`.ws-loading\` gone, \`__world\` set)* |`);
  return lines.join('\n') + '\n';
}
function budgetTable(rows, budget) {
  const lines = ['| budget | measured | threshold | |', '|---|---|---|---|'];
  let failed = 0;
  for (const b of budget.rows) {
    const r = rows[b.cond]; const v = r ? r[b.metric] : undefined;
    let cell, verdict;
    if (v === undefined || v === null) { cell = 'n/a'; verdict = 'SKIP'; }
    else if ('equals' in b) { cell = String(v); verdict = v === b.equals ? 'PASS' : 'FAIL'; }
    else { cell = fmtUnit(v, b.unit); verdict = v <= b.max ? 'PASS' : 'FAIL'; }
    if (verdict === 'FAIL') failed++;
    lines.push(`| ${b.name} (${b.cond}) | ${cell} | ${'equals' in b ? `= ${b.equals}` : `≤ ${fmtUnit(b.max, b.unit)}`} | ${verdict} |`);
  }
  return { table: lines.join('\n'), failed };
}
function compareTable(a, b, an, bn) {
  const keys = [...new Set([...Object.keys(a.rows), ...Object.keys(b.rows)])];
  const metrics = [['netBytes', 'net MB', (v) => fmtMB(v)], ['cacheBytes', 'cache MB', (v) => fmtMB(v)], ['requests', 'requests', na], ['textures', 'textures', na], ['geometries', 'geometries', na], ['programs', 'programs', na], ['longTasks', 'long tasks', na], ['longTaskMaxMs', 'longest task ms', na], ['heapMB', 'heap MB', na], ['titleMs', 'title s (p50)', fmtS], ['playMs', 'play s (p50)', fmtS]];
  let out = `## compare · ${an} (${a.build}) → ${bn} (${b.build})\n\nCounts are the comparators; ms rows are p50 over ${a.runsPerCondition ?? '?'}/${b.runsPerCondition ?? '?'} runs and swing ±25 % run-to-run on a shared host.\n\n`;
  for (const k of keys) {
    const ra = a.rows[k], rb = b.rows[k]; if (!ra || !rb) { out += `### ${k}: only in ${ra ? an : bn}\n\n`; continue; }
    out += `### ${k}\n\n| metric | before | after | Δ |\n|---|---|---|---|\n`;
    for (const [m, label, f] of metrics) {
      const va = ra[m], vb = rb[m];
      const d = typeof va === 'number' && typeof vb === 'number' && va !== 0 ? `${vb - va >= 0 ? '+' : ''}${((vb - va) / va * 100).toFixed(0)} %` : '';
      out += `| ${label} | ${f(va)} | ${f(vb)} | ${d} |\n`;
    }
    const bt = TYPES.filter((t) => (ra.bytes?.[t]?.net ?? 0) + (rb.bytes?.[t]?.net ?? 0) > 0);
    if (bt.length) out += `| bytes by type (net) | ${bt.map((t) => `${t} ${fmtMB(ra.bytes[t].net, 1)}`).join(' · ')} | ${bt.map((t) => `${t} ${fmtMB(rb.bytes[t].net, 1)}`).join(' · ')} | |\n`;
    out += '\n';
  }
  return out;
}

// ── util ──
function p50(xs) { const v = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; }
function fmtMB(b, d = 2) { return typeof b === 'number' ? (b / 1048576).toFixed(d) : 'n/a'; }
function fmtS(ms) { return typeof ms === 'number' ? (ms / 1000).toFixed(2) : 'n/a'; }
function fmtUnit(v, unit) { return unit === 'MB' ? fmtMB(v) : unit === 's' ? fmtS(v) : String(v); }
function na(v) { return v === null || v === undefined ? 'n/a' : String(v); }
function rel(p) { return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p; }
async function waitFor(fn, ms, msg) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch {} await new Promise((r) => setTimeout(r, 250)); } throw new Error(msg); }
