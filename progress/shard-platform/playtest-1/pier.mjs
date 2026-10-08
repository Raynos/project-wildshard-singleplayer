#!/usr/bin/env node
// probe: Driftwood's north jetty from the beach, on foot and on the hoverboard (standalone or in the grid)
//   node pier.mjs --url=... --mode=standalone|grid --out=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url'), mode = flag('mode', 'standalone'), OUT = resolve(flag('out', '.'));
mkdirSync(OUT, { recursive: true });
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 300)); });
const out = { url, mode, errors, legs: [] };
try {
  if (mode === 'grid') {
    await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(1500);
    await page.click('.ws-main-grid');
    await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
    await page.evaluate(() => { document.querySelector('.ws-grid-reveal')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  } else {
    await page.goto(`${url}/?chunk=driftwood-isle&tier=phone&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player) && document.querySelector('.ws-load') === null, undefined, { timeout: 300000, polling: 500 });
  }
  await sleep(3000);
  const LEGS = [
    { name: 'walk beach → jetty → socket', hover: false, start: [0, 172], wps: [[0, 186], [0, 192], [0, 215], [0, 245]] },
    { name: 'hover beach → jetty → socket', hover: true, start: [0, 160], wps: [[0, 186], [0, 192], [0, 215], [0, 245]] },
    { name: 'hover beach → jetty, off-centre', hover: true, start: [-1, 165], wps: [[-1, 186], [-1, 200]] },
    { name: 'walk jetty → beach', hover: false, start: [0, 205], wps: [[0, 186], [0, 176]] },
    { name: 'hover jetty → beach', hover: true, start: [0, 215], wps: [[0, 186], [0, 170]] },
  ];
  for (const leg of LEGS) {
    const yaw = Math.atan2(-(leg.wps[0][0] - leg.start[0]), -(leg.wps[0][1] - leg.start[1]));
    await page.evaluate((q) => window.__wildshard.pose(q), { x: leg.start[0], z: leg.start[1], yaw, pitch: -0.05 });
    await sleep(800);
    const res = await page.evaluate(async (leg) => {
      const world = window.__wildshard.world, p = world.player, input = world.game.app.input;
      p.setHover(leg.hover); await new Promise((r) => { setTimeout(r, 400); });
      const trace = [], stuck = []; let wi = 0, elapsed = 0, last = { t: 0, x: p.position.x, z: p.position.z }, maxY = -99;
      await new Promise((resolve) => {
        let stop = () => undefined;
        const timer = setTimeout(() => { input.clear(); stop(); resolve(); }, 30000);
        stop = world.game.watchFrames((dt) => {
          elapsed += dt;
          const x = p.position.x, z = p.position.z, y = p.position.y; maxY = Math.max(maxY, y);
          trace.push([Math.round(elapsed * 100) / 100, Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100]);
          const wp = leg.wps[wi]; if (wp === undefined) { clearTimeout(timer); input.clear(); stop(); resolve(); return; }
          const dx = wp[0] - x, dz = wp[1] - z;
          if (Math.hypot(dx, dz) < 1) { wi++; return; }
          if (Math.hypot(x - last.x, z - last.z) > 0.3) last = { t: elapsed, x, z };
          else if (elapsed - last.t > 2) { stuck.push({ wp: wi, x, y, z }); wi++; last = { t: elapsed, x, z }; return; }
          p.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        });
      });
      p.setHover(false);
      const end = trace[trace.length - 1];
      return { stuck, reached: wi, of: leg.wps.length, end, seconds: Math.round(elapsed * 10) / 10, trace: trace.filter((r, i) => i % 3 === 0) };
    }, leg);
    out.legs.push({ name: leg.name, ...res });
    console.log(leg.name, 'stuck', res.stuck.length, JSON.stringify(res.stuck), 'end', JSON.stringify(res.end), res.seconds + 's');
  }
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); console.log(out.error); }
await browser.close();
writeFileSync(join(OUT, `pier-${mode}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ error: out.error, errors }));
