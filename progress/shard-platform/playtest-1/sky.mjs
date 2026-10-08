#!/usr/bin/env node
// probe: drive a hoverboard at 30 m/s across a cell edge in the grid, sample the frame every frame, record video.
//   node sky.mjs --url=http://127.0.0.1:4401 --leg=template|driftwood --out=<dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url'), leg = flag('leg', 'template'), OUT = resolve(flag('out', '.'));
mkdirSync(OUT, { recursive: true });
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const video = join(OUT, '.video'); rmSync(video, { recursive: true, force: true });
const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, recordVideo: { dir: video, size: PHONE.screen } });
await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 300)); });
const t0 = Date.now();
const out = { url, leg, errors };
try {
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(1500);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await page.evaluate(() => { document.querySelector('.ws-grid-reveal')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  // legs (Driftwood frame metres, yaw 0 faces -z, yaw pi/2 faces -x):
  //  template: road west of template (1,1) at z=555, east into it across x=305
  //  driftwood: road north of Driftwood at x=0, z=290, south into it across z=250
  const LEGS = {
    template: { start: { x: 262, z: 555 }, wps: [{ x: 352, z: 555 }, { x: 258, z: 555 }] },
    driftwood: { start: { x: 0, z: 288 }, wps: [{ x: 0, z: 204 }, { x: 0, z: 292 }] },
  };
  const L = LEGS[leg];
  const yaw0 = Math.atan2(-(L.wps[0].x - L.start.x), -(L.wps[0].z - L.start.z));
  await page.evaluate((q) => window.__wildshard.pose(q), { x: L.start.x, z: L.start.z, yaw: yaw0, pitch: -0.04 });
  await sleep(9000);
  await page.evaluate(() => { const p = window.__wildshard.world.player; p.setHover(true); });
  await sleep(400);
  const vStart = (Date.now() - t0) / 1000;
  const samples = await page.evaluate(async (L) => {
    const api = window.__wildshard, world = api.world, input = world.game.app.input, p = world.player;
    const rows = []; let elapsed = 0, wi = 0;
    await new Promise((resolve) => {
      let stop = () => undefined;
      const timer = setTimeout(() => { input.clear(); stop(); resolve(); }, 25000);
      stop = world.game.watchFrames((dt) => {
        elapsed += dt;
        const s = api.shard.grid.state(), f = s.frame, feet = s.feet;
        rows.push({ t: Math.round(elapsed * 1000) / 1000, x: feet.x, z: feet.z, speed: Math.round(Math.hypot(p.velocity.x, p.velocity.z) * 10) / 10,
          current: s.live?.live?.current ?? null, highway: f?.highway, roadSky: f?.roadSky, weights: f?.weights, air: f?.air, owner: f?.owner, wp: wi });
        const wp = L.wps[wi]; if (wp === undefined) { clearTimeout(timer); input.clear(); stop(); resolve(); return; }
        const dx = wp.x - feet.x, dz = wp.z - feet.z;
        if (Math.hypot(dx, dz) < 3) { wi++; return; }
        const want = Math.atan2(-dx, -dz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        p.yaw += Math.max(-3 * dt, Math.min(3 * dt, d));
        input.setHeld('move.forward', true);
      });
    });
    return rows;
  }, L);
  const vEnd = (Date.now() - t0) / 1000;
  out.samples = samples; out.video = [vStart, vEnd];
  await sleep(800);
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); }
await ctx.close(); await browser.close();
const [file] = readdirSync(video).filter((f) => f.endsWith('.webm'));
if (file !== undefined && out.video) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', out.video[0].toFixed(2), '-t', (out.video[1] - out.video[0]).toFixed(2), '-i', join(video, file), '-vf', 'scale=540:-2', '-an', '-c:v', 'libx264', '-b:v', '900k', '-pix_fmt', 'yuv420p', '-r', '30', join(OUT, `${leg}.mp4`)]);
rmSync(video, { recursive: true, force: true });
writeFileSync(join(OUT, `${leg}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ error: out.error, errors: errors.length, n: out.samples?.length }));
