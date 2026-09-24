#!/usr/bin/env node
// pine-hollow-fps.mjs — the 30 fps phone tier's ruler (PINE-HOLLOW-REMASTER PH-P1).
//
// Phone tier (iPhone 16 Pro UA, 390×844 @3, touch, `tier=phone`) at --cpu× CPU throttling (default 4, the phone proxy
// the physics / play-perf lanes use). Per pose: spawn, settle, then record --frames drawn frames:
//   interval  the time between drawn frames (Game.frameMs: the loop's own dt) — at the 30 cap it is 33.3 ms, and a
//             16.7 ms entry would be a 30 ↔ 60 judder; the share of intervals within ±4 ms of 1000/cap is the "lock"
//   work      the main-thread ms of one drawn frame: input → fixed steps → updaters → composer.render (GL submit), which
//             must fit the 33 ms budget with room for the GPU and the browser (the p95 is the budget's number)
//   calls / tris  game.lastFrame, median
// `--query=fps=60` measures the uncapped phone for comparison. Writes progress/pine-hollow-fps-<tag>.json.
//
//   node scripts/pine-hollow-fps.mjs --url=http://localhost:4194 --tag=p1
//
// Serve a clean `git archive HEAD` export. One headless Chromium on Metal, muted, closed at the end.
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4194');
const TAG = flag('tag', 'latest');
const EXTRA = flag('query', '');
const CPU = Number(flag('cpu', '4'));
const SETTLE = Number(flag('settle', '6')) * 1000;
const FRAMES = Number(flag('frames', '120'));
/** pine-hollow-drawcalls.mjs's poses (yaw faces (-sin yaw, -cos yaw)) */
const POSES = [
  { id: 'gate', x: 0, z: -200, yaw: 3.1416 },
  { id: 'cabin', x: -14, z: -62, yaw: 3.1416 },
  { id: 'pond', x: -56, z: 95, yaw: 3.1416 },
  { id: 'shore', x: -60, z: 106, yaw: 1.5708 },
  { id: 'hamlet', x: -150, z: -130, yaw: 0 },
  { id: 'lookout', x: 36, z: 208, yaw: 0 },
].filter((p) => flag('poses', '') === '' || flag('poses', '').split(',').includes(p.id));

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  const iphone = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const p0 = POSES[0];
  const q = ['chunk=pine-hollow', 'mute=1', 'skipintro=1', 'nolock=1', 'sw=0', 'tier=phone', 'touch', `x=${p0.x}`, `z=${p0.z}`, `yaw=${p0.yaw}`, EXTRA].filter(Boolean).join('&');
  await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.game), undefined, { timeout: 300000, polling: 500 });
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await sleep(SETTLE);
  // work per drawn frame: from the first input handler to the end of composer.render
  await page.evaluate(() => {
    const g = window.__world.game, st = { t0: 0, work: [] };
    window.__fps = st;
    const first = g.inputs[0];
    if (first !== undefined) g.inputs[0] = (dt) => { st.t0 = performance.now(); first(dt); };
    const render = g.composer.render.bind(g.composer);
    g.composer.render = (dt) => { render(dt); if (st.t0 > 0) st.work.push(performance.now() - st.t0); st.t0 = 0; };
  });
  for (const p of POSES) {
    await page.evaluate((pp) => { const w = window.__world; w.player.spawn(pp.x, pp.z, pp.yaw); w.player.pitch = 0; }, p);
    await sleep(SETTLE);
    const r = await page.evaluate((n) => new Promise((resolve) => {
      const g = window.__world.game, st = window.__fps;
      st.work.length = 0;
      const calls = [], tris = [], interval = [];
      let seen = g.frameI; // the frame-time ring's cursor moves once per drawn frame
      const tick = () => {
        if (g.frameI !== seen) { seen = g.frameI; interval.push(g.frameMs[(g.frameI + g.frameMs.length - 1) % g.frameMs.length]); calls.push(g.lastFrame.calls); tris.push(g.lastFrame.triangles); }
        if (interval.length < n) { requestAnimationFrame(tick); return; }
        const pct = (a, f) => { const s = [...a].sort((x, y) => x - y); return Math.round((s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0) * 10) / 10; };
        const cap = 1000 / 30;
        resolve({
          intervalP50: pct(interval, 0.5), intervalP95: pct(interval, 0.95), intervalMin: pct(interval, 0),
          locked: Math.round((interval.filter((x) => Math.abs(x - cap) < 4).length / interval.length) * 1000) / 10,
          short: interval.filter((x) => x < 25).length,
          workP50: pct(st.work, 0.5), workP95: pct(st.work, 0.95), workMax: pct(st.work, 1),
          calls: pct(calls, 0.5), trisM: Math.round(pct(tris, 0.5) / 1e4) / 100, fps: g.stats.fps,
        });
      };
      requestAnimationFrame(tick);
    }), FRAMES);
    rows.push({ pose: p.id, ...r });
    console.log(`${p.id.padEnd(8)} interval ${r.intervalP50} / ${r.intervalP95} ms (min ${r.intervalMin}, ${r.locked} % at 33.3, ${r.short} short) · work ${r.workP50} / ${r.workP95} ms (max ${r.workMax}) · ${r.calls} calls · ${r.trisM} M`);
  }
  if (errors.length > 0) console.error(`page errors: ${errors.join(' | ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
const out = resolvePath(ROOT, `progress/pine-hollow-fps-${TAG}.json`);
writeFileSync(out, `${JSON.stringify({ tag: TAG, url: URL_BASE, query: EXTRA, cpu: CPU, frames: FRAMES, when: new Date().toISOString(), rows }, null, 2)}\n`);
console.log(`→ progress/pine-hollow-fps-${TAG}.json`);
