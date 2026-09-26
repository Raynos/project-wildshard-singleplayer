#!/usr/bin/env node
// e172-clear-downloads.mjs — E172's proof: title ▸ Settings ▸ Developer ▸ Debug ▸ Clear downloads makes the next load cold.
//
// Serves a build with `vite preview` (the service worker on, vercel.json's headers replayed — Clear-Site-Data included) and
// drives ONE headless Chromium context (Metal, muted) at iPhone portrait, phone tier:
//   1. first visit (cold): the reference bytes; then the background download (E158) runs to the end;
//   2. warm reload: ~0 bytes on the network;
//   3. title ▸ Settings ▸ Debug (unfold) ▸ Developer on ▸ Loading & memory ▸ Clear downloads, tapped twice (shots before);
//   4. the reload it makes: bytes on the network (≈ the first visit's), localStorage kept (saves, settings, review login),
//      the KTX2 markers gone, a new worker, and the background download running again;
//   5. into the world ▸ pause ▸ Settings ▸ Debug: the same registry (its rows compared with the title's), shots.
// Bytes, two rulers: "served" = the bytes the server actually sent (a counting proxy in front of `vite preview`: the ground
// truth — a response the HTTP cache answered never reaches it), and "net" = page responses the worker did not serve + every
// fetch the worker made itself, as Playwright reports them (scripts/bench-shard-switch.mjs).
//
//   node scripts/e172-clear-downloads.mjs [--root=<built tree>] [--port=4193] [--no-build] [--shots=<dir>] [--out=<json>]
//                                         [--no-http-clear]   (the control: the proxy strips Clear-Site-Data)
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
const { chromium } = await import('playwright');

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const has = (name) => argv.includes(`--${name}`);
const ROOT = resolvePath(flag('root', new URL('..', import.meta.url).pathname));
const PORT = Number(flag('port', '4193'));
const SHOTS = resolvePath(flag('shots', '/tmp/e172-shots'));
const OUT = resolvePath(flag('out', '/tmp/e172-result.json'));
const TIMEOUT_MS = 300_000;
const UPSTREAM = `http://localhost:${PORT}`;
const PROXY_PORT = PORT + 1;
const BASE = `http://localhost:${PROXY_PORT}`;
/** what the server sent, since the start (bodies + a rough header size per response) */
const served = { bytes: 0, requests: 0, urls: [] };
const proxy = http.createServer((req, res) => {
  const up = http.request(`${UPSTREAM}${req.url}`, { method: req.method, headers: { ...req.headers, host: `localhost:${PORT}` } }, (r) => {
    // --no-http-clear (a control): the proxy drops Clear-Site-Data, so only Cache Storage + the worker are cleared
    if (has('no-http-clear')) delete r.headers['clear-site-data'];
    res.writeHead(r.statusCode ?? 502, r.headers);
    let n = 0;
    r.on('data', (c) => { n += c.length; });
    r.on('end', () => { served.bytes += n + 300; served.requests++; served.urls.push([req.url, n]); });
    r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(up);
});
proxy.listen(PROXY_PORT);
const URL0 = `${BASE}/?nolock=1&mute=1&touch=1&tier=phone&chunk=driftwood-isle`;

if (!has('no-build')) execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
const cleanup = () => { if (!preview.killed) preview.kill('SIGTERM'); proxy.close(); };
process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(130); });
await waitFor(async () => (await fetch(`${UPSTREAM}/version.json`)).ok, 30_000, 'vite preview did not answer');
const csd = (await fetch(`${BASE}/clear-cache.json?sw=0`)).headers.get('clear-site-data');
console.error(`> e172 ${BASE} root=${ROOT} · /clear-cache.json Clear-Site-Data: ${csd}`);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { at: new Date().toISOString(), clearSiteDataHeader: csd };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  const reqs = []; const inflight = [];
  ctx.on('requestfinished', (req) => { inflight.push((async () => {
    const [sizes, res] = await Promise.all([within(req.sizes(), 5000), within(req.response(), 5000)]);
    reqs.push({ url: req.url(), bySW: Boolean(req.serviceWorker()), fromSW: Boolean(res?.fromServiceWorker()), body: sizes?.responseBodySize ?? 0, headers: sizes?.responseHeadersSize ?? 0 });
  })()); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  result.errors = errors;
  // the saved picks the clean reload keeps (it drops ?tier / ?touch), a save sentinel and a review login: once, before any script
  await page.addInitScript(() => {
    if (localStorage.getItem('ws.e172.seeded') !== null) return;
    localStorage.setItem('ws.e172.seeded', '1');
    localStorage.setItem('ws.settings.v1', JSON.stringify({ tier: 'phone', touch: 'on' }));
    localStorage.setItem('ws.e172.save', 'a save the clear must keep');
    localStorage.setItem('ws.review.v1', JSON.stringify({ password: 'e172-test', quick: true }));
  });
  const mark = async () => { await within(Promise.all(inflight), 10_000); const n = reqs.length; return () => reqs.slice(n); };
  const playable = () => page.waitForFunction(() => Boolean(window.__world) && !document.querySelector('.ws-load'), null, { timeout: TIMEOUT_MS, polling: 200 });
  const settle = async () => { await page.waitForTimeout(1500); await within(Promise.all(inflight), 10_000); };
  const load = async (label, go) => {
    const since = await mark(); const s0 = { bytes: served.bytes, requests: served.requests, n: served.urls.length }; const t0 = Date.now();
    await go(); await playable(); const playMs = Date.now() - t0; await settle();
    const acc = account(since());
    const srv = { servedBytes: served.bytes - s0.bytes, servedRequests: served.requests - s0.requests, servedTop: served.urls.slice(s0.n).sort((a, b) => b[1] - a[1]).slice(0, 6) };
    console.error(`  ${label}: playable in ${(playMs / 1000).toFixed(1)} s · server sent ${mb(srv.servedBytes)} in ${srv.servedRequests} responses · Playwright net ${mb(acc.netBytes)} (${acc.netRequests} requests; ${acc.fromSW} served by the worker)`);
    return { playMs, ...srv, ...acc, net: acc.net.slice(0, 8) };
  };
  const storage = () => page.evaluate(async () => (await navigator.storage.estimate()).usage ?? null);

  // 1. first visit + the background download
  result.cold = await load('first visit', () => page.goto(URL0, { waitUntil: 'commit', timeout: TIMEOUT_MS }));
  const pre = await page.evaluate(async () => { const h = window.__ws_prefetch; if (!h) return null; const s = await h.done; return { status: s.status, stored: Object.values(s.shards).reduce((n, t) => n + t.stored, 0), ktx2: Object.fromEntries(Object.entries(s.ktx2).map(([k, v]) => [k, v.complete])) }; });
  result.prefetch1 = pre; result.storageAfterPrefetch = await storage();
  console.error(`  background download: ${JSON.stringify(pre)} · storage ${mb(result.storageAfterPrefetch)}`);

  // 2. warm reload
  result.warm = await load('warm reload', () => page.goto(URL0, { waitUntil: 'commit', timeout: TIMEOUT_MS }));
  const lsBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  result.markersBefore = Object.keys(lsBefore).filter((k) => k.startsWith('ws.ktx2set.'));
  result.cachesBefore = await page.evaluate(() => caches.keys());
  result.storageBefore = await storage();

  // 3. title ▸ Settings ▸ Developer ▸ Debug ▸ Clear downloads
  await page.locator('.ws-menu-settings').first().click();
  await page.waitForSelector('.ws-gmenu.show');
  const boot = page.locator('.ws-gmenu.show');
  // E177: the title's Debug card is folded until asked for; the Developer switch is in it, the registry (E162) under it
  const fold = boot.locator('.ws-gmenu-card.fold');
  if (await fold.evaluate((e) => e.classList.contains('folded'))) await fold.locator('.ws-gmenu-cardtitle').click();
  const devSwitch = boot.locator('.ws-gmenu-switch', { hasText: 'Developer mode' });
  if ((await devSwitch.getAttribute('aria-checked')) !== 'true') await devSwitch.click();
  const card = boot.locator('.ws-gmenu-debugslot');
  await card.waitFor({ state: 'visible' });
  const openGroup = async (root, title) => { const g = root.locator('.ws-dbg-group', { hasText: title }).first(); if (!(await g.evaluate((e) => e.classList.contains('open')))) await g.locator('.ws-dbg-head').click(); };
  await openGroup(card, 'Loading & memory');
  result.titleRows = await card.evaluate(rowsOf);
  const clear = card.locator('.ws-dbg-action');
  // viewport shots (the card is taller than the phone): the registry's top, then the armed button
  await card.evaluate((e) => { e.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/title-top.png` });
  await clear.evaluate((e) => { e.closest('.ws-dbg-row')?.nextElementSibling?.scrollIntoView({ block: 'end' }); }); // the button and its status line
  await clear.click();
  await page.waitForFunction(() => (document.querySelector('.ws-gmenu.show .ws-dbg-action')?.textContent ?? '').includes('Tap again'), null, { timeout: 10_000 });
  result.armedText = await clear.textContent();
  await page.screenshot({ path: `${SHOTS}/title-armed.png` });
  console.error(`  armed: "${result.armedText}"`);

  // 4. the second tap, and the reload it makes
  result.afterClear = await load('after Clear downloads', async () => {
    const nav = page.waitForURL((u) => !u.searchParams.has('tier'), { waitUntil: 'commit', timeout: 60_000 }); // the clean reload drops ?tier
    await clear.click();
    await page.waitForFunction(() => (document.querySelector('.ws-gmenu.show .ws-dbg-action')?.textContent ?? '').includes('reloading'), null, { timeout: 30_000 });
    result.clearedText = await clear.textContent();
    await nav;
  });
  result.reloadUrl = page.url();
  const lsAfter = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  result.report = await page.evaluate(() => JSON.parse(sessionStorage.getItem('wsClearDownloads') ?? 'null'));
  const keptKeys = Object.keys(lsBefore).filter((k) => !k.startsWith('ws.ktx2set.'));
  result.localStorage = {
    changed: keptKeys.filter((k) => lsAfter[k] !== lsBefore[k]).map((k) => [k, lsBefore[k], lsAfter[k] ?? null]),
    markersAfterReload: Object.keys(lsAfter).filter((k) => k.startsWith('ws.ktx2set.')),
    save: lsAfter['ws.e172.save'], review: lsAfter['ws.review.v1'], settings: lsAfter['ws.settings.v1'], dev: lsAfter['ws.dev'],
  };
  result.sw = await page.evaluate(async () => ({ controlled: navigator.serviceWorker.controller !== null, regs: (await navigator.serviceWorker.getRegistrations()).length, build: (await window.__ws_sw?.version())?.build ?? null, caches: await caches.keys() }));
  console.error(`  clicked: "${result.clearedText}" → ${result.reloadUrl}`);
  console.error(`  report: ${JSON.stringify(result.report)}`);
  console.error(`  localStorage: ${JSON.stringify(result.localStorage)}`);

  // the background download again
  await page.waitForFunction(() => window.__ws_prefetch?.state.status === 'running' || window.__ws_prefetch?.state.status === 'done', null, { timeout: 60_000, polling: 250 });
  await page.waitForFunction(() => Object.values(window.__ws_prefetch?.state.shards ?? {}).reduce((n, t) => n + t.stored, 0) > 3, null, { timeout: 120_000, polling: 500 });
  result.prefetch2 = await page.evaluate(() => { const s = window.__ws_prefetch?.state; return s ? { status: s.status, stored: Object.values(s.shards).reduce((n, t) => n + t.stored, 0), hit: Object.values(s.shards).reduce((n, t) => n + t.hit, 0) } : null; });
  console.error(`  background download after the clear: ${JSON.stringify(result.prefetch2)}`);

  // 5. the pause menu's Debug card (the same module)
  await page.keyboard.press('Enter'); // the title's "any key enters"
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.ws-gmenu.show .ws-gmenu-card.fold', { timeout: 15_000 });
  const pcard = page.locator('.ws-gmenu.show .ws-gmenu-card.fold');
  if (await pcard.evaluate((e) => e.classList.contains('folded'))) await pcard.locator('.ws-gmenu-cardtitle').click();
  await pcard.locator('.ws-dbg-action').waitFor({ state: 'attached' });
  result.pauseRows = await pcard.evaluate(rowsOf);
  await pcard.evaluate((e) => { e.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(2300); // the memory readout's 2 s tick
  await page.screenshot({ path: `${SHOTS}/pause-top.png` });
  const pstatus = pcard.locator('.ws-dbg-status');
  await pstatus.evaluate((e) => { e.scrollIntoView({ block: 'end' }); }); // with "Last clear freed …" under the button
  result.pauseClearNote = await pstatus.textContent();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/pause-bottom.png` });
  result.sameRows = JSON.stringify(result.titleRows) === JSON.stringify(result.pauseRows);
  console.error(`  pause-menu card rows = title card rows: ${result.sameRows}`);
  await within(ctx.close(), 10_000);
} finally { await within(browser.close(), 10_000); cleanup(); }

writeFileSync(OUT, JSON.stringify(result, null, 1));
console.error(`> wrote ${OUT}`);
process.exit(0);

/** the Debug registry's rows that apply here, as "group / label" (in the page) */
function rowsOf(root) {
  return [...root.querySelectorAll('.ws-dbg-group')].filter((g) => !g.hidden).flatMap((g) => [...g.querySelectorAll('.ws-dbg-row')].filter((r) => !r.hidden)
    .map((r) => `${g.querySelector('.ws-dbg-title')?.textContent ?? ''} / ${r.querySelector('.ws-gmenu-swlabel')?.firstChild?.textContent ?? ''}`));
}

function account(rs) {
  let netBytes = 0, netRequests = 0, fromSW = 0;
  const net = [];
  for (const r of rs) {
    if (/^(blob|data):/.test(r.url) || !r.url.startsWith(BASE)) continue;
    const n = r.body + r.headers;
    if (r.bySW) { netBytes += n; netRequests++; net.push([r.url.replace(BASE, ''), n]); continue; }
    if (r.fromSW) { fromSW++; continue; }
    if (r.body > 0) { netBytes += n; netRequests++; net.push([r.url.replace(BASE, ''), n]); }
  }
  net.sort((a, b) => b[1] - a[1]);
  return { netBytes, netRequests, fromSW, requests: rs.length, net };
}
function mb(b) { return typeof b === 'number' ? `${(b / 1048576).toFixed(2)} MB` : 'n/a'; }
function within(p, ms) { return Promise.race([Promise.resolve(p).catch(() => null), new Promise((resolve) => { setTimeout(resolve, ms, null).unref(); })]); }
async function waitFor(fn, ms, msg) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch { /* not yet */ } await new Promise((resolve) => { setTimeout(resolve, 250); }); } throw new Error(msg); }
