#!/usr/bin/env node
// bench-shard-switch.mjs — E158's ruler: does the first switch to a never-visited shard still download?
//
// Serves a build with `vite preview` (service worker on, the host's cache headers) and drives headless Chromium over CDP
// the way scripts/bench-load.mjs does (the worker's own fetches are throttled and counted too). Per mode, in ONE fresh
// browser context:
//   1. cold-load one shard (--from, default Driftwood Isle); once playable, sample frame times + long tasks while the background prefetch
//      (src/boot/shardPrefetch.ts, `window.__ws_prefetch`) runs, and record how long it took and what it stored;
//   2. navigate to `?chunk=<slug>` for every other shard and record the bytes that crossed the (emulated) network
//      until that shard is playable.
// Modes: `prefetch` (the default boot) and `baseline` (`&prefetch=0`: the first switch downloads the shard, as before
// E158). The baseline samples frames for as long as the prefetch run's prefetch took, so the two frame-time windows
// compare like for like.
//
//   node scripts/bench-shard-switch.mjs [--tier=phone|desktop] [--net=wifi|4g|none] [--cpu=1] [--modes=prefetch,baseline]
//                                        [--from=driftwood-isle] [--port=4191] [--no-build] [--out=progress/bench/shard-switch-<tier>-from-<slug>.json]
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
const { chromium } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const has = (name) => argv.includes(`--${name}`);
const TIER = flag('tier', 'desktop');
const NET = flag('net', 'wifi');
const CPU = Number(flag('cpu', '1'));
const PORT = Number(flag('port', '4191'));
const MODES = flag('modes', 'prefetch,baseline').split(',');

const TIMEOUT_MS = Number(flag('timeout', '300')) * 1000;
const NETS = { wifi: { latency: 20, down: 30e6 / 8, up: 15e6 / 8 }, '4g': { latency: 170, down: 9e6 / 8, up: 1.5e6 / 8 }, none: null };
const [VW, VH] = TIER === 'phone' ? [390, 844] : [1280, 720];
const TIER_Q = TIER === 'phone' ? 'touch=1&tier=phone' : 'tier=desktop';
const FROM = flag('from', 'driftwood-isle'); // the shard loaded cold; the switches go to the other two
const OUT = resolvePath(ROOT, flag('out', `progress/bench/shard-switch-${TIER}-from-${FROM}.json`));
const SHARDS = [FROM, ...['driftwood-isle', 'nalati-grasslands', 'pine-hollow'].filter((s) => s !== FROM)];

// ── build + preview ──
if (!has('no-build')) execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let listening = false;
// oxlint-disable-next-line no-control-regex -- stripping vite's ANSI colours
preview.stdout.on('data', (d) => { if (String(d).replaceAll(/\u001B\[[\d;]*m/g, '').includes(`:${PORT}/`)) listening = true; });
const BASE = `http://localhost:${PORT}`;
const cleanup = () => { if (!preview.killed) preview.kill('SIGTERM'); };
process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(130); });
await waitFor(() => listening, 20_000, 'vite preview did not come up');
await waitFor(async () => (await fetch(`${BASE}/version.json`)).ok, 20_000, 'vite preview did not answer');
const build = (await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json()).build;
console.error(`> shard-switch ${BASE} build=${build} tier=${TIER} net=${NET} cpu=${CPU}× modes=${MODES.join(',')}`);

