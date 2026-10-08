#!/usr/bin/env node
// SF67 loading audit (E461): SHARD SELECT -> shard load, profiled in desktop Chromium emulating the iPhone 16 Pro.
// Per shard: a cold run (fresh context: no SW, no HTTP cache, no IndexedDB) and a warm run (same context, again).
// The title is opened, the shard card and ENTER WORLD are tapped (the real travel(): location.replace(?chunk=)),
// and a browser-wide Chrome trace (timeline + V8 sampling profiler) runs from the tap to playable + 2 s.
// Playable = the loading panel (.ws-load) is gone and the probe (window.__wildshard.world) exists.
//
//   scripts/browser-lane.sh --max 20 node progress/loading/sf67/capture.mjs \
//     --base=http://127.0.0.1:4406 --pin=<full served SHA> --shards=driftwood-isle,pine-hollow,_template --cpu=4 --out=<scratch dir>
//
// Writes <out>/<shard>-<cache>.trace.json (raw, scratch) and <out>/<shard>-<cache>.json (steps, long tasks, metrics).
// analyze.mjs turns those into the ranked long-task table.
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const arg = (name, dflt) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const BASE = arg('base', 'http://127.0.0.1:4406');
const PIN = arg('pin', '');
if (!/^[a-f0-9]{40}$/u.test(PIN)) throw new Error('--pin requires the exact served commit');
const VERSION = await (await fetch(new URL('/version.json', BASE))).json();
if (!VERSION.build?.startsWith(PIN.slice(0, 7))) throw new Error('Preview pin mismatch');
const SHARDS = arg('shards', 'driftwood-isle').split(',');
const CACHES = arg('cache', 'cold,warm').split(',');
const CPU = Number(arg('cpu', '4'));
const OUT = resolve(arg('out', '.'));
const TRACE = arg('trace', '1') === '1';
const TIMEOUT = Number(arg('timeout', '240')) * 1000;
mkdirSync(OUT, { recursive: true });

const NAMES = { 'driftwood-isle': 'Driftwood Isle', 'pine-hollow': 'Pine Hollow', 'nalati-grasslands': 'Nalati', _template: 'Template shard' };

const INIT = `(() => {
  const W = window; W.__a_isLoad = location.href; W.__a_markAt = performance.now(); try { performance.mark('ws-audit-origin'); } catch {} W.__a_longSupported = PerformanceObserver.supportedEntryTypes.includes('longtask'); W.__a_ready = 0; W.__a_steps = []; W.__a_long = []; W.__a_play = 0; W.__a_frames = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__a_long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  let last = '';
  const read = () => { const r = document.querySelector('.ws-load'); if (!r) return null;
    const pct = (r.getAttribute('data-download') || '?') + '/' + (r.getAttribute('data-setup') || '?');
    const name = r.querySelector('[data-el="slug"]')?.textContent ?? '';
    const line = r.querySelector('[data-el="line"]')?.textContent ?? '';
    return (r.getAttribute('data-step') || '') + ' | ' + pct + ' | ' + name + ' | ' + line; };
  const on = () => { const s = read(); if (s && s !== last) { last = s; const t = Math.round(performance.now()); W.__a_steps.push([t, s]); if (!W.__a_ready && s.includes('| 100/100 |')) W.__a_ready = t; } };
  const go = () => { new MutationObserver(on).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true }); on(); };
  if (document.documentElement) go(); else document.addEventListener('DOMContentLoaded', go);
  // rAF gaps: what the loading screen's own animation sees
  let prev = 0; const raf = (t) => { if (prev && t - prev > 50) W.__a_frames.push([Math.round(prev), Math.round(t - prev)]); prev = t; if (!W.__a_play || performance.now() - W.__a_play < 3000) requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  const poll = setInterval(() => { const L = [...document.querySelectorAll('.ws-load')].map((e) => e.className + ':' + getComputedStyle(e).display + ':' + getComputedStyle(e).opacity).join(','); if (W.__a_isLoad && W.__a_ready && L !== W.__a_lastL) { W.__a_lastL = L; W.__a_steps.push([Math.round(performance.now()), 'LOADEL ' + L]); }
    if (!W.__a_play && W.__a_isLoad && W.__a_ready && ![...document.querySelectorAll('.ws-load')].some((e) => getComputedStyle(e).display !== 'none' && Number(getComputedStyle(e).opacity) > 0.05)) { clearInterval(poll); requestAnimationFrame(() => requestAnimationFrame(() => { W.__a_play = Math.round(performance.now()); })); } }, 25);
})();`;

const COLLECT = `(() => { const W = window; const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0), enc = res.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
  const world = W.__wildshard?.world; const info = world?.game?.renderer?.info;
  return { url: location.href, timeOrigin: performance.timeOrigin, markAt: W.__a_markAt, playMs: W.__a_play || null, readyMs: W.__a_ready || null, longTaskObserverSupported: W.__a_longSupported, steps: W.__a_steps, long: W.__a_long, rafGaps: W.__a_frames,
    dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null, transferBytes: bytes, encodedBytes: enc, requests: res.length,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    programs: info ? info.programs.length : null, textures: info ? info.memory.textures : null, geometries: info ? info.memory.geometries : null,
    sw: !!navigator.serviceWorker?.controller, isLoad: W.__a_isLoad, loadEls: [...document.querySelectorAll('.ws-load')].map((e) => e.className + ':' + getComputedStyle(e).display + ':' + getComputedStyle(e).opacity + ':' + getComputedStyle(e).visibility),
    resources: res.map((r) => [r.name.replace(location.origin, ''), Math.round(r.startTime), Math.round(r.duration), r.transferSize, r.encodedBodySize, r.initiatorType]) }; })()`;

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const { defaultBrowserType: _ignored, ...phone } = devices['iPhone 16 Pro'];
const cdpBrowser = await browser.newBrowserCDPSession();

