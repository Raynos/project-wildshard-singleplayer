#!/usr/bin/env node
// ktx2-b-check.mjs — E157 B's proof ("images on the first visit, KTX2 from the next launch"), end to end in one headless
// Chromium context (service worker on, iPhone 16 Pro UA, 390×844 @3, the phone tier), Settings ▸ Debug ▸ GPU textures on
// Auto (the default):
//
//   1. cold visit of build A           the boot loads IMAGES; bytes over the network until playable; GPU texture MB
//   2. the background download         window.__ws_prefetch.done: every shard's boot files, then every KTX2 set; this
//                                      shard's set must be complete (its marker written); the worker's cache total
//   3. reload                          the boot loads KTX2 (from the cache: network bytes ≈ 0); GPU texture MB
//   4. offline reload                  still playable, still KTX2, no page error; then the same warm launch with Images
//                                      picked, and with Auto again (warm time-to-play and GPU MB, like for like)
//   5. a deploy (build B on the same   the old worker serves A, B's worker installs, adopt (as the build pill does), B boots:
//      origin: --b, a build of the     KTX2 still (the set is the same files, content-named, kept by the cache GC) and no
//      same tree with a changed        byte under /assets/gpu/ or /basis/ crosses the network — at the boot or in B's
//      texture, like                   background pass (every KTX2 reply a 'hit')
//      scripts/bench-asset-deploy.mjs)
//
//   node scripts/ktx2-b-check.mjs --a=<dist A> --b=<dist B> [--chunk=pine-hollow] [--port=4770]
//
// Serves each dist with `vite preview --outDir` on the same port (one origin: the worker and its caches carry over). One
// browser, muted (`--mute-audio`, `mute=1`), closed at the end. Writes progress/bench/e157-b-check-<chunk>.json.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { ledger, report } from './texmem-probe.mjs';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const DIST_A = resolvePath(flag('a', 'dist'));
const DIST_B = flag('b', '') === '' ? null : resolvePath(flag('b', ''));
const CHUNK = flag('chunk', 'pine-hollow');
const PORT = Number(flag('port', '4770'));
const BASE = `http://localhost:${PORT}`;
const PAGE = `${BASE}/?chunk=${CHUNK}&mute=1&nolock=1&skipintro=1&tier=phone&touch=1`;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const mb = (b) => Number((b / 1048576).toFixed(2));

let preview = null;
async function serve(dist) {
  if (preview) { preview.kill('SIGTERM'); await sleep(1500); }
  preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--outDir', dist], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/version.json`, { cache: 'no-store' })).ok) return (await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json()).build; } catch { /* not yet */ } await sleep(500); }
  throw new Error(`vite preview of ${dist} did not come up`);
}
process.on('exit', () => { preview?.kill('SIGTERM'); });