// frame-time + long-task sampler, armed from the page's first script
const INIT = `(() => {
  const W = window; W.__ss = { long: [], frames: [], sampling: false };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__ss.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  let last = 0;
  const tick = (t) => { if (W.__ss.sampling && last) W.__ss.frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

const { browser, chrome, throttle } = await launchBrowser();
const result = { build, tier: TIER, net: NET, cpu: CPU, at: new Date().toISOString(), modes: {} };
try {
  await throttle(NETS[NET]);
  let prefetchMs = null;
  for (const mode of MODES) {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, serviceWorkers: 'allow' });
    const reqs = []; const inflight = [];
    ctx.on('requestfinished', (req) => { inflight.push((async () => {
      const [sizes, res] = await Promise.all([within(req.sizes(), 5000), within(req.response(), 5000)]);
      reqs.push({ url: req.url(), bySW: Boolean(req.serviceWorker()), fromSW: Boolean(res?.fromServiceWorker()), status: res?.status() ?? 0, body: sizes?.responseBodySize ?? 0, headers: sizes?.responseHeadersSize ?? 0, t: Date.now() });
    })()); });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const cdp = await ctx.newCDPSession(page);
    const net = NETS[NET];
    if (net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up }); }
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.addInitScript(INIT);
    const q = (slug) => `${BASE}/?nolock=1&mute=1&${TIER_Q}&chunk=${slug}${mode === 'baseline' ? '&prefetch=0' : ''}`;
    const out = { errors, cold: null, prefetch: null, frames: null, switches: {} };

    // 1. the cold shard
    const mark = async () => { await within(Promise.all(inflight), 10_000); const n = reqs.length; return () => reqs.slice(n); };
    let since = await mark();
    const t0 = Date.now();
    await page.goto(q(SHARDS[0]), { waitUntil: 'commit', timeout: TIMEOUT_MS });
    await playable(page);
    out.cold = { playMs: Date.now() - t0, ...account(since()) };
    console.error(`  ${mode}: cold ${FROM} playable in ${(out.cold.playMs / 1000).toFixed(1)} s · ${mb(out.cold.netBytes)} net`);

    // 2. the background prefetch (or, for the baseline, the same window without it) — frame times and long tasks meanwhile
    since = await mark();
    const long0 = await page.evaluate(() => { window.__ss.frames = []; window.__ss.sampling = true; return window.__ss.long.length; });
    const p0 = Date.now();
    if (mode === 'prefetch') {
      out.prefetch = await page.evaluate(async () => { const h = window.__ws_prefetch; return h ? structuredClone(await h.done) : null; });
      prefetchMs = Date.now() - p0;
    } else {
      out.prefetch = await page.evaluate(() => (window.__ws_prefetch ? structuredClone(window.__ws_prefetch.state) : null));
      await page.waitForTimeout(prefetchMs ?? 30_000);
    }
    const windowMs = Date.now() - p0;
    const f = await page.evaluate((n) => { window.__ss.sampling = false; return { frames: window.__ss.frames, long: window.__ss.long.slice(n) }; }, long0);
    out.frames = { windowMs, ...frameStats(f.frames), longTasks: f.long.length, longTaskMaxMs: f.long.reduce((m, e) => Math.max(m, e[1]), 0), longTaskMs: f.long.reduce((s, e) => s + e[1], 0) };
    const bg = account(since());
    out.background = { netBytes: bg.netBytes, swFetches: bg.swFetches };
    out.cacheAfterPrefetch = await page.evaluate(() => window.__ws_sw?.version());
    console.error(`  ${mode}: ${mode === 'prefetch' ? `prefetch ${out.prefetch?.status} in ${(windowMs / 1000).toFixed(1)} s` : `idle window ${(windowMs / 1000).toFixed(1)} s`} · ${mb(bg.netBytes)} net · fps p50 ${out.frames.fpsP50} · frame p95 ${out.frames.p95} ms · ${out.frames.longTasks} long tasks (max ${out.frames.longTaskMaxMs} ms)`);

    // 3. first switch to every other shard
    for (const slug of SHARDS.slice(1)) {
      since = await mark();
      const t1 = Date.now();
      await page.goto(q(slug), { waitUntil: 'commit', timeout: TIMEOUT_MS });
      await playable(page);
      await page.waitForTimeout(1500);
      await within(Promise.all(inflight), 10_000);
      const acc = account(since());
      out.switches[slug] = { playMs: Date.now() - t1 - 1500, ...acc };
      console.error(`  ${mode}: first switch → ${slug} · ${mb(acc.netBytes)} net (${acc.netRequests} net requests) · playable in ${(out.switches[slug].playMs / 1000).toFixed(1)} s`);
    }
    out.cacheEnd = await page.evaluate(() => window.__ws_sw?.version());
    out.storage = await page.evaluate(() => navigator.storage.estimate());
    result.modes[mode] = out;
    await within(ctx.close(), 10_000);
  }
} finally { await within(browser.close(), 10_000); chrome.kill(); cleanup(); }

mkdirSync(resolvePath(OUT, '..'), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(summary(result));
console.error(`> wrote ${OUT.slice(ROOT.length + 1)}`);
process.exit(0);

async function playable(page) {
  await page.waitForFunction(() => Boolean(window.__world) && !document.querySelector('.ws-load'), null, { timeout: TIMEOUT_MS, polling: 200 });
}

/** bytes that crossed the network: page responses the worker did not serve + every fetch the worker made itself */
function account(rs) {
  let netBytes = 0, netRequests = 0, swFetches = 0, fromSW = 0;
  const net = [];
  for (const r of rs) {
    if (/^(blob|data):/.test(r.url) || !r.url.startsWith(BASE)) continue;
    const n = r.body + r.headers;
    if (r.bySW) { swFetches++; netBytes += n; netRequests++; net.push([r.url.replace(BASE, ''), n]); continue; }
    if (r.fromSW) { fromSW++; continue; }
    if (r.body > 0) { netBytes += n; netRequests++; net.push([r.url.replace(BASE, ''), n]); }
  }
  net.sort((a, b) => b[1] - a[1]);
  return { netBytes, netRequests, swFetches, fromSW, requests: rs.length, net };
}

function frameStats(fs) {
  const v = [...fs].sort((a, b) => a - b);
  if (v.length === 0) return { frames: 0, p50: null, p95: null, p99: null, max: null, fpsP50: null, fpsMean: null, over50ms: 0 };
  const q = (p) => Number(v[Math.min(v.length - 1, Math.floor(p * v.length))].toFixed(1));
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  return { frames: v.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1), fpsP50: Number((1000 / q(0.5)).toFixed(1)), fpsMean: Number((1000 / mean).toFixed(1)), over50ms: v.filter((x) => x > 50).length };
}

function summary(r) {
  const lines = [`## shard switch · ${r.build} · ${r.tier} · ${r.net} · cpu ${r.cpu}×`, '', `| mode | cold ${FROM} net | background net (time) | fps p50 / frame p95 / p99 ms | long tasks (max ms) | ${SHARDS.slice(1).map((s) => `first switch → ${s}`).join(' | ')} |`, `|${'---|'.repeat(5 + SHARDS.length - 1)}`];
  for (const [mode, m] of Object.entries(r.modes)) {
    lines.push(`| ${mode} | ${mb(m.cold.netBytes)} | ${mb(m.background.netBytes)} (${(m.frames.windowMs / 1000).toFixed(1)} s) | ${m.frames.fpsP50} / ${m.frames.p95} / ${m.frames.p99} | ${m.frames.longTasks} (${m.frames.longTaskMaxMs}) | ${SHARDS.slice(1).map((s) => `${mb(m.switches[s]?.netBytes)} · ${m.switches[s]?.netRequests} req · ${((m.switches[s]?.playMs ?? 0) / 1000).toFixed(1)} s`).join(' | ')} |`);
  }
  return lines.join('\n');
}

