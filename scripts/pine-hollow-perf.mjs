#!/usr/bin/env node
// pine-hollow-perf.mjs — the phone ruler at Pine Hollow's poses (project/archive/2026-09-22-play-perf.md), scripted.
//
// Per tier (phone: 390×844, iPhone 16 Pro UA / DPR 3 / touch, `tier=phone`; desktop: 1600×900 `tier=desktop`) one page
// load, then per pose: spawn, settle, and read `game.lastFrame` (calls / triangles for the whole composer frame) on 30
// consecutive frames — the median is the number. Also the frame-ms p50 / p95 over those frames (headless = vsync-pinned,
// not a phone reading) and the linked program count. Writes progress/pine-hollow-perf-<tag>.json and prints a table.
//
//   node scripts/pine-hollow-perf.mjs --url=http://localhost:4186 --tag=baseline     # a `vite preview` of a clean export
//   node scripts/pine-hollow-perf.mjs --tiers=phone --poses=gate --query=foo=1
//
// Serve a clean `git archive HEAD` export (the dev server reloads whenever another lane saves a file); `sw=0` keeps the
// service worker from serving a previous build. One headless Chromium on Metal, muted, closed at the end.
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4186');
const TAG = flag('tag', 'latest');
const EXTRA = flag('query', '');
const SETTLE = Number(flag('settle', '6')) * 1000;
const FRAMES = Number(flag('frames', '30'));
const tiers = flag('tiers', 'phone,desktop').split(',').filter(Boolean);
/** the play-perf poses (yaw faces (-sin yaw, -cos yaw)) */
const POSES = [
  { id: 'gate', x: 0, z: -200, yaw: 3.1416 },
  { id: 'cabin', x: -14, z: -62, yaw: 3.1416 },
  { id: 'pond', x: -56, z: 95, yaw: 3.1416 },
].filter((p) => flag('poses', '') === '' || flag('poses', '').split(',').includes(p.id));

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  const iphone = devices['iPhone 16 Pro'];
  const CTX = {
    phone: { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } },
    desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
  };
  for (const tier of tiers) {
    const ctx = await browser.newContext(CTX[tier]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const p0 = POSES[0];
    const q = ['chunk=pine-hollow', 'mute=1', 'skipintro=1', 'nolock=1', 'sw=0', `tier=${tier}`, tier === 'phone' ? 'touch' : '', `x=${p0.x}`, `z=${p0.z}`, `yaw=${p0.yaw}`, EXTRA].filter(Boolean).join('&');
    const t0 = Date.now();
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.game), undefined, { timeout: 300000, polling: 500 });
    const ready = (Date.now() - t0) / 1000;
    await sleep(SETTLE);
    for (const p of POSES) {
      await page.evaluate((pp) => { const w = window.__world; w.player.spawn(pp.x, pp.z, pp.yaw); w.player.pitch = 0; }, p);
      await sleep(SETTLE);
      const r = await page.evaluate((n) => new Promise((resolve) => {
        const g = window.__world.game, calls = [], tris = [], ms = [];
        let last = performance.now();
        const tick = () => {
          const now = performance.now();
          calls.push(g.lastFrame.calls); tris.push(g.lastFrame.triangles); ms.push(now - last); last = now;
          if (calls.length < n) { requestAnimationFrame(tick); return; }
          const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
          const pct = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0; };
          const info = g.renderer.info;
          resolve({ calls: med(calls), tris: med(tris), msP50: pct(ms.slice(1), 0.5), msP95: pct(ms.slice(1), 0.95), programs: info.programs?.length ?? -1, forest: window.__world.forest.path });
        };
        requestAnimationFrame(tick);
      }), FRAMES);
      rows.push({ tier, pose: p.id, ...r });
      console.log(`${tier.padEnd(7)} ${p.id.padEnd(6)} ${String(r.calls).padStart(4)} calls · ${(r.tris / 1e6).toFixed(2)} M tris · ${r.msP50.toFixed(1)} / ${r.msP95.toFixed(1)} ms · ${r.programs} programs · ${r.forest}`);
    }
    console.error(`[${tier}] ready in ${ready.toFixed(0)} s${errors.length > 0 ? ` — page errors: ${errors.join(' | ')}` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
const out = resolvePath(ROOT, `progress/pine-hollow-perf-${TAG}.json`);
writeFileSync(out, `${JSON.stringify({ tag: TAG, url: URL_BASE, query: EXTRA, when: new Date().toISOString(), rows }, null, 2)}\n`);
console.log(`→ progress/pine-hollow-perf-${TAG}.json`);
