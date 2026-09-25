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
// --popcheck=N: the pop detector. Time frozen (no sway, no clouds); at N points on the path: refill at P, glide --glide m on
// (3.9: under a near refill step), shoot A; force a refill at that same pose (--away m aside and back, 30), shoot B. A and
// B share the camera, so any pixel that differs is something the refill popped in or out. The far tier's rebuild:
// --glide=7.9 --away=9 --settle=60 (under its 8 m step; its job runs a slice a frame, so let it settle).
// Fly mode also parks at the path's middle and times the GPU (EXT_disjoint_timer_query_webgl2 around the composer, the
// median of ~3 s of frames), then flies the path in real time at --speed m/s (with --cpu=N throttling, ~4 for a phone)
// and reports the frame-time p95 / max and the ground cover's own stats (GroundCover.stats: refill and far-job ms).
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
const SPEED = Number(flag('speed', '12'));
const CPU = Number(flag('cpu', '1'));
const GLIDE = Number(flag('glide', '3.9')), AWAY = Number(flag('away', '30')), SETTLE = Number(flag('settle', '4'));
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
      const Q = P.map((a, i) => a + (u[i] ?? 0) * GLIDE);
      await placeFor(page, [(P[0] ?? 0) + AWAY, P[1] ?? 0, P[2] ?? 0], SETTLE); await placeFor(page, P, SETTLE);
      await placeFor(page, Q, SETTLE);
      await page.screenshot({ path: `${OUT}/${LABEL}-${TIER}-pop${k}-a.png` });
      await placeFor(page, [(Q[0] ?? 0) + AWAY, Q[1] ?? 0, Q[2] ?? 0], SETTLE); await placeFor(page, Q, SETTLE);
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
    // parked at the path's middle: the frame's GPU time (timer queries round the composer, as E123 measured shadows)
    await placeFor(page, FROM.map((a, i) => (a + (TO[i] ?? a)) / 2), 30);
    const perf = await page.evaluate(async () => {
      const g = window.__world.game, gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const samples = [], pending = [];
      const composer = g.composer, orig = composer.render.bind(composer);
      composer.render = (dt) => {
        if (ext !== null) for (let q = pending[0]; q !== undefined; q = pending[0]) {
          if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
          pending.shift();
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
        }
        if (ext && pending.length < 4) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig(dt); gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); } else orig(dt);
      };
      await new Promise((resolve) => { setTimeout(resolve, 3000); });
      composer.render = orig;
      samples.sort((a, b) => a - b);
      return { gpuMs: samples[Math.floor(samples.length / 2)] ?? -1, gpuN: samples.length, calls: g.lastFrame.calls, tris: g.lastFrame.triangles };
    });
    // the path flown in real time at SPEED m/s: frame times (CPU-throttled if asked) and the cover's own costs
    await placeFor(page, FROM, 90); // settle at the start: the jump there is a teleport, not flight
    const cdp = CPU > 1 ? await ctx.newCDPSession(page) : null;
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const flight = await page.evaluate(async ([from, to, speed]) => {
      const g = window.__world.game;
      const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]), T = (len / speed) * 1000;
      let cover = null;
      g.scene.traverse((o) => { if (o.name === 'ground-cover') cover = o.userData.stats ?? null; });
      const dts = [], farJob = [], near = [];
      const t0 = performance.now();
      let last = t0;
      await new Promise((resolve) => {
        const tick = () => {
          const now = performance.now(), u = Math.min(1, (now - t0) / T);
          dts.push(now - last); last = now;
          g.camera.position.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u);
          if (cover) { farJob.push(cover.farJobMs); near.push(cover.nearRefillMs); }
          if (u < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      dts.shift(); dts.sort((a, b) => a - b);
      const q = (f) => dts[Math.min(dts.length - 1, Math.floor(dts.length * f))] ?? 0;
      return { frames: dts.length, p50: q(0.5), p95: q(0.95), max: dts.at(-1) ?? 0, cover, nearRefillMsMax: Math.max(0, ...near) };
    }, [FROM, TO, SPEED]);
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    perf.flight = flight;
    writeFileSync(`${OUT}/${LABEL}-${TIER}.json`, JSON.stringify({ url, tier: TIER, label: LABEL, perf, steps: log, errors }, null, 1));
    const tris = log.map((l) => l.tris), calls = log.map((l) => l.calls);
    console.log(`${LABEL} ${TIER}: tris ${Math.min(...tris)}–${Math.max(...tris)} · calls ${Math.min(...calls)}–${Math.max(...calls)} · GPU ${round2(perf.gpuMs)} ms (n ${perf.gpuN})`);
    console.log(`  flight ${SPEED} m/s cpu×${CPU}: frame p50 ${round2(flight.p50)} p95 ${round2(flight.p95)} max ${round2(flight.max)} ms · near refill max ${round2(flight.nearRefillMsMax)} ms · cover ${JSON.stringify(flight.cover)}`);
    if (errors.length > 0) console.log('errors', errors);
  }
} finally {
  await browser.close();
}
