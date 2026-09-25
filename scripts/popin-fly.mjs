#!/usr/bin/env node
// popin-fly.mjs — E117: fly Explore World's camera in a straight line over Driftwood Isle and capture frames, so pop-in
// (ground cover / props / LOD swaps appearing as the camera moves) can be seen frame to frame and measured.
//
//   node scripts/popin-fly.mjs --base=http://localhost:4173 --tier=phone --out=<dir> [--label=before]
//     [--from=x,y,z --to=x,y,z --yaw=<rad> --pitch=<rad> --frames=6 --steps=30 --q=<extra url params>] [--popcheck=N]
//
// Serve a build (vite preview), not the shared dev server: its HMR reloads mid-run when other agents save files.
// Fly mode: the camera is moved `steps` times from `from` to `to` (a few frames each, so every step renders and the
// ground cover refills as in play); `frames` evenly spaced steps are shot as JPEG. It logs draw calls and triangles per
// step and the game's own frame times parked at the middle. Headless, muted, GPU (ANGLE Metal).
// --popcheck=N: the pop detector. Time frozen (no sway, no clouds); at N points on the path: refill at P, glide 3.9 m on
// (under a refill step), shoot A; force a refill at that same pose (30 m away and back), shoot B. A and B share the
// camera, so any pixel that differs is something the refill popped in or out.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a === undefined ? d : a.slice(n.length + 3); };
const BASE = flag('base', 'http://localhost:4173');
const TIER = flag('tier', 'phone');
const OUT = resolvePath(flag('out', 'popin-out'));
const LABEL = flag('label', 'run');
const FROM = flag('from', '-60,14,-20').split(',').map(Number);
const TO = flag('to', '-60,14,40').split(',').map(Number);
const YAW = Number(flag('yaw', String(Math.PI)));
const PITCH = Number(flag('pitch', '-0.32'));
const FRAMES = Number(flag('frames', '6'));
const STEPS = Number(flag('steps', '30'));
const POPCHECK = Number(flag('popcheck', '0'));
const EXTRA = flag('q', '');
mkdirSync(OUT, { recursive: true });

const round2 = (v) => Math.round(v * 100) / 100;
/** in the page: put the camera at p and let `n` frames render there (FreeCam keeps the position we set) */
const placeFor = (page, p, n) => page.evaluate(async ([x, y, z, k]) => {
  const g = window.__world.game;
  for (let i = 0; i < k; i++) {
    g.camera.position.set(x, y, z);
    await new Promise((resolve) => { requestAnimationFrame(() => { resolve(); }); });
  }
  return { calls: g.lastFrame.calls, tris: g.lastFrame.triangles };
}, [...p, n]);

const phone = TIER === 'phone';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--mute-audio', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], consoleLog = [];
  page.on('pageerror', (e) => { errors.push(e.message.slice(0, 200)); });
  page.on('console', (m) => { consoleLog.push(`${m.type()}: ${m.text().slice(0, 200)}`); if (consoleLog.length > 40) consoleLog.shift(); });
  const cam = [...FROM, YAW, PITCH].map((v) => v.toFixed(3)).join(',');
  const url = `${BASE}/?explore=world&cam=${cam}&mute=1&tier=${TIER}${phone ? '&touch' : ''}${EXTRA === '' ? '' : `&${EXTRA}`}`;
  console.log(url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => Boolean(window.__world?.game), undefined, { timeout: Number(flag('timeout', '240')) * 1000, polling: 1000 });
  } catch (error) {
    await page.screenshot({ path: `${OUT}/${LABEL}-${TIER}-timeout.jpg`, type: 'jpeg', quality: 70 });
    console.log(consoleLog.join('\n'), errors);
    throw error;
  }
  await page.waitForTimeout(8000); // Explore opens, the shaders compile, the island's GLB lands
  await page.addStyleTag({ content: '.ws-x, #hud, .ws-perf, .ws-update { visibility: hidden !important; }' }); // just the world

  if (POPCHECK > 0) {
    await page.evaluate(() => { window.__world.game.clock.getDelta = () => 1e-5; });
    const dir = TO.map((b, i) => b - (FROM[i] ?? 0)), len = Math.hypot(...dir), u = dir.map((d) => d / len);
    for (let k = 0; k < POPCHECK; k++) {
      const P = FROM.map((a, i) => a + ((TO[i] ?? a) - a) * (k / POPCHECK));
      const Q = P.map((a, i) => a + (u[i] ?? 0) * 3.9);
      await placeFor(page, [(P[0] ?? 0) + 30, P[1] ?? 0, P[2] ?? 0], 4); await placeFor(page, P, 4);
      await placeFor(page, Q, 4);
      await page.screenshot({ path: `${OUT}/${LABEL}-${TIER}-pop${k}-a.png` });
      await placeFor(page, [(Q[0] ?? 0) + 30, Q[1] ?? 0, Q[2] ?? 0], 4); await placeFor(page, Q, 4);
      await page.screenshot({ path: `${OUT}/${LABEL}-${TIER}-pop${k}-b.png` });
    }
    console.log(`${LABEL} ${TIER}: popcheck ${POPCHECK} pairs in ${OUT}`);
  } else {
    const shots = Array.from({ length: FRAMES }, (_, i) => Math.round((i / Math.max(1, FRAMES - 1)) * STEPS));
    const log = [];
    for (let s = 0; s <= STEPS; s++) {
      const p = FROM.map((a, i) => a + ((TO[i] ?? a) - a) * (s / STEPS));
      const info = await placeFor(page, p, 5);
      log.push({ step: s, pos: p.map(round2), ...info });
      const k = shots.indexOf(s);
      if (k !== -1) await page.screenshot({ path: `${OUT}/${LABEL}-${TIER}-${String(k).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 82 });
    }
    // steady frame time over 4 s parked at the path's middle (the game's own frameMs ring)
    await placeFor(page, FROM.map((a, i) => (a + (TO[i] ?? a)) / 2), 2);
    const perf = await page.evaluate(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 4000); });
      const g = window.__world.game;
      const ms = Array.from(g.frameMs).filter((v) => v > 0).sort((a, b) => a - b);
      const q = (f) => ms[Math.min(ms.length - 1, Math.floor(ms.length * f))] ?? 0;
      return { p50: q(0.5), p90: q(0.9), calls: g.lastFrame.calls, tris: g.lastFrame.triangles };
    });
    writeFileSync(`${OUT}/${LABEL}-${TIER}.json`, JSON.stringify({ url, tier: TIER, label: LABEL, perf, steps: log, errors }, null, 1));
    const tris = log.map((l) => l.tris), calls = log.map((l) => l.calls);
    console.log(`${LABEL} ${TIER}: tris ${Math.min(...tris)}–${Math.max(...tris)} · calls ${Math.min(...calls)}–${Math.max(...calls)} · parked p50 ${round2(perf.p50)} ms p90 ${round2(perf.p90)} ms`);
    if (errors.length > 0) console.log('errors', errors);
  }
} finally {
  await browser.close();
}