async function launchBrowser() {
  const udd = mkdtempSync(join(tmpdir(), 'wildshard-switch-'));
  const chromeProc = spawn(chromium.executablePath(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(udd, 'DevToolsActivePort');
  await waitFor(() => existsSync(portFile) && readFileSync(portFile, 'utf8').split('\n')[0] > 0, 15_000, 'chromium did not open its DevTools port');
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  let id = 0; const pending = new Map(); const swSessions = new Set(); let current = null;
  const send = (method, params, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const apply = (sessionId) => (current ? send('Network.emulateNetworkConditions', { offline: false, latency: current.latency, downloadThroughput: current.down, uploadThroughput: current.up }, sessionId) : send('Network.disable', {}, sessionId));
  ws.addEventListener('message', (ev) => { void (async () => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); return; }
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      if (targetInfo.type === 'service_worker' && targetInfo.url.startsWith(BASE)) {
        swSessions.add(sessionId);
        try { await send('Network.enable', {}, sessionId); await apply(sessionId); } catch (e) { console.error(`  [sw throttle] ${e.message}`); }
      }
      send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => undefined);
    }
    if (m.method === 'Target.detachedFromTarget') swSessions.delete(m.params.sessionId);
  })(); });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const cdpBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  return { browser: cdpBrowser, chrome: chromeProc, throttle: async (n) => { current = n; for (const s of swSessions) await apply(s).catch(() => undefined); } };
}

function mb(b) { return typeof b === 'number' ? `${(b / 1048576).toFixed(2)} MB` : 'n/a'; }
function within(p, ms) { return Promise.race([Promise.resolve(p).catch(() => null), new Promise((resolve) => { setTimeout(resolve, ms, null).unref(); })]); }
async function waitFor(fn, ms, msg) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch { /* not yet */ } await new Promise((resolve) => { setTimeout(resolve, 250); }); } throw new Error(msg); }