const out = { chunk: CHUNK, a: DIST_A, b: DIST_B, when: new Date().toISOString(), steps: {} };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  out.buildA = await serve(DIST_A);
  const iphone = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  await ctx.addInitScript(ledger);
  // every request that crossed the network: the page's own (not answered by the worker) and the worker's fetches
  const reqs = [];
  ctx.on('requestfinished', (req) => { void (async () => {
    try {
      const [sizes, res] = await Promise.all([req.sizes(), req.response()]);
      const bySW = Boolean(req.serviceWorker()), fromSW = Boolean(res?.fromServiceWorker());
      if (!req.url().startsWith(BASE)) return; // blob: / data: URLs never touch the network
      if (bySW || !fromSW) reqs.push({ url: req.url().replace(BASE, ''), bytes: sizes.responseBodySize + sizes.responseHeadersSize, bySW });
    } catch { /* a request of a closed page */ }
  })(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const since = () => { const n = reqs.length; return () => { const rs = reqs.slice(n); const gpu = rs.filter((r) => /^\/(assets\/gpu|basis)\//.test(r.url)); return { netMB: mb(rs.reduce((s, r) => s + r.bytes, 0)), requests: rs.length, ktx2MB: mb(gpu.reduce((s, r) => s + r.bytes, 0)), ktx2Requests: gpu.length, top: [...rs].sort((x, y) => y.bytes - x.bytes).slice(0, 8).map((r) => `${r.bySW ? 'sw ' : ''}${r.url} ${mb(r.bytes)}`) }; }; };
  const playable = async () => { const t = Date.now(); await page.waitForFunction(() => Boolean(window.__world?.game) && !document.querySelector('.ws-loading'), null, { timeout: 300_000, polling: 250 }); return Number(((Date.now() - t) / 1000).toFixed(2)); };
  const texmem = async () => { await sleep(6000); const r = await page.evaluate(report, 0); return { textureMB: r.textureMB, compressedMB: r.compressedMB }; };
  const tex = () => page.evaluate(() => window.__ws_prefetch?.state.tex ?? null);
  let after = since();
  const launch = async (label, url = PAGE) => {
    const acct = since();
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'commit' });
    await playable();
    const playS = Number(((Date.now() - t0) / 1000).toFixed(2));
    const net = acct();
    after = since(); // the background download starts a few seconds after playable: its bytes count from here
    const step = { playS, ...net, tex: await tex(), ...(await texmem()), errors: errors.splice(0) };
    out.steps[label] = step;
    console.log(`[b] ${label}: ${step.tex?.mode ?? '?'} (${step.tex?.why ?? ''}) · play ${playS} s · net ${step.netMB} MB in ${step.requests} requests (KTX2 ${step.ktx2MB} MB) · GPU textures ${step.textureMB} MB (compressed ${step.compressedMB})${step.errors.length > 0 ? ` · errors ${step.errors.join(' / ')}` : ''}`);
    return step;
  };
  const background = async (label) => {
    const acct = after;
    const t0 = Date.now();
    const state = await page.evaluate(() => window.__ws_prefetch?.done ?? null);
    const sw = await page.evaluate(async () => (await window.__ws_sw?.version()) ?? null);
    const step = { seconds: Number(((Date.now() - t0) / 1000).toFixed(1)), ...acct(), status: state?.status, reason: state?.reason, ktx2: state?.ktx2, shards: state?.shards, swCacheMB: sw ? mb(sw.bytes) : null, swCaches: sw?.caches };
    out.steps[label] = step;
    const sets = Object.entries(step.ktx2 ?? {}).map(([k, v]) => `${k} ${v.complete ? 'complete' : 'INCOMPLETE'} (${v.hit} hit · ${v.stored} stored · ${v.failed} failed, ${mb(v.bytes)} MB)`).join(' · ');
    console.log(`[b] ${label}: ${step.status} in ${step.seconds} s · net ${step.netMB} MB (KTX2 ${step.ktx2MB} MB) · SW cache ${step.swCacheMB} MB · KTX2 sets: ${sets}`);
    return step;
  };

  // 1–2: the first visit, then the background download to its end
  await launch('1-cold-visit');
  await background('2-background');
  // 3–4: the next launch, online then offline
  await launch('3-reload');
  await ctx.setOffline(true);
  await launch('4-offline-reload');
  await ctx.setOffline(false);
  // the same warm launch with Settings ▸ Debug ▸ GPU textures = Images (the comparison: everything cached either way)
  const setTex = (t) => page.evaluate((v) => { const o = JSON.parse(localStorage.getItem('ws.settings.v1') ?? '{}'); if (v === null) delete o.tex; else o.tex = v; localStorage.setItem('ws.settings.v1', JSON.stringify(o)); }, t);
  await setTex('img');
  await launch('4b-warm-images-for-comparison');
  await setTex(null);
  await launch('4c-warm-auto-again');
  // 5: the deploy — the old worker serves A, B's worker installs and is adopted, B boots
  if (DIST_B) {
    out.buildB = await serve(DIST_B);
    const acct = since();
    await page.goto(PAGE, { waitUntil: 'commit' });
    await playable();
    await page.waitForFunction(() => Boolean(window.__ws_sw?.waiting), null, { timeout: 180_000, polling: 250 });
    await Promise.all([page.waitForEvent('load', { timeout: 60_000 }), page.evaluate(() => { void window.__ws_sw?.adopt(); })]);
    await playable();
    const running = await page.evaluate(async () => (await window.__ws_sw?.version())?.build ?? null);
    const net = acct();
    after = since();
    const step = { ...net, worker: running, tex: await tex(), ...(await texmem()), errors: errors.splice(0) };
    out.steps['5-deploy'] = step;
    console.log(`[b] 5-deploy (${out.buildA} → ${out.buildB}, worker ${running}): ${step.tex?.mode ?? '?'} · net ${step.netMB} MB in ${step.requests} requests · KTX2 over the network ${step.ktx2MB} MB in ${step.ktx2Requests} · GPU textures ${step.textureMB} MB`);
    await background('6-background-after-deploy');
  }
  await ctx.close();
} finally {
  await browser.close();
  preview?.kill('SIGTERM');
}
const file = resolvePath(ROOT, `progress/bench/e157-b-check-${CHUNK}.json`);
mkdirSync(resolvePath(file, '..'), { recursive: true });
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`→ ${file}`);
process.exit(0);