async function traced(fn, file) {
  if (!TRACE) return fn();
  await cdpBrowser.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { recordMode: 'recordContinuously',
    includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'v8.execute', 'blink.user_timing', 'disabled-by-default-v8.cpu_profiler', 'v8', 'loading', 'gpu'] } });
  let result;
  try { result = await fn(); }
  finally {
    const done = new Promise((r) => cdpBrowser.once('Tracing.tracingComplete', r));
    await cdpBrowser.send('Tracing.end');
    const { stream } = await done;
    const out = createWriteStream(file);
    for (;;) { const { data, eof, base64Encoded } = await cdpBrowser.send('IO.read', { handle: stream, size: 4 << 20 }); out.write(base64Encoded ? Buffer.from(data, 'base64') : data); if (eof) break; }
    await cdpBrowser.send('IO.close', { handle: stream });
    await new Promise((r) => out.end(r));
  }
  return result;
}

try {
for (const shard of SHARDS) {
  const ctx = await browser.newContext({ ...phone, serviceWorkers: 'allow' });
  await ctx.addInitScript(INIT);
  // the template is a Developer-only card (titleDeck.ts titleCards): Developer on for it, as Jake has it
  if (shard.startsWith('_') || arg('dev', '0') === '1') await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  for (const cache of CACHES) {
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
    page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
    const navs = []; page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push([Date.now(), f.url()]); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    // the bare URL is the renderer-free title (src/bootRoute.ts): any other param boots the default shard (Driftwood) in place.
    // Audio is muted by --mute-audio (a ?mute would make the title page a Driftwood boot).
    await page.goto(`${BASE}/${arg('title', '')}`, { waitUntil: 'load', timeout: TIMEOUT });
    await page.locator('.ws-main-select').click();
    await page.waitForSelector('.ws-menu-card', { timeout: TIMEOUT });
    await page.waitForTimeout(1500);
    // pick the card by its visible name
    const idx = await page.evaluate((name) => { const cards = [...document.querySelectorAll('.ws-menu-card')]; const i = cards.findIndex((c) => (c.querySelector('b')?.textContent ?? '').toLowerCase().includes(name.toLowerCase())); return { i, names: cards.map((c) => c.querySelector('b')?.textContent) }; }, NAMES[shard] ?? shard);
    if (idx.i < 0) { console.error(`${shard}: no card (${idx.names.join(', ')})`); await page.close(); continue; }
    const file = resolve(OUT, `${shard}-${cache}.trace.json`);
    let status = 'ok'; let tapAt = 0;
    const m = await traced(async () => {
      await page.evaluate((i) => { document.querySelector(`.ws-menu-dots i[data-i="${i}"]`)?.click(); }, idx.i);
      await page.waitForTimeout(600);
      await page.waitForFunction((i) => document.querySelector('.ws-menu-card.selected')?.getAttribute('data-i') === String(i), idx.i, { timeout: 3000 });
      tapAt = Date.now();
      const compiled = page.locator('.ws-menu-shardfile');
      const enter = await compiled.isVisible() && await compiled.isEnabled() ? compiled : page.locator('.ws-menu-play');
      await enter.click();
      try {
        await page.waitForURL(/chunk=/, { timeout: 30000 });
        await page.waitForFunction(() => { const W = window; if (W.__a_play > 0 && W.__wildshard?.world) return true;
          if (!W.__a_ready) return false;
          const shown = [...document.querySelectorAll('.ws-load')].some((e) => getComputedStyle(e).display !== 'none' && Number(getComputedStyle(e).opacity) > 0.05);
          if (!shown) { W.__a_play = Math.round(performance.now()); return true; } return false; }, null, { timeout: TIMEOUT, polling: 50 });
        await page.waitForTimeout(2500);
      } catch (e) { status = /Timeout/i.test(String(e)) ? 'timeout' : `error ${String(e).slice(0, 200)}`; }
      // Non-graphical loading profile: no captures.
      return page.evaluate(COLLECT);
    }, file);
    const rec = { pin: PIN, version: VERSION, shard, cache, cpu: CPU, status, navs, tapAt, tapToOriginMs: m.timeOrigin - tapAt, errors, ...m };
    writeFileSync(resolve(OUT, `${shard}-${cache}.json`), JSON.stringify(rec, null, 1));
    const lt = m.long.filter((l) => l[1] > 50);
    console.log(`${shard} ${cache}: ${status} play=${m.playMs}ms (+${Math.round(m.timeOrigin - tapAt)} nav) long>50=${lt.length} sum=${lt.reduce((s, l) => s + l[1], 0)} max=${Math.max(0, ...lt.map((l) => l[1]))} heap=${m.heapMB}MB progs=${m.programs} errs=${errors.length}`);
    await page.close();
  }
  await ctx.close();
}
} finally { await browser.close(); }
